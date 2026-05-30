"""
Estimated probability of collision (Pc) for TLE-based conjunctions.

Public TLE/GP data carries no covariance, so a rigorous operational Pc is not
possible. This module produces a *heuristic* Pc: position uncertainty is
synthesised from the time elapsed since each object's TLE epoch (uncertainty
grows mostly in the along-track direction), the relative covariance is projected
onto the encounter plane (perpendicular to the relative velocity at TCA), and the
2-D Foster integral is evaluated over a hard-body disk whose radius is inferred
from object type. Every number here is an engineering estimate, not a CDM-grade
product, and the API/UI label it as such.

References (methodology, not data): Foster & Estes 1992 (2-D Pc); Hoots/Akella-Alfano
(encounter plane); standard RTN error-growth heuristics for SGP4.
"""
import math
from typing import Optional, Dict, Any
import numpy as np

# --- Synthetic RTN position-uncertainty model (heuristic) ---
# Uncertainty is dominated by the along-track (in-track) component and grows with
# the time since the TLE epoch (covers both TLE staleness and propagation span).
SIGMA_INTRACK_BASE_KM = 0.2          # 1-sigma in-track uncertainty at epoch
SIGMA_INTRACK_RATE_KM_PER_DAY = 0.6  # in-track growth per day since epoch
RADIAL_FRACTION = 0.15               # radial sigma as a fraction of in-track
CROSSTRACK_FRACTION = 0.30           # cross-track sigma as a fraction of in-track
SIGMA_INTRACK_MAX_KM = 25.0          # cap so very stale TLEs don't explode Pc math

# --- Representative hard-body radii by object type (metres, heuristic) ---
HBR_BY_TYPE_M = {
    "PAYLOAD": 2.0,
    "ROCKET_BODY": 4.0,
    "DEBRIS": 0.5,
    "UNKNOWN": 1.0,
}
DEFAULT_HBR_M = 1.0
# A few large named objects where the type default is clearly too small.
HBR_NAME_OVERRIDES_M = {
    "ISS": 55.0,
    "ZARYA": 55.0,
    "CSS": 30.0,
    "TIANHE": 30.0,
}

# Pc-based operational risk thresholds.
RISK_HIGH = 1e-4
RISK_MEDIUM = 1e-5
RISK_LOW = 1e-6


def hard_body_radius_m(object_type: Optional[str], name: Optional[str] = None) -> float:
    """Representative physical radius (m) for an object from its type/name."""
    if name:
        upper = name.upper()
        for key, radius in HBR_NAME_OVERRIDES_M.items():
            if key in upper:
                return radius
    if object_type:
        return HBR_BY_TYPE_M.get(object_type.upper(), DEFAULT_HBR_M)
    return DEFAULT_HBR_M


def classify_risk(pc: float) -> str:
    """Map an estimated Pc to a risk band."""
    if pc >= RISK_HIGH:
        return "HIGH"
    if pc >= RISK_MEDIUM:
        return "MEDIUM"
    if pc >= RISK_LOW:
        return "LOW"
    return "NEGLIGIBLE"


def _sigma_intrack_km(days_since_epoch: float, override: Optional[float] = None) -> float:
    if override is not None:
        return max(1e-3, override)
    days = max(0.0, days_since_epoch)
    sigma = SIGMA_INTRACK_BASE_KM + SIGMA_INTRACK_RATE_KM_PER_DAY * days
    return min(sigma, SIGMA_INTRACK_MAX_KM)


def _rtn_basis(r_eci: np.ndarray, v_eci: np.ndarray) -> np.ndarray:
    """
    RTN (radial, in-track, cross-track) orthonormal basis as a 3x3 matrix whose
    columns are R_hat, T_hat, N_hat in the ECI frame.
    """
    r_hat = r_eci / np.linalg.norm(r_eci)
    h = np.cross(r_eci, v_eci)
    n_hat = h / np.linalg.norm(h)          # orbit normal -> cross-track
    t_hat = np.cross(n_hat, r_hat)          # completes right-handed in-track
    return np.column_stack((r_hat, t_hat, n_hat))


def _covariance_eci(
    r_eci: np.ndarray,
    v_eci: np.ndarray,
    days_since_epoch: float,
    sigma_intrack_override: Optional[float] = None,
) -> np.ndarray:
    """Build a 3x3 position covariance in ECI from the RTN synthetic model."""
    sigma_t = _sigma_intrack_km(days_since_epoch, sigma_intrack_override)
    sigma_r = RADIAL_FRACTION * sigma_t
    sigma_n = CROSSTRACK_FRACTION * sigma_t
    cov_rtn = np.diag([sigma_r ** 2, sigma_t ** 2, sigma_n ** 2])
    rot = _rtn_basis(r_eci, v_eci)          # columns R,T,N
    return rot @ cov_rtn @ rot.T


