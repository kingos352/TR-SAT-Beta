from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.schemas.physics import (
    PropagationRequest,
    EphemerisRequest,
    CatalogPropagationRequest,
    CatalogEphemerisRequest,
    CatalogECIRequest,
    CatalogECIEphemerisRequest,
    ECIStatePoint,
    SatelliteState,
)
from app.services.astrodynamics import propagate_state, generate_ephemeris, get_eci_state, generate_eci_ephemeris
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

@router.post("/catalog/eci-state", response_model=ECIStatePoint)
def get_catalog_eci_state(req: CatalogECIRequest, db: Session = Depends(get_db)):
    """
    Return the GCRS/ECI position and velocity vectors for a catalog object at a given epoch.
    Used by the Research Lab Numerical Experiment module as integration initial conditions.
    """
    lookup = get_catalog_object_with_latest_tle(db, req.norad_id)
    if not lookup:
        raise HTTPException(status_code=404, detail=f"NORAD {req.norad_id} not found or lacks TLE data.")
    rso, tle = lookup
    try:
        return get_eci_state(rso.name, tle.line1, tle.line2, req.timestamp_utc)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"ECI state computation failed: {str(e)}")

@router.post("/catalog/eci-ephemeris", response_model=List[ECIStatePoint])
def get_catalog_eci_ephemeris(req: CatalogECIEphemerisRequest, db: Session = Depends(get_db)):
    """
    Return an ECI (GCRS) state-vector timeseries for a catalog object.
    Used by the Research Lab Numerical Experiment module for SGP4 baseline comparison.
    """
    lookup = get_catalog_object_with_latest_tle(db, req.norad_id)
    if not lookup:
        raise HTTPException(status_code=404, detail=f"NORAD {req.norad_id} not found or lacks TLE data.")
    rso, tle = lookup
    try:
        return generate_eci_ephemeris(rso.name, tle.line1, tle.line2,
                                      req.start_time_utc, req.end_time_utc, req.step_seconds)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"ECI ephemeris failed: {str(e)}")
