# Bharat Atlas — World Geography v1.3 engineering report

Date: 25 October 2026. Status: **local research preview, not production or government-certified mapping**.

## Source baseline and integrated improvements

Built from the user-facing v1.2 World Detail full source, retaining the independent India and World views and the operator-supplied Survey of India generalized national-claim outline.

1. Generated a new **source-backed historical physical geography** overlay from GSHHG/WDBII 2.3.6 via pinned basemap-data 2.0.0. Output: **1,150 generalized shoreline segments** and **650 inland-water shapes**, SHA-256-pinned in `data/world/shoreline-manifest.json` and carried in `data/world/world-shorelines.json`. These are separate from political borders, not contemporary hydrography. Source declared under LGPL-3.0-or-later. Upstream licence text is copied to the static preview.
2. Added separately controllable *Detailed shorelines* and *Reference inland water* options, both on by default in the World Explorer, with a displayed source and licensing note.
3. Improved zoom-sensitive city-marker labels: bounded count, collision suppression, zoom-compensated text size; these names are the existing **71** source-listed India locations, not an expanded global gazetteer.
4. Fixed detailed-country and state/province overlays not appearing/disappearing when zoom alone crosses their visibility thresholds.
5. Fixed a startup navigation race: an initial world camera animation could override a user's early location search. Initial view is now established without a queued camera animation.
6. Updated offline cache identifier and static physical-data source notices without modifying the India claim polygon or replacing the base world political dataset.

## Local validation carried out

- JavaScript: **143 passed** via `node --test tests/*.test.mjs`.
- Python: **107 passed** via `python -m unittest discover -s tests -p 'test_*.py'` (one non-fatal invalid-coordinate fixture warning observed).
- Static build/integrity: **778** SHA-verified preview files (`python scripts/verify_preview.py dist`).
- Detailed World Explorer browser scenarios: passed in desktop and mobile Chromium with a **simulated browser digest** in the isolated test harness; the built assets were SHA-verified independently.
- Legacy world exploration browser suite: passed desktop and mobile when run separately.
- One combined run of additional long browser suites timed out; it is not claimed as a pass.
- Genuine MapLibre GPU proof, physical Android/iOS testing, full accessibility compliance and production performance: **not performed or certified**.

## Source/geopolitical integrity

- The supplied Survey of India national claim geometry stays in `data/official-india` with its original provenance/rights metadata. It is generalized and is not a verified geometrical match to the 2026 official political map. Commercial rights are not established.
- Historical physical shorelines/lakes are not country borders. The legacy 177-item Natural Earth world overview is generalized and may differ from contested claims/control lines.
- The existing importer can accept reviewed 1:10m Natural Earth admin-1, 50m populated places and 50m physical data. Those **full source files were not downloaded** by this development pass, and global admin-1/city/peak coverage is **not claimed**. The importer excludes India admin-1 from Natural Earth's general de-facto reference layer.
- Natural Earth publisher downloads: https://www.naturalearthdata.com/downloads/10m-cultural-vectors/ and https://www.naturalearthdata.com/downloads/50m-physical-vectors/.

## Next development with newly acquired data

1. Obtain and locally hash the original Natural Earth 1:10m admin-1 source and 1:50m cities/rivers/lakes source. Reconcile the source edition, attribution and non-Indian political boundaries.
2. Import one reviewed source layer at a time using `prepare_world_detail_metadata.py` and `import_world_natural_earth.py` with replace semantics; audit loss, validity, antimeridian treatment and viewport performance.
3. Independently acquire permissioned Indian state/district polygons, reviewed against the relevant official edition; don't derive them from world de-facto polygons.
4. Conduct genuine browser-device acceptance and review readability at global, continental, and region-level zooms before public deployment.

## Windows preview

Extract the preview ZIP to a new folder. Double-click `START_PREVIEW_WINDOWS.bat`. Open `http://127.0.0.1:8000/world.html` for the world view or `http://127.0.0.1:8000/` for India. No compilation step is needed for this static preview.
