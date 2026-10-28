# Bharat Atlas v0.38 — Data acquisition, build and field acceptance

## 1. Windows preview without compilation
Extract `Bharat_Atlas_v038_Research_Preview.zip` and double-click `START_PREVIEW_WINDOWS.bat`, or run `py -3 -m http.server 8000 --bind 127.0.0.1` in the extracted directory. Open http://127.0.0.1:8000/. This is **research-only** and the SVG works without WebGL.

## 2. Build the full source and run automated audit

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-geo.txt
node --version
.\.venv\Scripts\python.exe scripts\atlas_program.py --run-tests
```

The package expects Node.js and Python with the GIS dependencies. It does not automatically fetch 1.6 GB of India data or write to GitHub.

## 3. Prepare data from Geofabrik or another licensed source

1. Download an OSM **regional** extract (not automatic) from `https://download.geofabrik.de/asia/india.html`. The current whole-India extract is approximately 1.6 GB and exceeds this research command's regional memory budget; split it in a GIS workstation pipeline.
2. Independently verify source date, exact download URL, SHA-256 and ODbL-1.0 use/attribution/share-alike requirements. Store a rights record with `sourceSha256`, `sourceUrl`, `licence`, `attribution`, `snapshotDate`, `officiallyVerified:false`, `redistributionReview:"approved_for_research_preview"`, `coverageClaim:"regional_extract"`. This label must reflect an actual human review; setting it is not legal clearance.
3. Install **osmium-tool** separately on a GIS workstation. Convert one reviewed region with `scripts/stage_osm_regional_pbf.py --pbf INPUT.osm.pbf --source-metadata INPUT-REVIEW.json --output STAGED.geojson`. A fresh metadata file must then bind the *new STAGED.geojson SHA*.
4. Use `scripts/build_regional_pack.py --geojson STAGED.geojson --source-metadata STAGED-REVIEW.json --output REGIONAL-TILES` (verify arguments with `--help`). This pipeline rejects already existing destinations and handles at most 50,000 input features per reviewed regional pack.
5. Independently inspect geometry, coverage and rights, then place only the reviewed output under `data/transport-pack/` and rebuild. Do **not** treat PBF regional coverage or community borders as official Indian political geometry.

## 4. Bilingual place index from your reviewed CSV

CSV columns: `id,name,region,kind,longitude,latitude,aliases`; aliases separated with `|`. Use source-provided Indic spellings and aliases. Hindi-to-English transliteration is **not** guessed. Strict input cap: 500,000 records and 8 MB per shard.

```powershell
.\.venv\Scripts\python.exe scripts\build_search_shards.py --source PLACES.csv --metadata PLACES-REVIEW.json --output SEARCH-INDEX
```

Do not overwrite the shipped `data/search-index` in place; stage and inspect the new index, then replace that directory as an intentional reviewed version change. Browser queries fetch only the necessary keyed shard and verify its SHA-256.

## 5. Political boundary comparison

Acquire a properly licensed WGS84 vector reference separately. The free Survey of India **PDF** is not automatically a grant to vectorize, host or commercially redistribute it. With private rights-approved candidate/reference GeoJSON files you may run:

```powershell
.\.venv\Scripts\python.exe scripts\compare_boundary_candidates.py --candidate CANDIDATE.geojson --reference OFFICIAL-REFERENCE.geojson --reference-rights REFERENCE-REVIEW.json
```

The rights record must contain SHA-256, HTTPS source, edition, licence and `rightsReview:"cleared_for_private_spatial_comparison"`. The result is NEVER a certification or public-reuse authorization. A GIS and legal reviewer must separately examine northern claimed/control lines and edition issues.

## 6. Authentic MapLibre + Android/iOS

On an internet-connected WebGL2 computer:

```powershell
.\.venv\Scripts\python.exe scripts\vendor_maplibre.py --fetch
.\.venv\Scripts\python.exe scripts\build.py
.\.venv\Scripts\python.exe scripts\run_renderer_proof.py
```

This pins and verifies the existing MapLibre 5.13.0 release; follow the installed script's npm integrity rules. After a successful *real* desktop GPU proof, test a physical Android Chrome and iOS Safari over trusted HTTPS (or a documented Android ADB localhost reverse), record named device, browser, renderer, real tile fetch/decoded features, pan/zoom, screenshots, errors, labels and touch behavior. Browser emulation and user-agent spoofing are NOT physical proof.

## 7. Offline research packaging and safe internal hosting

```powershell
.\.venv\Scripts\python.exe scripts\build_offline_research_pack.py --site dist --output BharatAtlas_Offline_Research.zip
```

An already-built offline archive is provided with this release. The archive includes the source-backed historical physical SVG and staged tiles but no modern nationwide roads and no guaranteed offline MapLibre GPU engine. It is not a full offline navigation map.

## 8. Production
Do not deploy this build publicly as a verified political atlas. `scripts/release_guard.py --target production` is intentionally blocking. The `infra` folder is internal research-serving scaffolding only, not a production certification.