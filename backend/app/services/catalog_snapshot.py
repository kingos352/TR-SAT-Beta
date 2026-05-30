from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.rso import RSOCatalog, TLERecord
from app.schemas.catalog_visualization import CatalogSnapshotRequest, CatalogSnapshotResponse, CatalogSnapshotObject
from app.services.astrodynamics import propagate_state
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

def generate_catalog_snapshot(db: Session, req: CatalogSnapshotRequest) -> CatalogSnapshotResponse:
    query = db.query(RSOCatalog)
    if req.object_type:
        query = query.filter(RSOCatalog.object_type == req.object_type)
    if req.category:
        query = query.filter(RSOCatalog.category == req.category)
    if req.source:
        query = query.filter(RSOCatalog.source == req.source)
    if req.source_group:
        query = query.filter(RSOCatalog.source_group == req.source_group)
    if req.search:
        query = query.filter(RSOCatalog.name.ilike(f"%{req.search}%"))
        
    total_matching_count = query.count()
    
    rsos = query.limit(req.limit).all()
    
    timestamp_utc = req.timestamp_utc or datetime.now(timezone.utc)
    
    if not timestamp_utc.tzinfo:
        timestamp_utc = timestamp_utc.replace(tzinfo=timezone.utc)
        
    norad_ids = [rso.norad_id for rso in rsos]
    
    if not norad_ids:
        return CatalogSnapshotResponse(
            timestamp_utc=timestamp_utc,
            returned_count=0,
            total_matching_count=total_matching_count,
            skipped_count=0,
            objects=[]
        )
        
    subq = db.query(
        TLERecord.norad_id,
        func.max(TLERecord.epoch).label('max_epoch')
    ).filter(
        TLERecord.norad_id.in_(norad_ids)
    ).group_by(TLERecord.norad_id).subquery()
    
    latest_tles = db.query(TLERecord).join(
        subq,
        (TLERecord.norad_id == subq.c.norad_id) & (TLERecord.epoch == subq.c.max_epoch)
    ).all()
    
    tle_dict = {tle.norad_id: tle for tle in latest_tles}
    
    objects = []
    skipped_count = 0
    
    for rso in rsos:
        tle = tle_dict.get(rso.norad_id)
        if not tle:
            skipped_count += 1
            continue
            
        try:
            state = propagate_state(
                name=rso.name,
                line1=tle.line1,
                line2=tle.line2,
                timestamp_utc=timestamp_utc
            )
            objects.append(CatalogSnapshotObject(
                norad_id=rso.norad_id,
                name=rso.name,
                object_type=rso.object_type,
                category=rso.category,
                latitude_deg=state["latitude_deg"],
                longitude_deg=state["longitude_deg"],
                altitude_km=state["altitude_km"],
                x_km=state["ecef"]["x_km"],
                y_km=state["ecef"]["y_km"],
                z_km=state["ecef"]["z_km"]
            ))
        except Exception as e:
            logger.error(f"Failed to propagate RSO {rso.norad_id}: {e}")
            skipped_count += 1
            
    return CatalogSnapshotResponse(
        timestamp_utc=timestamp_utc,
        returned_count=len(objects),
        total_matching_count=total_matching_count,
        skipped_count=skipped_count,
        objects=objects
    )

def get_catalog_summary(db: Session):
    total = db.query(RSOCatalog).count()
    return {"total_objects": total}
