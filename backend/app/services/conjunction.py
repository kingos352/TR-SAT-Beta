import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from functools import lru_cache
from typing import List, Tuple, Dict, Any, Optional
import numpy as np
from sqlalchemy.orm import Session

# GPU acceleration: drop-in NumPy replacement running on CUDA cores.
# Install: pip install cupy-cuda12x   (RTX 40xx / 30xx, CUDA 12.x)
#          pip install cupy-cuda11x   (older cards, CUDA 11.x)
try:
    import cupy as _cp
    _cp.cuda.Device(0).use()
    _GPU_AVAILABLE = True
except Exception:
    _cp = None
    _GPU_AVAILABLE = False

from sqlalchemy import func
from app.models.rso import TLERecord, RSOCatalog
from app.services.catalog_lookup import get_latest_tle_for_norad
from app.schemas.conjunction import (
    ConjunctionScreenRequest,
    ConjunctionResult,
    ConjunctionScreenResponse,
    DebrisWatchRequest,
)
from app.services.astrodynamics import build_satellite_from_tle, tle_age_days, ts
from app.services import collision_probability as cp
from sgp4.api import Satrec, jday

# Coarse-screen distance gate (km): a pair is only refined if it gets this close.
COARSE_SCREEN_KM = 200.0
# Radial-band overlap pad (km) for the apogee/perigee pre-filter. Must be >=
# COARSE_SCREEN_KM so the filter never discards a pair the coarse stage would flag.
APOGEE_PERIGEE_PAD_KM = COARSE_SCREEN_KM + 50.0
MU_EARTH_KM3_S2 = 398600.4418

DISCLAIMER = (
    "Estimated conjunction assessment. SGP4 propagation gives geometric miss distance and "
    "relative velocity. Public TLE/GP data has no covariance, so the probability of collision (Pc) "
    "is a HEURISTIC estimate: position uncertainty is synthesised from time since TLE epoch (RTN model) "
    "and the hard-body radius is inferred from object type. Pc and risk levels are indicative only and "
    "must not be used as an operational CDM-grade product."
)


def get_all_latest_tles(db: Session) -> Dict[int, TLERecord]:
    """Retrieve the latest TLE per object using a DB-side subquery.
    Avoids loading all historical TLE rows into Python memory."""
    latest_subq = (
        db.query(TLERecord.norad_id, func.max(TLERecord.epoch).label("max_epoch"))
        .group_by(TLERecord.norad_id)
        .subquery()
    )
    tles = (
        db.query(TLERecord)
        .join(latest_subq, (TLERecord.norad_id == latest_subq.c.norad_id) &
                           (TLERecord.epoch == latest_subq.c.max_epoch))
        .all()
    )
    return {t.norad_id: t for t in tles}


def _load_meta(db: Session, mode: str, norad_ids) -> Dict[int, RSOCatalog]:
    """Map norad_id -> RSOCatalog (object_type, name). Loads all rows for
    catalog/debris modes, a filtered set for selected mode."""
    if mode == "selected_vs_selected":
        rows = db.query(RSOCatalog).filter(RSOCatalog.norad_id.in_(list(norad_ids))).all()
    else:
        rows = db.query(RSOCatalog).all()
    return {r.norad_id: r for r in rows}


def ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


@lru_cache(maxsize=512)
def classify_severity(miss_distance_km: float) -> str:
    """Classify conjunction severity from miss distance (kept for continuity)."""
    if miss_distance_km < 1.0:
        return "CRITICAL_CANDIDATE"
    elif miss_distance_km < 10.0:
        return "CLOSE"
    elif miss_distance_km < 50.0:
        return "WATCH"
    else:
        return "INFO"


# Cap at 4 workers: diminishing returns beyond that for short-lived refinement tasks,
# and we don't want to saturate a low-core "average system" host.
_REFINE_WORKERS = min(os.cpu_count() or 2, 4)


