from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.catalog_visualization import CatalogSnapshotRequest, CatalogSnapshotResponse
from app.services.catalog_snapshot import generate_catalog_snapshot, get_catalog_summary

router = APIRouter()

@router.post("/snapshot", response_model=CatalogSnapshotResponse)
def get_catalog_snapshot(
    request: CatalogSnapshotRequest,
    db: Session = Depends(get_db)
):
    try:
        return generate_catalog_snapshot(db, request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/summary")
def get_catalog_summary_endpoint(db: Session = Depends(get_db)):
    """
    Get a summary of the catalog.
    """
    return get_catalog_summary(db)
