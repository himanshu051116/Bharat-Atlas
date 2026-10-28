# Bharat Atlas v0.37 — integrated geographic-data engineering report

**Status:** local research build. **Production:** BLOCKED. **GitHub/deployment:** unchanged.

## Implemented together in the existing application

1. **Decoded, cell-level coverage inventory.** The MVT builder independently decodes each emitted `.pbf` tile and records the actual encoded feature occurrences by layer in `tileLayerCounts` alongside its SHA-256. Older catalogues without this optional field remain readable but cannot claim decoded layer-level counts.
2. **Integrity and provenance checks.** `scripts/mvt_audit.py` rejects any tampered `tileLayerCounts`, even if the changed catalogue contains correct file hashes. The browser catalogue validates paths, layer names, finite positive integer counts and inventory cardinality. This is verification of encoded tile content, not cartographic truth.
3. **Accurate coverage diagnostics.** The on-page Data Coverage inspector identifies layers actually decoded in the matching tile cell, labels per-layer counts, flags overzoom and avoids claiming that tile-cell presence guarantees a feature at the exact checked coordinate. Zoom inventory now summarizes decoded feature occurrences separately for each layer.
4. **Reviewed regional data-pack builder.** `scripts/build_regional_pack.py` takes a source-backed local GeoJSON, source metadata including a recorded human rights review, classifies recognized roads, railways, waterways and settlement points, builds a sparse research MVT pack and audits the produced protobuf. It never downloads data, overwrites existing output, inserts synthetic production data or certifies national completeness.
5. **Bounded gazetteer manifest loading.** The optional place-catalogue manifest uses the bounded streaming reader instead of buffering an arbitrarily large `.text()` response before checking length.
6. **Rebuilt inherited real-source physical research tiles.** 608 local `.pbf` tiles spanning zoom 3–8, with data from the same previously pinned GSHHG/WDBII historical physical layers and 71 Natural Earth selected place points. The newly regenerated catalogue includes decoded per-tile counts. **No modern national roads, railways or official political boundaries have been added.**
7. **Unified v0.37 release stamps** for frontend, offline shell cache, build/verifier contracts, and audit filenames.

## Automated evidence (local execution)

| Check | Observed result |
|---|---|
| JavaScript Node unit tests | 136 passed |
| Python unit/GIS tests | 94 passed |
| Static build | Passed |
| Preview manifest/asset verification | 648 assets passed |
| Independent tile audit | 608 tiles, 4 layers, 13,047 decoded feature occurrences |
| Regional source-to-tiles pipeline | Synthetic fixture passed; synthetic test data excluded from preview |
| Mocked MapLibre browser regression | Passed, desktop/mobile and SVG fallback |
| Atlas Labs real-SVG browser regression | Passed, with mocked network access |
| Production release guard | Rejects release, as required |
| Authentic MapLibre GL JS/WebGL2/hardware | **NOT VERIFIED**, missing trusted local renderer package/GPU evidence |
| Physical Android/iOS | **NOT VERIFIED** |
| Survey of India political boundaries, reuse rights, disputed-region review | **BLOCKED** |
| Nationwide modern transport/place data | **MISSING** |

**Interpretation:** tile count ≠ nationwide zoom coverage; feature occurrences repeat across zoom levels and tile boundaries and do not equal unique physical geographic entities. Stronger integrity claims do not imply geographic correctness.

## Running on Windows

**Preview ZIP (no compilation):** Extract, open PowerShell within the extracted folder, and run:

```powershell
py -3 -m http.server 8000 --bind 127.0.0.1
```

Browse `http://127.0.0.1:8000/`. The preview does **not** contain `requirements-geo.txt`; do not run a source build in it.

**Full source ZIP:** Extract into its own folder and open PowerShell there:

```powershell
py -3 -m pip install -r requirements-geo.txt
py -3 scripts\atlas_program.py --run-tests --output docs\PROGRAM_AUDIT_LOCAL.json
py -3 -m http.server 8000 --directory dist --bind 127.0.0.1
```

Requires Node.js, Python, and the GIS dependencies for the end-to-end audit. Windows may require additional binary GIS dependencies; the prebuilt preview does not.

**Optional data pack from real user-supplied permitted GeoJSON:**

```powershell
py -3 scripts\build_regional_pack.py --geojson C:\path\to\region.geojson --source-metadata C:\path\to\rights.json --output C:\path\to\regional-pack --minzoom 4 --maxzoom 8
```

Rights JSON must include `officiallyVerified:false`, `redistributionReview:"approved_for_research_preview"` (a truthful recorded external human review, **not** a licence grant), the original input's SHA-256 in `sourceSha256`, HTTPS `sourceUrl`, `licence`, `attribution`, `snapshotDate` (`YYYY-MM-DD`), and `coverageClaim` (`local_sample`, `regional_extract`, or `unverified_extract`). Review data rights before installing the output under `data/transport-pack`, then rebuild. The installer does not guarantee access/turn restrictions or routable navigation.

## Next uncompleted integrated work

1. Acquire a permitted, pinned contemporary regional OSM extract, retain original rights/snapshot hashes, and independently audit roads, rail, waterways and settlements; expand region by region only with measured tile budgets.
2. Integrate authentic pinned MapLibre locally; independently prove actual WebGL2 rendered features and hardware pan/zoom (desktop and physical phone). Do not infer GPU success from simulated MapLibre tests.
3. Obtain appropriately licensed official boundary geometry; independently compare Indian claimed territory versus actual control/admin layers and review disputed geography; do not invent missing polygons.
4. Build scalable national settlement/POI and address indexing, check bilingual aliases and source administrative IDs.
5. Validate topology, turn restrictions and independent real-world routes before enabling navigation instructions.
6. Complete offline region-packs, accessibility, measured load, print/cartography QA and production operating evidence.

These are concrete, cross-dependent engineering gates. **The project is not finished**, and no real-world data, rights approvals, devices or GPU evidence were fabricated.