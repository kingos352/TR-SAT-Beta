"""
Coordinate conversion utilities.

Supported input formats → ECI J2000 state vector (km, km/s):
  - TLE (Two-Line Element set) via Skyfield
  - Keplerian orbital elements (classical COE)
  - State vector (direct ECI r/v)
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Tuple

import numpy as np
from skyfield.api import EarthSatellite, load, utc

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
GM_EARTH = 398600.4418          # km³/s²
R_EARTH_KM = 6378.137

# Skyfield timescale (module-level, shared)
_ts = load.timescale()


# ---------------------------------------------------------------------------
# Default covariance by mission type
# Diagonal 6×6 in km² (position) and km²/s² (velocity)
# Based on typical operational catalog covariance estimates.
# ---------------------------------------------------------------------------
_DEFAULT_COV_SIGMA: dict[str, dict] = {
    "LEO": {"r": 0.1, "t": 1.0, "n": 0.1, "vr": 1e-4, "vt": 1e-3, "vn": 1e-4},
    "SSO": {"r": 0.1, "t": 1.0, "n": 0.1, "vr": 1e-4, "vt": 1e-3, "vn": 1e-4},
    "MEO": {"r": 0.5, "t": 5.0, "n": 0.5, "vr": 5e-4, "vt": 5e-3, "vn": 5e-4},
    "GEO": {"r": 1.0, "t": 10.0, "n": 1.0, "vr": 1e-3, "vt": 1e-2, "vn": 1e-3},
    "HEO": {"r": 0.5, "t": 5.0, "n": 0.5, "vr": 5e-4, "vt": 5e-3, "vn": 5e-4},
    "CUSTOM": {"r": 0.2, "t": 2.0, "n": 0.2, "vr": 2e-4, "vt": 2e-3, "vn": 2e-4},
}


def default_covariance_6x6(mission_type: str, r_eci: np.ndarray, v_eci: np.ndarray) -> list:
    """Build a diagonal 6×6 covariance in ECI from RTN sigmas."""
    sig = _DEFAULT_COV_SIGMA.get(mission_type, _DEFAULT_COV_SIGMA["CUSTOM"])

    # RTN unit vectors
    r_hat = r_eci / np.linalg.norm(r_eci)
    h = np.cross(r_eci, v_eci)
    n_hat = h / np.linalg.norm(h)
    t_hat = np.cross(n_hat, r_hat)

    # Rotation matrix RTN→ECI columns
    M = np.column_stack([r_hat, t_hat, n_hat])  # 3×3

    # Position covariance in RTN (diagonal)
    C_pos_rtn = np.diag([sig["r"] ** 2, sig["t"] ** 2, sig["n"] ** 2])
    # Velocity covariance in RTN (diagonal)
    C_vel_rtn = np.diag([sig["vr"] ** 2, sig["vt"] ** 2, sig["vn"] ** 2])

    # Rotate to ECI
    C_pos_eci = M @ C_pos_rtn @ M.T
    C_vel_eci = M @ C_vel_rtn @ M.T

    # Build 6×6 block diagonal
    C6 = np.zeros((6, 6))
    C6[:3, :3] = C_pos_eci
    C6[3:, 3:] = C_vel_eci

    return C6.tolist()


# ---------------------------------------------------------------------------
# Kepler's equation solver
# ---------------------------------------------------------------------------

def _solve_kepler(M: float, e: float, tol: float = 1e-12) -> float:
    """Iterative Newton-Raphson solution of M = E - e·sin(E)."""
    E = M if e < 0.8 else math.pi
    for _ in range(100):
        dE = (M - E + e * math.sin(E)) / (1.0 - e * math.cos(E))
        E += dE
        if abs(dE) < tol:
            break
    return E


# ---------------------------------------------------------------------------
# Rotation helpers
# ---------------------------------------------------------------------------

def _rot1(angle: float) -> np.ndarray:
    c, s = math.cos(angle), math.sin(angle)
    return np.array([[1, 0, 0], [0, c, s], [0, -s, c]])


def _rot3(angle: float) -> np.ndarray:
    c, s = math.cos(angle), math.sin(angle)
    return np.array([[c, s, 0], [-s, c, 0], [0, 0, 1]])


# ---------------------------------------------------------------------------
# TLE → ECI
# ---------------------------------------------------------------------------

def tle_to_eci(
    tle_line1: str,
    tle_line2: str,
    epoch_utc: datetime,
    name: str = "USER",
) -> Tuple[np.ndarray, np.ndarray, datetime]:
    """
    Propagate TLE to given epoch using Skyfield (SGP4/SDP4).
    Returns (r_eci_km, v_eci_kms, epoch_utc).
    If epoch_utc is None, uses the TLE's own epoch.
    """
    satellite = EarthSatellite(tle_line1, tle_line2, name, _ts)

    if epoch_utc is None:
        epoch_utc = satellite.epoch.utc_datetime()

    if epoch_utc.tzinfo is None:
        epoch_utc = epoch_utc.replace(tzinfo=timezone.utc)

    t = _ts.from_datetime(epoch_utc)
    geocentric = satellite.at(t)

    # Skyfield GCRS ≈ ECI J2000 for our purposes (< 20m error, acceptable)
    pos_km = geocentric.position.km           # (3,)
    vel_kms = geocentric.velocity.km_per_s    # (3,)

    r = np.array([float(pos_km[0]), float(pos_km[1]), float(pos_km[2])])
    v = np.array([float(vel_kms[0]), float(vel_kms[1]), float(vel_kms[2])])

    return r, v, epoch_utc


# ---------------------------------------------------------------------------
# Keplerian → ECI
# ---------------------------------------------------------------------------

def keplerian_to_eci(
    sma_km: float,        # semi-major axis (km)
    ecc: float,           # eccentricity
    inc_deg: float,       # inclination (deg)
    raan_deg: float,      # right ascension of ascending node (deg)
    argp_deg: float,      # argument of perigee (deg)
    mean_anomaly_deg: float,  # mean anomaly at epoch (deg)
    epoch_utc: datetime,
) -> Tuple[np.ndarray, np.ndarray, datetime]:
    """
    Convert classical orbital elements to ECI state vector.
    Uses standard perifocal → ECI rotation (313 Euler sequence).
    """
    i = math.radians(inc_deg)
    raan = math.radians(raan_deg)
    argp = math.radians(argp_deg)
    M = math.radians(mean_anomaly_deg)

    # Eccentric anomaly
    E = _solve_kepler(M, ecc)

    # True anomaly
    nu = 2.0 * math.atan2(
        math.sqrt(1.0 + ecc) * math.sin(E / 2.0),
        math.sqrt(1.0 - ecc) * math.cos(E / 2.0),
    )

    # Distance
    p = sma_km * (1.0 - ecc ** 2)
    r_mag = p / (1.0 + ecc * math.cos(nu))

    # Perifocal (PQW) frame
    r_pqw = np.array([r_mag * math.cos(nu), r_mag * math.sin(nu), 0.0])
    v_pqw = math.sqrt(GM_EARTH / p) * np.array([-math.sin(nu), ecc + math.cos(nu), 0.0])

    # Rotation PQW → ECI: R3(-RAAN) · R1(-i) · R3(-argp)
    R = _rot3(-raan) @ _rot1(-i) @ _rot3(-argp)
    r_eci = R @ r_pqw
    v_eci = R @ v_pqw

    if epoch_utc.tzinfo is None:
        epoch_utc = epoch_utc.replace(tzinfo=timezone.utc)

    return r_eci, v_eci, epoch_utc


# ---------------------------------------------------------------------------
# State vector validation (ECI input, just normalise & check)
# ---------------------------------------------------------------------------

def eci_to_geodetic(r_eci_km: np.ndarray, t_utc: datetime) -> tuple[float, float, float]:
    """
    Convert ECI (GCRS, J2000) position to geodetic (lat_deg, lon_deg, alt_km).
    Uses GMST rotation for ECI→ECEF, then Bowring's iterative method for ECEF→geodetic.
    """
    if t_utc.tzinfo is None:
        t_utc = t_utc.replace(tzinfo=timezone.utc)

    # Julian date
    from datetime import datetime as _dt
    ref = _dt(2000, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    T = (t_utc - ref).total_seconds() / (86400.0 * 36525.0)

    # Greenwich Mean Sidereal Time (degrees) — IAU 1982 formula
    gmst_deg = (100.4606184 + 36000.77004 * T + 0.000387933 * T**2) % 360.0
    # Precise Earth rotation: add seconds within the day
    gmst_deg = (gmst_deg + 360.98564724 * ((t_utc - ref).total_seconds() % 86400.0) / 86400.0) % 360.0
    theta = math.radians(gmst_deg)

    # ECI → ECEF (simple rotation about z-axis)
    c, s = math.cos(theta), math.sin(theta)
    x_e = c * r_eci_km[0] + s * r_eci_km[1]
    y_e = -s * r_eci_km[0] + c * r_eci_km[1]
    z_e = float(r_eci_km[2])

    # ECEF → Geodetic (Bowring's iterative method, WGS84)
    a = 6378.137          # km
    f = 1.0 / 298.257223563
    e2 = 2 * f - f * f

    lon = math.degrees(math.atan2(y_e, x_e))
    p = math.sqrt(x_e**2 + y_e**2)
    lat = math.atan2(z_e, p * (1.0 - e2))

    for _ in range(10):
        sin_lat = math.sin(lat)
        N = a / math.sqrt(1.0 - e2 * sin_lat**2)
        lat_new = math.atan2(z_e + e2 * N * sin_lat, p)
        if abs(lat_new - lat) < 1e-12:
            break
        lat = lat_new

    sin_lat = math.sin(lat)
    N = a / math.sqrt(1.0 - e2 * sin_lat**2)
    cos_lat = math.cos(lat)
    alt = (p / cos_lat - N) if abs(cos_lat) > 0.1 else (z_e / sin_lat - N * (1.0 - e2))

    return math.degrees(lat), lon, float(alt)


def validate_state_vector(
    pos_x_km: float, pos_y_km: float, pos_z_km: float,
    vel_x_kms: float, vel_y_kms: float, vel_z_kms: float,
    epoch_utc: datetime,
) -> Tuple[np.ndarray, np.ndarray, datetime]:
    r = np.array([float(pos_x_km), float(pos_y_km), float(pos_z_km)])
    v = np.array([float(vel_x_kms), float(vel_y_kms), float(vel_z_kms)])

    r_mag = float(np.linalg.norm(r))
    if r_mag < R_EARTH_KM:
        raise ValueError(f"Position magnitude {r_mag:.1f} km is below Earth's surface.")
    if r_mag > 500_000:
        raise ValueError(f"Position magnitude {r_mag:.1f} km exceeds 500 000 km (unreasonable).")

    v_mag = float(np.linalg.norm(v))
    if v_mag > 20.0:
        raise ValueError(f"Velocity magnitude {v_mag:.3f} km/s exceeds escape velocity (~11.2 km/s).")

    if epoch_utc.tzinfo is None:
        epoch_utc = epoch_utc.replace(tzinfo=timezone.utc)

    return r, v, epoch_utc
