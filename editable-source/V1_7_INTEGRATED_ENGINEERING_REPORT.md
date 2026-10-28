# Bharat Atlas v1.7 — Integrated Engineering Report

**Date:** 25 October 2026  
**Status:** locally built research atlas; NOT a certified political map and NOT approved for production.

## Scope
Continued from the complete editable v1.6 source, retaining India + World, 28/8 administrative-name directory, supplied Survey of India-derived claimed national outline, historical GSHHG/WDBII physical geography, reference capitals and existing import pipelines.

## Changes implemented

1. **Complete Shapefile-component provenance:** The Natural Earth importer now requires SHA-256 checks of `.shp`, `.shx`, `.dbf` and `.prj`, plus `.cpg` when supplied. A matching `.shp` by itself is no longer considered a verified source. GeoJSON inputs remain supported as single-file source assets. The Windows online/offline Natural Earth acquisition path and manual provenance-preparation command produce these records. Imported layer metadata retains component hashes.
2. **Visible source-feature search:** World city/province/river/lake/peak search matches are no longer placed only in an often-collapsed advanced-tools section. Matching source-backed records appear beneath the active desktop or mobile search box with category and country code, where available. Diacritics normalize for search (e.g. São → sao); distinct same-name locations are retained; duplicates of the same feature are removed; result counts and query length are bounded. Results are chosen by actual feature, not inferred/geocoded coordinates.
3. **Small-screen UI correction:** Made the desktop country/search sidebar independently scrollable. On smaller laptop screens, the earlier long sidebar could intercept clicks on search suggestions. Kept the existing mobile map-first layout.
4. **Capital-point navigation:** A search for an exact reference-capital name now focuses its point coordinates rather than zooming only to its country's broad bounding rectangle. The older countryinfo points remain labelled historical reference data.
5. **Offline/build consistency:** Added the optional search logic to the static build and offline shell manifest; updated the release version to v1.7 and source/preview instructions.

## Confirmed automated test evidence

- `node --test tests/*.test.mjs tests/*.test.cjs` — **153 passed, 0 failed**.
- `python -m unittest discover -s tests -p 'test_*.py' -q` — **110 passed, 0 failed**.
- `python scripts/build.py` — local static app built.
- `python scripts/verify_preview.py` — **780 assets verified**, v1.7, 27 bundled India application modules.
- Isolated Chromium desktop + mobile browser check of visible optional city suggestions, selection and exact reference-capital focusing — **both passed**, with local geography and simulated SHA-256 API because no secure local HTTP browser could be used here.
- Manual Shapefile sidecar mutation test — altered `.dbf` rejected while `.shp` unchanged.

## What has not changed or been verified

- Full Natural Earth 50m/10m worldwide datasets are **not bundled**. The environment couldn't retrieve publisher ZIPs; the installer remains provided for a networked computer. Bundled optional world place detail remains 71 Natural Earth India-tagged locations; reference capitals separately number 163 (historical), and some historical physical layers are already bundled.
- Indian state/UT and district polygons are **not** authenticated or bundled as official geometry. The operator-supplied generalized national outline was preserved, with its existing copyright and non-commercial restriction notice. Its correspondence to the 2026 official political-map edition remains unverified.
- Genuine MapLibre/WebGL2 GPU and real Android/iOS acceptance tests remain pending. The independent SVG World Explorer is usable without them.
- No production approval, release, public URL, GitHub modifications, deployment or hardware certification occurred.

## Recommended remaining steps (outside this code-only build)

1. Install source ZIP on a connected machine. Use `FETCH_WORLD_GEOGRAPHY_WINDOWS.bat`; inspect source ZIPs, output counts, source component hashes and rendered labels.
2. Obtain independently verified rights and exact state/district geometry for India's political depiction. Maintain distinct claimed-territory vs de facto administrative layers where relevant.
3. Validate new 10m/50m geographic coverage, labels, boundaries near the dateline and source-based place selection on real desktop and mobile browsers.
4. Do accessibility, offline revisit, load and licensing checks before publishing.

**Data sources:** [Natural Earth populated places](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-populated-places/), [Natural Earth admin-1](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/), [Survey of India outline](https://surveyofindia.gov.in/pages/outline-maps-of-india).
