# Bharat Atlas v0.20 — First source-derived geographic layer

Date: 23 October 2026 | Release type: local research preview | Production: BLOCKED

## Why this sprint matters

Previous versions generated valid MVT files only from **synthetic** source fixtures. This version ships source-derived, **real** watercourse geometry from the installed GSHHG/WDBII package. It does not claim to be a complete Indian basemap or have survey-authoritative boundaries.

## Extracted source

- GSHHG/WDBII v2.3.6, included in `basemap-data==2.0.0`; river segments were extracted via `mpl_toolkits.basemap.Basemap._readboundarydata('rivers')` at intermediate (`i`) resolution.
- Scope: 68°E–99°E, 6°N–38°N, a study WINDOW that includes neighbouring countries. The source is global; lines were not clipped to a verified Indian border.
- 1,723 historical *unlabelled* river segments retained after rectangle clipping and the declared 0.015-degree length cut-off. River names, classifications and contemporary completeness are NOT inferred.
- Machine-readable original feature GeoJSON: `source-data/gshhg-rivers.geojson` (SHA-256 in `data/hydrography/manifest.json`).
- Build-generated static MVT: 555 XYZ files, zoom 3 through 8, in `data/tiles/`. The independent MVT decoder checks their protobuf contents and their recorded SHA-256 hashes are verified before copying into `dist/`.
- Same lines are bundled as `dist/data/hydrography/rivers.geojson` with a hash-checked manifest for the accessible SVG mode and SVG exports when user toggles rivers on.
- The real hydrography layer is only drawn when using the stock regional research dataset, not over unrelated user-imported boundary data.

## Licensing, source and warning

GSHHG 2.3.6 / WDBII via matplotlib Basemap Data 2.0.0. Original WDBII/GSHHG authors: Paul Wessel (University of Hawai'i), Walter H. F. Smith (NOAA). Source: https://www.soest.hawaii.edu/wessel/gshhg/ . The Basemap Data package says its river data is **LGPL-3.0-or-later**. The extracted data, extraction scripts, modification notices, and corresponding GPL/LGPL licence copies are included in `source-data/` and copied to `dist/data/hydrography/` where required.

Extraction modifications: geographic clipping to a rectangular study window; thresholding of tiny segments for legible research display; numerical rounding to six decimals; conversion from Basemap-derived line coordinates to GeoJSON and static MVT; no political borders from GSHHG published as official.

This **is not** an official Survey of India hydrological atlas; it includes river courses outside modern Indian administration, uses older generalized data, does not provide verified named rivers, has gaps at detailed local zoom levels and must not be used for survey, engineering or navigation.

## Verification types and remaining blockers

**Verified engineering:** Independent MVT decode; source-file and tile SHA-256 integrity; provenance, licence and declared coordinates; static build + rollback; JS/Python tests and mocked-browser regression; real historical source material in both vector tiles and WebGL-free SVG fallback.

**Not verified:** WebGL MapLibre rendering on real browser GPUs; authoritative Indian borders or northern region (Shaksgam) alignment; legal entitlement to redistribute any future official political Shapefile; current nationwide roads, buildings, settlement database, or exhaustive rivers; network load under real users.

The previously deployed Vercel v0.16 preview was not changed; no GitHub commits were made.

## Regeneration

```bash
python -m pip install -r requirements-geo.txt -r requirements-hydro.txt
python scripts/extract_gshhg_rivers.py --output source-data/gshhg-rivers.geojson
python scripts/build_vector_tiles.py --rivers source-data/gshhg-rivers.geojson --source-metadata source-data/gshhg-source.json --output data/tiles --minzoom 3 --maxzoom 8
python scripts/mvt_audit.py data/tiles
python scripts/build.py
python scripts/verify_preview.py
python scripts/release_guard.py --target production  # must fail
```

## Immediate next work

1. Acquire licensed **real roads and named modern river datasets** in representative pilot locations; avoid mistaking this historical layer for a comprehensive network.
2. Resolve genuine MapLibre installation/worker bundling and WebGL device testing; current browser tests still mock it.
3. Obtain and independently compare Survey of India 2026 political geometry, especially northern territory; never merge disputed claims with effective-control borders silently.
4. Validate visual layer ordering, missing-tile behaviour, labels and mobile performance on real geographic data.
