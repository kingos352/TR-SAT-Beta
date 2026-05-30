from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.visibility import VisibilityScreenRequest, VisibilityScreenResponse
from app.services.visibility import find_current_visible_objects

router = APIRouter()

@router.post("/current", response_model=VisibilityScreenResponse)
def get_current_visible_objects(req: VisibilityScreenRequest, db: Session = Depends(get_db)):
    """
    Find currently visible objects based on observer location and TLE propagation.
    """
    try:
        response = find_current_visible_objects(req, db)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
