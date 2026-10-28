# v0.8 Critical development audit

Scope: local development only. No GitHub write, no Vercel deployment, no production release.

| Area | v0.7 issue | v0.8 response | Actual evidence | Remaining limitation |
|---|---|---|---|---|
| Renderer | Custom SVG map with limited zoom | MapLibre integration and vector style sources/layers | Pure style tests + mocked browser interaction | Real WebGL maps not tested; remote library required |
| UI | Heavy persistent panels | Responsive canvas-first layout with mobile drawer | Desktop/mobile Playwright layout screenshots, clearly synthetic | Device testing pending |
| Data provenance | Local source optional, imports unknown | Source-kind-specific licence/attribution; SHA-checked opt-in bundle | Build-integrity and browser tests | No authoritative boundary archive |
| Import safety | Malformed geometry risks | Duplicate IDs, ring closure, zero-area, extent, CRS guards; non-destructive import | 13 Node tests and browser import test | Topological crossing is checked only in Python GIS pipeline |
| GIS accuracy | Four screening point tests | Adds independent Shapely polygon validity and overlap-area QA | 4 Python topology tests | Does not resolve missing Shaksgam or official border matching |
| Fallback | Failed engine can leave a blank viewer | Link to legacy viewer stays visible after source load | Isolated browser regression test | Legacy also needs data or local file import |
| Labels | Hardcoded coordinates | Candidate centroid/point-in-polygon anchor and collision-aware symbol style | Unit tests + style schema inspection | Actual font glyph availability & cartographic label quality not proven |
| Performance | No measurements | Modular static build ready for profiling | Asset manifest and deterministic bundler | 1,000-user and mobile performance testing missing |
| Deployment | Public preview exists at v0.5 | v0.8 only local package with explicit production block | `release_guard.py` | Live site remains unchanged |

## New issues found during v0.8 testing

1. Test stubs initially had malformed class syntax (`setFilter(){},...`). Corrected the test harness and reran browser checks.
2. A successful async data request could hide a map-engine failure overlay. Fixed the overlay lifecycle and added a regression test without `maplibregl`.
3. The initial mobile screenshot captured the drawer mid-transition. Updated screenshots to wait for it to finish, and confirmed the map is unobstructed afterward.
4. First successful map load displayed a redundant toast on top of selected-region content. Suppressed the unsolicited load toast; user-initiated imports still receive feedback.

## Acceptance summary

- Node geometry/style tests: 13 passed.
- Python topology/build tests: 7 passed.
- Mocked desktop/mobile/fallback/import browser tests: passed, with no uncaught page errors.
- Build manifest: explicitly `officialGeometryVerified: false`, `hasAuthoritativeData: false`, `noProductionPromotion: true`.
- Full GIS verification, real MapLibre browser tests, tile infrastructure, street-level detail, geocoding, export parity and capacity tests: **not passed / not attempted**.

### Immediate v0.9 objectives

1. Replace CDN MapLibre dependency with reproducibly vendored distribution and validated font resources, while preserving copyright notices.
2. Integrate rights-verified boundary data, compare polygons and publish machine-readable uncertainty/source metadata.
3. Add PMTiles-based progressive road, water and settlement layers with matching boundary standards.
4. Build address/place search with licence-respecting data source and ranking, then implement a professional export renderer.
5. Run real WebGL cross-browser tests, field-mobile evaluation and measured capacity testing before requesting any release authorization.
