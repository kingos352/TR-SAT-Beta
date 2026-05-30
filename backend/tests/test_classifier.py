from app.services.classifier import classify_object_type, classify_category

def test_classify_space_station():
    name = "ISS (ZARYA)"
    assert classify_object_type(name) == "PAYLOAD"
    assert classify_category(name) == "Space Station"

    name_tiangong = "TIANGONG STATION"
    assert classify_category(name_tiangong) == "Space Station"

def test_classify_communication():
    name = "TURKSAT 5B"
    assert classify_object_type(name) == "PAYLOAD"
    assert classify_category(name) == "Communication"

    name_intelsat = "INTELSAT 39"
    assert classify_category(name_intelsat) == "Communication"

def test_classify_mega_constellation():
    name = "STARLINK-31245"
    assert classify_object_type(name) == "PAYLOAD"
    assert classify_category(name) == "Mega-constellation"

    name_oneweb = "ONEWEB-0145"
    assert classify_category(name_oneweb) == "Mega-constellation"

def test_classify_debris():
    name = "FENGYUN 1C DEB"
    assert classify_object_type(name) == "DEBRIS"
    assert classify_category(name) == "Debris"

    name_frag = "COSMOS 2251 FRAGMENT"
    assert classify_object_type(name_frag) == "DEBRIS"
    assert classify_category(name_frag) == "Debris"

    # Match by group name
    assert classify_object_type("OBJECT A", "debris") == "DEBRIS"

def test_classify_rocket_body():
    name = "FALCON 9 R/B"
    assert classify_object_type(name) == "ROCKET_BODY"
    assert classify_category(name) == "Rocket Body"

    name_rb_verbose = "ARIANE 5 ROCKET BODY"
    assert classify_object_type(name_rb_verbose) == "ROCKET_BODY"
    assert classify_category(name_rb_verbose) == "Rocket Body"

def test_classify_weather():
    name = "NOAA 19"
    assert classify_object_type(name) == "PAYLOAD"
    assert classify_category(name) == "Weather"

    name_goes = "GOES 16"
    assert classify_category(name_goes) == "Weather"
