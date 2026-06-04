"""Minimal SciPy frozen test for PyInstaller.

Build:
    cd backend
    ..\.venv-build\Scripts\python.exe -m PyInstaller ^
        --onedir --console --noupx --name test-scipy-frozen ^
        scripts\diagnostics\test_scipy_frozen.py

Run:
    dist\test-scipy-frozen\test-scipy-frozen.exe

Expected output:
    SCIPY FROZEN TEST OK: <float value>
"""
import sys

def main() -> None:
    print(f"Python {sys.version}")
    print(f"Frozen: {getattr(sys, 'frozen', False)}")

    import numpy
    print(f"NumPy: {numpy.__version__}")

    import scipy
    print(f"SciPy: {scipy.__version__}")

    from scipy.stats import chi2
    value = chi2.cdf(1.0, df=2)
    print(f"SCIPY FROZEN TEST OK: {value}")

if __name__ == "__main__":
    main()