def _parallel_refine(
    hits: List[tuple],
    start_t: datetime,
    end_t: datetime,
    coarse_step_s: float,
    refine_step_s: float,
    hbr_override: Optional[float],
    sigma_override: Optional[float],
) -> List[ConjunctionResult]:
    """Refine coarse-screened pairs concurrently.
    Each hit tuple: (pid, p_sat, p_tle, p_meta, sid, s_sat, s_tle, s_meta, center_time).
    Falls back to sequential execution when there is only one hit or on single-core hosts."""
    if not hits:
        return []

    def _safe(args):
        try:
            return _refine_pair(*args)
        except Exception:
            return None

    args_list = [
        (*hit, start_t, end_t, coarse_step_s, refine_step_s, hbr_override, sigma_override)
        for hit in hits
    ]

    if len(args_list) == 1 or _REFINE_WORKERS <= 1:
        return [r for a in args_list if (r := _safe(a)) is not None]

    with ThreadPoolExecutor(max_workers=_REFINE_WORKERS) as pool:
        futures = [pool.submit(_safe, a) for a in args_list]
        return [r for f in as_completed(futures) if (r := f.result()) is not None]


def _orbital_radii_km(tle: TLERecord) -> Optional[Tuple[float, float]]:
    """(perigee_radius, apogee_radius) in km from mean motion + eccentricity, or
    None when the elements are unavailable (then the pre-filter is skipped)."""
    n = tle.mean_motion_rev_per_day
    e = tle.eccentricity
    if not n or n <= 0 or e is None:
        return None
    n_rad_s = n * 2.0 * np.pi / 86400.0
    a = (MU_EARTH_KM3_S2 / (n_rad_s ** 2)) ** (1.0 / 3.0)
    return a * (1.0 - e), a * (1.0 + e)


def _radial_bands_overlap(
    p_radii: Optional[Tuple[float, float]],
    s_radii: Optional[Tuple[float, float]],
    pad_km: float,
) -> bool:
    """True if the two geocentric radial shells come within pad_km of each other.
    Unknown elements -> always True (do not discard)."""
    if p_radii is None or s_radii is None:
        return True
    p_peri, p_apo = p_radii
    s_peri, s_apo = s_radii
    if p_peri - s_apo > pad_km:
        return False
    if s_peri - p_apo > pad_km:
        return False
    return True


def _refine_tca(refine_times: List[datetime], dist_ref: np.ndarray, refine_step_s: float) -> datetime:
    """Sub-second TCA via 3-point parabolic interpolation around the grid minimum."""
    i = int(np.argmin(dist_ref))
    if 0 < i < len(dist_ref) - 1:
        y0, y1, y2 = float(dist_ref[i - 1]), float(dist_ref[i]), float(dist_ref[i + 1])
        denom = y0 - 2.0 * y1 + y2
        if abs(denom) > 1e-12:
            delta = 0.5 * (y0 - y2) / denom            # fraction of a step, in [-1, 1]
            delta = max(-1.0, min(1.0, delta))
            return refine_times[i] + timedelta(seconds=delta * refine_step_s)
    return refine_times[i]


