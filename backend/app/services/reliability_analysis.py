from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.rso import TLERecord
from app.schemas.reliability_analysis import ObjectReliabilityDetail, ReliabilitySummary
import statistics

def get_reliability_label(age_days: float) -> str:
    if age_days <= 2.0:
        return "FRESH"
    elif age_days <= 14.0:
        return "AGING"
    else:
        return "STALE"

def calculate_age_days(epoch: datetime) -> float:
    now = datetime.now(timezone.utc)
    # Ensure epoch is timezone-aware
    if epoch.tzinfo is None:
        epoch = epoch.replace(tzinfo=timezone.utc)
    delta = now - epoch
    return delta.total_seconds() / 86400.0

def get_object_reliability(db: Session, norad_id: str) -> ObjectReliabilityDetail:
    try:
        norad_id_int = int(norad_id)
    except (ValueError, TypeError):
        raise ValueError("Invalid NORAD ID.")
        
    rso = db.query(TLERecord).filter(TLERecord.norad_id == norad_id_int).order_by(TLERecord.epoch.desc()).first()
    if not rso or not rso.epoch:
        raise ValueError("RSO not found or has no epoch.")
    
    age_days = calculate_age_days(rso.epoch)
    label = get_reliability_label(age_days)
    
    warnings = []
    if label == "STALE":
        warnings.append("High covariance expected. Propagation errors increase non-linearly over time.")
        
    return ObjectReliabilityDetail(
        norad_id=norad_id_int,
        tle_epoch_utc=rso.epoch.isoformat() if hasattr(rso.epoch, "isoformat") else str(rso.epoch),
        tle_age_days=age_days,
        reliability_label=label,
        warnings=warnings
    )

def get_reliability_summary(db: Session) -> ReliabilitySummary:
    rsos = db.query(TLERecord).filter(TLERecord.epoch.isnot(None)).all()
    if not rsos:
        return ReliabilitySummary(
            overall_freshness_score=0.0,
            total_objects=0,
            fresh_count=0,
            aging_count=0,
            stale_count=0,
            unknown_count=0,
            average_age_days=0.0,
            median_age_days=0.0,
            age_histogram=[
                {"label": "0-2d", "count": 0},
                {"label": "2-5d", "count": 0},
                {"label": "5-10d", "count": 0},
                {"label": "10-15d", "count": 0},
                {"label": "15d+", "count": 0}
            ]
        )
        
    ages = [calculate_age_days(rso.epoch) for rso in rsos]
    
    fresh_count = 0
    aging_count = 0
    stale_count = 0
    unknown_count = 0
    
    # Histogram counters
    bin_0_2 = 0
    bin_2_5 = 0
    bin_5_10 = 0
    bin_10_15 = 0
    bin_15_plus = 0
    
    for age in ages:
        label = get_reliability_label(age)
        if label == "FRESH":
            fresh_count += 1
        elif label == "AGING":
            aging_count += 1
        else:
            stale_count += 1
            
        if age <= 2.0:
            bin_0_2 += 1
        elif age <= 5.0:
            bin_2_5 += 1
        elif age <= 10.0:
            bin_5_10 += 1
        elif age <= 15.0:
            bin_10_15 += 1
        else:
            bin_15_plus += 1
            
    total = len(ages)
    
    overall_freshness_score = ((fresh_count + aging_count * 0.5) / total) * 100.0 if total > 0 else 0.0
    
    age_histogram = [
        {"label": "0-2d", "count": bin_0_2},
        {"label": "2-5d", "count": bin_2_5},
        {"label": "5-10d", "count": bin_5_10},
        {"label": "10-15d", "count": bin_10_15},
        {"label": "15d+", "count": bin_15_plus}
    ]
    
    return ReliabilitySummary(
        overall_freshness_score=overall_freshness_score,
        total_objects=total,
        fresh_count=fresh_count,
        aging_count=aging_count,
        stale_count=stale_count,
        unknown_count=unknown_count,
        average_age_days=statistics.mean(ages) if ages else 0.0,
        median_age_days=statistics.median(ages) if ages else 0.0,
        age_histogram=age_histogram
    )
