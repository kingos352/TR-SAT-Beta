from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class VisibilityScreenRequest(BaseModel):
    observer_latitude_deg: float = Field(..., description="Observer latitude in degrees")
    observer_longitude_deg: float = Field(..., description="Observer longitude in degrees")
    observer_elevation_m: float = Field(0.0, description="Observer elevation in meters")
    timestamp_utc: Optional[datetime] = Field(None, description="Time to evaluate visibility. Defaults to current time if not provided.")
    min_elevation_deg: float = Field(10.0, description="Minimum elevation in degrees to be considered visible")
    high_elevation_deg: float = Field(45.0, description="Elevation in degrees to be considered high elevation")
    object_type: Optional[str] = None
    category: Optional[str] = None
    source: Optional[str] = None
    source_group: Optional[str] = None
    include_debris: bool = Field(True, description="Include debris objects in the search")
    limit: int = Field(100, description="Maximum number of objects to return")
    max_candidates: int = Field(10000, description="Maximum number of objects to evaluate")

class VisibilityResultObject(BaseModel):
    norad_id: str
    name: str
    object_type: Optional[str] = None
    category: Optional[str] = None
    source: Optional[str] = None
    source_group: Optional[str] = None
    azimuth_deg: float
    elevation_deg: float
    range_km: float
    visibility_class: str
    reliability_status: str
    tle_age_days: float

class ObserverLocation(BaseModel):
    latitude_deg: float
    longitude_deg: float
    elevation_m: float

class VisibilityScreenResponse(BaseModel):
    timestamp_utc: datetime
    observer: ObserverLocation
    returned_count: int
    evaluated_count: int
    skipped_count: int
    objects: List[VisibilityResultObject]
    warnings: List[str]
    disclaimer: str
