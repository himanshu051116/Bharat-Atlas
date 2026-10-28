# Bharat Atlas v1.10 — Natural Earth publisher-extract integration

Date: 2026-10-26. **Local research preview only; not a geographically complete release.**

## What was actually imported

* 160 named major cities transcribed from Natural Earth's publisher-hosted `geojson/ne_50m_populated_places_simple.geojson` reference (source has 1,251 features); the earlier 71 India Natural Earth points were retained. Five duplications in country + city names were omitted, leaving **226 actual installed city points**.
* 81 named physical/elevation points transcribed from publisher-hosted `geojson/ne_50m_geography_regions_elevation_points.geojson` (source has 86 entries; unnamed entries not transcribed). Includes Mt Everest, K2, Kilimanjaro, Denali, Nanda Devi and others. Elevation information is descriptive research source data, not a field survey.
* Existing 177 generalized global country outlines, Survey of India-sourced generalized national claim outline, physical GSHHG/WDBII layers and capital references preserved.
* Real records are integrated into the optional World Explorer geographic layers, search, feature inspector, coordinate focusing and mobile search. They are bundled offline in the Windows research preview.

This import is a **curated subset from publisher files**, not the original GeoJSON download or the complete Shapefile collection. The source review records name the original Git blobs and SHA-1 IDs, but local SHA-256 checks cover the **derived local files**, not the bytewise complete publisher GeoJSON. No claim of archival completeness or end-to-end publisher-file cryptographic verification is made.

## Source register and limits

- Source city publisher Git blob: `3fad8f0038ba95c7758800f3f3c148418e7c76d1` — https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_populated_places_simple.geojson
- Source elevation publisher Git blob: `70050da0bc83a0736d6c6ca92a6a3a09b710e316` — https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_geography_regions_elevation_points.geojson
- Natural Earth terms: https://www.naturalearthdata.com/about/terms-of-use/ (public domain)
- Survey of India outline: independent prior provenance; **not** Natural Earth and not claimed to be a certified 2026 political-map match. Subject to non-commercial reuse restrictions already documented in this project.

## Why complete global datasets were not installed

The execution container fails to resolve `naturalearth.s3.amazonaws.com` and `raw.githubusercontent.com`. The publisher GitHub file connector can read modest-sized text GeoJSON, but cannot materialize original ZIP/Shapefile archives in this environment. The 1:10m states/provinces source (~14.2 MB compressed), 50m named waterways/lakes, and complete 50m populated places are not installed. No fabricated provinces, rivers or lakes were substituted.

To complete this stage on a networked Windows machine, run `FETCH_WORLD_GEOGRAPHY_WINDOWS.bat` from the *full source* with Python dependencies listed in the README (or supply downloaded original ZIPs to `scripts/install_world_geography.py`). The script imports source-verified and reviewed shapefiles and then builds the preview. The importer excludes Natural Earth Indian administrative polygons because they are not official SoI claim geometry.

## Tests and engineering evidence

* JavaScript Node tests: **143 passing**.
* Python tests: **114 passing**, including four new checks for counts, source records and real location/elevation anchor points.
* Build: **783 verified assets**, v1.10 local preview.
* Source manifest: `data/world-detail/manifest.json` SHA-256 verifies all included optional layer bytes; counts cities=226, peaks=81.
* Isolated Chromium desktop and mobile: country selection, Ottawa reference-capital search, Amaravati, Mount Everest, Nairobi city feature inspector and distance scale **passed**. Test simulates browser crypto; integrity independently checked by Python build. Screenshots are from these browser tests.
* Not passed or not attempted: complete all-layer imported geography verification, physical Windows/Android/iOS hardware checks, legally authoritative Indian admin boundary review, genuine WebGL2 GPU acceptance, end-to-end secure-origin browser checks and production approval.

## Acceptance recommendation

The resulting v1.10 build offers a genuine, modest improvement to world geography content and can be run as a local non-commercial research preview. The requested **fully comprehensive** Natural Earth world geographic import remains pending the original publisher ZIP files. Do not label this version geographically complete or ready for commercial deployment.