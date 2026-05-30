from pydantic import BaseModel, Field, model_validator, ConfigDict
from typing import List, Optional, Literal
from datetime import datetime

class ConjunctionScreenRequest(BaseModel):
    mode: Literal["selected_vs_selected", "primary_vs_catalog", "primary_vs_debris"]
    primary_norad_ids: List[int] = Field(..., min_length=1)
    secondary_norad_ids: Optional[List[int]] = Field(None, description="Used in selected_vs_selected mode")
    start_time: datetime
    end_time: datetime
    coarse_step_seconds: float = Field(60.0, gt=0)
    refine_step_seconds: float = Field(1.0, gt=0)
    max_candidates: int = Field(100, le=2000)
    include_rocket_bodies: bool = Field(
        False, description="In primary_vs_debris mode, also screen against ROCKET_BODY objects"
    )
    hard_body_radius_m: Optional[float] = Field(
        None, gt=0, description="Override the combined hard-body radius (m) used for Pc"
    )
    sigma_intrack_km: Optional[float] = Field(
        None, gt=0, description="Override the synthetic 1-sigma in-track position uncertainty (km)"
    )

    @model_validator(mode="after")
    def validate_params(self) -> 'ConjunctionScreenRequest':
        if self.start_time >= self.end_time:
            raise ValueError("start_time must be before end_time")
        if (self.end_time - self.start_time).total_seconds() > 7 * 86400:
            raise ValueError("Screening horizon cannot exceed 7 days")
        if self.refine_step_seconds > self.coarse_step_seconds:
            raise ValueError("refine_step_seconds must be <= coarse_step_seconds")
        if self.mode == "selected_vs_selected" and not self.secondary_norad_ids:
            raise ValueError("secondary_norad_ids required for selected_vs_selected mode")
        return self

class DebrisWatchRequest(BaseModel):
    """Catalog-wide, all-vs-all debris conjunction screen — needs no primary object."""
    start_time: datetime
    end_time: datetime
    coarse_step_seconds: float = Field(120.0, gt=0)
    refine_step_seconds: float = Field(2.0, gt=0)
    include_rocket_bodies: bool = Field(False, description="Also screen ROCKET_BODY objects against debris")
    max_objects: int = Field(1500, gt=1, le=4000, description="Cap on objects screened (perigee-ascending; lowest/most collision-relevant orbits first)")
    max_candidates: int = Field(200, gt=0, le=2000, description="Closest coarse pairs refined for Pc")
    hard_body_radius_m: Optional[float] = Field(None, gt=0)
    sigma_intrack_km: Optional[float] = Field(None, gt=0)

    @model_validator(mode="after")
    def validate_params(self) -> 'DebrisWatchRequest':
        if self.start_time >= self.end_time:
            raise ValueError("start_time must be before end_time")
        if (self.end_time - self.start_time).total_seconds() > 3 * 86400:
            raise ValueError("Debris-watch horizon cannot exceed 3 days")
        if self.refine_step_seconds > self.coarse_step_seconds:
            raise ValueError("refine_step_seconds must be <= coarse_step_seconds")
        return self


class ConjunctionResult(BaseModel):
    primary_norad_id: int
    secondary_norad_id: int
    tca_time: datetime
    miss_distance_km: float
    severity: Literal["CRITICAL_CANDIDATE", "CLOSE", "WATCH", "INFO"]
    primary_position_km: List[float]
    secondary_position_km: List[float]
    primary_velocity_km_per_s: Optional[List[float]] = None
    secondary_velocity_km_per_s: Optional[List[float]] = None

    # Estimated collision assessment (heuristic — see response disclaimer)
    relative_speed_km_per_s: Optional[float] = None
    collision_probability: Optional[float] = None
    max_collision_probability: Optional[float] = None
    hard_body_radius_m: Optional[float] = None
    risk_level: Optional[Literal["HIGH", "MEDIUM", "LOW", "NEGLIGIBLE"]] = None
    # Encounter-plane (B-plane) geometry for visualisation
    miss_x_km: Optional[float] = None
    miss_y_km: Optional[float] = None
    covariance_2d_km2: Optional[List[List[float]]] = None
    # Context that drives the uncertainty estimate
    primary_object_type: Optional[str] = None
    secondary_object_type: Optional[str] = None
    primary_tle_age_days: Optional[float] = None
    secondary_tle_age_days: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)

class ConjunctionScreenResponse(BaseModel):
    disclaimer: str
    mode: str
    results: List[ConjunctionResult]
    computation_time_ms: float
