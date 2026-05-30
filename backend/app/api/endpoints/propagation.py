from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.schemas.physics import (
    PropagationRequest,
    EphemerisRequest,
    CatalogPropagationRequest,
    CatalogEphemerisRequest,
    SatelliteState
)
from app.services.astrodynamics import propagate_state, generate_ephemeris
from app.services.catalog_lookup import get_catalog_object_with_latest_tle

router = APIRouter()

@router.post("/state", response_model=SatelliteState)
def propagate_raw_state(req: PropagationRequest):
    """
    Propagate orbital state at a given UTC epoch using raw TLE inputs.
    """
    try:
        state = propagate_state(req.name, req.line1, req.line2, req.timestamp_utc)
        return state
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Propagation failed: {str(e)}"
        )

@router.post("/ephemeris", response_model=List[SatelliteState])
def generate_raw_ephemeris(req: EphemerisRequest):
    """
    Generate an ephemeris coordinate timeseries using raw TLE inputs.
    """
    try:
        ephemeris = generate_ephemeris(
            req.name, req.line1, req.line2, 
            req.start_time_utc, req.end_time_utc, req.step_seconds
        )
        return ephemeris
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Ephemeris generation failed: {str(e)}"
        )

@router.post("/catalog/state", response_model=SatelliteState)
def propagate_catalog_state(req: CatalogPropagationRequest, db: Session = Depends(get_db)):
    """
    Propagate orbital state at a given UTC epoch using database-backed TLE.
    """
    lookup = get_catalog_object_with_latest_tle(db, req.norad_id)
    if not lookup:
        raise HTTPException(
            status_code=404,
            detail=f"Resident Space Object with NORAD ID {req.norad_id} not found or lacks TLE data."
        )
    
    rso, tle = lookup
    try:
        state = propagate_state(rso.name, tle.line1, tle.line2, req.timestamp_utc)
        return state
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Propagation failed: {str(e)}"
        )

@router.post("/catalog/ephemeris", response_model=List[SatelliteState])
def generate_catalog_ephemeris(req: CatalogEphemerisRequest, db: Session = Depends(get_db)):
    """
    Generate an ephemeris coordinate timeseries using database-backed TLE.
    """
    lookup = get_catalog_object_with_latest_tle(db, req.norad_id)
    if not lookup:
        raise HTTPException(
            status_code=404,
            detail=f"Resident Space Object with NORAD ID {req.norad_id} not found or lacks TLE data."
        )
        
    rso, tle = lookup
    try:
        ephemeris = generate_ephemeris(
            rso.name, tle.line1, tle.line2, 
            req.start_time_utc, req.end_time_utc, req.step_seconds
        )
        return ephemeris
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Ephemeris generation failed: {str(e)}"
        )
