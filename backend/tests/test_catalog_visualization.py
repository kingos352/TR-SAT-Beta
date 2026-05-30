import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
from datetime import datetime, timezone
import math

from app.main import app
from app.database import get_db
from app.models.rso import RSOCatalog, TLERecord

client = TestClient(app)

def override_get_db():
    db = MagicMock()
    return db

@pytest.fixture(autouse=True)
def setup_db_mock():
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.clear()

def test_snapshot_limit_exceeds_cap():
    # The "MAX" option loads the full catalog; the cap is 50000.
    response = client.post("/api/v1/catalog-visualization/snapshot", json={"limit": 50001})
    assert response.status_code in (400, 422)
    assert "limit" in response.text.lower()

def test_snapshot_filters_work():
    mock_db = MagicMock()
    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.all.return_value = []
    
    app.dependency_overrides[get_db] = lambda: mock_db
    
    response = client.post("/api/v1/catalog-visualization/snapshot", json={"object_type": "PAYLOAD", "limit": 100})
    assert response.status_code == 200
    assert mock_query.filter.called

def test_snapshot_missing_tles_skipped():
    mock_db = MagicMock()
    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.limit.return_value = mock_query
    
    mock_rso = RSOCatalog(norad_id=99999, object_type="PAYLOAD", name="NO TLE SAT")
    
    # Let the first all() return the RSO, the second all() return empty TLEs
    mock_query.all.side_effect = [[mock_rso], []]
    
    app.dependency_overrides[get_db] = lambda: mock_db
    
    response = client.post("/api/v1/catalog-visualization/snapshot", json={"limit": 10})
    assert response.status_code == 200
    data = response.json()
    assert "objects" in data
    assert len(data["objects"]) == 0
    assert data["skipped_count"] == 1

def test_snapshot_timestamp_defaults_to_current_utc():
    mock_db = MagicMock()
    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.limit.return_value = mock_query
    
    mock_rso = RSOCatalog(norad_id=25544, object_type="PAYLOAD", name="ISS")
    mock_tle = TLERecord(
        norad_id=25544, 
        line1="1 25544U 98067A   21001.00000000  .00000000  00000-0  00000-0 0  9999", 
        line2="2 25544 000.0000 000.0000 0000000 000.0000 000.0000 00.00000000000000"
    )
    
    mock_query.all.side_effect = [[mock_rso], [mock_tle]]
    
    app.dependency_overrides[get_db] = lambda: mock_db
    
    response = client.post("/api/v1/catalog-visualization/snapshot", json={"limit": 10})
    assert response.status_code == 200
    data = response.json()
    
    assert "timestamp_utc" in data
    dt = datetime.fromisoformat(data["timestamp_utc"].replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    # The timestamp should be very close to now (within a few seconds)
    assert abs((now - dt).total_seconds()) < 10
