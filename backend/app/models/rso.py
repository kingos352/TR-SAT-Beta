from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Index, func
from sqlalchemy.orm import relationship
from app.database import Base
import datetime

class RSOCatalog(Base):
    __tablename__ = "rso_catalog"

    norad_id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, index=True)
    object_type = Column(String, nullable=False, index=True)  # PAYLOAD, ROCKET_BODY, DEBRIS, UNKNOWN
    category = Column(String, nullable=False, index=True)
    source = Column(String, nullable=False, default="CelesTrak")
    source_group = Column(String, nullable=False, index=True)
    cospar_id = Column(String, nullable=True)
    last_updated = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationship to historical TLE records
    tles = relationship("TLERecord", back_populates="rso", cascade="all, delete-orphan")

class TLERecord(Base):
    __tablename__ = "tle_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    norad_id = Column(Integer, ForeignKey("rso_catalog.norad_id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    line1 = Column(String, nullable=False)
    line2 = Column(String, nullable=False)
    epoch = Column(DateTime, nullable=False, index=True)
    inclination_deg = Column(Float, nullable=True)
    raan_deg = Column(Float, nullable=True)
    eccentricity = Column(Float, nullable=True)
    arg_perigee_deg = Column(Float, nullable=True)
    mean_anomaly_deg = Column(Float, nullable=True)
    mean_motion_rev_per_day = Column(Float, nullable=True)
    bstar = Column(Float, nullable=True)
    source = Column(String, nullable=False, default="CelesTrak")
    source_group = Column(String, nullable=False)
    source_format = Column(String, nullable=False, server_default="TLE", default="TLE")  # TLE, OMM_JSON, OMM_CSV, OEM, CDM
    ingested_at = Column(DateTime, default=func.now())

    rso = relationship("RSOCatalog", back_populates="tles")

# Indexing constraints
# 1. Unique constraint / index on (norad_id, epoch) to avoid duplicate TLE records for same satellite + epoch
Index("idx_tle_norad_epoch", TLERecord.norad_id, TLERecord.epoch, unique=True)
