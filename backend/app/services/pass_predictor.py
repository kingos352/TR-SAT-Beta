from datetime import datetime
from functools import lru_cache
from typing import List, Dict, Any, Optional
from skyfield.api import wgs84
from app.services.astrodynamics import build_satellite_from_tle, ensure_utc, ts

@lru_cache(maxsize=256)
def predict_passes_from_tle(
    name: Optional[str],
    line1: str,
    line2: str,
    observer_latitude_deg: float,
    observer_longitude_deg: float,
    observer_elevation_m: float,
    start_time_utc: datetime,
    end_time_utc: datetime,
    min_elevation_deg: float = 10.0
) -> List[Dict[str, Any]]:
    """
    Predict visibility passes for a satellite relative to an observer location.
    Uses Skyfield's analytical find_events method and groups rise/culminate/set events.
    Cached: all parameters are hashable (str, float, datetime).  Repeated calls
    for the same satellite, observer, and time window skip the expensive
    find_events + altaz computation entirely.
    """
    t_start = ts.from_datetime(ensure_utc(start_time_utc))
    t_end = ts.from_datetime(ensure_utc(end_time_utc))
    
    satellite = build_satellite_from_tle(name, line1, line2)
    observer_topos = wgs84.latlon(
        observer_latitude_deg, 
        observer_longitude_deg, 
        elevation_m=observer_elevation_m
    )
    
    t_events, event_types = satellite.find_events(
        observer_topos, t_start, t_end, altitude_degrees=min_elevation_deg
    )
    
    passes = []
    current_pass = {}
    
    for t, event_type in zip(t_events, event_types):
        if event_type == 0:  # Rise (AOS)
            current_pass = {
                "aos_time": t.utc_datetime()
            }
        elif event_type == 1:  # Culminate (Max Elevation)
            if "aos_time" in current_pass:
                current_pass["max_time"] = t.utc_datetime()
        elif event_type == 2:  # Set (LOS)
            if "aos_time" in current_pass and "max_time" in current_pass:
                current_pass["los_time"] = t.utc_datetime()
                
                # Fetch Time objects for each key event point
                t_aos = ts.from_datetime(current_pass["aos_time"])
                t_max = ts.from_datetime(current_pass["max_time"])
                t_los = ts.from_datetime(current_pass["los_time"])
                
                # Compute coordinates at AOS
                topocentric_aos = (satellite - observer_topos).at(t_aos)
                _, az_aos, _ = topocentric_aos.altaz()
                
                # Compute coordinates at MAX
                topocentric_max = (satellite - observer_topos).at(t_max)
                alt_max, az_max, dist_max = topocentric_max.altaz()
                
                # Compute coordinates at LOS
                topocentric_los = (satellite - observer_topos).at(t_los)
                _, az_los, _ = topocentric_los.altaz()
                
                passes.append({
                    "aos_time_utc": current_pass["aos_time"],
                    "max_time_utc": current_pass["max_time"],
                    "los_time_utc": current_pass["los_time"],
                    "max_elevation_deg": alt_max.degrees,
                    "azimuth_aos_deg": az_aos.degrees,
                    "azimuth_max_deg": az_max.degrees,
                    "azimuth_los_deg": az_los.degrees,
                    "range_at_max_km": dist_max.km
                })
                
            current_pass = {}  # Reset state machine
            
    return passes

