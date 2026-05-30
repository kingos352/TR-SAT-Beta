from sqlalchemy.orm import Session
from typing import Optional, Tuple
from app.models.rso import RSOCatalog, TLERecord

def get_latest_tle_for_norad(db: Session, norad_id: int) -> Optional[TLERecord]:
    """
    Query the latest TLE record for a given NORAD ID, ordered by epoch descending.
    """
    return db.query(TLERecord).filter(
        TLERecord.norad_id == norad_id
    ).order_by(TLERecord.epoch.desc()).first()

def get_catalog_object_with_latest_tle(
    db: Session, 
    norad_id: int
) -> Optional[Tuple[RSOCatalog, TLERecord]]:
    """
    Query the RSOCatalog object and retrieve its latest TLE record.
    Returns None if either the catalog object or its TLE record does not exist.
    """
    rso = db.query(RSOCatalog).filter(RSOCatalog.norad_id == norad_id).first()
    if not rso:
        return None
        
    tle = get_latest_tle_for_norad(db, norad_id)
    if not tle:
        return None
        
    return rso, tle
