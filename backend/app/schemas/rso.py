from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import List, Optional

class TLERead(BaseModel):
    id: int
    norad_id: int
    name: str
    line1: str
    line2: str
    epoch: datetime
    inclination_deg: Optional[float] = None
    raan_deg: Optional[float] = None
    eccentricity: Optional[float] = None
    arg_perigee_deg: Optional[float] = None
    mean_anomaly_deg: Optional[float] = None
    mean_motion_rev_per_day: Optional[float] = None
    bstar: Optional[float] = None
    source: str
    source_group: str
    ingested_at: datetime

    model_config = ConfigDict(from_attributes=True)

class RSORead(BaseModel):
    norad_id: int
    name: str
    object_type: str
    category: str
    source: str
    source_group: str
    cospar_id: Optional[str] = None
    last_updated: datetime
    latest_tle: Optional[TLERead] = None

    model_config = ConfigDict(from_attributes=True)

class CatalogSyncRequest(BaseModel):
    group: str

class CatalogSyncResponse(BaseModel):
    group: str
    fetched_count: int
    parsed_count: int
    inserted_objects: int
    inserted_tles: int
    updated_objects: int
    skipped_count: int
    warning: Optional[str] = None

class CatalogSearchResponse(BaseModel):
    count: int
    results: List[RSORead]

    model_config = ConfigDict(from_attributes=True)