@lru_cache(maxsize=128)
def compute_detailed_passes_from_tle(
    name: Optional[str],
    line1: str,
    line2: str,
    observer_latitude_deg: float,
    observer_longitude_deg: float,
    observer_elevation_m: float,
    start_time_utc: datetime,
    end_time_utc: datetime,
    min_elevation_deg: float = 10.0,
    profile_step_seconds: int = 30
) -> List[Dict[str, Any]]:
    """
    Predict detailed visibility passes with elevation profiles and quality labels.
    Cached: all parameters are hashable (str, float, int, datetime).  The
    detailed profile computation (per-step altaz across every pass) is the most
    expensive call in the pass predictor; caching avoids re-running it for
    identical requests (e.g. UI re-renders or retries with the same inputs).
    maxsize=128 is lower than predict_passes because each cached entry is larger
    (full elevation profiles).
    """
    # Enforce constraints
    start_time = ensure_utc(start_time_utc)
    end_time = ensure_utc(end_time_utc)
    
    # Limit max horizon to 7 days
    if (end_time - start_time).total_seconds() > 7 * 24 * 3600:
        import datetime as dt
        end_time = start_time + dt.timedelta(days=7)
        
    # Enforce minimum profile step
    step_sec = max(10, profile_step_seconds)
    
    t_start = ts.from_datetime(start_time)
    t_end = ts.from_datetime(end_time)
    
    satellite = build_satellite_from_tle(name, line1, line2)
    observer_topos = wgs84.latlon(
        observer_latitude_deg, 
        observer_longitude_deg, 
        elevation_m=observer_elevation_m
    )
    
    t_events, event_types = satellite.find_events(
        observer_topos, t_start, t_end, altitude_degrees=min_elevation_deg
    )
    
    detailed_passes = []
    current_pass = {}
    
    for t, event_type in zip(t_events, event_types):
        if event_type == 0:  # Rise
            current_pass = {"aos_time": t.utc_datetime()}
        elif event_type == 1:  # Culminate
            if "aos_time" in current_pass:
                current_pass["max_time"] = t.utc_datetime()
        elif event_type == 2:  # Set
            if "aos_time" in current_pass and "max_time" in current_pass:
                current_pass["los_time"] = t.utc_datetime()
                
                aos_dt = current_pass["aos_time"]
                max_dt = current_pass["max_time"]
                los_dt = current_pass["los_time"]
                
                duration_sec = (los_dt - aos_dt).total_seconds()
                
                t_aos = ts.from_datetime(aos_dt)
                t_max = ts.from_datetime(max_dt)
                t_los = ts.from_datetime(los_dt)
                
                topo_aos = (satellite - observer_topos).at(t_aos)
                _, az_aos, _ = topo_aos.altaz()
                
                topo_max = (satellite - observer_topos).at(t_max)
                alt_max, az_max, dist_max = topo_max.altaz()
                
                topo_los = (satellite - observer_topos).at(t_los)
                _, az_los, _ = topo_los.altaz()
                
                max_elev = alt_max.degrees
                if max_elev >= 75:
                    quality = "OVERHEAD"
                elif max_elev >= 45:
                    quality = "EXCELLENT"
                elif max_elev >= 20:
                    quality = "GOOD"
                else:
                    quality = "LOW"
                    
                # Build elevation profile
                profile = []
                import math
                num_steps = math.ceil(duration_sec / step_sec)
                
                for i in range(num_steps + 1):
                    import datetime as dt
                    step_dt = aos_dt + dt.timedelta(seconds=i * step_sec)
                    if step_dt > los_dt:
                        step_dt = los_dt
                        
                    t_step = ts.from_datetime(step_dt)
                    topo_step = (satellite - observer_topos).at(t_step)
                    alt_step, az_step, dist_step = topo_step.altaz()
                    
                    profile.append({
                        "timestamp_utc": step_dt,
                        "elevation_deg": alt_step.degrees,
                        "azimuth_deg": az_step.degrees,
                        "range_km": dist_step.km
                    })
                    
                    if step_dt == los_dt:
                        break
                        
                detailed_passes.append({
                    "aos_time_utc": aos_dt,
                    "max_time_utc": max_dt,
                    "los_time_utc": los_dt,
                    "duration_seconds": duration_sec,
                    "max_elevation_deg": max_elev,
                    "azimuth_aos_deg": az_aos.degrees,
                    "azimuth_max_deg": az_max.degrees,
                    "azimuth_los_deg": az_los.degrees,
                    "range_at_max_km": dist_max.km,
                    "quality_label": quality,
                    "elevation_profile": profile
                })
                
                if len(detailed_passes) >= 50:
                    break
                
            current_pass = {}  # Reset state machine
            
    return detailed_passes
