"""
Professional conjunction screening pipeline.

Stages:
  1. Hoots coarse filter       — apogee/perigee overlap
  2. Coarse time scan          — 60 s step, SGP4 vs numerical propagator
  3. Interval isolation        — find intervals where dist < threshold
  4. TCA refinement            — Brent's method on scalar distance function
  5. RTN frame analysis        — miss distance decomposition
  6. Pc calculation            — Foster/Chan 2D method
"""

from __future__ import annotations

import math
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Tuple

import numpy as np
from scipy.optimize import brentq
from scipy.stats import chi2
from sqlalchemy.orm import Session

from app.models.rso import RSOCatalog, TLERecord
from app.models.user_satellite import UserSatellite
from app.services.numerical_propagator import propagate_to_times, state_at_time
from app.services.astrodynamics import build_satellite_from_tle

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
GM = 398600.4418
R_E = 6378.137
TWO_PI = 2.0 * math.pi


# ---------------------------------------------------------------------------
# Orbital element helpers (from TLE line2)
# ---------------------------------------------------------------------------

def _mean_motion_rads(line2: str) -> float:
    """Mean motion from TLE line 2 in rad/s."""
    n_revday = float(line2[52:63])
    return n_revday * TWO_PI / 86400.0


def _semi_major_axis(n_rads: float) -> float:
    """Semi-major axis in km from mean motion (rad/s)."""
    return (GM / n_rads ** 2) ** (1.0 / 3.0)


def _eccentricity(line2: str) -> float:
    return float("0." + line2[26:33].strip())


def _inclination_rad(line2: str) -> float:
    return math.radians(float(line2[8:16]))


# ---------------------------------------------------------------------------
# 1. Hoots coarse filter
# ---------------------------------------------------------------------------

def _hoots_filter(
    user_alt_min: float,
    user_alt_max: float,
    catalog_objects: List[Tuple[RSOCatalog, TLERecord]],
    margin_km: float = 50.0,
) -> List[Tuple[RSOCatalog, TLERecord]]:
    """
    Reject objects whose perigee/apogee bands do not overlap with the user
    satellite's altitude band (+ margin_km).
    """
    passing = []
    for rso, tle in catalog_objects:
        try:
            n = _mean_motion_rads(tle.line2)
            a = _semi_major_axis(n)
            e = _eccentricity(tle.line2)
            alt_min = a * (1.0 - e) - R_E
            alt_max = a * (1.0 + e) - R_E
            if alt_max + margin_km >= user_alt_min and alt_min - margin_km <= user_alt_max:
                passing.append((rso, tle))
        except Exception:
            continue
    return passing


# ---------------------------------------------------------------------------
# 2 & 3. Coarse scan + interval isolation
# ---------------------------------------------------------------------------

def _sgp4_position(satellite, t_sec: float, epoch: datetime) -> Optional[np.ndarray]:
    """Get SGP4 position at epoch + t_sec using Skyfield."""
    from skyfield.api import load
    ts = load.timescale()
    t = ts.from_datetime(epoch + timedelta(seconds=t_sec))
    try:
        geo = satellite.at(t)
        pos = geo.position.km
        return np.array([float(pos[0]), float(pos[1]), float(pos[2])])
    except Exception:
        return None


def _coarse_scan(
    user_sat: UserSatellite,
    catalog_objects: List[Tuple[RSOCatalog, TLERecord]],
    epoch: datetime,
    window_days: float,
    coarse_step_s: float = 60.0,
    threshold_km: float = 100.0,
) -> List[Tuple[Tuple[RSOCatalog, TLERecord], List[Tuple[float, float]]]]:
    """
    Scan the time window at coarse_step_s intervals.
    Returns list of (catalog_obj, [(t_start, t_end), ...]) where
    distance < threshold_km in that interval.
    """
    r0 = np.array([user_sat.pos_x_km, user_sat.pos_y_km, user_sat.pos_z_km])
    v0 = np.array([user_sat.vel_x_kms, user_sat.vel_y_kms, user_sat.vel_z_kms])

    window_s = window_days * 86400.0
    times = np.arange(0.0, window_s + coarse_step_s, coarse_step_s)

    # Propagate user satellite at all coarse times
    user_states = propagate_to_times(
        r0, v0, epoch, list(times),
        cd=user_sat.cd,
        drag_area_m2=user_sat.drag_area_m2,
        srp_area_m2=user_sat.srp_area_m2,
        mass_kg=user_sat.mass_kg, cr=user_sat.cr,
        mission_type=user_sat.mission_type,
    )
    user_pos = user_states[:, :3]  # (N, 3)

    results = []
    for rso, tle in catalog_objects:
        try:
            cat_sat = build_satellite_from_tle(rso.name, tle.line1, tle.line2)
        except Exception:
            continue

        distances = []
        for i, t_sec in enumerate(times):
            cat_r = _sgp4_position(cat_sat, t_sec, epoch)
            if cat_r is None:
                distances.append(1e9)
            else:
                distances.append(float(np.linalg.norm(user_pos[i] - cat_r)))

        # Detect intervals where distance dips below threshold
        intervals = []
        below = False
        t_start = 0.0
        for i, d in enumerate(distances):
            if d < threshold_km and not below:
                below = True
                t_start = max(0.0, times[i] - coarse_step_s)
            elif d >= threshold_km and below:
                below = False
                intervals.append((t_start, min(times[i], window_s)))
        if below:
            intervals.append((t_start, window_s))

        if intervals:
            results.append(((rso, tle), intervals))

    return results


