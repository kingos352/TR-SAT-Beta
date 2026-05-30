import httpx
from typing import Dict, List
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.models.rso import RSOCatalog, TLERecord
from app.services.tle_parser import parse_tle_text, extract_norad_id, extract_epoch, extract_tle_orbital_fields
from app.services.classifier import classify_object_type, classify_category
from app.schemas.rso import CatalogSyncResponse

CELESTRAK_BASE_URL = "https://celestrak.org/NORAD/elements/gp.php"

# CelesTrak publishes debris as event-specific clouds, not a single "debris" group.
# The "debris" selection fans out to these real groups.
DEBRIS_GROUPS = [
    "fengyun-1c-debris",
    "cosmos-2251-debris",
    "iridium-33-debris",
    "cosmos-1408-debris",
]

# Supported group identifiers. "debris" is an aggregate alias (see DEBRIS_GROUPS).
SUPPORTED_GROUPS = [
    "active",
    "stations",
    "visual",
    "geo",
    "weather",
    "noaa",
    "gps-ops",
    "galileo",
    "starlink",
    "oneweb",
    "science",
    "debris",
] + DEBRIS_GROUPS

def build_celestrak_url(group: str) -> str:
    """
    Construct URL to query specific CelesTrak GP element groupings.
    """
    if group not in SUPPORTED_GROUPS:
        raise ValueError(f"Group '{group}' is not supported by TR-SAT CelesTrak client.")
    return f"{CELESTRAK_BASE_URL}?GROUP={group}&FORMAT=tle"

def fetch_celestrak_group(group: str, timeout_seconds: int = 60) -> str:
    """
    Fetch raw TLE stream from CelesTrak API using httpx.
    Raises ValueError when CelesTrak rejects the query or returns no element data
    (CelesTrak answers an unknown group with HTTP 200 + an "Invalid query" body).
    """
    url = build_celestrak_url(group)
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    response = httpx.get(url, headers=headers, timeout=timeout_seconds)
    if response.status_code == 403 and "has not updated" in response.text:
        raise ValueError(
            "CelesTrak rate limit: Data has not updated since your last download. "
            "CelesTrak elements are updated once every 2 hours. Please try again later."
        )
    if response.status_code != 200:
        raise RuntimeError(f"CelesTrak request failed with status: {response.status_code}")

    body = response.text
    lowered = body.lstrip().lower()
    if lowered.startswith("invalid query") or "no gp data found" in lowered:
        raise ValueError(
            f"CelesTrak returned no data for group '{group}': {body.strip()[:160]}"
        )
    return body


def _empty_counts() -> Dict[str, int]:
    return {
        "fetched": 0,
        "parsed": 0,
        "inserted_objects": 0,
        "inserted_tles": 0,
        "updated_objects": 0,
        "skipped": 0,
    }


def _ingest_parsed_entries(db: Session, group: str, parsed_entries: List[dict], acc: Dict[str, int], warnings: List[str] = None) -> None:
    """Parse, classify and persist one group's entries, accumulating counts into acc."""
    for entry in parsed_entries:
        try:
            line1 = entry["line1"]
            line2 = entry["line2"]

            norad_id = extract_norad_id(line1)
            epoch = extract_epoch(line1)
            orbital_fields = extract_tle_orbital_fields(line1, line2)

            cospar_id = line1[9:17].strip() if len(line1) >= 17 else None

            object_type = classify_object_type(entry["name"], group)
            category = classify_category(entry["name"], group)

            rso = db.query(RSOCatalog).filter(RSOCatalog.norad_id == norad_id).first()
            if not rso:
                rso = RSOCatalog(
                    norad_id=norad_id,
                    name=entry["name"],
                    object_type=object_type,
                    category=category,
                    source="CelesTrak",
                    source_group=group,
                    cospar_id=cospar_id,
                    last_updated=datetime.now(timezone.utc).replace(tzinfo=None)
                )
                db.add(rso)
                acc["inserted_objects"] += 1
            else:
                rso.name = entry["name"]
                rso.object_type = object_type
                rso.category = category
                rso.source_group = group
                rso.cospar_id = cospar_id
                rso.last_updated = datetime.now(timezone.utc).replace(tzinfo=None)
                acc["updated_objects"] += 1

            # Flush catalog insertion so FK is valid
            db.flush()

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
                    source="CelesTrak",
                    source_group=group,
                    ingested_at=datetime.now(timezone.utc).replace(tzinfo=None),
                    **orbital_fields
                )
                db.add(tle_record)
                acc["inserted_tles"] += 1
            else:
                existing_tle.name = entry["name"]
                existing_tle.line1 = line1
                existing_tle.line2 = line2
                existing_tle.source_group = group
                existing_tle.ingested_at = datetime.now(timezone.utc).replace(tzinfo=None)
                for key, val in orbital_fields.items():
                    setattr(existing_tle, key, val)

            acc["parsed"] += 1
        except Exception as exc:
            acc["skipped"] += 1
            if warnings is not None and acc["skipped"] <= 3:
                name = entry.get("name", "?") if isinstance(entry, dict) else "?"
                warnings.append(f"Skip [{name}]: {exc}")
            continue


def ingest_celestrak_group(db: Session, group: str) -> CatalogSyncResponse:
    """
    Query CelesTrak elements, parse parameters, classify, and persist to SQLite.
    The "debris" group is an aggregate that fans out to the real CelesTrak debris
    clouds (DEBRIS_GROUPS); a failure in one sub-group is reported as a warning
    rather than aborting the whole sync.
    """
    groups = DEBRIS_GROUPS if group == "debris" else [group]
    acc = _empty_counts()
    warnings: List[str] = []

    for g in groups:
        try:
            raw_tle_data = fetch_celestrak_group(g)
        except ValueError as e:
            warnings.append(str(e))
            continue
        parsed_entries = parse_tle_text(raw_tle_data)
        acc["fetched"] += len(parsed_entries)
        _ingest_parsed_entries(db, g, parsed_entries, acc, warnings)

    db.commit()

    return CatalogSyncResponse(
        group=group,
        fetched_count=acc["fetched"],
        parsed_count=acc["parsed"],
        inserted_objects=acc["inserted_objects"],
        inserted_tles=acc["inserted_tles"],
        updated_objects=acc["updated_objects"],
        skipped_count=acc["skipped"],
        warning="; ".join(warnings) if warnings else None,
    )
