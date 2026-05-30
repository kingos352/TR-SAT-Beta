from pydantic import BaseModel
from typing import Dict, List, Optional
from enum import Enum

class OrbitalRegime(str, Enum):
    LEO = "LEO"
    MEO = "MEO"
    GEO = "GEO"
    HEO = "HEO"
    UNKNOWN = "UNKNOWN"

class DistributionBin(BaseModel):
    label: str
    count: int

class FreshnessSummary(BaseModel):
    total_evaluated: int
    fresh_count: int
    stale_count: int
    average_age_days: Optional[float] = None
    max_age_days: Optional[float] = None

class CatalogAnalyticsSummary(BaseModel):
    total_objects: int
    by_object_type: Dict[str, int]
    by_source: Dict[str, int]
    by_category: Dict[str, int]
    by_orbital_regime: Dict[str, int]
    altitude_bins: List[DistributionBin]
    inclination_bins: List[DistributionBin]
    freshness_summary: FreshnessSummary
    stale_percentage: float
    debris_percentage: float
    warnings: List[str]
    disclaimer: str = "Catalog analytics are derived from locally stored TLE/GP metadata and SGP4-derived orbital characteristics. They are intended for situational awareness, not certified operational SSA."
