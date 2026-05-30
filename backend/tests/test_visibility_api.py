import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
from app.main import app
from app.schemas.visibility import VisibilityScreenResponse, ObserverLocation, VisibilityResultObject
from datetime import datetime, timezone

client = TestClient(app)

@patch('app.api.endpoints.visibility.find_current_visible_objects')
def test_get_current_visible_objects(mock_find):
    mock_find.return_value = VisibilityScreenResponse(
        timestamp_utc=datetime(2020, 1, 1, tzinfo=timezone.utc),
        observer=ObserverLocation(latitude_deg=0.0, longitude_deg=0.0, elevation_m=0.0),
        returned_count=1,
        evaluated_count=1,
        skipped_count=0,
        objects=[
            VisibilityResultObject(
                norad_id="25544",
                name="ISS",
                object_type="PAYLOAD",
                category="STATION",
                source="USSTRATCOM",
                source_group="ACTIVE",
                azimuth_deg=90.0,
                elevation_deg=45.0,
                range_km=500.0,
                visibility_class="HIGH_ELEVATION",
                reliability_status="RELIABLE",
                tle_age_days=1.0
            )
        ],
        warnings=[],
        disclaimer="Visibility is based on TLE/GP-derived SGP4 propagation..."
    )

    req_data = {
        "observer_latitude_deg": 0.0,
        "observer_longitude_deg": 0.0,
        "observer_elevation_m": 0.0,
        "min_elevation_deg": 10.0,
        "high_elevation_deg": 45.0,
        "max_candidates": 10,
        "limit": 10
    }
    
    # Needs a DB override or mock, but app is loaded and Depends(get_db) is used
    # Wait, the endpoint uses db: Session = Depends(get_db)
    # We mocked find_current_visible_objects, so DB isn't actually used
    response = client.post("/api/v1/visibility/current", json=req_data)
    
    assert response.status_code == 200
    data = response.json()
    assert data["returned_count"] == 1
    assert len(data["objects"]) == 1
    assert data["objects"][0]["norad_id"] == "25544"

@patch('app.api.endpoints.visibility.find_current_visible_objects')
def test_get_current_visible_objects_error(mock_find):
    mock_find.side_effect = Exception("DB Connection Error")
    
    req_data = {
        "observer_latitude_deg": 0.0,
        "observer_longitude_deg": 0.0,
        "observer_elevation_m": 0.0
    }
    
    response = client.post("/api/v1/visibility/current", json=req_data)
    assert response.status_code == 500
    assert "DB Connection Error" in response.json()["detail"]
