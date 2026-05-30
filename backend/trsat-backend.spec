# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for the TR-SAT backend sidecar that Tauri spawns at startup.
# Build: pyinstaller trsat-backend.spec  (from the backend/ directory)
# Output: backend/dist/trsat-backend.exe  (one-file, no console window)

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

# Skyfield ships ephemeris + leap-second data as package data; without these the
# astrodynamics layer falls back to broken offline tables.
skyfield_data = collect_data_files("skyfield")

# Pull in modules pydantic-settings / sqlalchemy can resolve dynamically that
# static analysis would otherwise miss.
hidden = (
    collect_submodules("sqlalchemy.dialects.sqlite")
    + collect_submodules("pydantic")
    + collect_submodules("uvicorn")
    + ["app.main", "app.config"]
)

a = Analysis(
    ["run_desktop_backend.py"],
    pathex=["."],
    binaries=[],
    datas=skyfield_data,
    hiddenimports=hidden,
    hookspath=[],
    runtime_hooks=[],
    excludes=["tkinter", "pytest", "_pytest", "IPython", "jupyter"],
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="trsat-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
