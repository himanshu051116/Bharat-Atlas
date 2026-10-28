# Bharat Atlas v0.32 — Cartographic exploration & motion refinement

**Decision: LOCAL RESEARCH PREVIEW ONLY. NO production promotion, no GitHub mutation, no deployment.**

## Implemented this iteration

- New `src/detail-math.mjs` with approximate spherical great-circle distance and bearing, deterministic nearby-list ranking, zoom/latitude-aware Web Mercator scale bar, and stable spherical segment interpolation.
- Contextual nearby explorer: selecting a sourced place or WGS84 coordinate shows up to six *actual* places from the pre-existing 71-point Natural Earth catalogue, ranked by direct-line distance. Click a card to inspect that source point. Distances do not represent driving or travel.
- Map scale strip with human-readable km/m ranges, derived from zoom and centre latitude in the MapLibre view. SVG fallback uses a centre-latitude approximate scale derived from its geographic projection (not a measured field scale). Displays 'unavailable' if computation cannot be justified.
- A non-routing straight-line research trail accompanies the guided seven-place journey. It is source-derived and shown in MapLibre or source SVG projection, never a road, flight, maritime or claim/control boundary. Clear Journey removes it.
- Physical-only place discovery: optional source-backed points can now be searched even when unrelated provisional political polygons fail to load. Existing boundary source approval rules and export warnings remain unchanged.
- SVG failure resilience: current place/coordinate is refocused when a fallback SVG is regenerated. Existing selected region, source data and session-only user research layers are not reclassified as official.
- Motion and visual polishing: scalable HUD, hover transitions on source-place cards, reduced-motion handling, responsive layout for narrow screens.

## Verification (2026-10-24)

- `node --test tests/*.test.mjs`: 119 passed (includes four pure geometric tests).
- `python -m unittest discover -s tests -p 'test_*.py' -q`: 92 passed.
- `python scripts/build.py` and `python scripts/verify_preview.py`: passed, 21 bundled source modules and 648 SHA-256-verifiable static assets.
- `python tests/browser_preview.py`: mocked MapLibre integration passed, including nearby, scale, cleared trail, source-labelled place search without political polygons, SVG fallback, responsive controls, and error recovery. **Mocked browser tests do not prove real GPU rendering.**
- `python scripts/release_guard.py --target production`: blocked as designed.

## What v0.32 does NOT contain

- Authentic MapLibre 5.13.0 JavaScript package bundled for offline GPU proof, or successful real WebGL2 run in this container.
- A nationwide current road or rail network, street/address geocoding, routing-grade topology, parcel/terrain elevations or district-gazetteer completeness.
- Source-approved Survey of India 2026 political vector geometry, redistribution permissions or certified northern territorial topology (including Shaksgam).
- Hardware Android/iOS acceptance, accessibility audit or 1,000-concurrent-user load test.

Selected Natural Earth catalogue labels and coordinates are approximate and not government administrative or legal boundary evidence. The historical physical layers may include neighbouring countries. The application never treats the journey line as a transportation route.

## Local startup

Preview ZIP: extract, double-click `START_PREVIEW_WINDOWS.bat` or run `py -3 -m http.server 8000 --bind 127.0.0.1` in the extracted folder; open `http://127.0.0.1:8000`.

Full source: install Python dependencies from `requirements-geo.txt` and run `START_LOCAL_WINDOWS.bat`. Authentic MapLibre must separately be retrieved with `python scripts/vendor_maplibre.py --fetch` on a trusted, network-connected machine for the unmocked GPU proof. Its absence must not be reclassified as a pass.
