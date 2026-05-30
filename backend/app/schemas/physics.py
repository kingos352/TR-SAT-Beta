from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict
from datetime import datetime
from typing import Optional

class PropagationRequest(BaseModel):
    name: Optional[str] = None
    line1: str
    line2: str
    timestamp_utc: datetime

class EphemerisRequest(BaseModel):
    name: Optional[str] = None
    line1: str
    line2: str
    start_time_utc: datetime
    end_time_utc: datetime
    step_seconds: int = Field(60, description="Step size in seconds")

    @field_validator('step_seconds')
    @classmethod
    def validate_step(cls, v: int) -> int:
        if v < 1:
            raise ValueError("step_seconds must be >= 1")
        return v

    @model_validator(mode='after')
    def validate_times_and_resolution(self) -> 'EphemerisRequest':
        if self.end_time_utc <= self.start_time_utc:
            raise ValueError("end_time_utc must be after start_time_utc")
            
        duration_seconds = (self.end_time_utc - self.start_time_utc).total_seconds()
        points = duration_seconds / self.step_seconds
        if points > 10000:
            raise ValueError(f"Too many ephemeris points requested: {int(points)} (limit is 10000)")
        return self

class CatalogPropagationRequest(BaseModel):
    norad_id: int
    timestamp_utc: datetime

class CatalogEphemerisRequest(BaseModel):
    norad_id: int
    start_time_utc: datetime
    end_time_utc: datetime
    step_seconds: int = Field(60, description="Step size in seconds")

    @field_validator('step_seconds')
    @classmethod
    def validate_step(cls, v: int) -> int:
        if v < 1:
            raise ValueError("step_seconds must be >= 1")
        return v

    @model_validator(mode='after')
    def validate_times_and_resolution(self) -> 'CatalogEphemerisRequest':
        if self.end_time_utc <= self.start_time_utc:
            raise ValueError("end_time_utc must be after start_time_utc")
            
        duration_seconds = (self.end_time_utc - self.start_time_utc).total_seconds()
        points = duration_seconds / self.step_seconds
        if points > 10000:
            raise ValueError(f"Too many ephemeris points requested: {int(points)} (limit is 10000)")
        return self

class CatalogECIRequest(BaseModel):
    norad_id: int
    timestamp_utc: datetime

class CatalogECIEphemerisRequest(BaseModel):
    norad_id: int
    start_time_utc: datetime
    end_time_utc: datetime
    step_seconds: int = Field(60, ge=1)

    @model_validator(mode='after')
    def validate_window(self) -> 'CatalogECIEphemerisRequest':
        if self.end_time_utc <= self.start_time_utc:
            raise ValueError("end_time_utc must be after start_time_utc")
        duration = (self.end_time_utc - self.start_time_utc).total_seconds()
        if duration / self.step_seconds > 5000:
            raise ValueError("Too many ECI ephemeris points (limit 5000)")
        return self

class ECIStatePoint(BaseModel):
    timestamp_utc: datetime
    pos_x_km: float
    pos_y_km: float
    pos_z_km: float
    vel_x_kms: float
    vel_y_kms: float
    vel_z_kms: float

    model_config = ConfigDict(from_attributes=True)

class GeoPosition(BaseModel):
    timestamp_utc: datetime
    latitude_deg: float
    longitude_deg: float
    altitude_km: float

class ECEFPosition(BaseModel):
    x_km: float
    y_km: float
    z_km: float

class SatelliteState(BaseModel):
    name: str
    timestamp_utc: datetime
    latitude_deg: float
    longitude_deg: float
    altitude_km: float
    ecef: ECEFPosition
    tle_epoch_utc: Optional[datetime] = None
    tle_age_days: Optional[float] = None
    reliability_status: str  # FRESH, AGING, STALE, UNKNOWN

    model_config = ConfigDict(from_attributes=True)

class ObserverAERRequest(BaseModel):
    name: Optional[str] = None
    line1: str
    line2: str
    timestamp_utc: datetime
    observer_latitude_deg: float
    observer_longitude_deg: float
    observer_elevation_m: float = 0.0

class CatalogObserverAERRequest(BaseModel):
    norad_id: int
    timestamp_utc: datetime
    observer_latitude_deg: float
    observer_longitude_deg: float
    observer_elevation_m: float = 0.0

class ObserverAER(BaseModel):
    timestamp_utc: datetime
    azimuth_deg: float
    elevation_deg: float
    range_km: float

    model_config = ConfigDict(from_attributes=True)

class PassPredictionRequest(BaseModel):
    name: Optional[str] = None
    line1: str
    line2: str
    observer_latitude_deg: float
    observer_longitude_deg: float
    observer_elevation_m: float = 0.0
    start_time_utc: datetime
    end_time_utc: datetime
    min_elevation_deg: float = 10.0

    @model_validator(mode='after')
    def validate_prediction_window(self) -> 'PassPredictionRequest':
        if self.end_time_utc <= self.start_time_utc:
            raise ValueError("end_time_utc must be after start_time_utc")
        return self

class CatalogPassPredictionRequest(BaseModel):
    norad_id: int
    observer_latitude_deg: float
    observer_longitude_deg: float
    observer_elevation_m: float = 0.0
    start_time_utc: datetime
    end_time_utc: datetime
    min_elevation_deg: float = 10.0

    @model_validator(mode='after')
    def validate_prediction_window(self) -> 'CatalogPassPredictionRequest':
        if self.end_time_utc <= self.start_time_utc:
            raise ValueError("end_time_utc must be after start_time_utc")
        return self

class PassWindow(BaseModel):
    aos_time_utc: datetime
    max_time_utc: datetime
    los_time_utc: datetime
    max_elevation_deg: float
    azimuth_aos_deg: Optional[float] = None
    azimuth_max_deg: Optional[float] = None
    azimuth_los_deg: Optional[float] = None
    range_at_max_km: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)

class CatalogDetailedPassRequest(BaseModel):
    norad_id: int
    observer_latitude_deg: float
    observer_longitude_deg: float
    observer_elevation_m: float = 0.0
    start_time_utc: datetime
    end_time_utc: datetime
    min_elevation_deg: float = 10.0
    profile_step_seconds: int = 30

    @model_validator(mode='after')
    def validate_prediction_window(self) -> 'CatalogDetailedPassRequest':
        if self.end_time_utc <= self.start_time_utc:
            raise ValueError("end_time_utc must be after start_time_utc")
        if self.profile_step_seconds < 10:
            raise ValueError("profile_step_seconds must be >= 10")
        return self

class DetailedPassProfilePoint(BaseModel):
    timestamp_utc: datetime
    elevation_deg: float
    azimuth_deg: float
    range_km: float

class DetailedPassWindow(BaseModel):
    aos_time_utc: datetime
    max_time_utc: datetime
    los_time_utc: datetime
    duration_seconds: float
    max_elevation_deg: float
    azimuth_aos_deg: Optional[float] = None
    azimuth_max_deg: Optional[float] = None
    azimuth_los_deg: Optional[float] = None
    range_at_max_km: Optional[float] = None
    quality_label: str
    elevation_profile: list[DetailedPassProfilePoint]

    model_config = ConfigDict(from_attributes=True)

