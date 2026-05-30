import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timezone, timedelta
from app.main import app

client = TestClient(app)

TEST_LINE1 = "1 25544U 98067A   26144.57790509  .00014790  00000-0  26653-3 0  9997"
TEST_LINE2 = "2 25544  51.6409 191.0776 0004128 316.0372 135.9189 15.49479326454746"

def test_observer_aer_api():
    ref_time = "2026-05-24T14:00:00Z"
    
    payload = {
        "name": "ISS (ZARYA)",
        "line1": TEST_LINE1,
        "line2": TEST_LINE2,
        "timestamp_utc": ref_time,
        "observer_latitude_deg": 39.9334,
        "observer_longitude_deg": 32.8597,
        "observer_elevation_m": 938.0
    }
    
    response = client.post("/api/v1/observer/aer", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    assert 0.0 <= data["azimuth_deg"] <= 360.0
    assert -90.0 <= data["elevation_deg"] <= 90.0
    assert data["range_km"] > 0.0

def test_observer_passes_api():
    start = "2026-05-24T14:00:00Z"
    end = "2026-05-25T14:00:00Z" # 24h
    
    payload = {
        "name": "ISS (ZARYA)",
        "line1": TEST_LINE1,
        "line2": TEST_LINE2,
        "observer_latitude_deg": 39.9334,
        "observer_longitude_deg": 32.8597,
        "observer_elevation_m": 938.0,
        "start_time_utc": start,
        "end_time_utc": end,
        "min_elevation_deg": 10.0
    }
    
    response = client.post("/api/v1/observer/passes", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "aos_time_utc" in data[0]
    assert "max_elevation_deg" in data[0]
