"""
User Satellite CRUD + Conjunction Screening endpoints.

Job management uses an in-process dict (sufficient for single-user desktop).
"""

from __future__ import annotations

import uuid
import threading
from datetime import datetime, timezone
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user_satellite import UserSatellite
from app.schemas.user_satellite import (
    UserSatelliteCreate,
    UserSatelliteResponse,
    ConjunctionScreenRequest,
    ConjunctionScreenResponse,
    ConjunctionEvent,
)
from app.services.coordinate_conversion import (
    tle_to_eci,
    keplerian_to_eci,
    validate_state_vector,
    default_covariance_6x6,
    eci_to_geodetic,
)
from app.services.user_conjunction import run_conjunction_screening

router = APIRouter()

# In-process job store: job_id → dict
_jobs: Dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_user_satellite(req: UserSatelliteCreate) -> dict:
    """Convert create-request to DB column values."""
    fmt = req.input_format.upper()
    phys = req.physical

    # --- ECI state vector ---
    if fmt == "TLE":
        r, v, epoch = tle_to_eci(
            req.tle.line1,
            req.tle.line2,
            datetime.fromisoformat(req.tle.epoch_utc) if req.tle.epoch_utc else None,
        )
        raw = {"line1": req.tle.line1, "line2": req.tle.line2}

    elif fmt == "KEPLERIAN":
        k = req.keplerian
        r, v, epoch = keplerian_to_eci(
            k.sma_km, k.eccentricity, k.inclination_deg,
            k.raan_deg, k.argp_deg, k.mean_anomaly_deg,
            datetime.fromisoformat(k.epoch_utc),
        )
        raw = k.model_dump()

    elif fmt == "STATE_VECTOR":
        sv = req.state_vector
        r, v, epoch = validate_state_vector(
            sv.pos_x_km, sv.pos_y_km, sv.pos_z_km,
            sv.vel_x_kms, sv.vel_y_kms, sv.vel_z_kms,
            datetime.fromisoformat(sv.epoch_utc),
        )
        raw = sv.model_dump()

    else:
        raise ValueError(f"Unknown input_format: {req.input_format}")

    # --- Covariance ---
    import numpy as np
    if req.covariance_full:
        cov = req.covariance_full.matrix_6x6
    elif req.covariance_simple:
        cs = req.covariance_simple
        h = np.cross(r, v)
        n_hat = h / np.linalg.norm(h)
        r_hat = r / np.linalg.norm(r)
        t_hat = np.cross(n_hat, r_hat)
        M = np.column_stack([r_hat, t_hat, n_hat])
        C_pos = M @ np.diag([cs.sigma_r_km**2, cs.sigma_t_km**2, cs.sigma_n_km**2]) @ M.T
        C_vel = M @ np.diag([cs.sigma_vr_kms**2, cs.sigma_vt_kms**2, cs.sigma_vn_kms**2]) @ M.T
        C6 = np.zeros((6, 6))
        C6[:3, :3] = C_pos
        C6[3:, 3:] = C_vel
        cov = C6.tolist()
    else:
        cov = default_covariance_6x6(req.mission_type, r, v)

    return {
        "name": req.name,
        "mission_type": req.mission_type.upper(),
        "input_format": fmt,
        "raw_input": raw,
        "epoch_utc": epoch.isoformat(),
        "pos_x_km": float(r[0]),
        "pos_y_km": float(r[1]),
        "pos_z_km": float(r[2]),
        "vel_x_kms": float(v[0]),
        "vel_y_kms": float(v[1]),
        "vel_z_kms": float(v[2]),
        "cov_6x6": cov,
        "hard_body_radius_m": phys.hard_body_radius_m if phys else 2.0,
        "drag_area_m2": phys.drag_area_m2 if phys else 0.04,
        "srp_area_m2": phys.srp_area_m2 if phys else 0.04,
        "mass_kg": phys.mass_kg if phys else 12.0,
        "cd": phys.cd if phys else 2.2,
        "cr": phys.cr if phys else 1.4,
    }


# ---------------------------------------------------------------------------
# State & Ephemeris  (must come BEFORE /{sat_id} wildcard)
# ---------------------------------------------------------------------------

_GM = 398600.4418   # km³/s²
_J2 = 1.08262668e-3
_RE = 6378.137


