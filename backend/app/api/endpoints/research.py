from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.reliability_analysis import ReliabilitySummary, ObjectReliabilityDetail
from app.services.reliability_analysis import get_reliability_summary, get_object_reliability

router = APIRouter()

@router.get("/reliability-summary", response_model=ReliabilitySummary)
def get_summary(db: Session = Depends(get_db)):
    try:
        return get_reliability_summary(db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/object-reliability/{norad_id}", response_model=ObjectReliabilityDetail)
def get_object_detail(norad_id: str, db: Session = Depends(get_db)):
    try:
        return get_object_reliability(db, norad_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
