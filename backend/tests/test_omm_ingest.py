"""OMM (Orbit Mean-elements Message) ingestion — conversion correctness.

Validates that a CelesTrak FORMAT=json OMM record converts to a classic TLE
line1/line2 pair that round-trips back through SGP4 with the same NORAD id.
No network or database is required.
"""
from sgp4.api import Satrec

from app.services.celestrak import omm_record_to_tle, _omm_records_to_entries
from app.services.tle_parser import extract_norad_id, extract_tle_orbital_fields

# Representative CelesTrak FORMAT=json OMM record for the ISS.
ISS_OMM = {
    "OBJECT_NAME": "ISS (ZARYA)",
    "OBJECT_ID": "1998-067A",
    "EPOCH": "2024-01-01T00:00:00.000000",
    "MEAN_MOTION": 15.50103472,
    "ECCENTRICITY": 0.0007039,
    "INCLINATION": 51.6416,
    "RA_OF_ASC_NODE": 247.4627,
    "ARG_OF_PERICENTER": 130.5360,
    "MEAN_ANOMALY": 325.0288,
    "EPHEMERIS_TYPE": 0,
    "CLASSIFICATION_TYPE": "U",
    "NORAD_CAT_ID": 25544,
    "ELEMENT_SET_NO": 999,
    "REV_AT_EPOCH": 12345,
    "BSTAR": 0.00012345,
    "MEAN_MOTION_DOT": 1.234e-05,
    "MEAN_MOTION_DDOT": 0.0,
}


def test_omm_record_to_tle_round_trips():
    line1, line2 = omm_record_to_tle(ISS_OMM)
    assert line1.startswith("1 ")
    assert line2.startswith("2 ")
    assert len(line1) >= 69
    assert len(line2) >= 69
    # NORAD id survives the OMM -> TLE conversion.
    assert extract_norad_id(line1) == 25544
    # The generated lines parse back into a valid SGP4 record.
    sat = Satrec.twoline2rv(line1, line2)
    assert sat.satnum == 25544


def test_omm_orbital_fields_match_input():
    line1, line2 = omm_record_to_tle(ISS_OMM)
    fields = extract_tle_orbital_fields(line1, line2)
    # Inclination and mean motion should reflect the source OMM to ~TLE precision.
    assert abs(fields["inclination_deg"] - ISS_OMM["INCLINATION"]) < 1e-3
    assert abs(fields["mean_motion_rev_per_day"] - ISS_OMM["MEAN_MOTION"]) < 1e-6


def test_omm_records_to_entries_shapes_and_skips():
    entries = _omm_records_to_entries([ISS_OMM, {"OBJECT_NAME": "BROKEN"}])
    # The valid record converts; the malformed one is skipped, not fatal.
    assert len(entries) == 1
    assert entries[0]["name"] == "ISS (ZARYA)"
    assert entries[0]["line1"].startswith("1 ")
