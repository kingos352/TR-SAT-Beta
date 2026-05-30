from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from enum import Enum

class IlluminationState(str, Enum):
    SUNLIT = "SUNLIT"
    EARTH_SHADOW = "EARTH_SHADOW"
    UNKNOWN = "UNKNOWN"

class HistoricalTLEPoint(BaseModel):
    epoch: datetime
    inclination: float
    raan: float
    eccentricity: float
    arg_perigee: float
    mean_anomaly: float
    mean_motion: float
    bstar: float

class OrbitalDecayIndicators(BaseModel):
    mean_motion_trend: Optional[float]
    bstar_trend: Optional[float]
    altitude_trend_km: Optional[float]
    note: str

class RelativeMotionPoint(BaseModel):
    timestamp_utc: datetime
    distance_km: float

class RelativeMotionResult(BaseModel):
    primary_id: int
    secondary_id: int
    tca_utc: datetime
    relative_speed_kmps: float
    distance_curve: List[RelativeMotionPoint]
