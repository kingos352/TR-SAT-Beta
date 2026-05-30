import math
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.rso import RSOCatalog, TLERecord
from app.schemas.catalog_analytics import CatalogAnalyticsSummary, DistributionBin, FreshnessSummary, OrbitalRegime

MU_EARTH_KM3_S2 = 398600.4418
EARTH_RADIUS_KM = 6378.137

def classify_orbital_regime(mean_motion: Optional[float], eccentricity: Optional[float]) -> str:
    """
    Approximate orbital regime classification based on TLE mean motion and eccentricity.
    Derived for situational awareness purposes, not certified SSA.
    """
    if mean_motion is None or eccentricity is None or mean_motion <= 0:
        return OrbitalRegime.UNKNOWN.value

    # Mean motion in radians per second
    n_rad_s = mean_motion * (2 * math.pi) / 86400.0
    
    # Semi-major axis in km
    a_km = (MU_EARTH_KM3_S2 / (n_rad_s ** 2)) ** (1.0 / 3.0)
    
    mean_altitude = a_km - EARTH_RADIUS_KM
    
    # Highly Eccentric Orbit
    if eccentricity > 0.25:
        return OrbitalRegime.HEO.value
        
    # Geosynchronous / Geostationary (tolerance ±1500 km around 35786 km)
    if abs(mean_altitude - 35786.0) <= 1500.0:
        return OrbitalRegime.GEO.value
        
    # Low Earth Orbit
    if mean_altitude < 2000.0:
        return OrbitalRegime.LEO.value
        
    # Medium Earth Orbit (Between LEO and GEO)
    if 2000.0 <= mean_altitude < 34286.0:
        return OrbitalRegime.MEO.value
        
    # High Earth Orbit (Above GEO)
    if mean_altitude > 37286.0:
        return OrbitalRegime.HEO.value
        
    return OrbitalRegime.UNKNOWN.value

def compute_approx_altitude(mean_motion: float) -> float:
    n_rad_s = mean_motion * (2 * math.pi) / 86400.0
    a_km = (MU_EARTH_KM3_S2 / (n_rad_s ** 2)) ** (1.0 / 3.0)
    return a_km - EARTH_RADIUS_KM

def get_altitude_bin(alt: float) -> str:
    if alt < 500: return "0-500 km"
    if alt < 1000: return "500-1000 km"
    if alt < 2000: return "1000-2000 km"
    if alt < 10000: return "2000-10000 km"
    if alt < 25000: return "10000-25000 km"
    if alt < 38000: return "25000-38000 km"
    return "38000+ km"

def get_inclination_bin(inc: float) -> str:
    if inc < 30: return "0-30°"
    if inc < 60: return "30-60°"
    if inc < 90: return "60-90°"
    if inc < 120: return "90-120°"
    if inc < 150: return "120-150°"
    return "150-180°"

