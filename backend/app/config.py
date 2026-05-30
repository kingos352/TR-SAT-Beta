from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Union
import os
from pathlib import Path

# Resolve project paths dynamically
backend_dir = Path(__file__).resolve().parent.parent # Resolve to backend/
project_root = backend_dir.parent                    # Resolve to project root (TR-SAT-V3/)

# Resolve environment files order
appdata_dir = os.environ.get("TRSAT_DATA_DIR")
appdata_env = Path(appdata_dir) / ".env" if appdata_dir else None
local_data_env = project_root / "data" / ".env"
root_env = project_root / ".env"

env_files_ordered = []
if root_env.exists():
    env_files_ordered.append(root_env)
if local_data_env.exists():
    env_files_ordered.append(local_data_env)
if appdata_env and appdata_env.exists():
    env_files_ordered.append(appdata_env)

# Convert to strings for Pydantic Settings
env_file_paths = tuple(str(p.resolve()) for p in env_files_ordered)

def get_data_dir() -> Path:
    trsat_data_dir = os.environ.get("TRSAT_DATA_DIR")
    if trsat_data_dir:
        path = Path(trsat_data_dir)
    else:
        path = project_root / "data"
    path.mkdir(parents=True, exist_ok=True)
    return path

def save_env_vars(env_data: dict):
    data_dir = get_data_dir()
    env_path = data_dir / ".env"
    
    # Read existing
    existing_lines = []
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            existing_lines = f.readlines()
            
    # Update dict
    env_dict = {}
    for line in existing_lines:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env_dict[k] = v
            
    env_dict.update(env_data)
    
    # Write back
    with open(env_path, "w", encoding="utf-8") as f:
        for k, v in env_dict.items():
            f.write(f"{k}={v}\n")
            os.environ[k] = v


class Settings(BaseSettings):
    APP_NAME: str = "TR-SAT Mission Control V3"
    APP_ENV: str = "development"
    DATABASE_URL: str = "sqlite:///../data/trsat_v3.sqlite"
    
    # Handle both string (comma separated) and list CORS_ORIGINS
    CORS_ORIGINS: Union[str, List[str]] = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000,tauri://localhost"
    
    CESIUM_ION_TOKEN: str = ""
    SPACETRACK_USERNAME: str = ""
    SPACETRACK_PASSWORD: str = ""

    # AI Assistant Configuration
    AI_PROVIDER: str = "local"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "anthropic/claude-3.5-sonnet:beta"

    model_config = SettingsConfigDict(
        env_file=env_file_paths if env_file_paths else ("data/.env", "../data/.env", ".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins_list(self) -> List[str]:
        if isinstance(self.CORS_ORIGINS, list):
            return self.CORS_ORIGINS
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

settings = Settings()
