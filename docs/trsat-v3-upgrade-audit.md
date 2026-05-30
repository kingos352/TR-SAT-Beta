# TR-SAT Mission Control V3 — Upgrade Audit & Phase Plan

> **Status:** Phase 0 complete · Phase 1 complete (build-validated)
> **Audit date:** 2026-05-30
> **Canonical edit target:** `C:\Users\yukse\Desktop\TR-SAT-Desktop` (the runnable clean install)
> **Version control:** none (no `.git`) — every change is surgical and build-validated; core systems (WebSocket / SGP4 / store shape) are not touched without an explicit phase.
> **Source of truth:** the code in this repository, not prior memory notes.

This document is the Phase 0 deliverable required by the V3 upgrade brief. It records what was inspected, the confirmed architecture, a feature-status matrix, the file-level plan for each phase, a risk register, and the validation checklist.

---

## 1. Decisions taken before implementation

| Decision | Choice | Reason |
|----------|--------|--------|
| Which folder to edit | `TR-SAT-Desktop` | Documented canonical "çalışan klasör". `TR-SAT-WEB DENEME` is byte-identical and treated as archive. |
| Git safety net | Not used (per user) | No `.git` in either folder. Mitigation: surgical edits, build after each step, no edits to core runtime logic in Phase 1. |
| Sequencing | Audit → safe subset → checkpoint | Matches the brief's "highest-confidence Phase 1 first" and the user's "plan before implementation" preference. |

> ⚠️ **Standing recommendation:** initialise git in `TR-SAT-Desktop` before the larger phases (4–6). A 20k-object DB migration and a data-model change without version control is high risk.

---

## 2. Confirmed architecture (from code)

### Frontend
- **React 18 + TypeScript + Vite**, CesiumJS globe, Zustand store. **No router.**
- `src/App.tsx` is a single component:
  - `LeftSidebar` = **14 flat accordion panels** (`CollapsibleWrapper`), driven by a local `useState activePanelId` (one open at a time).
  - Right dock = **4 panels** (`telemetry`, `live_tracking` [keepMounted for WS], `mission_replay`, `conjunction`) gated on `activeObject`.
  - A static centered badge: `ACTIVE ORBIT VISUALIZATION [SGP4]`.
  - First-boot gate: `GET /config/status` → `FirstBootSetup`.
- Store `src/store/useConsoleStore.ts` + 6 slices (`catalog`, `activeObject`, `visualization`, `analysis`, `system`, `graphics`). It declares an `activePanel` enum that is **not** used for navigation (legacy).
- i18n `src/i18n/translations.ts` — `en`/`tr`, `t('section.key')`. **Already carries honest scientific disclaimers** (see §4).
- Design tokens `src/index.css` — `--accent-blue #25B7FF`, `--accent-cyan #3ED1B2`, `--accent-success`, `--accent-danger`, `--accent-warning`; Inter + JetBrains Mono; `.glass-panel`, `.badge*`, `.card`, `.collapsible-header`. **No UI-scale token system** (all sizing is inline `px`).

### Backend
- **FastAPI + Uvicorn (Python 3.12)**, SQLAlchemy 2.0, SQLite (WAL).
- `app/api/router.py` mounts 15 routers: `health, catalog, propagation, observer, ws(telemetry), spacetrack, conjunction, catalog-visualization, visibility, assistant, analytics, research, advanced-research, config, user-satellites`.
- 23 services in `app/services/` incl. `astrodynamics, conjunction, collision_probability, pass_predictor, visibility, illumination, numerical_propagator, relative_motion, historical_tle, reliability_analysis, catalog_*, celestrak, spacetrack, user_conjunction, coordinate_conversion, classifier, tle_parser, assistant_*`.

### Data models (`app/models/`)
- `RSOCatalog` — `norad_id` PK, name, object_type, category, source, source_group, cospar_id, last_updated.
- `TLERecord` — `line1`/`line2` **plus parsed element columns** (`inclination_deg, raan_deg, eccentricity, arg_perigee_deg, mean_anomaly_deg, mean_motion_rev_per_day, bstar`), unique index `(norad_id, epoch)`.
- `UserSatellite` — full ECI J2000 state vector, **6×6 covariance (JSON)**, physical params (`mass_kg, drag_area_m2, srp_area_m2, cd, cr, hard_body_radius_m`), `input_format` (TLE/KEPLERIAN/STATE_VECTOR).

