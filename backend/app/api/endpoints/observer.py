from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.schemas.physics import (
    ObserverAERRequest,
    CatalogObserverAERRequest,
    ObserverAER,
    PassPredictionRequest,
    CatalogPassPredictionRequest,
    PassWindow
)
from app.services.astrodynamics import compute_observer_aer
from app.services.pass_predictor import predict_passes_from_tle
from app.services.catalog_lookup import get_catalog_object_with_latest_tle

router = APIRouter()

@router.post("/aer", response_model=ObserverAER)
def get_raw_observer_aer(req: ObserverAERRequest):
    """
    Compute Azimuth, Elevation, and Range (AER) relative to observer coordinates using raw TLE.
    """
    try:
        aer = compute_observer_aer(
            req.name, req.line1, req.line2, req.timestamp_utc,
            req.observer_latitude_deg, req.observer_longitude_deg, req.observer_elevation_m
        )
        return aer
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Observer AER computation failed: {str(e)}"
        )

@router.post("/catalog/aer", response_model=ObserverAER)
def get_catalog_observer_aer(req: CatalogObserverAERRequest, db: Session = Depends(get_db)):
    """
    Compute Azimuth, Elevation, and Range (AER) relative to observer coordinates using database-backed TLE.
    """
    lookup = get_catalog_object_with_latest_tle(db, req.norad_id)
    if not lookup:
        raise HTTPException(
            status_code=404,
            detail=f"Resident Space Object with NORAD ID {req.norad_id} not found or lacks TLE data."
        )
        
    rso, tle = lookup
    try:
        aer = compute_observer_aer(
            rso.name, tle.line1, tle.line2, req.timestamp_utc,
            req.observer_latitude_deg, req.observer_longitude_deg, req.observer_elevation_m
        )
        return aer
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Observer AER computation failed: {str(e)}"
        )

@router.post("/passes", response_model=List[PassWindow])
def get_raw_passes(req: PassPredictionRequest):
    """
    Predict ground station visibility pass windows using raw TLE.
    """
    try:
        passes = predict_passes_from_tle(
            req.name, req.line1, req.line2,
            req.observer_latitude_deg, req.observer_longitude_deg, req.observer_elevation_m,
            req.start_time_utc, req.end_time_utc, req.min_elevation_deg
        )
        return passes
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Pass prediction failed: {str(e)}"
        )

@router.post("/catalog/passes", response_model=List[PassWindow])
def get_catalog_passes(req: CatalogPassPredictionRequest, db: Session = Depends(get_db)):
    """
    Predict ground station visibility pass windows using database-backed TLE.
    """
    lookup = get_catalog_object_with_latest_tle(db, req.norad_id)
    if not lookup:
        raise HTTPException(
            status_code=404,
            detail=f"Resident Space Object with NORAD ID {req.norad_id} not found or lacks TLE data."
        )
        
    rso, tle = lookup
    try:
        passes = predict_passes_from_tle(
            rso.name, tle.line1, tle.line2,
            req.observer_latitude_deg, req.observer_longitude_deg, req.observer_elevation_m,
            req.start_time_utc, req.end_time_utc, req.min_elevation_deg
        )
        return passes
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Pass prediction failed: {str(e)}"
        )

from app.schemas.physics import CatalogDetailedPassRequest, DetailedPassWindow
from app.services.pass_predictor import compute_detailed_passes_from_tle

@router.post("/catalog/passes/detail", response_model=List[DetailedPassWindow])
def get_detailed_catalog_passes(req: CatalogDetailedPassRequest, db: Session = Depends(get_db)):
    """
    Predict detailed ground station visibility pass windows using database-backed TLE,
    including elevation profiles and quality labels.
    """
    lookup = get_catalog_object_with_latest_tle(db, req.norad_id)
    if not lookup:
        raise HTTPException(
            status_code=404,
            detail=f"Resident Space Object with NORAD ID {req.norad_id} not found or lacks TLE data."
        )
        
    rso, tle = lookup
    try:
        detailed_passes = compute_detailed_passes_from_tle(
            rso.name, tle.line1, tle.line2,
            req.observer_latitude_deg, req.observer_longitude_deg, req.observer_elevation_m,
            req.start_time_utc, req.end_time_utc, req.min_elevation_deg, req.profile_step_seconds
        )
        return detailed_passes
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Detailed pass prediction failed: {str(e)}"
        )
