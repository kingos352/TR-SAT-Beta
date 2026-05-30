from typing import List, Tuple
from sqlalchemy.orm import Session
from app.models.rso import TLERecord
from app.schemas.advanced_research import HistoricalTLEPoint, OrbitalDecayIndicators

def get_historical_tles(db: Session, norad_id: int) -> List[HistoricalTLEPoint]:
    records = db.query(TLERecord).filter(TLERecord.norad_id == norad_id).order_by(TLERecord.epoch.asc()).all()
    points = []
    for r in records:
        points.append(HistoricalTLEPoint(
            epoch=r.epoch,
            inclination=r.inclination_deg or 0.0,
            raan=r.raan_deg or 0.0,
            eccentricity=r.eccentricity or 0.0,
            arg_perigee=r.arg_perigee_deg or 0.0,
            mean_anomaly=r.mean_anomaly_deg or 0.0,
            mean_motion=r.mean_motion_rev_per_day or 0.0,
            bstar=r.bstar or 0.0
        ))
    return points

def get_decay_indicators(points: List[HistoricalTLEPoint]) -> OrbitalDecayIndicators:
    if len(points) < 2:
        return OrbitalDecayIndicators(
            mean_motion_trend=None,
            bstar_trend=None,
            altitude_trend_km=None,
            note="Insufficient historical TLE records. Sync this object over time to build an evolution timeline."
        )
        
    first = points[0]
    last = points[-1]
    
    mm_diff = last.mean_motion - first.mean_motion
    bstar_diff = last.bstar - first.bstar
    
    # Very rough approx altitude change from mean motion
    # SMA = (mu / n^2)^(1/3)
    # n is rad/s. mean_motion is rev/day
    mu = 398600.4418
    n_first = first.mean_motion * (2 * 3.141592653589793) / 86400.0
    n_last = last.mean_motion * (2 * 3.141592653589793) / 86400.0
    
    try:
        sma_first = (mu / (n_first**2))**(1/3)
        sma_last = (mu / (n_last**2))**(1/3)
        alt_diff = sma_last - sma_first
    except:
        alt_diff = 0.0
        
    return OrbitalDecayIndicators(
        mean_motion_trend=mm_diff,
        bstar_trend=bstar_diff,
        altitude_trend_km=alt_diff,
        note="These indicators are derived from public TLE/GP fields and are not a high-fidelity atmospheric drag or orbit determination product."
    )