def _keplerian_propagate_fast(r0, v0, dt_sec):
    """
    Fast J2-secular analytical propagation for |dt| > 7 days.
    Propagates mean orbital elements analytically — no iteration.
    Accurate to ~km over days-to-weeks, sufficient for globe visualization.
    """
    import numpy as np
    import math

    r_mag = float(np.linalg.norm(r0))
    v_mag = float(np.linalg.norm(v0))
    h_vec = np.cross(r0, v0)
    h = float(np.linalg.norm(h_vec))

    # Specific energy → semi-major axis
    energy = 0.5 * v_mag**2 - _GM / r_mag
    a = -_GM / (2.0 * energy)

    # Eccentricity vector
    e_vec = np.cross(v0, h_vec) / _GM - r0 / r_mag
    e = float(np.linalg.norm(e_vec))
    e = min(e, 0.999)

    # Inclination
    n_hat = h_vec / h
    inc = math.acos(float(np.clip(n_hat[2], -1, 1)))

    # Mean motion
    n = math.sqrt(_GM / a**3)
    T = 2 * math.pi / n  # orbital period (s)

    # J2 secular rates
    p = a * (1 - e**2)
    j2_factor = -1.5 * _J2 * (_RE / p)**2 * n
    cos_i = math.cos(inc)
    raan_dot = j2_factor * cos_i
    argp_dot = j2_factor * (2.5 * cos_i**2 - 0.5)
    M_dot    = n + j2_factor * math.sqrt(1 - e**2) * (1.5 * cos_i**2 - 0.5) * (-1)

    # Propagate angles
    # RAAN
    k_hat = np.array([0.0, 0.0, 1.0])
    node_vec = np.cross(k_hat, n_hat)
    node_mag = float(np.linalg.norm(node_vec))
    if node_mag < 1e-10:
        RAAN = 0.0
    else:
        node_hat = node_vec / node_mag
        RAAN_0 = math.atan2(float(node_hat[1]), float(node_hat[0]))
        RAAN = RAAN_0 + raan_dot * dt_sec

    # argp
    if node_mag > 1e-10 and e > 1e-6:
        e_hat = e_vec / e
        argp_0 = math.atan2(float(np.dot(e_hat, np.cross(n_hat, node_hat))),
                             float(np.dot(e_hat, node_hat)))
    else:
        argp_0 = 0.0
    argp = argp_0 + argp_dot * dt_sec

    # True anomaly at epoch → mean anomaly → propagate → eccentric → true
    r_dot_v = float(np.dot(r0, v0))
    cos_nu0 = float(np.dot(r0 / r_mag, e_vec / max(e, 1e-10)))
    cos_nu0 = float(np.clip(cos_nu0, -1, 1))
    nu0 = math.atan2(r_dot_v / max(e * h, 1e-30), (h**2 / (_GM * r_mag) - 1) / max(e, 1e-10))
    E0 = 2 * math.atan2(math.sqrt(1 - e) * math.sin(nu0 / 2),
                        math.sqrt(1 + e) * math.cos(nu0 / 2))
    M0 = E0 - e * math.sin(E0)
    M = M0 + M_dot * dt_sec

    # Solve Kepler
    E = M
    for _ in range(20):
        dE = (M - E + e * math.sin(E)) / (1 - e * math.cos(E))
        E += dE
        if abs(dE) < 1e-10:
            break
    nu = 2 * math.atan2(math.sqrt(1 + e) * math.sin(E / 2),
                        math.sqrt(1 - e) * math.cos(E / 2))

    # Position in perifocal frame
    pp = a * (1 - e**2)
    r_peri = pp / (1 + e * math.cos(nu))
    r_pqw = r_peri * np.array([math.cos(nu), math.sin(nu), 0.0])
    v_pqw = math.sqrt(_GM / pp) * np.array([-math.sin(nu), e + math.cos(nu), 0.0])

    def R3(a):
        c, s = math.cos(a), math.sin(a)
        return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
    def R1(a):
        c, s = math.cos(a), math.sin(a)
        return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])

    Q = R3(-RAAN) @ R1(-inc) @ R3(-argp)
    r_new = Q @ r_pqw
    v_new = Q @ v_pqw
    return r_new, v_new


def _propagate_user_sat(sat: UserSatellite, t_utc: datetime):
    """Propagate user satellite to t_utc.
    Uses full RK45 for |dt| ≤ 7 days, fast analytical J2-secular for longer spans.
    """
    import numpy as np
    from app.services.numerical_propagator import state_at_time
    from app.services.astrodynamics import ensure_utc

    epoch = ensure_utc(datetime.fromisoformat(sat.epoch_utc))
    t_utc = ensure_utc(t_utc)
    dt_sec = (t_utc - epoch).total_seconds()

    r0 = np.array([sat.pos_x_km, sat.pos_y_km, sat.pos_z_km])
    v0 = np.array([sat.vel_x_kms, sat.vel_y_kms, sat.vel_z_kms])

    if abs(dt_sec) < 0.5:
        return r0, v0

    MAX_RK45_SEC = 7 * 86400   # 7 days

    if abs(dt_sec) <= MAX_RK45_SEC:
        r, v = state_at_time(
            r0, v0, epoch, dt_sec,
            cd=sat.cd, drag_area_m2=sat.drag_area_m2,
            srp_area_m2=sat.srp_area_m2, mass_kg=sat.mass_kg,
            cr=sat.cr, mission_type=sat.mission_type,
        )
    else:
        r, v = _keplerian_propagate_fast(r0, v0, dt_sec)

    return r, v


