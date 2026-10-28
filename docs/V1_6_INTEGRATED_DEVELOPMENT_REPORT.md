# Bharat Atlas v1.6 — Integrated Development & Critical Status

## Release class
Research/development candidate only. No deployment; no GitHub writes. India claim outline unchanged.

## Changes made to real v1.5 source

1. **Geographic viewport correctness.** Extracted deterministic latitude/longitude visibility and pixel-placement helpers into `world-detail-geometry.js`; introduced a 10° cell spatial index for cities/peaks to reduce repeated full-list scans; removed assumptions based on half the viewport width. Longitude-wrap bounds retain cross-date-line features conservatively. Added Node unit tests.
2. **Map movement performance.** Physical river/lake paths now use bounded, cached per-feature path collection, without constructing another entire filtered array on every repaint. The existing country and province viewport filtering is retained.
3. **Viewport-aware geographic labels.** Source place labels scale using the actual displayed SVG width/height and active viewBox, reducing tiny type at mobile widths and offscreen text.
4. **Visitor-facing data coverage.** Six source-layer cards show actual installed feature counts; uninstalled layers explicitly say so. Counts are not coverage certifications. The current bundled optional detail pack has only 71 India-tagged cities.
5. **Importer hardening.** Rejects Shapefile symlinks/encrypted ZIP entries and checks extraction bounds before `testzip()` decompresses archive members. Rejects oversized source files before loading their bytes.
6. **Integrated build.** World geometry module is packaged in static previews and offline cache; cache identity and version contracts updated.

## Verification in this session

- Node test suite: **149 passed, 0 failed**.
- Python test suite: **110 passed, 0 failed**.
- Static `build.py` and `verify_preview.py`: **779 assets verified**, version 1.6, production gate remains closed.
- Isolated Chromium desktop + mobile geography smoke: PASS (checksum API simulated in the isolated browser; exact data SHA integrity tested at build).
- Isolated Chromium synthetic admin-1 province search and viewport culling: PASS for desktop and mobile; unknown-length oversized response blocked.
- Extended named rivers/lakes/peaks browser scenario: did not complete within runtime; not accepted as a passing check.
- Authentic MapLibre GPU and actual Android/iOS hardware tests: **NOT PERFORMED**.

## Geography fidelity / legal source status

- World overview: inherited generalized Natural Earth 1:110m **177 map units**, not certified current political geometry.
- World capitals: inherited 163 historical source-listed reference points; not a live authoritative list.
- Optional city dataset: inherited 71 Natural Earth source-listed India-tagged city locations.
- Historical world physical geometry: inherited GSHHG/WDBII watercourse, coast and inland-water source records; not modern named hydrography.
- Indian national outline: user-provided, Survey of India–labelled simplified national claimed outline; subject to source usage restrictions (non-commercial), not a certified 2026 political state/district map. No alterations in this release.
- Natural Earth publisher ZIPs for 10m admin-1, 50m populated places and named physical features: no local downloads possible due restricted DNS; install pipeline is present, not nationwide completeness.

## Unfinished development / dependencies

- Import, audit and validate actual 50m populated places; 10m non-India provinces; modern named water/rivers/lakes/peaks; verify source hashes and globe-scale cartography after acquiring publisher ZIPs.
- Acquire permitted authoritative Indian state/UT and district geometry; document editions, territorial claims vs control, web redistribution rights.
- Test actual MapLibre renderer and physical devices. Review high-zoom labels, touch, performance, accessibility, and edge cases like +180/-180.
- Finish acceptance campaign and only then consider a public release, subject to legal permission for India geometry.

## Usage

**Windows:** unzip the ready preview, run `START_PREVIEW_WINDOWS.bat`; world `/world.html`, India `/`.
**Source:** `py -3 scripts/build.py`, `py -3 scripts/verify_preview.py`; data downloads: `FETCH_WORLD_GEOGRAPHY_WINDOWS.bat` on connected Windows.

**No invented data, no production certification, no deployment.**