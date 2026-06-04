from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from pathlib import Path
from app.config import settings, get_data_dir

# Resolve the data directory first (creates it if missing).
# get_data_dir() honours TRSAT_DATA_DIR set by the Tauri sidecar launcher, so
# the database always lands in %APPDATA%\com.trsat.mission-control\ in production
# regardless of the process working directory.
_data_dir = get_data_dir()

# Build an absolute SQLite URL that is CWD-independent.
# The relative default "sqlite:///../data/trsat_v3.sqlite" would resolve against
# the process CWD which, when launched by Tauri from Program Files, points to
# C:\Program Files\... — a location we cannot write to.
_db_url = settings.DATABASE_URL
if _db_url.startswith("sqlite:///") and not _db_url.startswith("sqlite:////"):
    _rel = _db_url[len("sqlite:///"):]
    _path = Path(_rel)
    if _path.is_absolute():
        _abs = _path
    else:
        # Relative path: always resolve against data_dir, never against CWD.
        # E.g. "../data/trsat_v3.sqlite" -> <data_dir>/trsat_v3.sqlite
        _abs = _data_dir / _path.name
    _abs.parent.mkdir(parents=True, exist_ok=True)
    _db_url = f"sqlite:///{_abs}"

# For SQLite, we must set check_same_thread to False to allow concurrent async operations
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    _db_url,
    connect_args=connect_args,
    echo=False
)

if settings.DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        # WAL mode: readers and writers no longer block each other.
        # Critical for FastAPI where multiple requests hit the DB concurrently.
        cursor.execute("PRAGMA journal_mode=WAL")
        # NORMAL sync: safe for WAL, eliminates the costly fsync on each commit.
        cursor.execute("PRAGMA synchronous=NORMAL")
        # Temp tables/indexes in RAM — avoids temp-file I/O during query execution.
        cursor.execute("PRAGMA temp_store=MEMORY")
        cursor.close()

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def run_migrations() -> None:
    """Idempotent lightweight migrations for the local SQLite DB.

    SQLAlchemy's create_all() creates missing tables but never alters existing
    ones, so additive columns are applied here. Safe to run on every startup.
    """
    from sqlalchemy import inspect
    insp = inspect(engine)
    if "tle_records" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("tle_records")}
    if "source_format" not in cols:
        with engine.begin() as conn:
            conn.exec_driver_sql(
                "ALTER TABLE tle_records ADD COLUMN source_format VARCHAR NOT NULL DEFAULT 'TLE'"
            )


def get_db():
    """
    Database session dependency generator.
    Yields a database session and closes it on request completion.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
