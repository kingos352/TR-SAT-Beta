import pytest
import os
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import get_db

# Use a test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_conjunction_api.sqlite"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="module")
def db_setup():
    from app.models.rso import Base
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
        if os.path.exists("test_conjunction_api.sqlite"):
            try:
                os.remove("test_conjunction_api.sqlite")
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

def test_screen_conjunctions_horizon_rejected(client):
    start = datetime.now(timezone.utc)
    end = start + timedelta(days=8)  # > 7 days

    payload = {
        "mode": "selected_vs_selected",
        "primary_norad_ids": [25544],
        "secondary_norad_ids": [48274],
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "coarse_step_seconds": 60,
        "refine_step_seconds": 1,
        "max_candidates": 100
    }
    response = client.post("/api/v1/conjunction/screen", json=payload)
    assert response.status_code == 422
    assert "Screening horizon cannot exceed 7 days" in response.text

def test_screen_conjunctions_max_candidates_rejected(client):
    start = datetime.now(timezone.utc)
    end = start + timedelta(days=1)

    payload = {
        "mode": "selected_vs_selected",
        "primary_norad_ids": [25544],
        "secondary_norad_ids": [48274],
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "coarse_step_seconds": 60,
        "refine_step_seconds": 1,
        "max_candidates": 2001  # > 2000
    }
    response = client.post("/api/v1/conjunction/screen", json=payload)
    assert response.status_code == 422
    assert "less than or equal to 2000" in response.text or "max_candidates" in response.text

def test_screen_conjunctions_missing_tle(client):
    start = datetime.now(timezone.utc)
    end = start + timedelta(hours=1)

    # Database is empty, so 99999 and 88888 have no TLEs.
    payload = {
        "mode": "selected_vs_selected",
        "primary_norad_ids": [99999],
        "secondary_norad_ids": [88888],
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "coarse_step_seconds": 60,
        "refine_step_seconds": 1,
        "max_candidates": 100
    }
    response = client.post("/api/v1/conjunction/screen", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 0
    assert "disclaimer" in data
