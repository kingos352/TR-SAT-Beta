from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.spacetrack import (
    space_track_credentials_available,
    authenticate_spacetrack_client,
    fetch_spacetrack_latest_by_norad,
    fetch_spacetrack_by_object_type,
)

router = APIRouter()

@router.get("/status")
def get_spacetrack_status():
    """
    Check if Space-Track credentials are configured.
    """
    return {"configured": space_track_credentials_available()}

@router.post("/test-auth")
def test_spacetrack_auth():
    """
    Test authentication with Space-Track API.
    """
    try:
        client = authenticate_spacetrack_client()
        client.close()
        return {"status": "success", "message": "Successfully authenticated with Space-Track"}
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Authentication failed: {str(e)}"
        )

@router.post("/sync/norad/{norad_id}")
def sync_spacetrack_norad(norad_id: int, db: Session = Depends(get_db)):
    """
    Fetch and ingest Space-Track GP data for a specific NORAD ID.
    """
    try:
        result = fetch_spacetrack_latest_by_norad(db, norad_id)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Space-Track GP data integration failed for NORAD ID {norad_id}: {str(e)}"
        )

@router.post("/sync/object-type/{object_type}")
def sync_spacetrack_object_type(object_type: str, db: Session = Depends(get_db)):
    """
    Bulk-fetch and ingest all on-orbit objects of a type from Space-Track.
    `object_type` is one of: rocket-body, debris, payload.
    Rocket bodies in particular are not available as a CelesTrak group.
    """
    try:
        return fetch_spacetrack_by_object_type(db, object_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        # Upstream / authentication problems (e.g. invalid Space-Track credentials)
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Space-Track {object_type} bulk sync failed: {str(e)}"
        )
