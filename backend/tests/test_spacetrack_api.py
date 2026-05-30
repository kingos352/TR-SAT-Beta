import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from app.main import app

client = TestClient(app)

@patch('app.api.endpoints.spacetrack.authenticate_spacetrack_client', create=True)
def test_sync_spacetrack_missing_credentials(mock_auth):
    mock_auth.side_effect = Exception('Missing Space-Track credentials')
    
    response = client.post('/api/v1/spacetrack/test-auth')
    assert response.status_code == 401
    
    data = response.json()
    data_str = str(data).lower()
    
    assert 'password' not in data_str
    assert 'username' not in data_str
    assert 'credential' in data_str

@patch('app.api.endpoints.spacetrack.fetch_spacetrack_latest_by_norad', create=True)
def test_sync_spacetrack_success(mock_fetch):
    mock_fetch.return_value = {
        'status': 'success',
        'norad_id': 25544,
        'message': 'Space-Track authenticated catalog GP data integration successful.'
    }
    
    response = client.post('/api/v1/spacetrack/sync/norad/25544')
    assert response.status_code == 200
    data = response.json()
    assert data['status'] == 'success'
    
    data_str = str(data).lower()
    assert 'password' not in data_str
    assert 'username' not in data_str
