import math
from datetime import datetime, timezone
from skyfield.api import EarthSatellite, load

def approximate_sun_eci(t: datetime):
    # Number of days from J2000.0
    # J2000.0 is 2000-01-01 12:00:00 UTC
    j2000 = datetime(2000, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    d = (t - j2000).total_seconds() / 86400.0
    
    # Mean anomaly of the Sun
    g = math.radians((357.529 + 0.98560028 * d) % 360.0)
    
    # Mean longitude of the Sun
    q = (280.459 + 0.98564736 * d) % 360.0
    
    # Geocentric apparent ecliptic longitude
    L = math.radians((q + 1.915 * math.sin(g) + 0.020 * math.sin(2*g)) % 360.0)
    
    # Mean obliquity of the ecliptic
    e = math.radians(23.439 - 0.00000036 * d)
    
    # Unit vector in ECI
    x = math.cos(L)
    y = math.sin(L) * math.cos(e)
    z = math.sin(L) * math.sin(e)
    
    return x, y, z

def determine_illumination_state(line1: str, line2: str, t_utc: datetime) -> str:
    try:
        ts = load.timescale()
        t = ts.from_datetime(t_utc)
        satellite = EarthSatellite(line1, line2, "Target", ts)
        
        pos = satellite.at(t).position.km
        x_sat, y_sat, z_sat = pos[0], pos[1], pos[2]
        
        r_sat = math.sqrt(x_sat**2 + y_sat**2 + z_sat**2)
        if r_sat == 0:
            return "UNKNOWN"
            
        x_sun, y_sun, z_sun = approximate_sun_eci(t_utc)
        
        # Projection of sat vector onto sun direction
        proj = x_sat * x_sun + y_sat * y_sun + z_sat * z_sun
        
        if proj > 0:
            # Satellite is on the sunward side of the Earth
            return "SUNLIT"
        else:
            # Satellite is on the night side. Check if it's within the cylindrical shadow.
            perp_dist_sq = r_sat**2 - proj**2
            if perp_dist_sq < 0:
                perp_dist_sq = 0
            perp_dist = math.sqrt(perp_dist_sq)
            
            EARTH_RADIUS_KM = 6371.0
            if perp_dist < EARTH_RADIUS_KM:
                return "EARTH_SHADOW"
            else:
                return "SUNLIT"
    except Exception as e:
        print(f"Illumination error: {e}")
        return "UNKNOWN"
