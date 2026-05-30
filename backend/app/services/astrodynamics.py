from datetime import datetime, timezone, timedelta
import math
from functools import lru_cache
from typing import Optional, List
from skyfield.api import EarthSatellite, load, wgs84
from app.services.tle_parser import extract_epoch

# Initialize timescale offline to ensure local-first functionality without internet requests
ts = load.timescale(builtin=True)

def ensure_utc(dt: datetime) -> datetime:
    """
    Ensure the datetime object is timezone-aware and set to UTC.
    """
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

@lru_cache(maxsize=128)
def build_satellite_from_tle(name: Optional[str], line1: str, line2: str) -> EarthSatellite:
    """
    Build a Skyfield EarthSatellite object from TLE lines.
    Cached: same TLE strings always produce an identical satellite object,
    so repeated calls (e.g. across conjunction screening pairs, ephemeris
    generation, and pass prediction) return the cached instance at no cost.
    """
    fallback_name = name if name else "OBJECT"
    return EarthSatellite(line1, line2, fallback_name, ts)

def get_tle_epoch_utc(line1: str) -> Optional[datetime]:
    """
    Extract TLE epoch and ensure it is in UTC.
    """
    try:
        epoch = extract_epoch(line1)
        return ensure_utc(epoch)
    except Exception:
        return None

def tle_age_days(line1: str, reference_dt: Optional[datetime] = None) -> Optional[float]:
    """
    Compute TLE age in days relative to a reference date.
    """
    epoch = get_tle_epoch_utc(line1)
    if epoch is None:
        return None
        
    ref = ensure_utc(reference_dt) if reference_dt else datetime.now(timezone.utc)
    delta = ref - epoch
    return delta.total_seconds() / 86400.0

def classify_tle_reliability(age_days: Optional[float]) -> str:
    """
    Classify TLE reliability status: FRESH, AGING, STALE, or UNKNOWN.
    """
    if age_days is None:
        return "UNKNOWN"
    if age_days <= 2.0:
        return "FRESH"
    if age_days <= 14.0:
        return "AGING"
    return "STALE"

def latlonalt_to_ecef(latitude_deg: float, longitude_deg: float, altitude_km: float) -> dict:
    """
    Convert geodetic coordinates to ECEF coordinates.
    NOTE: This uses a spherical approximation suitable for Cesium 3D visual mapping,
    not a high-precision ellipsoidal geodetic transformation.
    """
    R_EARTH_KM = 6378.137
    r = R_EARTH_KM + altitude_km
    lat_rad = math.radians(latitude_deg)
    lon_rad = math.radians(longitude_deg)
    
    x = r * math.cos(lat_rad) * math.cos(lon_rad)
    y = r * math.cos(lat_rad) * math.sin(lon_rad)
    z = r * math.sin(lat_rad)
    
    return {
        "x_km": x,
        "y_km": y,
        "z_km": z
    }

def propagate_state(name: Optional[str], line1: str, line2: str, timestamp_utc: datetime) -> dict:
    """
    Propagate the satellite position using SGP4/Skyfield.
    Returns a fresh dict each call — avoids mutable-cache corruption for
    high-altitude / deep-space (SDP4) satellites such as GEO where the same
    epoch is often queried multiple times across concurrent requests.
    build_satellite_from_tle is still cached so the expensive EarthSatellite
    construction is shared across calls.
    """
    t_utc = ensure_utc(timestamp_utc)
    satellite = build_satellite_from_tle(name, line1, line2)

    t = ts.from_datetime(t_utc)
    geocentric = satellite.at(t)
    subpoint = wgs84.subpoint(geocentric)

    latitude_deg = float(subpoint.latitude.degrees)
    longitude_deg = float(subpoint.longitude.degrees)
    altitude_km = float(subpoint.elevation.km)

    ecef = latlonalt_to_ecef(latitude_deg, longitude_deg, altitude_km)

    tle_epoch = get_tle_epoch_utc(line1)
    age = tle_age_days(line1, t_utc)
    reliability = classify_tle_reliability(age)

    return {
        "name": name if name else "OBJECT",
        "timestamp_utc": t_utc,
        "latitude_deg": latitude_deg,
        "longitude_deg": longitude_deg,
        "altitude_km": altitude_km,
        "ecef": ecef,
        "tle_epoch_utc": tle_epoch,
        "tle_age_days": age,
        "reliability_status": reliability
    }

