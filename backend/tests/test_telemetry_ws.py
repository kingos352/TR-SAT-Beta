import pytest
import os
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db
from app.models.rso import RSOCatalog, TLERecord

# Use a test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_telemetry_ws.sqlite"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="module")
def db_setup():
    # Setup test tables
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Pre-populate with mock TLE records for testing
    iss = RSOCatalog(
        norad_id=25544,
        name="ISS (ZARYA)",
        object_type="PAYLOAD",
        category="Space Station",
        source="CelesTrak",
        source_group="stations"
    )
    iss_tle = TLERecord(
        norad_id=25544,
        name="ISS (ZARYA)",
        line1="1 25544U 98067A   26144.57790509  .00014790  00000-0  26653-3 0  9997",
        line2="2 25544  51.6409 191.0776 0004128 316.0372 135.9189 15.49479326454746",
        epoch=datetime.now(timezone.utc),
        source="CelesTrak",
        source_group="stations"
    )
    
    noaa = RSOCatalog(
        norad_id=33591,
        name="NOAA 19",
        object_type="PAYLOAD",
        category="Weather",
        source="CelesTrak",
        source_group="weather"
    )
    noaa_tle = TLERecord(
        norad_id=33591,
        name="NOAA 19",
        line1="1 33591U 09005A   26144.50293810  .00000091  00000-0  78434-4 0  9991",
        line2="2 33591  99.1973  92.5193 0013912  85.2012 275.0592 14.12563810892842",
        epoch=datetime.now(timezone.utc),
        source="CelesTrak",
        source_group="weather"
    )
    
    db.add(iss)
    db.add(iss_tle)
    db.add(noaa)
    db.add(noaa_tle)
    db.commit()
    
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
        if os.path.exists("test_telemetry_ws.sqlite"):
            try:
                os.remove("test_telemetry_ws.sqlite")
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

def test_telemetry_websocket_flow(client):
    with client.websocket_connect("/api/v1/ws/telemetry") as websocket:
        # Check initial connection status frame
        resp = websocket.receive_json()
        assert resp["type"] == "status"
        assert resp["status"] == "connected"
        
        # 1. Subscribe to valid satellite
        websocket.send_json({
            "action": "subscribe",
            "norad_ids": [25544],
            "rate_hz": 2.0
        })
        
        resp = websocket.receive_json()
        assert resp["type"] == "status"
        assert resp["status"] == "connected"
        
        # Receive a telemetry frame
        frame = websocket.receive_json()
        assert frame["type"] == "telemetry_frame"
        assert frame["rate_hz"] == 2.0
        assert "timestamp_utc" in frame
        assert len(frame["objects"]) == 1
        obj = frame["objects"][0]
        assert obj["norad_id"] == 25544
        assert obj["name"] == "ISS (ZARYA)"
        assert "latitude_deg" in obj
        assert "longitude_deg" in obj
        assert "altitude_km" in obj
        assert "ecef" in obj
        assert "reliability_status" in obj
        
        # 2. Update subscription to multiple satellites
        websocket.send_json({
            "action": "update",
            "norad_ids": [25544, 33591],
            "rate_hz": 1.0
        })
        resp = websocket.receive_json()
        assert resp["type"] == "status"
        assert resp["status"] == "resumed"
        
        frame = websocket.receive_json()
        assert frame["type"] == "telemetry_frame"
        assert len(frame["objects"]) <= 2
        
        # 3. Test missing NORAD ID returns errors but does not crash
        websocket.send_json({
            "action": "subscribe",
            "norad_ids": [25544, 99999],
            "rate_hz": 1.0
        })
        
        resp = websocket.receive_json()
        assert resp["type"] == "status"
        
        err = websocket.receive_json()
        assert err["type"] == "error"
        assert "missing_ids" in err["details"]
        assert 99999 in err["details"]["missing_ids"]
        
        # 4. Test limits (more than 20 objects)
        websocket.send_json({
            "action": "subscribe",
            "norad_ids": list(range(1, 25))
        })
        err = websocket.receive_json()
        assert err["type"] == "error"
        assert "Maximum tracking selection limit" in err["message"]
        
        # 5. Test pause/resume/stop
        websocket.send_json({"action": "pause"})
        resp = websocket.receive_json()
        assert resp["type"] == "status"
        assert resp["status"] == "paused"
        
        websocket.send_json({"action": "resume"})
        resp = websocket.receive_json()
        assert resp["type"] == "status"
        assert resp["status"] == "resumed"
        
        # 6. Test all objects failing
        websocket.send_json({
            "action": "subscribe",
            "norad_ids": [99998],
            "rate_hz": 1.0
        })
        resp = websocket.receive_json()
        assert resp["type"] == "status"
        
        # Receiver error about missing
        err = websocket.receive_json()
        assert err["type"] == "error"
        assert "missing_ids" in err["details"]
        
        # Sender error about all failing
        err2 = websocket.receive_json()
        assert err2["type"] == "error"
        assert "All selected objects failed" in err2["message"]

        # 7. Test clamping rate_hz
        websocket.send_json({
            "action": "subscribe",
            "norad_ids": [25544],
            "rate_hz": 10.0 # Will be clamped to 5.0
        })
        resp = websocket.receive_json()
        assert resp["type"] == "status"
        
        frame = websocket.receive_json()
        assert frame["type"] == "telemetry_frame"
        assert frame["rate_hz"] == 5.0

        websocket.send_json({
            "action": "subscribe",
            "norad_ids": [25544],
            "rate_hz": 0.1 # Will be clamped to 0.2
        })
        resp = websocket.receive_json()
        assert resp["type"] == "status"
        
        frame = websocket.receive_json()
        assert frame["type"] == "telemetry_frame"
        assert frame["rate_hz"] == 0.2
