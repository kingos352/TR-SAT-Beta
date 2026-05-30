import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_illumination_state():
    # Provide dummy date and valid TLE
    # ISS TLE
    line1 = "1 25544U 98067A   23272.50000000  .00000000  00000-0  00000-0 0  9999"
    line2 = "2 25544  51.6400  0.0000 0005000  0.0000  0.0000 15.50000000    05"
    
    from app.services.illumination import determine_illumination_state
    
    # Just run it to see if it doesn't crash
    t = datetime.now(timezone.utc)
    res = determine_illumination_state(line1, line2, t)
    assert res in ["SUNLIT", "EARTH_SHADOW", "UNKNOWN"]
