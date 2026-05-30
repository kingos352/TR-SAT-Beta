from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.schemas.catalog_analytics import CatalogAnalyticsSummary
from app.services.catalog_analytics import compute_catalog_summary
from app.schemas.reliability_analysis import ReliabilitySummary, ObjectReliabilityDetail
from app.services.reliability_analysis import get_reliability_summary, get_object_reliability

router = APIRouter()

@router.get("/catalog-summary", response_model=CatalogAnalyticsSummary)
def get_catalog_summary(
    db: Session = Depends(get_db),
    source: Optional[str] = Query(None, description="Filter by data source (e.g., CelesTrak)"),
    source_group: Optional[str] = Query(None, description="Filter by source group (e.g., active, stations)"),
    category: Optional[str] = Query(None, description="Filter by category"),
    object_type: Optional[str] = Query(None, description="Filter by object type (e.g., PAYLOAD, DEBRIS)")
):
    """
    Retrieve approximate catalog-level analytics derived from locally stored TLE metadata.
    Not for certified operational SSA.
    """
    summary = compute_catalog_summary(
        db=db,
        source=source,
        source_group=source_group,
        category=category,
        object_type=object_type
    )
    return summary

@router.get("/reliability/summary", response_model=ReliabilitySummary)
def get_reliability_summary_alias(db: Session = Depends(get_db)):
    try:
        return get_reliability_summary(db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/reliability/{norad_id}", response_model=ObjectReliabilityDetail)
def get_object_reliability_alias(norad_id: str, db: Session = Depends(get_db)):
    try:
        return get_object_reliability(db, norad_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
