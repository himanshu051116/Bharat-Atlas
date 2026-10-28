# Bharat Atlas v0.22 — physical land-mask audit

## Delivered

The local map now supports a **Physical** viewing theme using 41 actual generalized GSHHG land polygons, with holes representing inland water and detached island geometry. The mask was generated from Basemap's bundled GSHHG 2.3.6 at intermediate resolution by unioning source land polygons and subtracting source lake polygons. It covers a fixed India-focused geographic window of 68–99°E and 6–38°N, including surrounding countries.

Geography: `data/landcover/land.geojson` (158,402 bytes), hash `dbbdefe951a125968a6817c0b28f8bb33d2683655ed1e9fcf658b39ff2804f30`. Reproducible extractor: `scripts/extract_gshhg_landcover.py`. Source metadata and LGPL licence texts: `data/landcover/`. This is **not** a political land mask or official boundary layer. Geographically real land polygons and islands still have generalized historical accuracy limits.

The physical map theme places the source-derived land mask under the state outlines. Provisional administrative boundaries remain visible, but are de-emphasized. The SVG fallback and SVG export include the same physical layer, while user-imported custom political data do not inherit unrelated geographic overlays. Existing river/coast/lake-shore data and 608 physical MVT tiles remain unchanged.

## Software safety

- Build: SHA-256, exact source metadata/attribution, Shapely topology, WGS84 study extent, 30,000-vertex safety cap, source licence texts. Staged failure preserves prior valid build.
- Browser: independently checks geographic polygon coordinate/ring structure, feature count, byte size, SHA-256 and licence; missing or corrupt optional physical data must not block the political viewer.
- Tests: view-mode MapLibre style, no-WebGL SVG export, hole preservation, browser loading and tampering failure, build rollback after invalid rehashed data; desktop/mobile browser smoke suite and existing national-political QA tests.

## Critical limitations and next milestones

1. **Not the full national basemap**: detailed roads/railways/settlements, named rivers, elevation and verified nationwide coordinates are missing. The physical study window crops features, and physical polygons are not administrative territory.
2. **Not authoritative political geography**: 2026 Survey of India GIS geometry absent, northern international boundaries including Shaksgam unresolved, rights/edition review incomplete.
3. **No real GPU validation**: MapLibre external CDN and mock-only browser acceptance tests. SVG fallback runs without GPU but uses provisional polygon data from external source unless separately bundled.
4. **Scale**: 608 historical physical tiles serve only z3–8. None of this establishes 1,000 simultaneous visitors or production availability.
5. **Visual audit**: `docs/V22_PHYSICAL_LAND_REVIEW.png` is drawn directly from actual source data, depicts coastline/land/water/rivers across the full study rectangle and intentionally excludes political lines.

Recommendation: obtain a legally usable modern network of roads, railways, settlements and a genuine hosted WebGL-test environment before increasing the version number again. Independently validate official-reference political territory in a parallel workstream.

**Deployment:** none; the previously hosted simplified v0.16 research preview remains unchanged.
