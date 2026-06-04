"""
TR-SAT Mission Control V4 — Production server entry point.
Compiled by PyInstaller (console=False); launched by Tauri as a sidecar.

When frozen with console=False, sys.stdout and sys.stderr are None.
Uvicorn's DefaultFormatter calls stream.isatty() which raises AttributeError
on None, which then propagates as ValueError from logging.config.dictConfig.
Fix: redirect stdout/stderr to a log file before uvicorn touches them.
"""
import sys
import os
import multiprocessing
from pathlib import Path

# ── PyInstaller freeze support (must be before any other imports) ─────────────
if getattr(sys, "frozen", False):
    multiprocessing.freeze_support()
    sys.path.insert(0, sys._MEIPASS)  # type: ignore[attr-defined]

    # When console=False the Windows subsystem sets stdout/stderr to None.
    # Redirect both to a log file so uvicorn's logging initialisation
    # (and any other code that calls write/isatty) works correctly.
    data_dir = Path(os.environ.get("TRSAT_DATA_DIR", Path.home() / "AppData" / "Roaming" / "com.trsat.mission-control"))
    data_dir.mkdir(parents=True, exist_ok=True)
    log_path = data_dir / "trsat-backend.log"

    _log_file = open(log_path, "a", encoding="utf-8", buffering=1)
    if sys.stdout is None:
        sys.stdout = _log_file
    if sys.stderr is None:
        sys.stderr = _log_file

import uvicorn


# Minimal log config that does NOT reference stream.isatty().
# Writes to the log file via the root logger (already wired above).
LOG_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "()": "uvicorn.logging.DefaultFormatter",
            "fmt": "%(levelprefix)s %(message)s",
            "use_colors": False,   # avoids isatty() check
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
            "stream": "ext://sys.stderr",
        },
        "access": {
            "formatter": "access",
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stdout",
        },
    },
    "loggers": {
        "uvicorn": {"handlers": ["default"], "level": "WARNING", "propagate": False},
        "uvicorn.error": {"level": "WARNING"},
        "uvicorn.access": {"handlers": ["access"], "level": "WARNING", "propagate": False},
    },
}


def main() -> None:
    host = os.environ.get("TRSAT_HOST", "127.0.0.1")
    port = int(os.environ.get("TRSAT_PORT", "8000"))
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        log_config=LOG_CONFIG,
        access_log=False,
    )


if __name__ == "__main__":
    main()