### Desktop shell
- Tauri v2; `src-tauri/tauri.conf.json` (`bundle.resources` removed for dev — see Kurulum devlog). Rust manages the backend child process on port 8000.

---

## 3. Feature status matrix

### Implemented & working
Catalog search/sync (CelesTrak), SGP4 propagation, live WebSocket tracking (rate buttons), pass prediction (+ detailed profile), conjunction screening (selected/catalog/debris modes, debris self-scan, Foster 2D Pc, B-plane plot), visibility scan, illumination, TLE reliability dashboard, catalog analytics, historical TLE evolution + decay indicators, relative motion, mission replay, weather/observation score, AI assistant, export (Ephemeris CSV, Ground Track GeoJSON, CZML, catalog CSV/GeoJSON, conjunction CSV, EN/TR mission report), first-boot setup, settings modal.

### Partial / UI-only / gaps vs the V3 brief
| Area | Current state | Gap |
|------|---------------|-----|
| Research | Single accordion panel `ResearchModePanel` | Brief wants a dedicated **Research Lab workspace** (Overview, Validation Center, Orbit Evolution, Pass Analysis, Relative Motion, Conjunction Study, Numerical Experiment, Reproducibility). |
| Navigation | 14 flat panels | Brief wants **task-grouped workspaces** (Track / Observation / Analysis / Research Lab / Mission Assets / System). |
| Mission Assets | `UserSatellite` model+panel only | No `MissionAsset` / Enigma concept yet. |
| Onboarding | `FirstBootSetup` (credentials) | No **guided ISS mission tour**. |
| Numerical propagator | `numerical_propagator.py` service exists | Needs honest "Experimental" framing + validation-against-reference UX (claims to review at implementation time). |
| Data format | TLE-first (`line1`/`line2`) | Brief wants **OMM-first, TLE-compatible** — but parsed-element columns already exist, so migration is additive (see §5). |
| Globe semantics | Active object = **red**; solid cyan orbit / solid orange track; **no legend** | Fixed in Phase 1 safe subset. |
| Top bar | bare `1/20`; single `Online`/`Offline` badge | Needs `Tracked: x/y`, source-labelled service states. |
| UI scale | none | Brief wants Compact/Standard/Large — larger lift (px→token refactor). |

---

## 4. KEY FINDING — scientific language is already ~70% honest

The brief assumes worst-case labels ("Telemetry", "Collision Probability", "HIGH RISK", "Maneuver Required"). The code is **much further along**. Already present in `translations.ts`:
- `live_tracking.warning_title`: *"TLE/GP-based SGP4 estimate — not direct telemetry."*
- `conjunction.warning_title`: *"Estimated Pc — heuristic uncertainty, not a CDM-grade product."*
- `analytics.disclaimer`, `reliability.disclaimer`, `research.decay_warning`, `research.relative_warning`, `catalog_layer.warning_snapshot`, `pass_timeline.warning`, `visibility.estimate_warning` — all already careful and accurate.

**Therefore the terminology task is relabeling a small set of menu/button strings, not a rewrite.** Remaining user-facing gaps:

| Location | Current | Target |
|----------|---------|--------|
| `menus.telemetry_orbital_state` | Telemetry & Orbital State | **Predicted Orbital State** |
| `menus.live_tracking` | Live Tracking | **Live Propagation** |
| `menus.mission_replay` | Mission Replay | **Orbit Replay** |
| `telemetry.update_state` | Update State | **Refresh State** |
| `telemetry.update_orbit` | Update Orbit | **Recompute Trajectory** |
| `live_tracking.last_frame` | Last Frame | **Last Propagation Update** |
| `system.telemetry`, `system.live_tracking` (descriptions) | "physical parameters", "real-time SGP4" | predicted-state / propagated wording |
| `conjunction` risk labels | backend `risk_level` HIGH/MEDIUM/LOW rendered raw (`ConjunctionPanel.tsx:301-322`) | experimental framing via **frontend display-mapping** (no backend enum change) — *deferred to Phase 5* |

