import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta, timezone

from app.main import app
from app.database import Base, get_db
from app.models.rso import RSOCatalog, TLERecord
from app.services.catalog_analytics import classify_orbital_regime

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_analytics.sqlite"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    db = TestingSessionLocal()
    
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    
    # 1. LEO - Active Payload
    r1 = RSOCatalog(norad_id=10001, name="LEO-SAT", object_type="PAYLOAD", category="COMMUNICATIONS", source="TEST", source_group="active")
    t1 = TLERecord(
        norad_id=10001, name="LEO-SAT", line1="1", line2="2", epoch=now,
        mean_motion_rev_per_day=15.0, eccentricity=0.001, inclination_deg=45.0, source="TEST", source_group="active"
    )
    
    # 2. GEO - Stale TLE
    r2 = RSOCatalog(norad_id=10002, name="GEO-SAT", object_type="PAYLOAD", category="WEATHER", source="TEST", source_group="active")
    t2 = TLERecord(
        norad_id=10002, name="GEO-SAT", line1="1", line2="2", epoch=now - timedelta(days=10),
        mean_motion_rev_per_day=1.0027, eccentricity=0.0001, inclination_deg=0.0, source="TEST", source_group="active"
    )
    
    # 3. HEO - Debris
    r3 = RSOCatalog(norad_id=10003, name="HEO-DEB", object_type="DEBRIS", category="UNKNOWN", source="TEST", source_group="debris")
    t3 = TLERecord(
        norad_id=10003, name="HEO-DEB", line1="1", line2="2", epoch=now,
        mean_motion_rev_per_day=2.0, eccentricity=0.7, inclination_deg=60.0, source="TEST", source_group="debris"
    )

    db.add_all([r1, t1, r2, t2, r3, t3])
    db.commit()
    db.close()

def test_regime_classification():
    assert classify_orbital_regime(15.0, 0.001) == "LEO"
    assert classify_orbital_regime(1.0027, 0.0001) == "GEO"
    assert classify_orbital_regime(2.0, 0.7) == "HEO"
    assert classify_orbital_regime(None, None) == "UNKNOWN"

def test_analytics_summary_endpoint():
    response = client.get("/api/v1/analytics/catalog-summary")
    assert response.status_code == 200
    data = response.json()
    
    assert data["total_objects"] == 3
    assert data["by_object_type"]["PAYLOAD"] == 2
    assert data["by_object_type"]["DEBRIS"] == 1
    
    assert data["by_orbital_regime"]["LEO"] == 1
    assert data["by_orbital_regime"]["GEO"] == 1
    assert data["by_orbital_regime"]["HEO"] == 1
    
    # One TLE is 10 days old
    assert data["freshness_summary"]["stale_count"] == 1
    assert data["stale_percentage"] == pytest.approx(33.33, rel=1e-2)
    assert data["debris_percentage"] == pytest.approx(33.33, rel=1e-2)

def test_analytics_summary_with_filters():
    response = client.get("/api/v1/analytics/catalog-summary?object_type=PAYLOAD")
    assert response.status_code == 200
    data = response.json()
    
    assert data["total_objects"] == 2
    assert "DEBRIS" not in data["by_object_type"]