def _encounter_plane_basis(rel_pos: np.ndarray, rel_vel: np.ndarray) -> np.ndarray:
    """
    Two orthonormal in-plane unit vectors (3x2 matrix) spanning the encounter
    plane perpendicular to the relative velocity. The first axis points along the
    in-plane component of the relative position (the miss direction).
    """
    v_norm = np.linalg.norm(rel_vel)
    # Degenerate co-moving case (no relative velocity): the encounter plane is
    # undefined, so fall back to an arbitrary axis to keep the projection finite.
    v_hat = rel_vel / v_norm if v_norm > 1e-9 else np.array([0.0, 0.0, 1.0])
    r_perp = rel_pos - np.dot(rel_pos, v_hat) * v_hat
    norm = np.linalg.norm(r_perp)
    if norm < 1e-9:
        # Degenerate head-on geometry: choose any axis perpendicular to v_hat.
        seed = np.array([1.0, 0.0, 0.0]) if abs(v_hat[0]) < 0.9 else np.array([0.0, 1.0, 0.0])
        x_hat = seed - np.dot(seed, v_hat) * v_hat
        x_hat /= np.linalg.norm(x_hat)
    else:
        x_hat = r_perp / norm
    z_hat = np.cross(v_hat, x_hat)
    z_hat /= np.linalg.norm(z_hat)
    return np.column_stack((x_hat, z_hat))


def _foster_2d_pc(miss_2d: np.ndarray, cov_2d: np.ndarray, hbr_km: float) -> float:
    """
    Integrate a 2-D Gaussian (mean = miss vector, covariance = cov_2d) over the
    hard-body disk of radius hbr_km centred at the origin. Polar quadrature.
    """
    # Regularise to keep the covariance positive-definite.
    cov = cov_2d + np.eye(2) * 1e-12
    det = cov[0, 0] * cov[1, 1] - cov[0, 1] * cov[1, 0]
    if det <= 0:
        return 0.0
    inv = np.array([[cov[1, 1], -cov[0, 1]], [-cov[1, 0], cov[0, 0]]]) / det
    norm_const = 1.0 / (2.0 * math.pi * math.sqrt(det))

    n_r, n_theta = 24, 48
    r_edges = np.linspace(0.0, hbr_km, n_r + 1)
    r_mid = 0.5 * (r_edges[:-1] + r_edges[1:])
    dr = hbr_km / n_r
    theta = np.linspace(0.0, 2.0 * math.pi, n_theta, endpoint=False)
    dtheta = 2.0 * math.pi / n_theta

    cos_t = np.cos(theta)
    sin_t = np.sin(theta)
    total = 0.0
    for r in r_mid:
        x = r * cos_t - miss_2d[0]
        y = r * sin_t - miss_2d[1]
        quad = inv[0, 0] * x * x + (inv[0, 1] + inv[1, 0]) * x * y + inv[1, 1] * y * y
        dens = norm_const * np.exp(-0.5 * quad)
        total += np.sum(dens) * r * dr * dtheta
    return float(min(max(total, 0.0), 1.0))


def _max_pc(miss_2d: np.ndarray, cov_2d: np.ndarray, hbr_km: float) -> float:
    """
    Conservative upper bound: scale the covariance magnitude over a range and
    take the largest Pc. Recognised practice when the covariance is uncertain.
    """
    best = 0.0
    for scale in np.logspace(-2, 2, 25):
        pc = _foster_2d_pc(miss_2d, cov_2d * scale, hbr_km)
        if pc > best:
            best = pc
    return best


def estimate_collision(
    p_pos_km: np.ndarray,
    p_vel_km_s: np.ndarray,
    s_pos_km: np.ndarray,
    s_vel_km_s: np.ndarray,
    p_days_since_epoch: float,
    s_days_since_epoch: float,
    p_object_type: Optional[str],
    s_object_type: Optional[str],
    p_name: Optional[str] = None,
    s_name: Optional[str] = None,
    hbr_override_m: Optional[float] = None,
    sigma_intrack_override_km: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Estimate the collision metrics for one conjunction at TCA. All vectors are in
    a common inertial frame (km, km/s). Returns Pc, max Pc, hard-body radius,
    encounter-plane miss components, the 2-D covariance and the risk band.
    """
    p_pos = np.asarray(p_pos_km, dtype=float)
    s_pos = np.asarray(s_pos_km, dtype=float)
    p_vel = np.asarray(p_vel_km_s, dtype=float)
    s_vel = np.asarray(s_vel_km_s, dtype=float)

    rel_pos = p_pos - s_pos
    rel_vel = p_vel - s_vel
    relative_speed = float(np.linalg.norm(rel_vel))

    cov_p = _covariance_eci(p_pos, p_vel, p_days_since_epoch, sigma_intrack_override_km)
    cov_s = _covariance_eci(s_pos, s_vel, s_days_since_epoch, sigma_intrack_override_km)
    cov_rel = cov_p + cov_s

    basis = _encounter_plane_basis(rel_pos, rel_vel)   # 3x2
    miss_2d = basis.T @ rel_pos                          # 2-vector (km)
    cov_2d = basis.T @ cov_rel @ basis                   # 2x2 (km^2)

    if hbr_override_m is not None:
        hbr_m = hbr_override_m
    else:
        hbr_m = hard_body_radius_m(p_object_type, p_name) + hard_body_radius_m(s_object_type, s_name)
    hbr_km = hbr_m / 1000.0

    pc = _foster_2d_pc(miss_2d, cov_2d, hbr_km)
    pc_max = _max_pc(miss_2d, cov_2d, hbr_km)

    return {
        "collision_probability": pc,
        "max_collision_probability": pc_max,
        "hard_body_radius_m": hbr_m,
        "relative_speed_km_per_s": relative_speed,
        "miss_x_km": float(miss_2d[0]),
        "miss_y_km": float(miss_2d[1]),
        "covariance_2d_km2": [[float(cov_2d[0, 0]), float(cov_2d[0, 1])],
                              [float(cov_2d[1, 0]), float(cov_2d[1, 1])]],
        "risk_level": classify_risk(pc),
    }