---

## 5. Data architecture readiness (Phases 4 & 6)

Good news from the models:
- **OMM migration is additive, not destructive.** `TLERecord` already stores parsed elements as columns. Path: add a `source_format` column (default `TLE`) + optional `raw_payload` JSON; keep `line1`/`line2` nullable for OMM rows; resolve "latest usable element set" irrespective of format. python-sgp4 supports `omm.parse_*` for SGP4 construction.
- **MissionAsset / numerical-propagator inputs partly exist.** `UserSatellite` already has a state vector, real 6×6 covariance, and physical params — so a future `MissionAsset` and the Experimental Numerical Propagation inputs can build on it rather than starting from zero. Note: catalog objects use *synthetic* RTN covariance (correctly labelled heuristic); user satellites can use *real* covariance — a meaningful honesty distinction to surface in the UI.

---

## 6. File-level plan by phase

### Phase 1 — terminology, premium UI, information architecture
- `frontend/src/i18n/translations.ts` — relabels in §4 (en+tr) + new `legend` section. *(safe subset)*
- `frontend/src/components/Globe/CesiumViewer.tsx` — active object red→white; orbit thinner+faded; ground track dashed+faded; observer blue→blue-violet; catalog debris magenta→muted grey. *(safe subset)*
- `frontend/src/components/Globe/TrackLegend.tsx` *(new)* — collapsible track-overlay legend. *(safe subset)*
- `frontend/src/App.tsx` — render `<TrackLegend/>`; **later:** contextual mode badge, workspace grouping of the left dock, designed right-empty state. *(post-checkpoint)*
- `frontend/src/components/Console/StatusBar.tsx` — `Tracked: x/y`, source-labelled badges. *(post-checkpoint)*
- `frontend/src/components/Console/TelemetryPanel.tsx` — primary-state-first hierarchy, "Advanced Orbital Details" collapsible. *(post-checkpoint)*

### Phase 2 — onboarding & workspace transitions
- `frontend/src/components/Console/FirstBootSetup.tsx` (+ a new guided-tour component), restore-last-workspace.

### Phase 3 — Research Lab V1
- New `frontend/src/components/Research/` workspace; reuse `research`, `historical_tle`, `pass_predictor`, `relative_motion` services; JSON/CSV research-record export.

### Phase 4 — OMM-first data foundation
- `backend/app/models/rso.py` (+ migration), `services/celestrak.py`, `services/tle_parser.py`, catalog lookup; UI source-format labels; tests.

### Phase 5 — Research Lab V2
- Relative Motion + Conjunction Study workspaces; risk-label display-mapping in `ConjunctionPanel.tsx`; exportable records.

### Phase 6 — Enigma & experimental modelling
- New `MissionAsset` model/endpoints/UI; Experimental Numerical Propagation UX over `numerical_propagator.py`.

### Phase 7 — distribution, performance, security
- Tauri/installer, local-bind/CORS/CSP review, perf benchmarks, About/Scientific-Disclaimer panel.

---

## 7. Risk register

| Subsystem | Risk of change | Mitigation |
|-----------|----------------|------------|
| `CesiumViewer.tsx` | Entity-rendering regressions (orbit/track/markers) | Only colour/width/material literals changed; entity logic untouched; build + visual check. |
| `translations.ts` | Missing key → blank label | Edits are value-only; keys preserved; added keys consumed only by new `TrackLegend`. |
| `useConsoleStore` / WebSocket / SGP4 | Breaks live tracking, propagation | **Not touched in Phase 1.** |
| Left-dock regroup (Phase 1 post-checkpoint) | Panels disappear / wrong panel renders | Keep same panel components; only wrap with section headers; verify all 14 reachable. |
| OMM migration (Phase 4) | Data loss on 20k-object DB | Additive columns, nullable `line1/line2`, no destructive ALTER, back-compat lookup, tests, **git first**. |
| No version control | Hard to revert a bad edit | Surgical edits, build gate, recommend git before Phase 4. |

