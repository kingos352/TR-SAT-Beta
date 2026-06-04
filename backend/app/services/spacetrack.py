import httpx
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import logging

from app.config import settings
from app.models.rso import RSOCatalog, TLERecord
from app.services.tle_parser import parse_tle_text, extract_norad_id, extract_epoch, extract_tle_orbital_fields
from app.services.classifier import classify_object_type, classify_category

logger = logging.getLogger(__name__)

SPACETRACK_LOGIN_URL = "https://www.space-track.org/ajaxauth/login"
SPACETRACK_BASE_URL = "https://www.space-track.org/basicspacedata/query"

def space_track_credentials_available() -> bool:
    """Check if Space-Track credentials are set in configuration."""
    return bool(settings.SPACETRACK_USERNAME and settings.SPACETRACK_PASSWORD)

def authenticate_spacetrack_client() -> httpx.Client:
    """
    Authenticate with Space-Track and return an active httpx.Client session.
    Never logs credentials. Returns controlled error if missing.
    """
    if not space_track_credentials_available():
        raise RuntimeError("Space-Track credentials are not available in the environment configuration.")

    client = httpx.Client(timeout=20.0)
    data = {
        "identity": settings.SPACETRACK_USERNAME,
        "password": settings.SPACETRACK_PASSWORD
    }
    
    response = client.post(SPACETRACK_LOGIN_URL, data=data)
    # Space-Track answers a bad login with HTTP 200 + body {"Login":"Failed"}; a
    # successful login returns an empty body and sets a session cookie. Never log
    # the raw response, to avoid leaking credentials.
    if response.status_code != 200:
        client.close()
        raise RuntimeError(f"Space-Track login request failed (HTTP {response.status_code}).")
    if "Failed" in response.text:
        client.close()
        raise RuntimeError(
            "Space-Track authentication failed — the configured credentials were rejected. "
            "Verify SPACETRACK_USERNAME / SPACETRACK_PASSWORD in backend/.env "
            "(account must be active at space-track.org)."
        )

    return client

# Space-Track OBJECT_TYPE -> (query value, internal type, source_group, category)
SPACETRACK_OBJECT_TYPES = {
    "rocket-body": ("ROCKET BODY", "ROCKET_BODY", "spacetrack-rocket-body", "Rocket Body"),
    "debris": ("DEBRIS", "DEBRIS", "spacetrack-debris", "Debris"),
    "payload": ("PAYLOAD", "PAYLOAD", "spacetrack-payload", None),
}


def _upsert_gp_entry(db: Session, entry: dict, group: str, object_type: str, category) -> tuple:
    """
    Upsert one parsed GP entry as a Space-Track sourced object. Returns
    (object_action, tle_inserted) where object_action is 'inserted' or 'updated'.
    """
    line1 = entry["line1"]
    line2 = entry["line2"]
    norad_id = extract_norad_id(line1)
    epoch = extract_epoch(line1)
    orbital_fields = extract_tle_orbital_fields(line1, line2)
    cospar_id = line1[9:17].strip() if len(line1) >= 17 else None

    name = entry["name"]
    if name.startswith("0 "):  # Space-Track 3LE name lines are prefixed with "0 "
        name = name[2:].strip()
    resolved_category = category if category is not None else classify_category(name, group)

    rso = db.query(RSOCatalog).filter(RSOCatalog.norad_id == norad_id).first()
    if not rso:
        rso = RSOCatalog(
            norad_id=norad_id,
            name=name,
            object_type=object_type,
            category=resolved_category,
            source="Space-Track",
            source_group=group,
            cospar_id=cospar_id,
            last_updated=datetime.now(timezone.utc).replace(tzinfo=None),
        )
        db.add(rso)
        object_action = "inserted"
    else:
        rso.name = name
        rso.object_type = object_type
        rso.category = resolved_category
        rso.source = "Space-Track"
        rso.source_group = group
        rso.cospar_id = cospar_id
        rso.last_updated = datetime.now(timezone.utc).replace(tzinfo=None)
        object_action = "updated"

    db.flush()

    existing_tle = db.query(TLERecord).filter(
        TLERecord.norad_id == norad_id,
        TLERecord.epoch == epoch
    ).first()
    tle_inserted = False
    if not existing_tle:
        db.add(TLERecord(
            norad_id=norad_id,
            name=name,
            line1=line1,
            line2=line2,
            epoch=epoch,
            source="Space-Track",
            source_group=group,
            ingested_at=datetime.now(timezone.utc).replace(tzinfo=None),
            **orbital_fields
        ))
        tle_inserted = True
    else:
        existing_tle.name = name
        existing_tle.line1 = line1
        existing_tle.line2 = line2
        existing_tle.source = "Space-Track"
        existing_tle.source_group = group
        existing_tle.ingested_at = datetime.now(timezone.utc).replace(tzinfo=None)
        for key, val in orbital_fields.items():
            setattr(existing_tle, key, val)

    return object_action, tle_inserted


