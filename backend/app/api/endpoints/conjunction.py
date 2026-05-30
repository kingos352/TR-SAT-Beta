from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.conjunction import (
    ConjunctionScreenRequest,
    ConjunctionScreenResponse,
    DebrisWatchRequest,
)
from app.services.conjunction import screen_conjunctions, screen_catalog_debris

router = APIRouter()

@router.post("/screen", response_model=ConjunctionScreenResponse)
def screen_for_conjunctions(
    request: ConjunctionScreenRequest,
    db: Session = Depends(get_db)
):
    try:
        response = screen_conjunctions(db, request)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/debris-watch", response_model=ConjunctionScreenResponse)
def screen_debris_watch(
    request: DebrisWatchRequest,
    db: Session = Depends(get_db)
):
    """Catalog-wide debris conjunction screen — runs without a selected object."""
    try:
        return screen_catalog_debris(db, request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