def _state_to_dict(sat: UserSatellite, r: "np.ndarray", v: "np.ndarray", t_utc: datetime) -> dict:
    """Build SatelliteState-compatible dict from ECI position."""
    import numpy as np
    lat, lon, alt = eci_to_geodetic(r, t_utc)
    r_mag = float(np.linalg.norm(r))
    from app.services.astrodynamics import ensure_utc
    epoch = ensure_utc(datetime.fromisoformat(sat.epoch_utc))
    age_days = (ensure_utc(t_utc) - epoch).total_seconds() / 86400.0
    return {
        "name": sat.name,
        "timestamp_utc": t_utc.isoformat(),
        "latitude_deg": round(lat, 6),
        "longitude_deg": round(lon, 6),
        "altitude_km": round(alt, 3),
        "ecef": {
            "x_km": round(float(r[0]), 3),
            "y_km": round(float(r[1]), 3),
            "z_km": round(float(r[2]), 3),
        },
        "tle_epoch_utc": sat.epoch_utc,
        "tle_age_days": round(abs(age_days), 4),
        "reliability_status": "FRESH" if abs(age_days) < 2 else "AGING" if abs(age_days) < 14 else "STALE",
    }


@router.get("/{sat_id}/state")
def get_user_sat_state(
    sat_id: int,
    timestamp_utc: str = None,
    db: Session = Depends(get_db),
):
    sat = db.query(UserSatellite).filter(UserSatellite.id == sat_id).first()
    if not sat:
        raise HTTPException(status_code=404, detail="User satellite not found")
    try:
        t_utc = datetime.fromisoformat(timestamp_utc) if timestamp_utc else datetime.now(timezone.utc)
        r, v = _propagate_user_sat(sat, t_utc)
        return _state_to_dict(sat, r, v, t_utc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{sat_id}/ephemeris")
def get_user_sat_ephemeris(
    sat_id: int,
    body: dict,
    db: Session = Depends(get_db),
):
    """
    body: { start_time_utc, end_time_utc, step_seconds }
    Returns list of SatelliteState dicts.
    """
    sat = db.query(UserSatellite).filter(UserSatellite.id == sat_id).first()
    if not sat:
        raise HTTPException(status_code=404, detail="User satellite not found")
    try:
        import numpy as np
        from app.services.numerical_propagator import propagate_to_times
        from app.services.astrodynamics import ensure_utc
        from datetime import timedelta

        start = ensure_utc(datetime.fromisoformat(body["start_time_utc"]))
        end   = ensure_utc(datetime.fromisoformat(body["end_time_utc"]))
        step  = int(body.get("step_seconds", 60))

        import numpy as _np
        total_sec = (end - start).total_seconds()
        times = _np.arange(0.0, total_sec + step, step)
        if len(times) > 5000:
            times = times[:5000]

        # Propagate start state first, then propagate forward from there
        r_start, v_start = _propagate_user_sat(sat, start)
        epoch_start = start

        epoch_for_prop = ensure_utc(datetime.fromisoformat(sat.epoch_utc))
        dt_start = (start - epoch_for_prop).total_seconds()

        # Use numerical or fast propagation for the ephemeris window (always ≤7 days)
        states = propagate_to_times(
            r_start, v_start, epoch_start, list(times),
            cd=sat.cd, drag_area_m2=sat.drag_area_m2,
            srp_area_m2=sat.srp_area_m2, mass_kg=sat.mass_kg,
            cr=sat.cr, mission_type=sat.mission_type,
        )

        result = []
        for i, t_offset in enumerate(times):
            t_utc = start + timedelta(seconds=float(t_offset))
            r = states[i, :3]
            v = states[i, 3:]
            result.append(_state_to_dict(sat, r, v, t_utc))

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Conjunction screening endpoints  (must come BEFORE /{sat_id} wildcard)
# ---------------------------------------------------------------------------

@router.post("/conjunction/screen", response_model=ConjunctionScreenResponse)
def start_conjunction_screen(req: ConjunctionScreenRequest, db: Session = Depends(get_db)):
    sat = db.query(UserSatellite).filter(UserSatellite.id == req.user_satellite_id).first()
    if not sat:
        raise HTTPException(status_code=404, detail="User satellite not found")

    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    _jobs[job_id] = {
        "status": "RUNNING",
        "progress_pct": 0,
        "progress_msg": "Başlatılıyor...",
        "events": [],
        "total_events": 0,
        "user_satellite_id": req.user_satellite_id,
        "window_days": req.window_days,
        "catalog_filter": req.catalog_filter,
        "created_at": now,
    }

    # Run in background thread so endpoint returns immediately
    def _run():
        from app.database import SessionLocal
        thread_db = SessionLocal()
        try:
            thread_sat = thread_db.query(UserSatellite).filter(
                UserSatellite.id == req.user_satellite_id
            ).first()

            def progress(pct, msg):
                _jobs[job_id]["progress_pct"] = pct
                _jobs[job_id]["progress_msg"] = msg

            events = run_conjunction_screening(
                thread_sat,
                thread_db,
                window_days=req.window_days,
                catalog_filter=req.catalog_filter,
                miss_distance_threshold_km=req.miss_distance_threshold_km,
                pc_threshold=req.pc_threshold,
                progress_callback=progress,
            )
            _jobs[job_id]["events"] = events
            _jobs[job_id]["total_events"] = len(events)
            _jobs[job_id]["status"] = "COMPLETED"
            _jobs[job_id]["progress_pct"] = 100
        except Exception as e:
            _jobs[job_id]["status"] = "FAILED"
            _jobs[job_id]["progress_msg"] = str(e)
        finally:
            thread_db.close()

    t = threading.Thread(target=_run, daemon=True)
    t.start()

    return ConjunctionScreenResponse(
        job_id=job_id,
        user_satellite_id=req.user_satellite_id,
        status="RUNNING",
        progress_pct=0,
        progress_msg="Başlatılıyor...",
        window_days=req.window_days,
        catalog_filter=req.catalog_filter,
        events=[],
        total_events=0,
        created_at=now,
    )


@router.get("/conjunction/screen/{job_id}", response_model=ConjunctionScreenResponse)
def get_conjunction_screen_result(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    events = [ConjunctionEvent(**e) for e in job["events"]]
    return ConjunctionScreenResponse(
        job_id=job_id,
        user_satellite_id=job["user_satellite_id"],
        status=job["status"],
        progress_pct=job["progress_pct"],
        progress_msg=job["progress_msg"],
        window_days=job["window_days"],
        catalog_filter=job["catalog_filter"],
        events=events,
        total_events=job["total_events"],
        created_at=job["created_at"],
    )


@router.get("/conjunction/screen/{job_id}/export")
def export_conjunction_results(job_id: str, format: str = "json"):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] != "COMPLETED":
        raise HTTPException(status_code=400, detail="Job not completed yet")

    events = job["events"]

    if format.lower() == "csv":
        import csv
        import io
        from fastapi.responses import StreamingResponse

        output = io.StringIO()
        if events:
            writer = csv.DictWriter(output, fieldnames=[
                k for k in events[0].keys()
                if k not in ("r_user_km", "v_user_kms", "r_cat_km")
            ])
            writer.writeheader()
            for e in events:
                row = {k: v for k, v in e.items() if k not in ("r_user_km", "v_user_kms", "r_cat_km")}
                writer.writerow(row)

        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="conjunction_{job_id[:8]}.csv"'},
        )

    from fastapi.responses import JSONResponse
    return JSONResponse(content={"job_id": job_id, "events": events})