def fetch_spacetrack_by_object_type(db: Session, type_key: str) -> dict:
    """
    Bulk-fetch all on-orbit objects of a given type from Space-Track (e.g. rocket
    bodies, which CelesTrak does not expose as a group) and ingest them. The type
    is taken from the Space-Track query, not name guessing, so classification is
    authoritative.
    """
    if type_key not in SPACETRACK_OBJECT_TYPES:
        raise ValueError(
            f"Unsupported object type '{type_key}'. Allowed: {', '.join(SPACETRACK_OBJECT_TYPES)}"
        )
    st_type, internal_type, group, category = SPACETRACK_OBJECT_TYPES[type_key]

    client = authenticate_spacetrack_client()
    try:
        encoded_type = st_type.replace(" ", "%20")
        url = (
            f"{SPACETRACK_BASE_URL}/class/gp/OBJECT_TYPE/{encoded_type}"
            f"/DECAY_DATE/null-val/orderby/NORAD_CAT_ID/format/3le"
        )
        response = client.get(url)
        if response.status_code != 200:
            raise RuntimeError(f"Space-Track data request failed with status: {response.status_code}")

        parsed_entries = parse_tle_text(response.text)
        inserted_objects = updated_objects = inserted_tles = skipped = 0
        for entry in parsed_entries:
            try:
                action, tle_inserted = _upsert_gp_entry(db, entry, group, internal_type, category)
                if action == "inserted":
                    inserted_objects += 1
                else:
                    updated_objects += 1
                if tle_inserted:
                    inserted_tles += 1
            except Exception:
                skipped += 1
                continue

        db.commit()
        return {
            "status": "success",
            "object_type": st_type,
            "fetched_count": len(parsed_entries),
            "inserted_objects": inserted_objects,
            "updated_objects": updated_objects,
            "inserted_tles": inserted_tles,
            "skipped_count": skipped,
            "message": f"Space-Track {st_type} bulk ingest complete.",
        }
    finally:
        client.close()


def fetch_spacetrack_latest_by_norad(db: Session, norad_id: int):
    """
    Fetch historical and latest GP data (up to 100 records) for a single NORAD ID from Space-Track,
    parse it, classify it, and ingest it into the local catalog.
    Uses 'Space-Track' as the source.
    """
    client = authenticate_spacetrack_client()
    try:
        # Fetch up to 100 historical records so the Orbit Evolution dashboard has data
        url = f"{SPACETRACK_BASE_URL}/class/gp/NORAD_CAT_ID/{norad_id}/orderby/EPOCH desc/limit/100/format/tle"
        response = client.get(url)
        if response.status_code != 200:
            raise RuntimeError(f"Space-Track data request failed with status: {response.status_code}")
        
        raw_tle_data = response.text
        if not raw_tle_data.strip():
            raise RuntimeError(f"No GP data found for NORAD ID {norad_id}")
            
        parsed_entries = parse_tle_text(raw_tle_data)
        if not parsed_entries:
            raise RuntimeError(f"Failed to parse TLE data for NORAD ID {norad_id}")
            
        # The first entry is the latest since we ordered by EPOCH desc
        latest_entry = parsed_entries[0]
        latest_line1 = latest_entry["line1"]
        latest_line2 = latest_entry["line2"]
        latest_epoch = extract_epoch(latest_line1)
        cospar_id = latest_line1[9:17].strip() if len(latest_line1) >= 17 else None
        
        # Classification using the latest entry
        group = "spacetrack"
        object_type = classify_object_type(latest_entry["name"], group)
        category = classify_category(latest_entry["name"], group)
        
        # Upsert RSOCatalog using the latest entry
        rso = db.query(RSOCatalog).filter(RSOCatalog.norad_id == norad_id).first()
        if not rso:
            rso = RSOCatalog(
                norad_id=norad_id,
                name=latest_entry["name"],
                object_type=object_type,
                category=category,
                source="Space-Track",
                source_group=group,
                cospar_id=cospar_id,
                last_updated=datetime.now(timezone.utc).replace(tzinfo=None)
            )
            db.add(rso)
        else:
            rso.name = latest_entry["name"]
            rso.object_type = object_type
            rso.category = category
            rso.source_group = group
            rso.cospar_id = cospar_id
            rso.last_updated = datetime.now(timezone.utc).replace(tzinfo=None)
            rso.source = "Space-Track"
            
        db.flush()
        
        # Now ingest all returned historical TLEs into TLERecord
        for entry in parsed_entries:
            try:
                line1 = entry["line1"]
                line2 = entry["line2"]
                epoch = extract_epoch(line1)
                orbital_fields = extract_tle_orbital_fields(line1, line2)
                
                existing_tle = db.query(TLERecord).filter(
                    TLERecord.norad_id == norad_id,
                    TLERecord.epoch == epoch
                ).first()
                
                if not existing_tle:
                    tle_record = TLERecord(
                        norad_id=norad_id,
                        name=entry["name"],
                        line1=line1,
                        line2=line2,
                        epoch=epoch,
                        source="Space-Track",
                        source_group=group,
                        ingested_at=datetime.now(timezone.utc).replace(tzinfo=None),
                        **orbital_fields
                    )
                    db.add(tle_record)
                else:
                    existing_tle.name = entry["name"]
                    existing_tle.line1 = line1
                    existing_tle.line2 = line2
                    existing_tle.source_group = group
                    existing_tle.source = "Space-Track"
                    existing_tle.ingested_at = datetime.now(timezone.utc).replace(tzinfo=None)
                    for key, val in orbital_fields.items():
                        setattr(existing_tle, key, val)
            except Exception:
                continue
                
        db.commit()
        
        return {
            "status": "success",
            "norad_id": norad_id,
            "epoch": latest_epoch.isoformat(),
            "message": f"Space-Track GP data integration successful. Ingested {len(parsed_entries)} historical TLE records."
        }
    finally:
        client.close()