# ---------------------------------------------------------------------------
# 4. TCA refinement — Brent's method
# ---------------------------------------------------------------------------

def _distance_func(
    t_sec: float,
    user_sat: UserSatellite,
    epoch: datetime,
    cat_sat,
) -> float:
    r0 = np.array([user_sat.pos_x_km, user_sat.pos_y_km, user_sat.pos_z_km])
    v0 = np.array([user_sat.vel_x_kms, user_sat.vel_y_kms, user_sat.vel_z_kms])
    r_user, _ = state_at_time(
        r0, v0, epoch, t_sec,
        cd=user_sat.cd,
        drag_area_m2=user_sat.drag_area_m2,
        srp_area_m2=user_sat.srp_area_m2,
        mass_kg=user_sat.mass_kg, cr=user_sat.cr,
        mission_type=user_sat.mission_type,
    )
    r_cat = _sgp4_position(cat_sat, t_sec, epoch)
    if r_cat is None:
        return 1e9
    return float(np.linalg.norm(r_user - r_cat))


def _find_tca(
    user_sat: UserSatellite,
    epoch: datetime,
    cat_sat,
    t_start: float,
    t_end: float,
    fine_step_s: float = 5.0,
    brent_tol: float = 0.1,
) -> Optional[Tuple[float, float]]:
    """
    Find TCA within [t_start, t_end].
    Returns (tca_seconds, miss_distance_km) or None.
    """
    # Fine-resolution scan to find local minimum
    times_fine = np.arange(t_start, t_end + fine_step_s, fine_step_s)
    dists = [_distance_func(t, user_sat, epoch, cat_sat) for t in times_fine]

    if not dists:
        return None

    # Find index of minimum
    min_idx = int(np.argmin(dists))

    # Bracket the minimum
    i0 = max(0, min_idx - 1)
    i1 = min(len(times_fine) - 1, min_idx + 1)
    ta, tb = times_fine[i0], times_fine[i1]

    if tb - ta < brent_tol:
        return times_fine[min_idx], dists[min_idx]

    # Use Brent to minimize distance (minimize by finding zero of derivative)
    # We can't directly use Brent on a non-monotone function; use golden section
    from scipy.optimize import minimize_scalar
    result = minimize_scalar(
        lambda t: _distance_func(t, user_sat, epoch, cat_sat),
        bounds=(ta, tb),
        method="bounded",
        options={"xatol": brent_tol},
    )

    if result.success:
        return float(result.x), float(result.fun)
    return times_fine[min_idx], dists[min_idx]


# ---------------------------------------------------------------------------
# 5. RTN frame analysis
# ---------------------------------------------------------------------------

