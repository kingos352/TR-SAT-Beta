from pydantic import BaseModel, Field, model_validator
from typing import Optional, List, Any
from datetime import datetime


# ---------------------------------------------------------------------------
# Input schemas — one per input format
# ---------------------------------------------------------------------------

class TLEInput(BaseModel):
    line1: str = Field(..., min_length=69, max_length=69)
    line2: str = Field(..., min_length=69, max_length=69)
    epoch_utc: Optional[str] = None  # ISO; if None, TLE's own epoch is used


class KeplerianInput(BaseModel):
    sma_km: float = Field(..., gt=6378.137, description="Semi-major axis (km)")
    eccentricity: float = Field(..., ge=0.0, lt=1.0)
    inclination_deg: float = Field(..., ge=0.0, le=180.0)
    raan_deg: float = Field(..., ge=0.0, lt=360.0, description="Right ascension of ascending node")
    argp_deg: float = Field(..., ge=0.0, lt=360.0, description="Argument of perigee")
    mean_anomaly_deg: float = Field(..., ge=0.0, lt=360.0)
    epoch_utc: str = Field(..., description="Epoch (ISO 8601 UTC)")


class StateVectorInput(BaseModel):
    pos_x_km: float
    pos_y_km: float
    pos_z_km: float
    vel_x_kms: float
    vel_y_kms: float
    vel_z_kms: float
    epoch_utc: str = Field(..., description="Epoch (ISO 8601 UTC)")


# ---------------------------------------------------------------------------
# Covariance — simplified (σ in RTN) or full 6×6
# ---------------------------------------------------------------------------

class CovarianceSimple(BaseModel):
    sigma_r_km: float = Field(..., gt=0)
    sigma_t_km: float = Field(..., gt=0)
    sigma_n_km: float = Field(..., gt=0)
    sigma_vr_kms: float = Field(default=1e-4, gt=0)
    sigma_vt_kms: float = Field(default=1e-3, gt=0)
    sigma_vn_kms: float = Field(default=1e-4, gt=0)


class CovarianceFull(BaseModel):
    matrix_6x6: List[List[float]] = Field(..., description="6×6 covariance in ECI (km², km²/s²)")


# ---------------------------------------------------------------------------
# Physical parameters
# ---------------------------------------------------------------------------

class PhysicalParams(BaseModel):
    hard_body_radius_m: float = Field(default=2.0, gt=0)
    drag_area_m2: float = Field(default=0.04, gt=0, description="Effective drag cross-section (m²)")
    srp_area_m2: float = Field(default=0.04, gt=0, description="Effective SRP cross-section (m²)")
    mass_kg: float = Field(default=12.0, gt=0)
    cd: float = Field(default=2.2, gt=0)
    cr: float = Field(default=1.4, gt=0)


# ---------------------------------------------------------------------------
# Create request
# ---------------------------------------------------------------------------

class UserSatelliteCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    mission_type: str = Field(default="LEO")  # LEO/MEO/GEO/HEO/SSO/CUSTOM

    input_format: str = Field(..., description="TLE | KEPLERIAN | STATE_VECTOR")

    # Exactly one of these must be provided
    tle: Optional[TLEInput] = None
    keplerian: Optional[KeplerianInput] = None
    state_vector: Optional[StateVectorInput] = None

    # Covariance — optional; auto-generated from mission_type if omitted
    covariance_simple: Optional[CovarianceSimple] = None
    covariance_full: Optional[CovarianceFull] = None

    physical: Optional[PhysicalParams] = None

    @model_validator(mode="after")
    def _check_input_format(self):
        fmt = self.input_format.upper()
        if fmt == "TLE" and self.tle is None:
            raise ValueError("TLE input required when input_format=TLE")
        if fmt == "KEPLERIAN" and self.keplerian is None:
            raise ValueError("Keplerian input required when input_format=KEPLERIAN")
        if fmt == "STATE_VECTOR" and self.state_vector is None:
            raise ValueError("State vector input required when input_format=STATE_VECTOR")
        return self


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class UserSatelliteResponse(BaseModel):
    id: int
    name: str
    mission_type: str
    input_format: str
    epoch_utc: str
    pos_x_km: float
    pos_y_km: float
    pos_z_km: float
    vel_x_kms: float
    vel_y_kms: float
    vel_z_kms: float
    hard_body_radius_m: float
    drag_area_m2: float
    srp_area_m2: float
    mass_kg: float
    cd: float
    cr: float
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Conjunction screening request
# ---------------------------------------------------------------------------

class ConjunctionScreenRequest(BaseModel):
    user_satellite_id: int
    window_days: float = Field(default=3.0, ge=1.0, le=7.0)
    catalog_filter: Optional[str] = None  # None=ALL, "DEBRIS", "PAYLOAD", etc.
    miss_distance_threshold_km: float = Field(default=5.0, gt=0)
    pc_threshold: float = Field(default=1e-6, gt=0)


# ---------------------------------------------------------------------------
# Conjunction result schemas
# ---------------------------------------------------------------------------

class ConjunctionEvent(BaseModel):
    norad_id: int
    name: str
    object_type: str
    category: str
    tca_utc: str
    miss_distance_km: float
    miss_r_km: float
    miss_t_km: float
    miss_n_km: float
    rel_velocity_kms: float
    pc: float
    risk_level: str       # LOW / MEDIUM / HIGH / CRITICAL
    r_user_km: List[float]
    v_user_kms: List[float]
    r_cat_km: List[float]


class ConjunctionScreenResponse(BaseModel):
    job_id: str
    user_satellite_id: int
    status: str           # RUNNING / COMPLETED / FAILED
    progress_pct: int
    progress_msg: str
    window_days: float
    catalog_filter: Optional[str]
    events: List[ConjunctionEvent]
    total_events: int
    created_at: str
