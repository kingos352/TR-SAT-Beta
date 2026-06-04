from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Union
import os
import sys
from pathlib import Path

# Resolve project paths for development mode.
# In production (PyInstaller frozen) these are only used as fallbacks when
# TRSAT_DATA_DIR is not set — which should not happen in a Tauri-launched build.
backend_dir = Path(__file__).resolve().parent.parent  # …/backend/
project_root = backend_dir.parent                     # …/TR-SAT-Desktop/

_IS_FROZEN = getattr(sys, "frozen", False)


def get_data_dir() -> Path:
    """Return the runtime data directory (database, .env, logs).

    Priority:
      1. TRSAT_DATA_DIR env var  (set by Tauri sidecar launcher in production)
      2. %APPDATA%\\com.trsat.mission-control  (frozen exe fallback)
      3. <project_root>/data  (development)
    """
    trsat_data_dir = os.environ.get("TRSAT_DATA_DIR")
    if trsat_data_dir:
        path = Path(trsat_data_dir)
    elif _IS_FROZEN:
        # Frozen exe without TRSAT_DATA_DIR — use %APPDATA% so we never
        # try to write to Program Files or a PyInstaller temp directory.
        appdata = os.environ.get("APPDATA") or str(Path.home() / "AppData" / "Roaming")
        path = Path(appdata) / "com.trsat.mission-control"
    else:
        path = project_root / "data"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _sanitize_env_file(path: Path) -> None:
    """
    Inno Setup writes .env files in the system ANSI encoding (e.g. Windows-1252
    on Turkish Windows). Re-read with latin-1 (lossless for any byte value) and
    rewrite as UTF-8 so pydantic-settings can parse it.  Only meaningful lines
    (KEY=value) are kept; comment lines are preserved as ASCII-safe.
    This is idempotent — if the file is already UTF-8 it is left unchanged.
    """
    try:
        # Try UTF-8 first; if it succeeds the file is already fine.
        path.read_text(encoding="utf-8")
        return
    except (UnicodeDecodeError, ValueError):
        pass

    # Fall back to latin-1 (decodes every possible byte), then rewrite as UTF-8.
    try:
        raw = path.read_text(encoding="latin-1")
        # Re-encode: keep only ASCII-printable content in comment lines
        safe_lines = []
        for line in raw.splitlines():
            if line.startswith("#") or line.strip() == "":
                # Strip any non-ASCII from comments — they are decorative only
                safe_lines.append(line.encode("ascii", errors="ignore").decode("ascii"))
            else:
                safe_lines.append(line)
        path.write_text("\n".join(safe_lines) + "\n", encoding="utf-8")
    except Exception:
        pass  # If we can't sanitize, let pydantic-settings fail with its own error


# Resolve environment file search order.
# In frozen/production mode we only look in the data directory (TRSAT_DATA_DIR).
# In development we also look in the project root and project data/ folder.
_runtime_data_dir = get_data_dir()
_runtime_env = _runtime_data_dir / ".env"

env_files_ordered: list[Path] = []

if not _IS_FROZEN:
    # Development: also check project root .env files
    root_env = project_root / ".env"
    if root_env.exists():
        env_files_ordered.append(root_env)
    local_data_env = project_root / "data" / ".env"
    if local_data_env.exists():
        env_files_ordered.append(local_data_env)

# Always check the runtime data dir .env (written by installer or save_env_vars)
if _runtime_env.exists():
    env_files_ordered.append(_runtime_env)

# Sanitize any installer-written ANSI files before pydantic-settings reads them
for _p in env_files_ordered:
    _sanitize_env_file(_p)

# Convert to strings for Pydantic Settings
env_file_paths = tuple(str(p.resolve()) for p in env_files_ordered)


def save_env_vars(env_data: dict):
    data_dir = get_data_dir()
    env_path = data_dir / ".env"

    # Read existing key=value pairs (tolerant read)
    existing_lines: list[str] = []
    if env_path.exists():
        try:
            existing_lines = env_path.read_text(encoding="utf-8").splitlines()
        except UnicodeDecodeError:
            existing_lines = env_path.read_text(encoding="latin-1").splitlines()

    env_dict: dict[str, str] = {}
    for line in existing_lines:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env_dict[k.strip()] = v.strip()

    env_dict.update(env_data)

    # Always write UTF-8
    with open(env_path, "w", encoding="utf-8") as f:
        for k, v in env_dict.items():
            f.write(f"{k}={v}\n")
        os.environ[k] = v  # type: ignore[possibly-undefined]


class Settings(BaseSettings):
    APP_NAME: str = "TR-SAT Mission Control V4"
    APP_ENV: str = "development"
    DATABASE_URL: str = "sqlite:///../data/trsat_v3.sqlite"

    # Accept both comma-separated string and list for CORS_ORIGINS
    CORS_ORIGINS: Union[str, List[str]] = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:8000,http://127.0.0.1:8000,tauri://localhost"
    )

    CESIUM_ION_TOKEN: str = ""
    SPACETRACK_USERNAME: str = ""
    SPACETRACK_PASSWORD: str = ""

    # AI Assistant
    AI_PROVIDER: str = "local"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "anthropic/claude-3.5-sonnet:beta"

    model_config = SettingsConfigDict(
        env_file=env_file_paths if env_file_paths else ("data/.env", "../data/.env", ".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> List[str]:
        if isinstance(self.CORS_ORIGINS, list):
            return self.CORS_ORIGINS
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
