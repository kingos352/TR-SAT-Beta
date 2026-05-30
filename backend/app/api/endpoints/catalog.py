from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.rso import RSOCatalog, TLERecord
from app.schemas.rso import RSORead, CatalogSyncRequest, CatalogSyncResponse
from app.services.celestrak import ingest_celestrak_group, ingest_celestrak_omm_group, SUPPORTED_GROUPS

router = APIRouter()

@router.post("/sync", response_model=CatalogSyncResponse)
def sync_catalog(req: CatalogSyncRequest, db: Session = Depends(get_db)):
    """
    Synchronize local database with CelesTrak GP/TLE data for a specific group.
    """
    if req.group not in SUPPORTED_GROUPS:
        raise HTTPException(
            status_code=400,
            detail=f"Group '{req.group}' is not supported. Supported: {', '.join(SUPPORTED_GROUPS)}"
        )
    try:
        if (req.data_format or "tle").lower() == "omm":
            response = ingest_celestrak_omm_group(db, req.group)
        else:
            response = ingest_celestrak_group(db, req.group)
        return response
    except ValueError as e:
        return CatalogSyncResponse(
            group=req.group,
            fetched_count=0,
            parsed_count=0,
            inserted_objects=0,
            inserted_tles=0,
            updated_objects=0,
            skipped_count=0,
            warning=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Sync execution failed: {str(e)}"
        )

@router.get("/groups", response_model=List[str])
def get_supported_groups():
    """
    Retrieve list of supported CelesTrak satellite group keywords.
    """
    return SUPPORTED_GROUPS

@router.get("/search", response_model=List[RSORead])
def search_catalog(
    q: Optional[str] = Query(None, description="Search query matching name or NORAD ID"),
    group: Optional[str] = Query(None, description="Filter by ingestion source group"),
    object_type: Optional[str] = Query(None, description="Filter by type (PAYLOAD, ROCKET_BODY, DEBRIS, UNKNOWN)"),
    category: Optional[str] = Query(None, description="Filter by orbital category"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """
    Query the local orbital catalog with filters and keyword matching.
    """
    query = db.query(RSOCatalog)

    if q:
        # Match name or exact norad_id
        if q.isdigit():
            query = query.filter((RSOCatalog.norad_id == int(q)) | (RSOCatalog.name.like(f"%{q}%")))
        else:
            query = query.filter(RSOCatalog.name.like(f"%{q}%"))

    if group:
        query = query.filter(RSOCatalog.source_group == group)
    if object_type:
        query = query.filter(RSOCatalog.object_type == object_type)
    if category:
        query = query.filter(RSOCatalog.category == category)

    rso_list = query.limit(limit).all()

    if rso_list:
        # Batch TLE lookup: single query instead of N+1 per-RSO queries.
        norad_ids = [rso.norad_id for rso in rso_list]
        latest_epoch_subq = (
            db.query(TLERecord.norad_id, func.max(TLERecord.epoch).label("max_epoch"))
            .filter(TLERecord.norad_id.in_(norad_ids))
            .group_by(TLERecord.norad_id)
            .subquery()
        )
        latest_tles = (
            db.query(TLERecord)
            .join(latest_epoch_subq, (TLERecord.norad_id == latest_epoch_subq.c.norad_id) &
                                     (TLERecord.epoch == latest_epoch_subq.c.max_epoch))
            .all()
        )
        tle_map = {tle.norad_id: tle for tle in latest_tles}
        for rso in rso_list:
            rso.latest_tle = tle_map.get(rso.norad_id)

    return rso_list

@router.get("/{norad_id}", response_model=RSORead)
def get_rso_details(norad_id: int, db: Session = Depends(get_db)):
    """
    Retrieve detailed metadata and latest TLE record for a specific NORAD ID.
    """
    rso = db.query(RSOCatalog).filter(RSOCatalog.norad_id == norad_id).first()
    if not rso:
        raise HTTPException(
            status_code=404,
            detail=f"Resident Space Object with NORAD ID {norad_id} not found in database."
        )

    # Attach latest TLE record dynamically
    rso.latest_tle = db.query(TLERecord).filter(
        TLERecord.norad_id == norad_id
    ).order_by(TLERecord.epoch.desc()).first()

    return rso
