import pytest
import os
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import patch, MagicMock

from app.main import app
from app.database import Base, get_db
from app.models.rso import RSOCatalog, TLERecord

# Use a test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_trsat.sqlite"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="module")
def db_setup():
    # Setup test tables
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
        if os.path.exists("test_trsat.sqlite"):
            try:
                os.remove("test_trsat.sqlite")
            except PermissionError:
                pass

@pytest.fixture(scope="module")
def client(db_setup):
    def override_get_db():
        try:
            yield db_setup
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

# Mock TLE Data
MOCK_TLE_DATA = """ISS (ZARYA)
1 25544U 98067A   26144.57790509  .00014790  00000-0  26653-3 0  9997
2 25544  51.6409 191.0776 0004128 316.0372 135.9189 15.49479326454746
"""

@patch("app.services.celestrak.httpx.get")
def test_sync_catalog(mock_get, client):
    # Mock httpx.get response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.text = MOCK_TLE_DATA
    mock_get.return_value = mock_response

    # Sync Stations Group
    response = client.post("/api/v1/catalog/sync", json={"group": "stations"})
    assert response.status_code == 200
    data = response.json()
    
    assert data["group"] == "stations"
    assert data["fetched_count"] == 1
    assert data["inserted_objects"] == 1
    assert data["inserted_tles"] == 1

def test_sync_catalog_unsupported_group(client):
    response = client.post("/api/v1/catalog/sync", json={"group": "invalid_group_name"})
    assert response.status_code == 400

def test_get_supported_groups(client):
    response = client.get("/api/v1/catalog/groups")
    assert response.status_code == 200
    groups = response.json()
    assert "stations" in groups
    assert "active" in groups

def test_search_catalog(client):
    # Search for ISS
    response = client.get("/api/v1/catalog/search?q=ISS")
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["name"] == "ISS (ZARYA)"
    assert results[0]["norad_id"] == 25544
    assert results[0]["latest_tle"] is not None
    assert results[0]["latest_tle"]["inclination_deg"] == 51.6409

    # Search for empty query should return ISS since it is in DB
    response_all = client.get("/api/v1/catalog/search")
    assert response_all.status_code == 200
    assert len(response_all.json()) >= 1

    # Search with no matching parameters
    response_empty = client.get("/api/v1/catalog/search?q=NO_SATELLITE_MATCH")
    assert response_empty.status_code == 200
    assert len(response_empty.json()) == 0

def test_get_rso_details(client):
    response = client.get("/api/v1/catalog/25544")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "ISS (ZARYA)"
    assert data["norad_id"] == 25544
    assert data["latest_tle"]["eccentricity"] == 0.0004128

def test_get_rso_details_not_found(client):
    response = client.get("/api/v1/catalog/99999")
    assert response.status_code == 404
