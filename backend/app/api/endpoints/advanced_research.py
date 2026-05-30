from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.database import get_db
from app.models.rso import TLERecord
from app.schemas.advanced_research import HistoricalTLEPoint, OrbitalDecayIndicators, RelativeMotionResult

from app.services.historical_tle import get_historical_tles, get_decay_indicators
from app.services.illumination import determine_illumination_state
from app.services.relative_motion import get_relative_motion

router = APIRouter()

@router.get("/historical/{norad_id}", response_model=List[HistoricalTLEPoint])
def get_historical_tle_endpoint(norad_id: int, db: Session = Depends(get_db)):
    points = get_historical_tles(db, norad_id)
    return points

@router.get("/decay-indicators/{norad_id}", response_model=OrbitalDecayIndicators)
def get_decay_indicators_endpoint(norad_id: int, db: Session = Depends(get_db)):
    points = get_historical_tles(db, norad_id)
    return get_decay_indicators(points)

@router.get("/illumination/{norad_id}")
def get_illumination_endpoint(norad_id: int, t_utc: datetime = Query(...), db: Session = Depends(get_db)):
    # get latest tle
    tle = db.query(TLERecord).filter(TLERecord.norad_id == norad_id).order_by(TLERecord.epoch.desc()).first()
    if not tle:
        raise HTTPException(status_code=404, detail="TLE not found for object")
        
    state = determine_illumination_state(tle.line1, tle.line2, t_utc)
    return {"illumination_state": state}

@router.get("/relative-motion", response_model=RelativeMotionResult)
def get_relative_motion_endpoint(primary_id: int, secondary_id: int, tca_utc: datetime, db: Session = Depends(get_db)):
    try:
        return get_relative_motion(db, primary_id, secondary_id, tca_utc)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
