from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class CatalogSnapshotRequest(BaseModel):
    timestamp_utc: Optional[datetime] = None
    object_type: Optional[str] = None
    category: Optional[str] = None
    source: Optional[str] = None
    source_group: Optional[str] = None
    search: Optional[str] = None
    limit: int = Field(default=1000, ge=1, le=100000)

class CatalogSnapshotObject(BaseModel):
    norad_id: int
    name: str
    object_type: str
    category: str
    latitude_deg: float
    longitude_deg: float
    altitude_km: float
    x_km: float
    y_km: float
    z_km: float

class CatalogSnapshotResponse(BaseModel):
    timestamp_utc: datetime
    returned_count: int
    total_matching_count: int
    skipped_count: int
    objects: List[CatalogSnapshotObject]
