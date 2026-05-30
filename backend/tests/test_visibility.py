import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone
from app.services.visibility import classify_visibility, compute_object_aer_from_tle, find_current_visible_objects
from app.schemas.visibility import VisibilityScreenRequest

def test_classify_visibility():
    assert classify_visibility(-5.0, 10.0, 45.0) == "BELOW_HORIZON"
    assert classify_visibility(5.0, 10.0, 45.0) == "LOW"
    assert classify_visibility(30.0, 10.0, 45.0) == "OBSERVABLE"
    assert classify_visibility(60.0, 10.0, 45.0) == "HIGH_ELEVATION"
    assert classify_visibility(80.0, 10.0, 45.0) == "OVERHEAD"

@patch('app.services.visibility.EarthSatellite')
@patch('app.services.visibility.wgs84')
def test_compute_object_aer_from_tle(mock_wgs84, mock_earth_satellite):
    mock_sat = MagicMock()
    mock_earth_satellite.return_value = mock_sat
    
    mock_observer = MagicMock()
    mock_wgs84.latlon.return_value = mock_observer
    
    mock_diff = MagicMock()
    mock_sat.__sub__.return_value = mock_diff
    
    mock_topocentric = MagicMock()
    mock_diff.at.return_value = mock_topocentric
    
    mock_alt = MagicMock()
    mock_alt.degrees = 45.0
    mock_az = MagicMock()
    mock_az.degrees = 90.0
    mock_dist = MagicMock()
    mock_dist.km = 500.0
    
    mock_topocentric.altaz.return_value = (mock_alt, mock_az, mock_dist)
    
    az, el, dist = compute_object_aer_from_tle(
        "1 25544U 98067A   20282.43328229  .00000788  00000-0  21953-4 0  9997",
        "2 25544  51.6443 251.6473 0001880 137.9822 301.7694 15.49206771249767",
        0.0, 0.0, 0.0, None
    )
    
    assert az == 90.0
    assert el == 45.0
    assert dist == 500.0

@patch('app.services.visibility.compute_object_aer_from_tle')
def test_find_current_visible_objects(mock_compute):
    # Setup mock returns
    mock_compute.return_value = (90.0, 45.0, 500.0)
    
    # Mock DB Session
    mock_db = MagicMock()
    
    # Mock RSO Candidates
    mock_rso = MagicMock()
    mock_rso.norad_id = 25544
    mock_rso.name = "ISS"
    mock_rso.object_type = "PAYLOAD"
    mock_rso.category = "STATION"
    mock_rso.source = "USSTRATCOM"
    mock_rso.source_group = "ACTIVE"
    
    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    
    # We need to simulate the candidates query and the TLE query
    # db.query(RSOCatalog)...all() returns candidates
    # db.query(TLERecord)...first() returns a TLE
    
    def mock_query_side_effect(model):
        from app.models.rso import RSOCatalog, TLERecord
        q = MagicMock()
        if model == RSOCatalog:
            q.filter.return_value = q
            q.limit.return_value = q
            q.all.return_value = [mock_rso]
            return q
        elif model == TLERecord:
            mock_tle = MagicMock()
            mock_tle.norad_id = 25544
            mock_tle.line1 = "1 25544U 98067A   20282.43328229  .00000788  00000-0  21953-4 0  9997"
            mock_tle.line2 = "2 25544  51.6443 251.6473 0001880 137.9822 301.7694 15.49206771249767"
            mock_tle.epoch = datetime(2020, 1, 1)
            
            q.filter.return_value = q
            q.order_by.return_value = q
            q.first.return_value = mock_tle
            return q
            
    mock_db.query.side_effect = mock_query_side_effect
    
    req = VisibilityScreenRequest(
        observer_latitude_deg=0.0,
        observer_longitude_deg=0.0,
        observer_elevation_m=0.0,
        min_elevation_deg=10.0,
        high_elevation_deg=45.0,
        max_candidates=10,
        limit=10,
        timestamp_utc=datetime(2020, 1, 2, tzinfo=timezone.utc)
    )
    
    resp = find_current_visible_objects(req, mock_db)
    
    assert resp.evaluated_count == 1
    assert len(resp.objects) == 1
    assert resp.objects[0].norad_id == "25544"
    assert resp.objects[0].visibility_class == "HIGH_ELEVATION"
    assert resp.objects[0].reliability_status == "RELIABLE"
