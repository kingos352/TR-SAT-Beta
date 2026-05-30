import numpy as np
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace

from app.services.conjunction import (
    classify_severity,
    _orbital_radii_km,
    _radial_bands_overlap,
    _refine_tca,
    APOGEE_PERIGEE_PAD_KM,
)


def test_severity_classification():
    assert classify_severity(0.5) == "CRITICAL_CANDIDATE"
    assert classify_severity(5.0) == "CLOSE"
    assert classify_severity(20.0) == "WATCH"
    assert classify_severity(55.0) == "INFO"


def test_orbital_radii_leo():
    # ISS-like: ~15.5 rev/day, near-circular -> perigee ~ apogee ~ 6790 km.
    tle = SimpleNamespace(mean_motion_rev_per_day=15.5, eccentricity=0.0006)
    peri, apo = _orbital_radii_km(tle)
    assert peri < apo
    assert 6600 < peri < 6900
    assert 6600 < apo < 6900


def test_orbital_radii_missing_elements():
    assert _orbital_radii_km(SimpleNamespace(mean_motion_rev_per_day=None, eccentricity=0.1)) is None
    assert _orbital_radii_km(SimpleNamespace(mean_motion_rev_per_day=15.0, eccentricity=None)) is None


def test_radial_bands_overlap():
    leo = (6700.0, 6720.0)
    geo = (42100.0, 42200.0)
    # LEO vs GEO shells are far apart -> filtered out.
    assert _radial_bands_overlap(leo, geo, APOGEE_PERIGEE_PAD_KM) is False
    # Overlapping shells -> kept.
    assert _radial_bands_overlap(leo, (6710.0, 6730.0), APOGEE_PERIGEE_PAD_KM) is True
    # Unknown elements -> never discard.
    assert _radial_bands_overlap(None, geo, APOGEE_PERIGEE_PAD_KM) is True


def test_refine_tca_subsecond():
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    refine_times = [t0 + timedelta(seconds=k) for k in range(5)]
    # Asymmetric minimum around index 2 -> TCA shifts off the grid node.
    dist = np.array([3.0, 2.0, 1.0, 1.2, 3.0])
    tca = _refine_tca(refine_times, dist, refine_step_s=1.0)
    assert refine_times[2] < tca < refine_times[3]


def test_refine_tca_symmetric_stays_on_node():
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    refine_times = [t0 + timedelta(seconds=k) for k in range(5)]
    dist = np.array([3.0, 2.0, 1.0, 2.0, 3.0])
    tca = _refine_tca(refine_times, dist, refine_step_s=1.0)
    assert tca == refine_times[2]