def _refine_pair(
    pid, p_sat, p_tle, p_meta,
    sid, s_sat, s_tle, s_meta,
    refine_center, start_t, end_t,
    coarse_step_s, refine_step_s,
    hbr_override, sigma_override,
) -> Optional[ConjunctionResult]:
    """Refine one coarse-screened pair to sub-second TCA and assess collision (Pc)."""
    refine_start = max(start_t, refine_center - timedelta(seconds=coarse_step_s))
    refine_end = min(end_t, refine_center + timedelta(seconds=coarse_step_s))
    ref_steps = int((refine_end - refine_start).total_seconds() / refine_step_s) + 1
    refine_times = [refine_start + timedelta(seconds=i * refine_step_s) for i in range(ref_steps)]
    if not refine_times:
        return None

    t_refine = ts.from_datetimes(refine_times)
    p_pos_ref = p_sat.at(t_refine).position.km
    s_pos_ref = s_sat.at(t_refine).position.km
    dist_ref = np.linalg.norm(p_pos_ref - s_pos_ref, axis=0)
    tca = _refine_tca(refine_times, dist_ref, refine_step_s)

    tca_t = ts.from_datetime(tca)
    p_tca = p_sat.at(tca_t)
    s_tca = s_sat.at(tca_t)
    p_p = np.array([float(x) for x in p_tca.position.km])
    s_p = np.array([float(x) for x in s_tca.position.km])
    p_v = np.array([float(x) for x in p_tca.velocity.km_per_s])
    s_v = np.array([float(x) for x in s_tca.velocity.km_per_s])

    tca_dist = float(np.linalg.norm(p_p - s_p))
    p_age = tle_age_days(p_tle.line1, tca)
    s_age = tle_age_days(s_tle.line1, tca)

    assessment = cp.estimate_collision(
        p_p, p_v, s_p, s_v,
        p_days_since_epoch=p_age if p_age is not None else 0.0,
        s_days_since_epoch=s_age if s_age is not None else 0.0,
        p_object_type=p_meta.object_type if p_meta else None,
        s_object_type=s_meta.object_type if s_meta else None,
        p_name=p_meta.name if p_meta else p_tle.name,
        s_name=s_meta.name if s_meta else s_tle.name,
        hbr_override_m=hbr_override,
        sigma_intrack_override_km=sigma_override,
    )

    return ConjunctionResult(
        primary_norad_id=pid,
        secondary_norad_id=sid,
        tca_time=tca,
        miss_distance_km=tca_dist,
        severity=classify_severity(tca_dist),
        primary_position_km=[float(x) for x in p_p],
        secondary_position_km=[float(x) for x in s_p],
        primary_velocity_km_per_s=[float(x) for x in p_v],
        secondary_velocity_km_per_s=[float(x) for x in s_v],
        relative_speed_km_per_s=assessment["relative_speed_km_per_s"],
        collision_probability=assessment["collision_probability"],
        max_collision_probability=assessment["max_collision_probability"],
        hard_body_radius_m=assessment["hard_body_radius_m"],
        risk_level=assessment["risk_level"],
        miss_x_km=assessment["miss_x_km"],
        miss_y_km=assessment["miss_y_km"],
        covariance_2d_km2=assessment["covariance_2d_km2"],
        primary_object_type=p_meta.object_type if p_meta else None,
        secondary_object_type=s_meta.object_type if s_meta else None,
        primary_tle_age_days=p_age,
        secondary_tle_age_days=s_age,
    )


def screen_conjunctions(db: Session, request: ConjunctionScreenRequest) -> ConjunctionScreenResponse:
    start_cpu = time.perf_counter()

    start_t = ensure_utc(request.start_time)
    end_t = ensure_utc(request.end_time)

    # 1. Gather TLEs
    primaries: Dict[int, TLERecord] = {}
    secondaries: Dict[int, TLERecord] = {}

    if request.mode == "selected_vs_selected":
        for pid in request.primary_norad_ids:
            tle = get_latest_tle_for_norad(db, pid)
            if tle:
                primaries[pid] = tle
        if request.secondary_norad_ids:
            for sid in request.secondary_norad_ids:
                tle = get_latest_tle_for_norad(db, sid)
                if tle:
                    secondaries[sid] = tle
        meta = _load_meta(db, request.mode, set(primaries) | set(secondaries))
    else:
        all_tles = get_all_latest_tles(db)
        meta = _load_meta(db, request.mode, None)
        for pid in request.primary_norad_ids:
            if pid in all_tles:
                primaries[pid] = all_tles[pid]

        allowed_types = {"DEBRIS"}
        if request.include_rocket_bodies:
            allowed_types.add("ROCKET_BODY")

        for sid, tle in all_tles.items():
            if sid in primaries:
                continue
            if request.mode == "primary_vs_debris":
                obj = meta.get(sid)
                if not obj or obj.object_type not in allowed_types:
                    continue
            secondaries[sid] = tle

    # 2. Build Satellites
    primary_sats = {pid: build_satellite_from_tle(None, tle.line1, tle.line2) for pid, tle in primaries.items()}
    secondary_sats = {sid: build_satellite_from_tle(None, tle.line1, tle.line2) for sid, tle in secondaries.items()}

    # Pre-compute radial bands for the apogee/perigee filter.
    p_radii = {pid: _orbital_radii_km(tle) for pid, tle in primaries.items()}
    s_radii = {sid: _orbital_radii_km(tle) for sid, tle in secondaries.items()}

    # 3. Create coarse time grid
    duration_s = (end_t - start_t).total_seconds()
    coarse_steps = int(duration_s / request.coarse_step_seconds) + 1
    coarse_times = [start_t + timedelta(seconds=i * request.coarse_step_seconds) for i in range(coarse_steps)]
    t_coarse = ts.from_datetimes(coarse_times)

    coarse_hits: List[tuple] = []
    pairs_evaluated = 0

    # 4. Coarse screen — collect close-approach pairs without refining yet
    for pid, p_sat in primary_sats.items():
        p_pos = p_sat.at(t_coarse).position.km  # (3, N)
        p_tle = primaries[pid]

        for sid, s_sat in secondary_sats.items():
            if pid == sid:
                continue

            # Cheap apogee/perigee pre-filter before any secondary propagation.
            if not _radial_bands_overlap(p_radii.get(pid), s_radii.get(sid), APOGEE_PERIGEE_PAD_KM):
                continue

            s_pos = s_sat.at(t_coarse).position.km
            distances = np.linalg.norm(p_pos - s_pos, axis=0)
            min_dist_idx = int(np.argmin(distances))
            pairs_evaluated += 1

            if distances[min_dist_idx] < COARSE_SCREEN_KM:
                coarse_hits.append((
                    pid, p_sat, p_tle, meta.get(pid),
                    sid, s_sat, secondaries[sid], meta.get(sid),
                    coarse_times[min_dist_idx],
                ))

            if pairs_evaluated >= request.max_candidates:
                break
        if pairs_evaluated >= request.max_candidates:
            break

    # 5. Parallel refinement of close-approach candidates
    results = _parallel_refine(
        coarse_hits, start_t, end_t,
        request.coarse_step_seconds, request.refine_step_seconds,
        request.hard_body_radius_m, request.sigma_intrack_km,
    )

    # Sort by estimated Pc (desc), then by miss distance (asc); cap at 100.
    results.sort(key=lambda x: (-(x.collision_probability or 0.0), x.miss_distance_km))
    results = results[:100]

    computation_time_ms = (time.perf_counter() - start_cpu) * 1000.0

    return ConjunctionScreenResponse(
        disclaimer=DISCLAIMER,
        mode=request.mode,
        results=results,
        computation_time_ms=computation_time_ms,
    )


