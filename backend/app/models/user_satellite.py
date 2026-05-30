from sqlalchemy import Column, Integer, String, Float, JSON, DateTime
from sqlalchemy.sql import func
from app.database import Base


class UserSatellite(Base):
    __tablename__ = "user_satellites"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    mission_type = Column(String(50), nullable=False, default="LEO")  # LEO/MEO/GEO/HEO/SSO/CUSTOM
    input_format = Column(String(20), nullable=False)  # TLE/KEPLERIAN/STATE_VECTOR

    # Original input preserved for re-processing
    raw_input = Column(JSON, nullable=False)

    # Epoch as ISO string (UTC)
    epoch_utc = Column(String(50), nullable=False)

    # ECI J2000 state vector at epoch (km, km/s)
    pos_x_km = Column(Float, nullable=False)
    pos_y_km = Column(Float, nullable=False)
    pos_z_km = Column(Float, nullable=False)
    vel_x_kms = Column(Float, nullable=False)
    vel_y_kms = Column(Float, nullable=False)
    vel_z_kms = Column(Float, nullable=False)

    # 6×6 position-velocity covariance (JSON list-of-lists, km² and km²/s² units)
    # None → auto-generated defaults based on mission_type
    cov_6x6 = Column(JSON, nullable=True)

    # Physical parameters for drag and SRP models
    hard_body_radius_m = Column(Float, default=2.0)
    drag_area_m2 = Column(Float, default=0.04)   # effective cross-section for drag
    srp_area_m2 = Column(Float, default=0.04)    # effective cross-section for SRP
    mass_kg = Column(Float, default=12.0)
    cd = Column(Float, default=2.2)              # ballistic drag coefficient
    cr = Column(Float, default=1.4)              # solar reflectivity coefficient

    created_at = Column(DateTime(timezone=True), server_default=func.now())
