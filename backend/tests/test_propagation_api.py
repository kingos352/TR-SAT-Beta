import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timezone, timedelta
from app.main import app

client = TestClient(app)

TEST_LINE1 = "1 25544U 98067A   26144.57790509  .00014790  00000-0  26653-3 0  9997"
TEST_LINE2 = "2 25544  51.6409 191.0776 0004128 316.0372 135.9189 15.49479326454746"

def test_propagate_raw_state_api():
    ref_time = "2026-05-24T14:00:00Z"
    
    payload = {
        "name": "ISS (ZARYA)",
        "line1": TEST_LINE1,
        "line2": TEST_LINE2,
        "timestamp_utc": ref_time
    }
    
    response = client.post("/api/v1/propagation/state", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    assert data["name"] == "ISS (ZARYA)"
    assert -90.0 <= data["latitude_deg"] <= 90.0
    assert -180.0 <= data["longitude_deg"] <= 180.0
    assert data["altitude_km"] > 100.0
    assert "x_km" in data["ecef"]
    assert "y_km" in data["ecef"]
    assert "z_km" in data["ecef"]
    assert data["reliability_status"] == "FRESH"

def test_generate_raw_ephemeris_api():
    start = "2026-05-24T14:00:00Z"
    end = "2026-05-24T14:05:00Z" # 5 minutes
    
    payload = {
        "name": "ISS (ZARYA)",
        "line1": TEST_LINE1,
        "line2": TEST_LINE2,
        "start_time_utc": start,
        "end_time_utc": end,
        "step_seconds": 60
    }
    
    response = client.post("/api/v1/propagation/ephemeris", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    assert isinstance(data, list)
    assert len(data) == 6 # 0, 1, 2, 3, 4, 5th minute points
    assert data[0]["name"] == "ISS (ZARYA)"
    assert -90.0 <= data[0]["latitude_deg"] <= 90.0
