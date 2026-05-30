from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.rso import Base, RSOCatalog, TLERecord
from app.schemas.conjunction import DebrisWatchRequest
from app.services.conjunction import screen_catalog_debris

L1 = '1 {n}U 98067A   26001.00000000  .00000000  00000-0  00000-0 0  9999'
L2 = '2 {n}  51.6400   0.0000 0000000   0.0000   0.0000 15.50000000    10'


def _memory_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)()


def _seed(db, norad, otype):
    db.add(RSOCatalog(norad_id=norad, name=f"OBJ{norad}", object_type=otype,
                      category="Debris" if otype == "DEBRIS" else "Other",
                      source="TEST", source_group="test"))
    db.add(TLERecord(norad_id=norad, name=f"OBJ{norad}",
                     line1=L1.format(n=norad), line2=L2.format(n=norad),
                     epoch=datetime(2026, 1, 1), source="TEST", source_group="test"))


def test_debris_watch_runs_without_primary_and_excludes_payload():
    db = _memory_db()
    # Two co-orbiting debris (identical elements) -> guaranteed close approach.
    _seed(db, 90001, "DEBRIS")
    _seed(db, 90002, "DEBRIS")
    _seed(db, 90003, "PAYLOAD")
    db.commit()

    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    req = DebrisWatchRequest(
        start_time=now, end_time=now + timedelta(hours=1),
        coarse_step_seconds=60, refine_step_seconds=2,
    )
    resp = screen_catalog_debris(db, req)

    assert resp.mode == "catalog_debris_self"
    assert resp.results, "co-orbiting debris should produce a conjunction"

    seen = set()
    for r in resp.results:
        seen.add(r.primary_norad_id)
        seen.add(r.secondary_norad_id)
        assert r.collision_probability is not None
        assert r.risk_level is not None
    assert 90003 not in seen          # payload excluded from a debris-only screen
    assert {90001, 90002} <= seen
    db.close()


def test_debris_watch_includes_rocket_bodies_when_requested():
    db = _memory_db()
    _seed(db, 90001, "DEBRIS")
    _seed(db, 90002, "ROCKET_BODY")
    db.commit()

    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    base = dict(start_time=now, end_time=now + timedelta(hours=1),
                coarse_step_seconds=60, refine_step_seconds=2)

    # Without the flag, the lone debris has no debris partner -> no results.
    assert screen_catalog_debris(db, DebrisWatchRequest(**base)).results == []
    # With rocket bodies included, the pair is screened.
    resp = screen_catalog_debris(db, DebrisWatchRequest(include_rocket_bodies=True, **base))
    assert resp.results
    db.close()
