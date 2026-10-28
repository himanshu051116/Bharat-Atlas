# Bharat Atlas v0.14 — Critical engineering audit

## Scope / release decision

**LOCAL ONLY, no production approval.** This release improves ingestion and tile concurrency; it does *not* integrate official Indian boundaries or a comprehensive road-level basemap. Previously deployed Vercel projects and GitHub repositories have not been modified.

## Confirmed weaknesses repaired

| Finding in v0.13 | Severity | Correction | How checked |
|---|---|---|---|
| Local provisional bundling validated region names but did not screen polygon overlaps and validity before installing data | High | Offline GEOS/Shapely screening before staging metadata and geometry; refuses pre-existing destination | New synthetic region tests, invalid-ring rejection, no overwrite test |
| No generic, strict Shapefile/GeoPackage-to-candidate conversion workflow | High | Created offline GIS import CLI, with declared CRS reprojection, region name controls, topology checks and isolated review output | Genuine GeoPackage/Shapefile round-trips, projected EPSG:3857 fixture, overlapping geometries |
| Simultaneous requests for the same MVT tile triggered redundant downloads | Medium | Coalesced in-flight tile requests, only one physical download per path | Concurrent promise tests and fetch counter |
| Cancelling one tile request could interrupt unrelated consumers if deduplication were naive | High | Per-reader cancellation, physical request only cancelled when last subscriber exits | Two-reader cancellation and all-reader cancellation/retry tests |
| Tile buffers exposed to independent consumers could share mutable memory | Medium | Return copies of verified buffers | Mutation-isolation test and updated earlier assertion |
| Oversized declared tile could still be buffered before detection | Medium | Checks Content-Length before allocation; post-read cap retained | Oversize header early-reject test |
| QA metadata and app build displayed old version identifiers | Low | Updated to v0.14 throughout the main bundle, QA export, manifest and release guard | Build-manifest and syntax tests |

## Remaining major blockers

1. **Authoritative data:** No Survey of India 2026 official 36-region political geometry has been integrated. Shaksgam and other border-region mismatches are unresolved. A clean polygon topology test is *not* evidence of the right external boundary.
2. **Data rights:** The official dataset's public redistribution/licensing terms require review before bundling. The ingest CLI requires metadata but does not itself verify a licence grant.
3. **Real rendering:** No true MapLibre/WebGL browser render test was possible here. Chromium mock tests only validate interface logic. The MapLibre distribution still needs local bundling and genuine browser/GPU validation.
4. **Map completeness:** There is no licensed high-detail national road, building, terrain and place dataset integrated in the default atlas. The 25 pilot cities are only approximate points.
5. **Search and output:** Nationwide geocoding, navigation/routing, printable PDF/8K renderer and accessibility validation remain unimplemented.
6. **Scalability:** 1,000 interactive concurrent users and real-tile traffic are not load-tested.
7. **Topology limits:** Import checks reject overlaps above a screening threshold; tiny overlaps, coastline/date-line handling, gaps and disagreements with an independent official reference remain separate GIS review tasks.

## Next engineering priority

Obtain an actually licensable official boundary archive and produce a reviewed candidate GIS report; bundle legitimate MapLibre runtime and verify real GPU rendering; then integrate high-detail licensed basemap tiles and measure per-zoom performance. Do **not** deploy research geography as a certified government map.
