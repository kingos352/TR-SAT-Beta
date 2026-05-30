from datetime import datetime, timedelta
import re

def extract_norad_id(line1: str) -> int:
    """
    Extract NORAD Catalog Number from TLE Line 1 (cols 3-7).
    """
    if len(line1) < 7:
        raise ValueError("Line 1 is too short to extract NORAD ID.")
    id_str = line1[2:7].strip()
    return int(id_str)

def extract_epoch(line1: str) -> datetime:
    """
    Extract Epoch date and time from TLE Line 1 (cols 19-32).
    Applies the NORAD 57-year epoch rule.
    """
    if len(line1) < 32:
        raise ValueError("Line 1 is too short to extract Epoch.")
    
    epoch_str = line1[18:32].strip()
    # Format: YYDDD.DDDDDDDD
    if len(epoch_str) < 2:
        raise ValueError(f"Malformed epoch string: {epoch_str}")
        
    year_val = int(epoch_str[:2])
    if year_val >= 57:
        year = year_val + 1900
    else:
        year = year_val + 2000
        
    day_fraction_str = epoch_str[2:]
    if not day_fraction_str:
        days = 1.0
    else:
        days = float(day_fraction_str)
        
    # Day 1.0 is Jan 1st 00:00:00. So we add (days - 1) to Jan 1st
    return datetime(year, 1, 1) + timedelta(days=days - 1)

def parse_bstar(bstar_str: str) -> float | None:
    """
    Parse B* drag term from TLE field (format: sDDDDDsE).
    """
    bstar_str = bstar_str.strip()
    if not bstar_str:
        return None
    try:
        # Expected format is 8 chars, e.g. " 26653-3" or "-11606-4"
        # Mantissa is the first part up to the exponent
        # Exponent is the last 2 characters (sign + digit)
        mantissa_str = bstar_str[:-2].strip()
        exponent_str = bstar_str[-2:].strip()
        
        mantissa = float(mantissa_str) / 100000.0
        exponent = int(exponent_str)
        return mantissa * (10 ** exponent)
    except Exception:
        return None

def extract_tle_orbital_fields(line1: str, line2: str) -> dict:
    """
    Extract orbital fields from TLE Line 1 and Line 2.
    """
    if len(line1) < 69 or len(line2) < 69:
        raise ValueError("TLE lines must be at least 69 characters.")
        
    bstar = parse_bstar(line1[53:61])
    
    try:
        inclination_deg = float(line2[8:16].strip())
        raan_deg = float(line2[17:25].strip())
        
        # Eccentricity has an implied decimal point
        ecc_str = line2[26:33].strip()
        eccentricity = float(ecc_str) / 10000000.0  # 7 implied decimal places
        
        arg_perigee_deg = float(line2[34:42].strip())
        mean_anomaly_deg = float(line2[43:51].strip())
        mean_motion_rev_per_day = float(line2[52:63].strip())
    except Exception as e:
        raise ValueError(f"Failed to parse orbital fields: {str(e)}")

    return {
        "bstar": bstar,
        "inclination_deg": inclination_deg,
        "raan_deg": raan_deg,
        "eccentricity": eccentricity,
        "arg_perigee_deg": arg_perigee_deg,
        "mean_anomaly_deg": mean_anomaly_deg,
        "mean_motion_rev_per_day": mean_motion_rev_per_day
    }

def parse_tle_text(tle_text: str) -> list[dict]:
    """
    Parse a multiline TLE text block into a list of satellite dictionaries.
    Supports both 3-line blocks (Name, Line 1, Line 2) and 2-line blocks.
    """
    lines = [line.strip() for line in tle_text.splitlines() if line.strip()]
    entries = []
    
    i = 0
    last_name = None
    name_used = True
    
    while i < len(lines):
        line = lines[i]
        
        # Check if line matches TLE Line 1 format
        if line.startswith('1') and len(line) >= 60 and (i + 1) < len(lines):
            next_line = lines[i + 1]
            if next_line.startswith('2') and len(next_line) >= 60:
                line1 = line
                line2 = next_line
                
                try:
                    norad_id = extract_norad_id(line1)
                except Exception:
                    norad_id = None
                    
                if last_name and not name_used:
                    name = last_name
                    name_used = True
                else:
                    name = f"OBJECT {norad_id}" if norad_id else "UNKNOWN"
                    
                entries.append({
                    "name": name,
                    "line1": line1,
                    "line2": line2
                })
                i += 2
                continue
                
        last_name = line
        name_used = False
        i += 1
        
    return entries
