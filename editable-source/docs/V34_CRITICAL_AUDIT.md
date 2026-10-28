# Bharat Atlas v0.34 — Critical engineering audit

**Date:** 24 October 2026. **Release decision:** LOCAL RESEARCH PREVIEW ONLY; production blocked.

## Scope and method

Read and modified v0.33 source, reviewed renderer lifecycle, boundary-loading failure handling, physical-only navigation and fallback CSS transformations. Verified the changes through Python, Node and Chromium simulated rendering suites. Consulted MapLibre GL JS public documentation for `style.load` lifecycle. No GitHub or hosting writes. This is not a nationwide data accuracy audit.

## Confirmed defects repaired

| Severity | Cause | Behavior before fix | Fix and regression proof |
|---|---|---|---|
| P0 | `fetchPreview()` coupled a political data failure with renderer teardown | Successful MapLibre renderer was removed if community boundary endpoints failed | Renderer preserved; style switched to physical-only when verified landcover is available; synthetic MapLibre browser test passes |
| P0 | `webglcontextlost` created SVG fallback without retiring `app.map` | Zoom/reset commands could still address the failed map behind the fallback overlay | Invalidated renderer, retired map and stale style callbacks; fallback zoom simulation passes |
| P1 | `fitAll()` returned when `app.features` was missing | Physical-only view could not reset | Fit historical physical extent; mocked browser regression passes |
| P1 | Wheel anchoring used a transformed SVG rectangle | Pointer-centred zoom drift at magnification | Changed anchor to stable SVG viewport CSS pixel coordinates |
| P1 | Static 36-region header falsely implied loaded polygons | Misleading status with boundary source absent | Dynamic heading with explicit unavailable/provisional status |
| P1 | Recovery/data download and export coupled to SVG fallback | No independent region retry; physical export could stay disabled with valid GPU | Added source retry and enabled historical physical SVG export |

## Verification summary

- **123/123** JavaScript tests, **92/92** Python tests.
- Mocked Chromium scenarios cover map retaining its renderer after optional boundary failure and user retry, correct physical-only reset, SVG drawing and context-loss re-routing of Zoom.
- Build verifier confirms **648 static assets** and **23 bundled modules** with matching SHA-256 hashes.
- No authentic MapLibre WebGL2 renderer proof; no physical Android/iOS proof.
- `scripts/release_guard.py --target production` blocked, as intended.

## Further observed design risks / acceptance gaps (not fixed or unverified)

**P0 — authoritative geography and distribution rights:** Survey of India 2026 political geometry, independent comparison for disputed northern regions and islands, and written rights for derivative vector tiling and distribution are still missing. Free download is not by itself a redistribution licence. Separate claim/admin control and source provenance layers. Do not insert guessed territory patches.

**P0 — genuine GPU rendering:** Authentic MapLibre distribution and WebGL2 desktop, physical Android Chrome and physical iOS Safari were not verified here. Real map style/layer compatibility, context restoration and performance remain unproven.

**P1 — national basemap:** The delivered 608 MVT tiles are sparse historical physical traces and 71 selected Natural Earth places, not a full dense national basemap. Modern roads/railways/current named water lines/full settlement tiles and zoom-sensitive labelling need provenance-checked ingestion and visual QA. Synthetic ingestion tests cannot prove Indian transport coverage.

**P1 — source-aware UX:** Map search remains a limited selected-place index, not an Indian address geocoder. Near-me coverage, region/city name collisions, empty-state guidance and language accessibility need genuine dense datasets and real-device review.

**P1 — load/error telemetry:** Add reproducible video/frame captures, startup timing, tile error counts, style reload race tests, connection-offline scenarios, and non-sensitive diagnostic export. Never silently substitute a different polygon source after a failed hash check.

**P2 — route engine:** Present road graph uses coincident vertices and approximated segment length, with no legal turn rules, one-way, access, grade separation, ferries, traffic, driving ETA or nationwide connectivity. Must remain clearly **research-only**. Do not label it driving navigation.

**P2 — performance/offline:** Plan national tile streaming with cache boundaries and dataset licences, optional PMTiles/MBTiles deployment, label collision benchmarks, efficient point indexing, accessibility auditing, realistic load tests, observability and rollback.

## Prioritized next implementation order

1. Reproducible genuine MapLibre vendor install and physical browser proof, before calling the renderer verified.
2. Licensed regional real transport/water/settlement pipeline with data coverage manifest; then scale to national coverage only after source/legal and visual checks.
3. Source-aware place search for towns/villages, Hindi/English aliases, autocomplete and provenance per result.
4. GIS reference and copyright reviews for authoritative political geometry, north/border distinctions, islands and independent sign-off.
5. Detail/cartography polish using only verified layers (hierarchical labels, road classes, river labels, zoom and motion quality), followed by functional/UX hardware testing.
6. Optional true routing after authoritative transport graph preprocessing and restrictions, with travel-use certification separate from research preview.

**Do not classify new data or motion as finished merely because UI controls or importers exist.**