def screen_catalog_debris(db: Session, request: DebrisWatchRequest) -> ConjunctionScreenResponse:
    """
    Catalog-wide, all-vs-all debris conjunction screen. Runs with no user-selected
    object: it propagates every debris object (optionally rocket bodies) over a
    coarse grid, finds the closest approaching pairs by vectorised distance, then
    refines the top candidates to sub-second TCA and estimates Pc. Bounded by
    max_objects (perigee-ascending — lowest, most collision-relevant orbits first)
    and max_candidates so it stays interactive.
    """
    start_cpu = time.perf_counter()
    start_t = ensure_utc(request.start_time)
    end_t = ensure_utc(request.end_time)

    allowed_types = {"DEBRIS"}
    if request.include_rocket_bodies:
        allowed_types.add("ROCKET_BODY")

    all_tles = get_all_latest_tles(db)
    meta = {r.norad_id: r for r in db.query(RSOCatalog).filter(RSOCatalog.object_type.in_(allowed_types)).all()}

    # Build the working set: objects of the right type that have a TLE and usable
    # orbital elements, sorted by perigee radius ascending (LEO/decaying first).
    working = []
    for nid, m in meta.items():
        tle = all_tles.get(nid)
        if not tle:
            continue
        radii = _orbital_radii_km(tle)
        perigee = radii[0] if radii else float("inf")
        working.append((perigee, nid, tle, m, radii))
    working.sort(key=lambda w: w[0])
    working = working[:request.max_objects]

    M = len(working)
    if M < 2:
        return ConjunctionScreenResponse(
            disclaimer=DISCLAIMER, mode="catalog_debris_self", results=[],
            computation_time_ms=(time.perf_counter() - start_cpu) * 1000.0,
        )

    # Coarse time grid.
    duration_s = (end_t - start_t).total_seconds()
    coarse_steps = int(duration_s / request.coarse_step_seconds) + 1
    coarse_times = [start_t + timedelta(seconds=i * request.coarse_step_seconds) for i in range(coarse_steps)]
    N = len(coarse_times)

    # Memory safety: cap positions array at ~12 MB (500K float64 elements = M*3*N).
    # If M*N exceeds budget, truncate the time grid rather than OOM on large catalogs.
    _MAX_POSITION_ELEMENTS = 500_000
    if M * N > _MAX_POSITION_ELEMENTS:
        N = max(10, _MAX_POSITION_ELEMENTS // M)
        coarse_times = coarse_times[:N]

    # Coarse positions via sgp4's C array propagator (TEME frame). Distances are
    # frame-independent, so TEME is fine for screening; the refine step below
    # re-propagates the few candidates with Skyfield for GCRF state + velocity.
    jds = np.empty(N)
    frs = np.empty(N)
    for idx, t_dt in enumerate(coarse_times):
        jd, fr = jday(t_dt.year, t_dt.month, t_dt.day, t_dt.hour, t_dt.minute,
                      t_dt.second + t_dt.microsecond * 1e-6)
        jds[idx] = jd
        frs[idx] = fr

    sats = []
    positions = np.empty((M, 3, N), dtype=float)
    apogee = np.array([(w[4][1] if w[4] else np.inf) for w in working])
    perigee = np.array([(w[4][0] if w[4] else -np.inf) for w in working])
    for i, w in enumerate(working):
        tle = w[2]
        sats.append(build_satellite_from_tle(None, tle.line1, tle.line2))
        satrec = Satrec.twoline2rv(tle.line1, tle.line2)
        err, r, _ = satrec.sgp4_array(jds, frs)   # r: (N, 3) km, TEME
        positions[i] = np.inf if np.any(err) else r.T

    # Vectorised pairwise coarse screen.
    # When CuPy is available (NVIDIA GPU), transfer the position arrays to GPU VRAM
    # and run all element-wise distance ops on CUDA cores — 20-50x faster than CPU
    # for large catalogs. Close-pair results (typically 0-5 per row) are transferred
    # back to CPU immediately so the Python candidate list stays on CPU throughout.
    if _GPU_AVAILABLE:
        _xp = _cp
        _pos = _cp.asarray(positions)
        _apo = _cp.asarray(apogee)
        _peri = _cp.asarray(perigee)
    else:
        _xp = np
        _pos = positions
        _apo = apogee
        _peri = perigee

    screen_sq = COARSE_SCREEN_KM ** 2
    candidates = []  # (coarse_min_km, i, j, k_index)
    for i in range(M - 1):
        rest = _pos[i + 1:]
        dx = rest[:, 0, :] - _pos[i, 0]
        dy = rest[:, 1, :] - _pos[i, 1]
        dz = rest[:, 2, :] - _pos[i, 2]
        dsq = dx * dx + dy * dy + dz * dz
        kmin = dsq.argmin(axis=1)
        dsq_min = dsq[_xp.arange(dsq.shape[0]), kmin]
        band_ok = (_peri[i] - _apo[i + 1:] <= APOGEE_PERIGEE_PAD_KM) & \
                  (_peri[i + 1:] - _apo[i] <= APOGEE_PERIGEE_PAD_KM)
        close = _xp.nonzero((dsq_min < screen_sq) & band_ok)[0]
        if len(close) == 0:
            continue
        # Minimal CPU transfer: pull only the close-pair scalars (rarely more than a handful).
        c_np = close.get() if _GPU_AVAILABLE else np.asarray(close)
        d_np = dsq_min[close].get() if _GPU_AVAILABLE else np.asarray(dsq_min[close])
        k_np = kmin[close].get() if _GPU_AVAILABLE else np.asarray(kmin[close])
        for idx in range(len(c_np)):
            candidates.append((float(np.sqrt(float(d_np[idx]))), i, i + 1 + int(c_np[idx]), int(k_np[idx])))

    # Refine only the closest coarse candidates for full TCA + Pc — in parallel.
    candidates.sort(key=lambda c: c[0])
    debris_hits = [
        (working[i][1], sats[i], working[i][2], working[i][3],
         working[j][1], sats[j], working[j][2], working[j][3],
         coarse_times[k])
        for _, i, j, k in candidates[:request.max_candidates]
    ]
    results = _parallel_refine(
        debris_hits, start_t, end_t,
        request.coarse_step_seconds, request.refine_step_seconds,
        request.hard_body_radius_m, request.sigma_intrack_km,
    )

    results.sort(key=lambda x: (-(x.collision_probability or 0.0), x.miss_distance_km))
    results = results[:100]

    return ConjunctionScreenResponse(
        disclaimer=DISCLAIMER,
        mode="catalog_debris_self",
        results=results,
        computation_time_ms=(time.perf_counter() - start_cpu) * 1000.0,
    )