def get_eci_state(name: Optional[str], line1: str, line2: str, timestamp_utc: datetime) -> dict:
    """
    Return the GCRS (ECI) position and velocity vectors from Skyfield.
    Units: km for position, km/s for velocity.
    """
    t_utc = ensure_utc(timestamp_utc)
    satellite = build_satellite_from_tle(name, line1, line2)
    t = ts.from_datetime(t_utc)
    geocentric = satellite.at(t)
    pos = geocentric.position.km
    vel = geocentric.velocity.km_per_s
    return {
        "timestamp_utc": t_utc,
        "pos_x_km": float(pos[0]),
        "pos_y_km": float(pos[1]),
        "pos_z_km": float(pos[2]),
        "vel_x_kms": float(vel[0]),
        "vel_y_kms": float(vel[1]),
        "vel_z_kms": float(vel[2]),
    }

def generate_eci_ephemeris(
    name: Optional[str],
    line1: str,
    line2: str,
    start_time_utc: datetime,
    end_time_utc: datetime,
    step_seconds: int = 60,
) -> List[dict]:
    """
    Generate an ECI (GCRS) state vector timeseries.
    """
    t_start = ensure_utc(start_time_utc)
    t_end = ensure_utc(end_time_utc)
    satellite = build_satellite_from_tle(name, line1, line2)
    points = []
    current = t_start
    while current <= t_end and len(points) < 5000:
        t = ts.from_datetime(current)
        geo = satellite.at(t)
        pos = geo.position.km
        vel = geo.velocity.km_per_s
        points.append({
            "timestamp_utc": current,
            "pos_x_km": float(pos[0]),
            "pos_y_km": float(pos[1]),
            "pos_z_km": float(pos[2]),
            "vel_x_kms": float(vel[0]),
            "vel_y_kms": float(vel[1]),
            "vel_z_kms": float(vel[2]),
        })
        current += timedelta(seconds=step_seconds)
    return points

def generate_ephemeris(
    name: Optional[str], 
    line1: str, 
    line2: str, 
    start_time_utc: datetime, 
    end_time_utc: datetime, 
    step_seconds: int = 60
) -> List[dict]:
    """
    Generate an ephemeris coordinate timeseries from start to end timestamps.
    Enforces a strict upper limit of 10000 points.
    """
    t_start = ensure_utc(start_time_utc)
    t_end = ensure_utc(end_time_utc)
    
    states = []
    current_time = t_start
    max_points = 3000
    first_error = None

    while current_time <= t_end:
        try:
            states.append(propagate_state(name, line1, line2, current_time))
        except Exception as e:
            if first_error is None:
                first_error = e
        current_time += timedelta(seconds=step_seconds)
        if len(states) >= max_points:
            break

    if not states:
        raise first_error or ValueError("No valid propagation points generated")

    # Include end_time_utc if the stepping interval didn't land exactly on it
    if len(states) < max_points and (states[-1]["timestamp_utc"] - t_end).total_seconds() < -0.1:
        try:
            states.append(propagate_state(name, line1, line2, t_end))
        except Exception:
            pass

    return states

def compute_observer_aer(
    name: Optional[str],
    line1: str,
    line2: str,
    timestamp_utc: datetime,
    observer_latitude_deg: float,
    observer_longitude_deg: float,
    observer_elevation_m: float = 0.0
) -> dict:
    """
    Compute topocentric Azimuth, Elevation, and Range (AER) of the satellite 
    relative to a WGS84 ground observer position.
    """
    t_utc = ensure_utc(timestamp_utc)
    satellite = build_satellite_from_tle(name, line1, line2)
    t = ts.from_datetime(t_utc)
    
    observer_topos = wgs84.latlon(
        observer_latitude_deg, 
        observer_longitude_deg, 
        elevation_m=observer_elevation_m
    )
    
    # Correct Skyfield relative vector formulation
    topocentric = (satellite - observer_topos).at(t)
    alt, az, distance = topocentric.altaz()
    
    return {
        "timestamp_utc": t_utc,
        "azimuth_deg": az.degrees,
        "elevation_deg": alt.degrees,
        "range_km": distance.km
    }
