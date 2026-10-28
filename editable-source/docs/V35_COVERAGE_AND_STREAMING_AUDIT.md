# Bharat Atlas v0.35 — Source-backed tile coverage and bounded browser data reads

**Build classification:** local research preview; not a completed national basemap, navigation product, or Survey of India-verified map. No GitHub writes or deployment.

## Implemented

1. **Geographic Coverage Inspector** (`src/coverage-inspector.mjs` and `src/main.mjs`): locate the declared XYZ cell for a WGS84 coordinate at zoom 3–12. Compare the historical GSHHG/Natural Earth MVT catalogue against any independently supplied modern research transport catalogue. Surface empty cells and overzoomed sources. Display per-zoom tile counts from real SHA-256 catalogue entries. Never claim that an existing tile contains a particular road, river, city or legal boundary, because catalogues describe tile files, not every layer's per-cell contents.
2. **SVG-only data inspection:** the tile catalogue remains available to the coverage inspector when the MapLibre library or WebGL is unavailable. Rendering availability is reported separately from data inventory; optional modern transport metadata also survives in that mode.
3. **Bounded streaming** (`src/tiles.mjs`): declared tile catalogues reject payloads over 2,000,000 bytes during streaming; individual vector tiles reject payloads over 3 MiB during streaming. Streaming readers are cancelled and released after size rejection. Existing response Content-Length early checks and SHA-256 tile content checks remain in force. Compatibility fallback handles test and legacy response objects without a stream reader.
4. **Browser input validation:** blank longitude/latitude no longer silently become zero in the coverage inspector. WGS84 ranges, effective zoom and overscaling are explicit.
5. **Accessibility/UI:** explanatory status, labelled controls, keyboard-accessible expandable inspector and responsive mobile layout with no reduced-motion violation.

## Verified locally in this development session

- JavaScript Node tests: **129 passed, 0 failed** (including 6 focused coverage/streaming checks).
- Python unittest suite: **92 passed, 0 failed**.
- Browser smoke integration with **simulated MapLibre**: passed, including tile inspection, absent tile, invalid coordinate, overzoom and SVG-only inspection, alongside existing region/selection and recovery scenarios.
- Deterministic static preview: **24 modules bundled; 648 SHA-256 verified assets**.
- Preview gate: PASSED. Production gate: deliberately BLOCKED.

## Non-verified/blocked

- Authentic MapLibre 5.13.0 distribution is not bundled; npm access in this environment fails DNS resolution. Genuine hardware WebGL2 rendering and Android/iOS device acceptance remain unverified.
- No approved official 2026 Indian political vectors, Shaksgam/Gilgit-Baltistan/Aksai Chin GIS reconciliation, or publishable rights decision were added.
- Historical generalized physical data and 71 Natural Earth selected locations remain the only bundled verified source-derived coverage; national current roads, rails, named waterways, addresses, navigation/routing and fully licensed contemporary datasets are **not included**.
- A present SHA-256 tile verifies file integrity **only**. Tile occupancy is not feature completeness or accuracy.

## Recommended next substantial engineering milestone

A multi-zoom, regional-first contemporary basemap data-acquisition and quality pipeline that (a) ingests specifically licensed current datasets, (b) preserves feature/zoom-specific provenance, (c) emits per-layer per-cell coverage stats, and (d) supports browser-readable manifest indexes, together with authentic MapLibre bundling on a connected GPU machine. Run hardware/browser/GIS acceptance after the full data and renderer stack is present.

## Windows local preview

Extract `bharat-atlas-v35-local-preview.zip` in its own folder and run `START_PREVIEW_WINDOWS.bat`, or run `py -3 -m http.server 8000 --bind 127.0.0.1` from within the extracted folder, then open <http://127.0.0.1:8000/>. The preview does **not** contain `requirements-geo.txt`. The full-source ZIP contains the GIS/build scripts and pinned dependency metadata. The coverage inspector appears beneath the map's geographic layer inventory.