---

## 8. Validation checklist (run after each phase)
- Frontend: `npm run build` (Vite + `tsc`) clean; Cesium globe still mounts; object selectable; live propagation still streams; language toggle EN/TR works.
- Backend (when touched): app starts; `/health`, `/propagation`, `/observer/.../passes`, `/conjunction`, `/ws/telemetry` respond; DB init/migration safe.
- Must-not-break: app launches, globe renders, ISS selectable, selected-object state readable, ground station preserved, no DB history deleted.

---

## 9. Phase 1 — complete (2026-05-30, build-validated)
1. **Terminology** (`translations.ts`, en+tr) — §4 relabels + new `legend`, `nav`, `system.mode_*`, conjunction-risk and telemetry-hierarchy keys.
2. **Globe colour semantics** (`CesiumViewer.tsx`) — active object red→white; orbit thinner+faded cyan; ground track dashed+faded orange; observer blue-violet; debris muted grey.
3. **Track-overlay legend** (`TrackLegend.tsx` + `App.tsx`) — collapsible, unobtrusive, bottom-left of the globe; glyphs match what is drawn.
4. **Contextual mode badge** (`App.tsx`) — static label → state-driven (Global Environment / Live Propagation · NAME · SGP4 / Orbit Replay / Conjunction Study / Predicted Orbit).
5. **Workspace grouping** (`App.tsx` LeftSidebar) — 15 flat panels regrouped under Track / Observation / Analysis / Research Lab / Mission Assets / System (all panels preserved and reachable).
6. **Top bar** (`StatusBar.tsx`) — `Tracked: n / 20` tooltip; backend badge source-labelled (`Backend: Online`).
7. **Selected-object hierarchy** (`TelemetryPanel.tsx`) — `Predicted State · SGP4` sub-label; derived orbital Period; ECEF + coordinate-standard note moved into a collapsible "Advanced Orbital Details".
8. **Conjunction risk labels** (`ConjunctionPanel.tsx`) — HIGH/MEDIUM/LOW → Elevated Experimental Alert / Review Suggested / Monitor (frontend display-mapping; backend enum unchanged).

Each step verified with `tsc && vite build` (clean; only pre-existing dynamic-import advisories). Core runtime (WebSocket / SGP4 / store shape) untouched.

> ⚠️ **Validation gap:** these were build/type-checked only. A runtime smoke-test (launch the app, confirm globe + selection + live propagation render) has not been done in this environment and is recommended before Phase 2, which changes startup flow.

**Deferred to later phases:** Research Lab workspace (Phase 3), OMM-first data — *initialise git first* (Phase 4), per-result conjunction provenance strip (Phase 5), UI-scale system & functional right-empty-state quick actions.

## 10. Phase 2 — onboarding (2026-05-30, build-validated)
1. **Guided tour** (`Console/GuidedTour.tsx`, new) — 5-step first-launch overlay (Welcome → Data Source → Ground Station → Track ISS → Scientific Understanding), localStorage-gated (`trsat_onboarded_v1`), skippable. Additive overlay; the `FirstBootSetup` credential gate is unchanged.
2. **Track ISS** — best-effort `getCatalogObject(25544)` → `setActiveObject`; graceful "sync catalog first" hint if the catalog is empty.
3. **Restore last workspace** (`App.tsx` LeftSidebar) — last-opened left panel persisted in `localStorage` (`trsat_last_panel`).
4. **Restart Guided Tour** (`Console/StatusBar.tsx` settings modal) — clears the flag and reloads.
5. i18n `onboarding` section (en+tr).

Built clean (`tsc && vite build`). Startup/setup flow untouched; tour is purely additive.

> Note: the tour appears once on next launch (flag not yet set). Skip / × dismisses it permanently; re-run via Settings → Restart Guided Tour.

> ⚠️ **Before Phase 3 (workspace rework) and Phase 4 (data model):** initialise git. Phase 3 changes the interaction model (panel-driven → workspace-driven) and Phase 4 alters the DB schema — both warrant a revert path.
