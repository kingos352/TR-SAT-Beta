# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec -- TR-SAT Mission Control V4 backend server.

Build:
    cd TR-SAT-Desktop\backend
    ..\.venv-build\Scripts\python.exe -m PyInstaller trsat_backend.spec ^
        --noconfirm

Output:  backend/dist/trsat-backend/trsat-backend.exe   (onedir)

Key design decisions
--------------------
* onedir mode: NumPy/SciPy/Skyfield ship many shared libraries and data
  files.  onedir bundles them next to the exe in a regular directory
  structure that Windows always loads correctly.
* console=True kept for diagnostic builds; the build script sets
  console=False for release via --windowed if needed.  stdout/stderr
  are redirected to a log file in main_server.py regardless.
* optimize=0 prevents CPython's peephole optimiser from rewriting
  scipy.stats._distn_infrastructure bytecode (NameError 'obj' bug).
* collect_all() ships every .pyc, .pyd, .dll and data file verbatim
  for numpy, scipy, skyfield, sgp4, and jplephem.
"""
import os
import sys
from pathlib import Path
from PyInstaller.utils.hooks import (
    collect_all,
    collect_data_files,
    collect_delvewheel_libs_directory,
)

block_cipher = None

# ── Paths ─────────────────────────────────────────────────────────────────────
SPEC_DIR = Path(SPECPATH)   # …/backend/
APP_DIR  = SPEC_DIR / "app"

# ── Skyfield built-in data ────────────────────────────────────────────────────
import skyfield as _sf
SKYFIELD_DATA = Path(_sf.__file__).parent / "data"

# ── collect_all for packages that need full binary/data collection ────────────
datas = [
    (str(SKYFIELD_DATA), "skyfield/data"),
    (str(APP_DIR), "app"),
]
binaries = []
hiddenimports = []

for _pkg in ["numpy", "scipy", "skyfield", "sgp4", "jplephem"]:
    _d, _b, _h = collect_all(_pkg)
    datas += _d
    binaries += _b
    hiddenimports += _h

# SciPy on Windows uses delvewheel; collect its .libs directory
try:
    datas, binaries = collect_delvewheel_libs_directory(
        "scipy", datas=datas, binaries=binaries,
    )
except Exception:
    pass  # older scipy or non-delvewheel build — ignore

# NumPy may also use delvewheel on newer versions
try:
    datas, binaries = collect_delvewheel_libs_directory(
        "numpy", datas=datas, binaries=binaries,
    )
except Exception:
    pass

# ── Hidden imports ────────────────────────────────────────────────────────────
hiddenimports += [
    # uvicorn
    "uvicorn",
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.loops.asyncio",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.http.h11_impl",
    "uvicorn.protocols.http.httptools_impl",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.protocols.websockets.websockets_impl",
    "uvicorn.protocols.websockets.wsproto_impl",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "uvicorn.lifespan.off",
    # FastAPI / Starlette
    "fastapi",
    "starlette",
    "starlette.routing",
    "starlette.middleware",
    "starlette.middleware.cors",
    "starlette.responses",
    "starlette.staticfiles",
    "starlette.testclient",
    # Pydantic v2
    "pydantic",
    "pydantic.v1",
    "pydantic_settings",
    "pydantic_core",
    # SQLAlchemy + SQLite
    "sqlalchemy",
    "sqlalchemy.dialects.sqlite",
    "sqlalchemy.dialects.sqlite.pysqlite",
    "sqlalchemy.orm",
    "sqlalchemy.ext.declarative",
    "sqlalchemy.pool",
    # Skyfield / SGP4
    "skyfield",
    "skyfield.api",
    "skyfield.iokit",
    "skyfield.earthlib",
    "skyfield.data",
    "sgp4",
    "sgp4.api",
    "sgp4.ext",
    "sgp4.omm",
    # HTTP clients
    "httpx",
    "httpx._transports",
    "httpx._transports.default",
    "httpx._config",
    "requests",
    "urllib3",
    "certifi",
    # Misc
    "h11",
    "anyio",
    "anyio._backends._asyncio",
    "anyio._backends._trio",
    "click",
    # python-dotenv (import name is "dotenv")
    "dotenv",
    "dotenv.main",
    # App modules
    "app.main",
    "app.config",
    "app.database",
    "app.models",
    "app.models.rso",
    "app.api",
    "app.api.router",
    "app.api.endpoints",
    "app.services",
    "app.services.astrodynamics",
    "app.services.celestrak",
    "app.services.spacetrack",
    "app.services.tle_parser",
    "app.services.catalog_lookup",
    "app.services.user_conjunction",
    "app.services.coordinate_conversion",
    "app.services.numerical_propagator",
    "app.schemas",
    "app.schemas.physics",
    "multiprocessing",
    "multiprocessing.forkserver",
    "multiprocessing.popen_forkserver",
    "multiprocessing.popen_spawn_win32",
]

# ── Analysis ──────────────────────────────────────────────────────────────────
a = Analysis(
    [str(SPEC_DIR / "main_server.py")],
    pathex=[str(SPEC_DIR)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "tkinter", "PIL", "pandas",
        "IPython", "jupyter", "test", "tests",
        "matplotlib",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
    # optimize=0 is critical: prevents bytecode rewrite that causes
    # NameError 'obj' in scipy.stats._distn_infrastructure.py
    optimize=0,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

# ── onedir EXE (no bundled data — those go in COLLECT) ────────────────────────
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="trsat-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,            # True for diagnostic builds; False for release
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(SPEC_DIR.parent / "src-tauri" / "icons" / "icon.ico"),
)

# ── COLLECT (onedir output) ──────────────────────────────────────────────────
coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="trsat-backend",
)
