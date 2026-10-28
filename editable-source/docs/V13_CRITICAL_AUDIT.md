# Bharat Atlas v0.13 — Critical engineering audit

**Development mode:** LOCAL ONLY. Existing GitHub repositories and live Vercel deployments are unchanged. Not a government-certified map.

## Concrete issues discovered and addressed

| Issue | Evidence | Resolution | Remaining limits |
|---|---|---|---|
| Imported self-crossing polygons could pass browser validation | v0.12 checked ring closure and signed area but not non-adjacent segment intersections | Browser rejects self-intersections on small rings, consecutive duplicate points, and holes outside their shells | Large rings (>512 vertices) still require the existing offline GIS topology audit; cross-polygon gaps/overlaps require independent reference geometry |
| Oversized geographic responses were only rejected after reading entire body | v0.12 called `response.text()` before checking its result length | Bounded streaming UTF-8 reading, early Content-Length reject and reader cancellation for oversized content | File integrity hash covers bundled provisional geometry, not government authenticity |
| Verified MVT tiles were fetched/hashed again when requested repeatedly | v0.12 sparse protocol had no client cache | Added bounded LRU cache (12 MiB/128 tiles by default), byte-buffer copies and corruption-safe cache insertion | Still no real nationwide vector basemap or measured cache hit rates under production traffic |
| Missing WebGL support could leave the atlas unusable | Library availability alone was tested; renderer construction failure did not always expose a legacy link | Added MapLibre supported() preflight, WebGL context-loss handling and SVG fallback on renderer startup errors | Real MapLibre/WebGL rendering cannot be verified here |
| Search offered only region names and 25 pilot cities | No coordinate navigation | Implemented decimal latitude/longitude queries, coordinate marker, map camera focus and safe reset. WGS84 is stated explicitly | Coordinates are **not** reverse geocoded and do not establish territorial sovereignty or a verified address |
| Coordinate search marker could persist after selecting a region | New state sync regression found in v0.13 integration | Pin now updates on every filter/selection change | Browser tests use a mocked MapLibre renderer |

## Local verification performed

- 44 JavaScript unit tests passed, including new coordinate parser, tile-cache, geometry and bounded-read tests.
- 22 Python tests passed for GIS build/guard pipeline.
- Isolated Chromium browser tests passed for desktop, mobile, imports, SVG exports, city/coordinate search, unsupported WebGL and renderer-constructor crash. Fake MapLibre + synthetic geographic shapes were used in those tests.
- `scripts/renderer_probe.py` found WebGL1/WebGL2 unavailable in this container's Chromium and no vendored MapLibre distribution; this **does not** mean WebGL is unavailable to real users.
- `scripts/release_guard.py --target production` remains a deliberate failure.

## Launch-critical blockers (unchanged)

1. Obtain a verifiably licensed authoritative Survey of India 2026 boundary dataset and compare 36 state/UT geometries to it; resolve Shaksgam and other northern discrepancies with documented GIS review.
2. Bundle MapLibre JS/CSS and the correct distribution licence; test actual WebGL drawing, zoom, labels and context recovery on real mobile/desktop browsers.
3. Ingest licensed detailed roads, railways, rivers, settlements, buildings and a searchable nationwide place index. Current tile tests use fictional geometry; current place catalogue is only 25 approximate cities.
4. Implement and verify professional large-format vector/PDF/PNG exporting with map-style/legend consistency, memory budgets and accurate cartographic attribution.
5. Conduct actual cross-browser, accessibility, device GPU and 1,000-simultaneous-user load tests with the real tile traffic pattern.

**Production-readiness verdict:** NOT READY. An accurate India political atlas is a geographically specialized product; smooth Google Maps-like rendering still needs real vector-tile data and a verified GPU renderer.