# ---------------------------------------------------------------------------
# CRUD endpoints  (wildcard /{sat_id} must come AFTER all specific paths)
# ---------------------------------------------------------------------------

@router.post("/", response_model=UserSatelliteResponse, status_code=201)
def create_user_satellite(req: UserSatelliteCreate, db: Session = Depends(get_db)):
    try:
        data = _build_user_satellite(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    sat = UserSatellite(**data)
    db.add(sat)
    db.commit()
    db.refresh(sat)
    return sat


@router.get("/", response_model=list[UserSatelliteResponse])
def list_user_satellites(db: Session = Depends(get_db)):
    return db.query(UserSatellite).order_by(UserSatellite.created_at.desc()).all()


@router.get("/{sat_id}", response_model=UserSatelliteResponse)
def get_user_satellite(sat_id: int, db: Session = Depends(get_db)):
    sat = db.query(UserSatellite).filter(UserSatellite.id == sat_id).first()
    if not sat:
        raise HTTPException(status_code=404, detail="User satellite not found")
    return sat


@router.delete("/{sat_id}", status_code=204)
def delete_user_satellite(sat_id: int, db: Session = Depends(get_db)):
    sat = db.query(UserSatellite).filter(UserSatellite.id == sat_id).first()
    if not sat:
        raise HTTPException(status_code=404, detail="User satellite not found")
    db.delete(sat)
    db.commit()
