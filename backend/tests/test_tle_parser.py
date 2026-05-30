import pytest
from datetime import datetime
from app.services.tle_parser import (
    parse_tle_text,
    extract_norad_id,
    extract_epoch,
    extract_tle_orbital_fields
)

# Benchmark ISS TLE sample
ISS_TLE = """
ISS (ZARYA)
1 25544U 98067A   26144.57790509  .00014790  00000-0  26653-3 0  9997
2 25544  51.6409 191.0776 0004128 316.0372 135.9189 15.49479326454746
"""

def test_extract_norad_id():
    line1 = ISS_TLE.strip().splitlines()[1]
    norad_id = extract_norad_id(line1)
    assert norad_id == 25544

def test_extract_epoch():
    line1 = ISS_TLE.strip().splitlines()[1]
    epoch = extract_epoch(line1)
    # 26144.57790509 -> Year 2026, Day 144.57790509
    assert epoch.year == 2026
    # Day 144 of year 2026 is May 24th (not a leap year)
    assert epoch.month == 5
    assert epoch.day == 24

def test_extract_orbital_fields():
    lines = ISS_TLE.strip().splitlines()
    line1 = lines[1]
    line2 = lines[2]
    
    fields = extract_tle_orbital_fields(line1, line2)
    
    assert fields["inclination_deg"] == 51.6409
    assert fields["raan_deg"] == 191.0776
    # 0004128 in TLE represents 0.0004128
    assert fields["eccentricity"] == 0.0004128
    assert fields["arg_perigee_deg"] == 316.0372
    assert fields["mean_anomaly_deg"] == 135.9189
    assert fields["mean_motion_rev_per_day"] == 15.49479326
    # 26653-3 represents 0.26653 * 10^-3 = 0.00026653
    assert fields["bstar"] == pytest.approx(0.00026653)

def test_parse_tle_text_three_line():
    parsed = parse_tle_text(ISS_TLE)
    assert len(parsed) == 1
    assert parsed[0]["name"] == "ISS (ZARYA)"
    assert parsed[0]["line1"].startswith("1 ")
    assert parsed[0]["line2"].startswith("2 ")

def test_parse_tle_text_two_line():
    two_line_tle = "\n".join(ISS_TLE.strip().splitlines()[1:])
    parsed = parse_tle_text(two_line_tle)
    assert len(parsed) == 1
    assert parsed[0]["name"] == "OBJECT 25544"

def test_malformed_input():
    # If line lengths are short or missing fields
    with pytest.raises(ValueError):
        extract_norad_id("1 25")
        
    with pytest.raises(ValueError):
        extract_epoch("1 25544U 98067A")

    with pytest.raises(ValueError):
        extract_tle_orbital_fields("1 25544U", "2 25544")