def compute_catalog_summary(
    db: Session, 
    source: Optional[str] = None,
    source_group: Optional[str] = None,
    category: Optional[str] = None,
    object_type: Optional[str] = None
) -> CatalogAnalyticsSummary:
    
    query = db.query(RSOCatalog, TLERecord).outerjoin(
        TLERecord, 
        (RSOCatalog.norad_id == TLERecord.norad_id)
    )
    
    if source:
        query = query.filter(RSOCatalog.source == source)
    if source_group:
        query = query.filter(RSOCatalog.source_group == source_group)
    if category:
        query = query.filter(RSOCatalog.category == category)
    if object_type:
        query = query.filter(RSOCatalog.object_type == object_type)
        
    # Because there might be multiple TLE records, we actually want the latest one.
    # To keep this fast without complex subqueries in SQLite, we will fetch the latest TLE per RSO in Python,
    # or just assume the DB only has the latest active TLEs for simplicity if it's cleaned up.
    # Alternatively, group by RSO and pick the max epoch.
    results = query.all()
    
    # Process results locally to get latest TLE per RSO
    rso_map: Dict[int, dict] = {}
    
    for rso, tle in results:
        if rso.norad_id not in rso_map:
            rso_map[rso.norad_id] = {
                "rso": rso,
                "latest_tle": tle
            }
        else:
            if tle and rso_map[rso.norad_id]["latest_tle"]:
                if tle.epoch > rso_map[rso.norad_id]["latest_tle"].epoch:
                    rso_map[rso.norad_id]["latest_tle"] = tle
            elif tle and not rso_map[rso.norad_id]["latest_tle"]:
                rso_map[rso.norad_id]["latest_tle"] = tle
                
    total_objects = len(rso_map)
    
    by_object_type = {}
    by_source = {}
    by_category = {}
    by_orbital_regime = {
        "LEO": 0, "MEO": 0, "GEO": 0, "HEO": 0, "UNKNOWN": 0
    }
    
    alt_counts = {
        "0-500 km": 0,
        "500-1000 km": 0,
        "1000-2000 km": 0,
        "2000-10000 km": 0,
        "10000-25000 km": 0,
        "25000-38000 km": 0,
        "38000+ km": 0
    }
    
    inc_counts = {
        "0-30°": 0,
        "30-60°": 0,
        "60-90°": 0,
        "90-120°": 0,
        "120-150°": 0,
        "150-180°": 0
    }
    
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    total_evaluated_tle = 0
    stale_count = 0
    total_age_days = 0.0
    max_age_days = 0.0
    
    debris_count = 0
    
    for item in rso_map.values():
        rso = item["rso"]
        tle = item["latest_tle"]
        
        # Types
        by_object_type[rso.object_type] = by_object_type.get(rso.object_type, 0) + 1
        by_source[rso.source] = by_source.get(rso.source, 0) + 1
        by_category[rso.category] = by_category.get(rso.category, 0) + 1
        
        if rso.object_type == "DEBRIS":
            debris_count += 1
            
        if tle:
            # Regime
            regime = classify_orbital_regime(tle.mean_motion_rev_per_day, tle.eccentricity)
            by_orbital_regime[regime] += 1
            
            # Altitude bins
            if tle.mean_motion_rev_per_day and tle.mean_motion_rev_per_day > 0:
                alt = compute_approx_altitude(tle.mean_motion_rev_per_day)
                alt_counts[get_altitude_bin(alt)] += 1
                
            # Inclination bins
            if tle.inclination_deg is not None:
                inc_counts[get_inclination_bin(tle.inclination_deg)] += 1
                
            # Freshness
            # Assuming tle.epoch is naive UTC datetime
            age_days = (now - tle.epoch).total_seconds() / 86400.0
            
            if age_days < 0: age_days = 0  # future epochs or minor clock skew
            
            total_evaluated_tle += 1
            total_age_days += age_days
            if age_days > max_age_days:
                max_age_days = age_days
                
            if age_days > 7.0:
                stale_count += 1
        else:
            by_orbital_regime["UNKNOWN"] += 1
            
    avg_age = (total_age_days / total_evaluated_tle) if total_evaluated_tle > 0 else None
    stale_percentage = (stale_count / total_evaluated_tle * 100.0) if total_evaluated_tle > 0 else 0.0
    debris_percentage = (debris_count / total_objects * 100.0) if total_objects > 0 else 0.0
    
    alt_bins = [DistributionBin(label=k, count=v) for k, v in alt_counts.items() if v > 0]
    inc_bins = [DistributionBin(label=k, count=v) for k, v in inc_counts.items() if v > 0]
    
    # Sort bins naturally
    alt_order = ["0-500 km", "500-1000 km", "1000-2000 km", "2000-10000 km", "10000-25000 km", "25000-38000 km", "38000+ km"]
    inc_order = ["0-30°", "30-60°", "60-90°", "90-120°", "120-150°", "150-180°"]
    
    alt_bins.sort(key=lambda x: alt_order.index(x.label))
    inc_bins.sort(key=lambda x: inc_order.index(x.label))

    return CatalogAnalyticsSummary(
        total_objects=total_objects,
        by_object_type=by_object_type,
        by_source=by_source,
        by_category=by_category,
        by_orbital_regime=by_orbital_regime,
        altitude_bins=alt_bins,
        inclination_bins=inc_bins,
        freshness_summary=FreshnessSummary(
            total_evaluated=total_evaluated_tle,
            fresh_count=total_evaluated_tle - stale_count,
            stale_count=stale_count,
            average_age_days=avg_age,
            max_age_days=max_age_days
        ),
        stale_percentage=stale_percentage,
        debris_percentage=debris_percentage,
        warnings=["No catalog objects found"] if total_objects == 0 else []
    )