def _to_rtn_frame(
    r1: np.ndarray, v1: np.ndarray,
    r2: np.ndarray, v2: np.ndarray,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Compute RTN rotation matrix and relative position/velocity at TCA.
    Returns (R_mat_3x3, dr_rtn, dv_rtn).
    R_mat columns: [R̂, T̂, N̂]
    """
    r_hat = r1 / np.linalg.norm(r1)
    h = np.cross(r1, v1)
    n_hat = h / np.linalg.norm(h)
    t_hat = np.cross(n_hat, r_hat)

    R_mat = np.column_stack([r_hat, t_hat, n_hat])  # ECI→RTN: R_mat.T @ vec

    dr = r2 - r1
    dv = v2 - v1

    dr_rtn = R_mat.T @ dr
    dv_rtn = R_mat.T @ dv

    return R_mat, dr_rtn, dv_rtn


# ---------------------------------------------------------------------------
# 6. Probability of Collision — Foster/Chan 2D method
# ---------------------------------------------------------------------------

def _pc_foster_chan(
    dr_rtn: np.ndarray,
    C_combined_rtn: np.ndarray,
    hard_body_radius_m: float,
) -> float:
    """
    2D Foster/Chan collision probability.

    Projects relative position and combined covariance onto the collision
    plane (T-N plane), then numerically integrates the bivariate Gaussian
    over a disk of radius R = hard_body_radius (km).

    Returns Pc in [0, 1].
    """
    R_hbr = hard_body_radius_m / 1000.0  # convert m → km

    # Project to T-N (collision) plane: indices 1 and 2 in RTN
    mu = dr_rtn[1:3]            # [dT, dN]
    C2 = C_combined_rtn[1:3, 1:3]  # 2×2 covariance in collision plane

    try:
        det = float(np.linalg.det(C2))
        if det <= 0:
            return 0.0
        C2_inv = np.linalg.inv(C2)
    except np.linalg.LinAlgError:
        return 0.0

    # Normalisation
    norm_factor = 1.0 / (2.0 * math.pi * math.sqrt(det))

    # Numerical integration over disk |x| ≤ R_hbr
    # Use polar coordinates with Gauss-Legendre quadrature
    N_r, N_theta = 30, 60
    r_nodes, r_weights = np.polynomial.legendre.leggauss(N_r)
    # Map r ∈ [-1,1] → [0, R_hbr]
    r_vals = 0.5 * R_hbr * (r_nodes + 1.0)
    r_wts = 0.5 * R_hbr * r_weights

    theta_vals = np.linspace(0.0, 2.0 * math.pi, N_theta, endpoint=False)
    dtheta = 2.0 * math.pi / N_theta

    Pc = 0.0
    for ri, rw in zip(r_vals, r_wts):
        if ri <= 0:
            continue
        for theta in theta_vals:
            x = np.array([ri * math.cos(theta), ri * math.sin(theta)])
            dx = x - mu
            exponent = -0.5 * float(dx @ C2_inv @ dx)
            f = norm_factor * math.exp(exponent)
            Pc += f * ri * rw * dtheta

    return max(0.0, min(1.0, Pc))


def _default_catalog_covariance_rtn() -> np.ndarray:
    """
    Default 6×6 covariance (RTN) for catalog objects without covariance data.
    Conservative estimate based on TLE accuracy.
    σR=0.2 km, σT=2 km, σN=0.2 km
    """
    sigmas = np.array([0.2, 2.0, 0.2, 2e-4, 2e-3, 2e-4])
    return np.diag(sigmas ** 2)


# ---------------------------------------------------------------------------
# Risk classification
# ---------------------------------------------------------------------------

def _risk_level(Pc: float) -> str:
    if Pc >= 1e-3:
        return "CRITICAL"
    elif Pc >= 1e-4:
        return "HIGH"
    elif Pc >= 1e-5:
        return "MEDIUM"
    else:
        return "LOW"


# ---------------------------------------------------------------------------
# Main screening function
# ---------------------------------------------------------------------------

def run_conjunction_screening(
    user_sat: UserSatellite,
    db: Session,
    window_days: float = 3.0,
    catalog_filter: Optional[str] = None,   # None=ALL, "DEBRIS", "PAYLOAD", etc.
    miss_distance_threshold_km: float = 5.0,
    pc_threshold: float = 1e-6,
    coarse_threshold_km: float = 200.0,
    progress_callback=None,
) -> List[dict]:
    """
    Full conjunction screening pipeline for a user satellite.
    Returns list of conjunction event dicts sorted by Pc (descending).
    """
    from app.services.astrodynamics import ensure_utc
    from datetime import datetime as dt

    epoch = ensure_utc(datetime.fromisoformat(user_sat.epoch_utc))
    r0 = np.array([user_sat.pos_x_km, user_sat.pos_y_km, user_sat.pos_z_km])
    v0 = np.array([user_sat.vel_x_kms, user_sat.vel_y_kms, user_sat.vel_z_kms])

    # User satellite altitude band
    alt = float(np.linalg.norm(r0)) - R_E
    n_user = math.sqrt(GM / float(np.linalg.norm(r0)) ** 3)
    T_user = 2 * math.pi / n_user
    # Approximate eccentricity 0 for Hoots margin (use ±5% of SMA as band)
    v_mag = float(np.linalg.norm(v0))
    E_spec = 0.5 * v_mag ** 2 - GM / float(np.linalg.norm(r0))
    a_user = -GM / (2 * E_spec)
    # Angular momentum for eccentricity
    h_vec = np.cross(r0, v0)
    e_vec = np.cross(v0, h_vec) / GM - r0 / float(np.linalg.norm(r0))
    e_user = float(np.linalg.norm(e_vec))
    user_alt_min = a_user * (1.0 - e_user) - R_E
    user_alt_max = a_user * (1.0 + e_user) - R_E

    # --- Load catalog ---
    if progress_callback:
        progress_callback(5, "Katalog yükleniyor...")

    rso_query = db.query(RSOCatalog)
    if catalog_filter and catalog_filter != "ALL":
        rso_query = rso_query.filter(RSOCatalog.object_type == catalog_filter)

    from sqlalchemy import func as sqlfunc
    subq = db.query(
        TLERecord.norad_id,
        sqlfunc.max(TLERecord.epoch).label("max_epoch"),
    ).group_by(TLERecord.norad_id).subquery()

    tle_records = db.query(TLERecord).join(
        subq,
        (TLERecord.norad_id == subq.c.norad_id) & (TLERecord.epoch == subq.c.max_epoch),
    ).all()

    tle_dict = {t.norad_id: t for t in tle_records}
    catalog_pairs = []
    for rso in rso_query.all():
        tle = tle_dict.get(rso.norad_id)
        if tle:
            catalog_pairs.append((rso, tle))

    if progress_callback:
        progress_callback(10, f"Toplam {len(catalog_pairs)} obje. Hoots filtresi uygulanıyor...")

    # --- Stage 1: Hoots filter ---
    filtered = _hoots_filter(user_alt_min, user_alt_max, catalog_pairs, margin_km=50.0)

    if progress_callback:
        progress_callback(20, f"Hoots sonrası {len(filtered)} obje kaldı. Kaba tarama başlıyor...")

    # --- Stage 2 & 3: Coarse scan ---
    intervals_list = _coarse_scan(
        user_sat, filtered, epoch, window_days,
        coarse_step_s=60.0,
        threshold_km=coarse_threshold_km,
    )

    if progress_callback:
        progress_callback(60, f"{len(intervals_list)} yakın geçiş adayı bulundu. TCA hesaplanıyor...")

    # --- Stages 4-6: TCA + RTN + Pc ---
    results = []
    n_candidates = len(intervals_list)
    for idx, ((rso, tle), intervals) in enumerate(intervals_list):
        if progress_callback and idx % 5 == 0:
            pct = 60 + int(35 * idx / max(n_candidates, 1))
            progress_callback(pct, f"Konjunksiyon analizi: {rso.name} ({idx+1}/{n_candidates})")

        try:
            cat_sat = build_satellite_from_tle(rso.name, tle.line1, tle.line2)
        except Exception:
            continue

        for t_start, t_end in intervals:
            tca_result = _find_tca(user_sat, epoch, cat_sat, t_start, t_end)
            if tca_result is None:
                continue

            tca_sec, miss_dist = tca_result

            if miss_dist > miss_distance_threshold_km:
                continue

            # Get precise states at TCA
            r_user, v_user = state_at_time(
                r0, v0, epoch, tca_sec,
                cd=user_sat.cd,
                drag_area_m2=user_sat.drag_area_m2,
                srp_area_m2=user_sat.srp_area_m2,
                mass_kg=user_sat.mass_kg, cr=user_sat.cr,
                mission_type=user_sat.mission_type,
            )
            r_cat_arr = _sgp4_position(cat_sat, tca_sec, epoch)
            if r_cat_arr is None:
                continue

            # SGP4 doesn't give velocity directly; finite-difference approximation
            r_cat_dt = _sgp4_position(cat_sat, tca_sec + 1.0, epoch)
            v_cat = (r_cat_dt - r_cat_arr) if r_cat_dt is not None else np.zeros(3)

            # RTN analysis
            _, dr_rtn, dv_rtn = _to_rtn_frame(r_user, v_user, r_cat_arr, v_cat)
            rel_velocity = float(np.linalg.norm(dv_rtn))

            # Combined covariance (RTN)
            user_cov = np.array(user_sat.cov_6x6) if user_sat.cov_6x6 else np.zeros((6, 6))
            cat_cov = _default_catalog_covariance_rtn()
            C_combined = user_cov + cat_cov

            # Pc
            combined_radius_m = user_sat.hard_body_radius_m + 2.0  # catalog default 2m
            Pc = _pc_foster_chan(dr_rtn, C_combined, combined_radius_m)

            if Pc < pc_threshold:
                continue

            tca_dt = epoch + timedelta(seconds=tca_sec)

            results.append({
                "norad_id": rso.norad_id,
                "name": rso.name,
                "object_type": rso.object_type,
                "category": rso.category,
                "tca_utc": tca_dt.isoformat(),
                "miss_distance_km": round(miss_dist, 4),
                "miss_r_km": round(float(dr_rtn[0]), 4),
                "miss_t_km": round(float(dr_rtn[1]), 4),
                "miss_n_km": round(float(dr_rtn[2]), 4),
                "rel_velocity_kms": round(rel_velocity, 4),
                "pc": float(Pc),
                "risk_level": _risk_level(Pc),
                "r_user_km": [round(float(x), 3) for x in r_user],
                "v_user_kms": [round(float(x), 6) for x in v_user],
                "r_cat_km": [round(float(x), 3) for x in r_cat_arr],
            })

    if progress_callback:
        progress_callback(100, f"Tamamlandı. {len(results)} konjunksiyon tespit edildi.")

    results.sort(key=lambda x: x["pc"], reverse=True)
    return results
