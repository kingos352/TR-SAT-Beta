import pytest
import os
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone

from app.main import app
from app.database import Base, get_db
from app.models.rso import RSOCatalog, TLERecord

# Use a test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_physics_trsat.sqlite"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="module")
def db_setup():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        # Prepopulate with a test satellite and TLE record
        rso = RSOCatalog(
            norad_id=25544,
            name="ISS (ZARYA)",
            object_type="PAYLOAD",
            category="Space Station",
            source="CelesTrak",
            source_group="stations",
            cospar_id="98067A",
            last_updated=datetime.now(timezone.utc).replace(tzinfo=None)
        )
        db.add(rso)
        db.flush()
        
        tle = TLERecord(
            norad_id=25544,
            name="ISS (ZARYA)",
            line1="1 25544U 98067A   26144.57790509  .00014790  00000-0  26653-3 0  9997",
            line2="2 25544  51.6409 191.0776 0004128 316.0372 135.9189 15.49479326454746",
            epoch=datetime(2026, 5, 24, 13, 52, 11),
            inclination_deg=51.6409,
            raan_deg=191.0776,
            eccentricity=0.0004128,
            arg_perigee_deg=316.0372,
            mean_anomaly_deg=135.9189,
            mean_motion_rev_per_day=15.49479326,
            bstar=0.00026653,
            source="CelesTrak",
            source_group="stations",
            ingested_at=datetime.now(timezone.utc).replace(tzinfo=None)
        )
        db.add(tle)
        db.commit()
        
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
        if os.path.exists("test_physics_trsat.sqlite"):
            try:
                os.remove("test_physics_trsat.sqlite")
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

def test_propagate_catalog_state_api(client):
    ref_time = "2026-05-24T14:00:00Z"
    payload = {
        "norad_id": 25544,
        "timestamp_utc": ref_time
    }
    
    response = client.post("/api/v1/propagation/catalog/state", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "ISS (ZARYA)"
    assert -90.0 <= data["latitude_deg"] <= 90.0

def test_propagate_catalog_state_not_found(client):
    ref_time = "2026-05-24T14:00:00Z"
    payload = {
        "norad_id": 99999,
        "timestamp_utc": ref_time
    }
    
    response = client.post("/api/v1/propagation/catalog/state", json=payload)
    assert response.status_code == 404

def test_generate_catalog_ephemeris_api(client):
    start = "2026-05-24T14:00:00Z"
    end = "2026-05-24T14:05:00Z"
    payload = {
        "norad_id": 25544,
        "start_time_utc": start,
        "end_time_utc": end,
        "step_seconds": 60
    }
    
    response = client.post("/api/v1/propagation/catalog/ephemeris", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 6

def test_observer_catalog_aer_api(client):
    ref_time = "2026-05-24T14:00:00Z"
    payload = {
        "norad_id": 25544,
        "timestamp_utc": ref_time,
        "observer_latitude_deg": 39.9334,
        "observer_longitude_deg": 32.8597,
        "observer_elevation_m": 938.0
    }
    
    response = client.post("/api/v1/observer/catalog/aer", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert 0.0 <= data["azimuth_deg"] <= 360.0

def test_observer_catalog_passes_api(client):
    start = "2026-05-24T14:00:00Z"
    end = "2026-05-25T14:00:00Z"
    payload = {
        "norad_id": 25544,
        "observer_latitude_deg": 39.9334,
        "observer_longitude_deg": 32.8597,
        "observer_elevation_m": 938.0,
        "start_time_utc": start,
        "end_time_utc": end,
        "min_elevation_deg": 10.0
    }
    
    response = client.post("/api/v1/observer/catalog/passes", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
