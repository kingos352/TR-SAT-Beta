import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from app.main import app

# To test the logic without triggering DB import errors if they exist,
# we import functions directly, patching if necessary, or just test the pure logic.
from app.services.reliability_analysis import get_reliability_label, calculate_age_days

client = TestClient(app)

def test_reliability_boundaries():
    # exactly 2 days -> FRESH
    assert get_reliability_label(2.0) == "FRESH"
    # >2 and <= 14 -> AGING
    assert get_reliability_label(2.0001) == "AGING"
    # exactly 14 -> AGING
    assert get_reliability_label(14.0) == "AGING"
    # >14 -> STALE
    assert get_reliability_label(14.0001) == "STALE"

@patch("app.services.reliability_analysis.datetime")
def test_calculate_age_days(mock_dt):
    # Mock datetime.now(timezone.utc) to return a fixed time
    fixed_now = datetime(2025, 1, 15, 12, 0, tzinfo=timezone.utc)
    mock_dt.now.return_value = fixed_now
    
    # Epoch 1 day ago
    epoch = fixed_now - timedelta(days=1)
    
    age = calculate_age_days(epoch)
    assert age == 1.0

@patch("app.api.endpoints.research.get_reliability_summary")
def test_get_reliability_summary_endpoint(mock_get_summary):
    mock_get_summary.return_value = {
        "overall_freshness_score": 85.0,
        "total_objects": 100,
        "fresh_count": 50,
        "aging_count": 30,
        "stale_count": 20,
        "unknown_count": 0,
        "average_age_days": 8.5,
        "median_age_days": 7.0,
        "age_histogram": [
            {"label": "0-2d", "count": 50},
            {"label": "2-5d", "count": 15},
            {"label": "5-10d", "count": 15},
            {"label": "10-15d", "count": 10},
            {"label": "15d+", "count": 10}
        ]
    }
    
    response = client.get("/api/v1/research/reliability-summary")
    assert response.status_code == 200
    data = response.json()
    assert data["total_objects"] == 100
    assert data["overall_freshness_score"] == 85.0
    mock_get_summary.assert_called_once()

@patch("app.api.endpoints.research.get_object_reliability")
def test_get_object_reliability_endpoint(mock_get_object):
    mock_get_object.return_value = {
        "norad_id": 25544,
        "tle_epoch_utc": "2025-01-14T12:00:00",
        "tle_age_days": 10.5,
        "reliability_label": "AGING",
        "warnings": []
    }
    
    response = client.get("/api/v1/research/object-reliability/25544")
    assert response.status_code == 200
    data = response.json()
    assert data["norad_id"] == 25544
    assert data["reliability_label"] == "AGING"
    mock_get_object.assert_called_once()
