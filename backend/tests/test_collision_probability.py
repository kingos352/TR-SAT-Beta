import numpy as np
from app.services import collision_probability as cp


def test_hard_body_radius_by_type():
    assert cp.hard_body_radius_m("DEBRIS") == 0.5
    assert cp.hard_body_radius_m("ROCKET_BODY") == 4.0
    assert cp.hard_body_radius_m("PAYLOAD") == 2.0
    assert cp.hard_body_radius_m("UNKNOWN") == cp.DEFAULT_HBR_M
    assert cp.hard_body_radius_m(None) == cp.DEFAULT_HBR_M


def test_hard_body_radius_name_override():
    # ISS is far larger than its PAYLOAD default.
    assert cp.hard_body_radius_m("PAYLOAD", "ISS (ZARYA)") == 55.0


def test_classify_risk_thresholds():
    assert cp.classify_risk(5e-4) == "HIGH"
    assert cp.classify_risk(5e-5) == "MEDIUM"
    assert cp.classify_risk(5e-6) == "LOW"
    assert cp.classify_risk(1e-9) == "NEGLIGIBLE"


def _head_on_scenario(miss_km: float, days: float = 0.0, hbr_m: float = 1.0):
    """Two objects passing with a head-on relative velocity and a radial miss."""
    p_pos = np.array([7000.0, 0.0, 0.0])
    p_vel = np.array([0.0, 7.5, 0.0])
    s_pos = np.array([7000.0 + miss_km, 0.0, 0.0])
    s_vel = np.array([0.0, -7.5, 0.0])
    return cp.estimate_collision(
        p_pos, p_vel, s_pos, s_vel,
        p_days_since_epoch=days, s_days_since_epoch=days,
        p_object_type="DEBRIS", s_object_type="DEBRIS",
        hbr_override_m=hbr_m,
    )


def test_relative_speed_is_vector_difference():
    res = _head_on_scenario(miss_km=1.0)
    assert abs(res["relative_speed_km_per_s"] - 15.0) < 1e-6


def test_miss_vector_in_encounter_plane():
    res = _head_on_scenario(miss_km=2.0)
    # The miss is purely radial -> lands on the first encounter-plane axis.
    assert abs(abs(res["miss_x_km"]) - 2.0) < 1e-6
    assert abs(res["miss_y_km"]) < 1e-6


def test_pc_decreases_with_miss_distance():
    near = _head_on_scenario(miss_km=0.05)
    far = _head_on_scenario(miss_km=20.0)
    assert near["collision_probability"] > far["collision_probability"]
    assert near["max_collision_probability"] >= near["collision_probability"]


def test_pc_increases_with_hard_body_radius():
    small = _head_on_scenario(miss_km=0.2, hbr_m=1.0)
    large = _head_on_scenario(miss_km=0.2, hbr_m=50.0)
    assert large["collision_probability"] > small["collision_probability"]


def test_high_risk_for_direct_hit():
    res = _head_on_scenario(miss_km=0.0, hbr_m=50.0)
    assert res["collision_probability"] > cp.RISK_LOW
    assert res["risk_level"] in ("HIGH", "MEDIUM", "LOW")


def test_uncertainty_grows_with_tle_age():
    # A larger covariance spreads probability away from a near-zero miss, so a
    # very fresh pair concentrates more probability inside a tiny hard-body disk.
    fresh = _head_on_scenario(miss_km=0.01, days=0.0, hbr_m=1.0)
    stale = _head_on_scenario(miss_km=0.01, days=10.0, hbr_m=1.0)
    assert fresh["collision_probability"] >= stale["collision_probability"]


def test_covariance_2d_symmetric():
    res = _head_on_scenario(miss_km=1.0, days=3.0)
    c = res["covariance_2d_km2"]
    assert abs(c[0][1] - c[1][0]) < 1e-9
    assert c[0][0] > 0 and c[1][1] > 0
