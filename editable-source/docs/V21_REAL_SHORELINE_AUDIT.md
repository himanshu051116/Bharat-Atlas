# Bharat Atlas v0.21 — Engineering and geographic audit

**Result:** Local research milestone. **Do not promote to production.** Earlier v0.16 Vercel research preview has not been changed.

## Source and data facts

| Asset | Source evidence | Verified counts | Limitations |
|---|---|---:|---|
| Historic watercourses | GSHHG/WDBII 2.3.6 via basemap-data 2.0.0 | 1,723 source-derived lines | Old, generalized, unnamed; includes neighbouring countries |
| Coastlines | GSHHG 2.3.6 GSHHS physical coast category | 39 extracted lines | Old generalized shore traces; removed artificial viewport frame edges |
| Inland-water shores | GSHHG 2.3.6 GSHHS inland-water category | 93 extracted lines | Generalized outline, not an exhaustive current lake index |
| XYZ vector tiles | Locally generated, independently decoded Mapbox Vector Tiles | 608 files, z3–8, 3 layers | No authentic WebGL hardware test; no roads or settlements |

All data is research geography covering **68°E–99°E and 6°N–38°N, including adjacent countries**. This does not delineate India's political extent. **The official 2026 Survey of India vector geometry was not acquired.** Current state, UT and international borders, including the Shaksgam area, cannot be verified from these shorelines.

**Rights:** The derived physical data retain LGPL-3.0-or-later; included copying notices, attribution, modifications and upstream URL. Do not infer that licence applies to unrelated political or commercial map datasets.

## Concrete developments

1. Added reproducible `scripts/extract_gshhg_shores.py` which decodes GSHHS 2.3.6 type-1 coastlines and type-2 lake shores and strips artificial crop-window lines.
2. Integrated coastline and lake shore layers into the static MVT builder, independent MVT decoder, hash manifest, runtime source restrictions and MapLibre style.
3. Added a separate on/off control and SVG fallback/export integration for shorelines. Imported user boundaries cannot silently inherit unrelated physical overlays.
4. Added independently hashed local shoreline GeoJSON, provenance metadata and complete LGPL licence notices. The build refuses modified, missing or unlicensed shoreline data and retains its previous valid output on failure.
5. Added `node --check` for the final concatenated JS bundle. **Actual regression found:** two modules declared the same `hex` identifier, which broke the website despite individually passing JS module tests. Renamed the scoped function and made the build fail closed on future syntax collisions.
6. Added derived-shore tests, frame-edge tests, metadata/hash tampering tests, real-geometry integration checks and browser toggle checks.

## Human visual inspection

See `V21_PHYSICAL_GEOGRAPHY_REVIEW.png` generated from the shipped GeoJSON. It separately shows coastline (dark teal), inland-water outlines (blue), and old watercourses (pale blue). It **does not draw or certify a political boundary**. Observe visible Gujarat/Saurashtra coastline, west/east coasts, Sundarbans delta, Andaman/Nicobar islands and northwestern inland water outlines. Outlines should be compared against more current source data before product use.

## Known limitations and release blockers

- Still no authoritative, rights-cleared 2026 political boundary vector source. Provisional community geometry must not be represented as official.
- No contemporary real road network, modern named rivers, nationwide gazetteer or comprehensive address search.
- True MapLibre WebGL rendering and GPU performance have **not** been tested because the required engine is external and this sandbox's Chromium WebGL support is unavailable. The Chromium browser suite uses mocked MapLibre and synthetic region geometry. The SVG fallback is separately exercised.
- No published load test, routing, satellite, terrain, mobile device matrix, complete accessibility audit or true professional 8K/PDF export.
- Generalized coastline tracks represent physical water-land separation, not legal control lines, borders, or up-to-date hydrographic surveys.

**Next highest-value milestone:** integrate verifiably reusable detailed roads and named settlements, acquire/licence source-appropriate authoritative political geometry, then render real multi-zoom tiles on actual GPU-enabled mobile/desktop browsers. Avoid more interface-only iterations.
