import pytest
from datetime import datetime, timezone, timedelta
from app.services.astrodynamics import (
    ensure_utc,
    tle_age_days,
    classify_tle_reliability,
    latlonalt_to_ecef,
    propagate_state,
    generate_ephemeris,
    compute_observer_aer
)

# Reference TLE epoch: 2026-05-24T13:52:11.000 UTC (day 144.57790509 of 2026)
TEST_LINE1 = "1 25544U 98067A   26144.57790509  .00014790  00000-0  26653-3 0  9997"
TEST_LINE2 = "2 25544  51.6409 191.0776 0004128 316.0372 135.9189 15.49479326454746"

def test_ensure_utc_accepts_naive_datetime():
    naive = datetime(2026, 5, 24, 12, 0, 0)
    aware = ensure_utc(naive)
    assert aware.tzinfo == timezone.utc
    assert aware.hour == 12

    # Check already aware datetime
    aware_already = datetime(2026, 5, 24, 12, 0, 0, tzinfo=timezone.utc)
    assert ensure_utc(aware_already) == aware_already

def test_tle_age_and_reliability():
    # TLE Epoch is May 24, 2026
    tle_epoch = datetime(2026, 5, 24, 13, 52, 11, tzinfo=timezone.utc)
    
    # 1. Fresh Test: Age <= 2 days
    ref_fresh = tle_epoch + timedelta(days=1.5)
    age = tle_age_days(TEST_LINE1, ref_fresh)
    assert age == pytest.approx(1.5)
    assert classify_tle_reliability(age) == "FRESH"
    
    # 2. Aging Test: Age > 2 and <= 14 days
    ref_aging = tle_epoch + timedelta(days=8)
    age = tle_age_days(TEST_LINE1, ref_aging)
    assert age == pytest.approx(8.0)
    assert classify_tle_reliability(age) == "AGING"
    
    # 3. Stale Test: Age > 14 days
    ref_stale = tle_epoch + timedelta(days=20)
    age = tle_age_days(TEST_LINE1, ref_stale)
    assert age == pytest.approx(20.0)
    assert classify_tle_reliability(age) == "STALE"

def test_latlonalt_to_ecef_equator():
    # Equator intersection
    pos = latlonalt_to_ecef(0.0, 0.0, 0.0)
    assert pos["x_km"] == pytest.approx(6378.137)
    assert pos["y_km"] == pytest.approx(0.0)
    assert pos["z_km"] == pytest.approx(0.0)

def test_latlonalt_to_ecef_north_pole():
    # North pole intersection
    pos = latlonalt_to_ecef(90.0, 0.0, 0.0)
    assert pos["x_km"] == pytest.approx(0.0)
    assert pos["y_km"] == pytest.approx(0.0)
    assert pos["z_km"] == pytest.approx(6378.137)

def test_propagate_state_returns_valid_ranges():
    # Propagate at exact TLE epoch time
    ref_time = datetime(2026, 5, 24, 13, 52, 11, tzinfo=timezone.utc)
    state = propagate_state("ISS (ZARYA)", TEST_LINE1, TEST_LINE2, ref_time)
    
    assert state["name"] == "ISS (ZARYA)"
    assert -90.0 <= state["latitude_deg"] <= 90.0
    assert -180.0 <= state["longitude_deg"] <= 180.0
    assert state["altitude_km"] > 100.0  # LEO satellite is at least 100km altitude
    assert "x_km" in state["ecef"]
    assert "y_km" in state["ecef"]
    assert "z_km" in state["ecef"]
    assert state["reliability_status"] == "FRESH"

def test_generate_ephemeris_returns_expected_number_of_points():
    start = datetime(2026, 5, 24, 12, 0, 0, tzinfo=timezone.utc)
    end = start + timedelta(minutes=10)
    step = 60 # 1 minute
    
    ephemeris = generate_ephemeris("ISS (ZARYA)", TEST_LINE1, TEST_LINE2, start, end, step)
    
    # 10 minute window, 1 minute steps. Should contain 11 points (0th minute to 10th minute)
    assert len(ephemeris) == 11
    
    # Validate sequential increasing order
    for idx in range(1, len(ephemeris)):
        assert ephemeris[idx]["timestamp_utc"] > ephemeris[idx - 1]["timestamp_utc"]

def test_observer_aer_returns_valid_ranges():
    # Ankara Ground Station Observer Coordinates
    obs_lat = 39.9334
    obs_lon = 32.8597
    obs_elev = 938.0
    
    ref_time = datetime(2026, 5, 24, 14, 0, 0, tzinfo=timezone.utc)
    aer = compute_observer_aer(
        "ISS (ZARYA)", TEST_LINE1, TEST_LINE2, ref_time, obs_lat, obs_lon, obs_elev
    )
    
    assert 0.0 <= aer["azimuth_deg"] <= 360.0
    assert -90.0 <= aer["elevation_deg"] <= 90.0
    assert aer["range_km"] > 0.0
