from typing import Optional

def classify_object_type(name: str, group: Optional[str] = None) -> str:
    """
    Classify the Resident Space Object type (PAYLOAD, ROCKET_BODY, DEBRIS, UNKNOWN)
    based on the name and the ingestion group name.
    """
    name_upper = name.upper()
    group_upper = group.upper() if group else ""

    # Check for Debris
    if "DEBRIS" in group_upper or "DEB" in name_upper or "DEBRIS" in name_upper or "FRAGMENT" in name_upper:
        return "DEBRIS"

    # Check for Rocket Body
    if "R/B" in name_upper or "ROCKET BODY" in name_upper or "AKM" in name_upper:
        return "ROCKET_BODY"

    # Check for Payload
    if name_upper and name_upper != "UNKNOWN":
        return "PAYLOAD"

    return "UNKNOWN"

def classify_category(name: str, group: Optional[str] = None) -> str:
    """
    Classify the orbital intelligence category of the RSO.
    """
    name_upper = name.upper()
    group_upper = group.upper() if group else ""

    # Debris / Rocket Body take precedence if matching type
    obj_type = classify_object_type(name, group)
    if obj_type == "DEBRIS":
        return "Debris"
    if obj_type == "ROCKET_BODY":
        return "Rocket Body"

    # Space Stations
    if "ISS" in name_upper or "TIANGONG" in name_upper or "SPACE STATION" in name_upper:
        return "Space Station"

    # Mega-constellations
    if "STARLINK" in name_upper or "ONEWEB" in name_upper:
        return "Mega-constellation"

    # Navigation
    if "GPS" in name_upper or "GALILEO" in name_upper or "GLONASS" in name_upper or "BEIDOU" in name_upper:
        return "Navigation"

    # Weather
    if "NOAA" in name_upper or "GOES" in name_upper or "METEOR" in name_upper:
        return "Weather"

    # Earth Observation
    if any(eo in name_upper for eo in ["GOKTURK", "IMECE", "RASAT", "SENTINEL", "LANDSAT", "EARTH OBS"]):
        return "Earth Observation"

    # Communication
    if any(comm in name_upper for comm in ["TURKSAT", "INTELSAT", "SES", "EUTELSAT", "TELECOM"]):
        return "Communication"

    # Science
    if "SCIENCE" in group_upper or any(sci in name_upper for sci in ["HUBBLE", "TESS", "SWIFT", "JWST", "KEPLER"]):
        return "Science"

    return "Unknown"
