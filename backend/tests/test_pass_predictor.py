import pytest
from datetime import datetime, timezone, timedelta
from app.services.pass_predictor import predict_passes_from_tle

# Benchmark ISS TLE sample (Epoch: 2026-05-24T13:52:11.000 UTC)
TEST_LINE1 = "1 25544U 98067A   26144.57790509  .00014790  00000-0  26653-3 0  9997"
TEST_LINE2 = "2 25544  51.6409 191.0776 0004128 316.0372 135.9189 15.49479326454746"

def test_predict_passes_returns_valid_passes():
    # Nevşehir, Turkey observer
    obs_lat = 38.6244
    obs_lon = 34.7144
    obs_elev = 1200.0
    
    # 24-hour prediction window starting near epoch
    start_time = datetime(2026, 5, 24, 14, 0, 0, tzinfo=timezone.utc)
    end_time = start_time + timedelta(days=1)
    
    passes = predict_passes_from_tle(
        "ISS (ZARYA)", TEST_LINE1, TEST_LINE2,
        obs_lat, obs_lon, obs_elev, start_time, end_time, min_elevation_deg=10.0
    )
    
    assert isinstance(passes, list)
    # A LEO satellite like ISS will pass over Turkey multiple times in 24h. We expect at least 1 pass window.
    assert len(passes) >= 1
    
    # Validate keys in first pass window
    p = passes[0]
    assert isinstance(p["aos_time_utc"], datetime)
    assert isinstance(p["max_time_utc"], datetime)
    assert isinstance(p["los_time_utc"], datetime)
    assert p["los_time_utc"] > p["max_time_utc"] > p["aos_time_utc"]
    
    assert p["max_elevation_deg"] >= 10.0
    assert 0.0 <= p["azimuth_aos_deg"] <= 360.0
    assert 0.0 <= p["azimuth_max_deg"] <= 360.0
    assert 0.0 <= p["azimuth_los_deg"] <= 360.0
    assert p["range_at_max_km"] > 100.0  # Range must be physically valid
