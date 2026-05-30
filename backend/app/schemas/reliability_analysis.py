from pydantic import BaseModel, Field
from typing import List

class AgeHistogramItem(BaseModel):
    label: str
    count: int

class ObjectReliabilityDetail(BaseModel):
    norad_id: int = Field(..., description="NORAD Catalog Number")
    tle_epoch_utc: str = Field(..., description="TLE epoch timestamp")
    tle_age_days: float = Field(..., description="Age of the TLE in days")
    reliability_label: str = Field(..., description="Categorical label: FRESH, AGING, STALE, UNKNOWN")
    warnings: List[str] = Field(default_factory=list, description="List of warnings")

class ReliabilitySummary(BaseModel):
    overall_freshness_score: float = Field(..., description="Freshness index score")
    total_objects: int = Field(..., description="Total number of objects analyzed")
    fresh_count: int = Field(..., description="Number of fresh TLEs")
    aging_count: int = Field(..., description="Number of aging TLEs")
    stale_count: int = Field(..., description="Number of stale TLEs")
    unknown_count: int = Field(..., description="Number of unknown TLEs")
    average_age_days: float = Field(..., description="Mean TLE age in days")
    median_age_days: float = Field(..., description="Median TLE age in days")
    age_histogram: List[AgeHistogramItem] = Field(..., description="Histogram distribution data")
