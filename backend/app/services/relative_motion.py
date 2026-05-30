import math
from datetime import datetime, timedelta, timezone
from skyfield.api import load, EarthSatellite
from sqlalchemy.orm import Session
from app.models.rso import TLERecord
from app.schemas.advanced_research import RelativeMotionResult, RelativeMotionPoint

def get_relative_motion(db: Session, primary_id: int, secondary_id: int, tca_utc: datetime) -> RelativeMotionResult:
    # Get latest TLEs
    prim_tle = db.query(TLERecord).filter(TLERecord.norad_id == primary_id).order_by(TLERecord.epoch.desc()).first()
    sec_tle = db.query(TLERecord).filter(TLERecord.norad_id == secondary_id).order_by(TLERecord.epoch.desc()).first()
    
    if not prim_tle or not sec_tle:
        raise ValueError("Missing TLE data for relative motion analysis.")
        
    ts = load.timescale()
    sat1 = EarthSatellite(prim_tle.line1, prim_tle.line2, "Primary", ts)
    sat2 = EarthSatellite(sec_tle.line1, sec_tle.line2, "Secondary", ts)
    
    # Propagate from TCA - 10 mins to TCA + 10 mins
    start_time = tca_utc - timedelta(minutes=10)
    
    curve = []
    
    t_eval = start_time
    for i in range(121): # every 10 seconds for 20 mins
        t_sf = ts.from_datetime(t_eval)
        pos1, vel1 = sat1.at(t_sf).position.km, sat1.at(t_sf).velocity.km_per_s
        pos2, vel2 = sat2.at(t_sf).position.km, sat2.at(t_sf).velocity.km_per_s
        
        dist = math.sqrt((pos1[0]-pos2[0])**2 + (pos1[1]-pos2[1])**2 + (pos1[2]-pos2[2])**2)
        curve.append(RelativeMotionPoint(
            timestamp_utc=t_eval,
            distance_km=dist
        ))
        
        if i == 60: # this is TCA
            rel_vx = vel1[0] - vel2[0]
            rel_vy = vel1[1] - vel2[1]
            rel_vz = vel1[2] - vel2[2]
            tca_speed = math.sqrt(rel_vx**2 + rel_vy**2 + rel_vz**2)
            
        t_eval += timedelta(seconds=10)
        
    return RelativeMotionResult(
        primary_id=primary_id,
        secondary_id=secondary_id,
        tca_utc=tca_utc,
        relative_speed_kmps=tca_speed,
        distance_curve=curve
    )
