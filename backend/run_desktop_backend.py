import os
import sys
from pathlib import Path


def _fix_stdio(log_path: Path) -> None:
    """Redirect None stdout/stderr to a log file.

    PyInstaller one-file windowless exes (console=False) leave sys.stdout and
    sys.stderr as None. Uvicorn's logging formatter calls sys.stdout.isatty()
    at startup, which crashes immediately. Redirecting to a file fixes this and
    gives us a useful debug log.
    """
    if sys.stdout is None or sys.stderr is None:
        try:
            log_path.parent.mkdir(parents=True, exist_ok=True)
            log_file = open(log_path, "a", encoding="utf-8", buffering=1)
            if sys.stdout is None:
                sys.stdout = log_file
            if sys.stderr is None:
                sys.stderr = log_file
        except Exception:
            import io
            dummy = io.StringIO()
            if sys.stdout is None:
                sys.stdout = dummy
            if sys.stderr is None:
                sys.stderr = dummy


def main():
    # 1. Resolve data directory first so the log file goes to the right place.
    trsat_data_dir = os.environ.get("TRSAT_DATA_DIR")
    data_path = Path(trsat_data_dir) if trsat_data_dir else Path(".") / "data"
    data_path.mkdir(parents=True, exist_ok=True)

    # Fix None stdio BEFORE any library (uvicorn, logging) tries to use it.
    _fix_stdio(data_path / "backend.log")

    # 2. Configure database path.
    db_path = data_path / "trsat_v3.sqlite"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path.resolve()}"

    # 3. Load user settings from AppData .env if present.
    env_path = data_path / ".env"
    if env_path.exists():
        try:
            from dotenv import load_dotenv
            load_dotenv(env_path, override=True)
        except ImportError:
            pass

    # 4. Get port.
    port = int(os.environ.get("TRSAT_DESKTOP_PORT", 8000))

    # 5. Import FastAPI app AFTER env vars are set so Pydantic reads them.
    import uvicorn
    from app.main import app

    # 6. Run uvicorn with a simple log config that doesn't call isatty().
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=port,
        log_level="info",
        log_config={
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "()": "uvicorn.logging.DefaultFormatter",
                    "fmt": "%(levelprefix)s %(message)s",
                    "use_colors": False,
                },
                "access": {
                    "()": "uvicorn.logging.AccessFormatter",
                    "fmt": '%(levelprefix)s %(client_addr)s - "%(request_line)s" %(status_code)s',
                    "use_colors": False,
                },
            },
            "handlers": {
                "default": {
                    "formatter": "default",
                    "class": "logging.StreamHandler",
                    "stream": "ext://sys.stdout",
                },
                "access": {
                    "formatter": "access",
                    "class": "logging.StreamHandler",
                    "stream": "ext://sys.stdout",
                },
            },
            "loggers": {
                "uvicorn": {"handlers": ["default"], "level": "INFO", "propagate": False},
                "uvicorn.error": {"level": "INFO"},
                "uvicorn.access": {"handlers": ["access"], "level": "INFO", "propagate": False},
            },
        },
    )


if __name__ == "__main__":
    main()
