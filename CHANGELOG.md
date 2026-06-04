# Changelog

All notable changes to this project will be documented in this file.

## [v0.8.0-export-system] - Release Candidate

### Added & Completed Phases
*   **Phase 1**: Monorepo foundation established (FastAPI backend + React/Vite frontend).
*   **Phase 2**: CelesTrak ingestion and local SQLite persistence integrated.
*   **Phase 3**: SGP4 astrodynamics algorithms implemented via Skyfield.
*   **Phase 4**: Physics API endpoints for propagation, ephemeris, AER, and pass predictions.
*   **Phase 5**: Mission Console UI integration (aerospace dark theme, Zustand state).
*   **Phase 6**: Cesium selected object 3D visualization (orbit path, ground track, observer).
*   **Phase 7**: Live TLE-based tracking over high-frequency WebSocket streams.
*   **Phase 7.5**: Live tracking hardening and performance optimization.
*   **Phase 8**: Space-Track authenticated catalog / GP integration added as a secondary source.
*   **Phase 9**: Conjunction Screening MVP for geometric close approach detection.
*   **Phase 10**: All-Catalog Progressive Visualization (Snapshot rendering).
*   **Phase 11**: UI/UX polish and system-wide aerospace nomenclature standardization.
*   **Phase 12**: Client-side export system (CSV, GeoJSON, CZML, Mission Reports).

### Known Technical Limitations
- **Precision**: Public TLE/GP accuracy depends heavily on the specific object and the age of the TLE.
- **Probability of Collision (Pc)**: The system computes geometric miss-distances but *no covariance-based collision probability*.
- **Ephemeris Certification**: CZML and ephemeris exports are for visualization and awareness, *not certified operational ephemeris*.
- **Authentication**: Space-Track data requires valid authenticated credentials; defaults to unauthenticated CelesTrak.
- **Local-First**: The system is designed to run locally; cloud deployments or multi-user access architectures are outside the current scope.
