# Bharat Atlas v0.23 — Physical-Only Continuity Sprint

23 October 2026 · Local research build · No GitHub or Vercel deployment

## The user-facing defect addressed

The existing v0.22 project contained 41 source-derived GSHHG physical land polygons, 1,723 historical WDBII river lines, 39 coastline lines and 93 lake-shore lines. All were locally packaged. Yet the map depended on retrieving 36 provisional state/UT polygons from an external pinned service before it would display any geographic image. Loss of external network access therefore made even existing local geographic content appear unavailable.

v0.23 preserves the working political map when a valid source is available and adds an **independent physical-only view** if no acceptable political boundaries can be loaded. It does **not** invent national boundaries or imply certification.

## Implemented changes

1. `src/physical-only.mjs` constructs a scalable 1600×1120 SVG directly from the hash-verified GSHHG/WDBII files, with polygon hole preservation, inland waters, islands, coastlines and optional historic rivers. No `<path data-region>` or state boundary geometry is present. The map warns that it covers the 68–99°E/6–38°N study area, including neighbouring countries.
2. `src/main.mjs` displays the physical-only SVG in the existing interactive fallback when boundary retrieval fails or its provenance is rejected. It retains zoom, pan, controls, explicit source text, and an enabled physical-only SVG download. The region list remains unavailable instead of showing false results.
3. The `mapLoadComplete()` race guard prevents delayed renderer load events from replacing the physical fallback with a loading overlay after failed geography initialization.
4. `scripts/build.py` checks for duplicate cross-module top-level function declarations before concatenation. This prevents the shadowing defect caught during browser testing; Node's `--check` alone does not flag duplicate function declarations.
5. `scripts/render_physical_only.py` produces a standalone SVG. `docs/V23_PHYSICAL_ONLY_ATLAS.svg` is viewable without MapLibre, internet, an HTTP server or an app runtime; a PNG visual-review copy is included.
6. Updated preview verifier, source version, tests and README.

## Regression evidence

- 83 JavaScript tests passed, including real bundled GSHHG geometry in `tests/physical_only.test.mjs`.
- 68 Python tests passed, including the new function-collision build guard.
- Browser Chromium smoke tests passed with a **mock MapLibre** and actual GSHHG land data. The new case simulates failure of both boundary URLs, asserts zero political polygons, enables SVG download, and exercises zoom. Browser Web Crypto is simulated in that isolated fixture only; genuine SHA checking is covered by separate module and Python build checks.
- Static preview verifier: 14 application modules and 636 assets, without bundled political boundaries.
- Production release guard: remains blocked.

## Known limitations and release blocks

- This is a **generalized historical physical map**, not a contemporary Indian political map, legal document or navigation product. GSHHG land/coastlines do not encode India's territorial claims or current control.
- The source window includes non-Indian land. No political borders are drawn when the boundary source is missing.
- Real nationally detailed roads, named present-day rivers, railways, addresses and a nationwide gazetteer remain missing.
- Genuine GPU/WebGL MapLibre rendering remains unverified because the available browser harness uses mock MapLibre and the installed headless browser cannot create working WebGL contexts.
- The main application still depends on externally served provisional community state/UT geometry unless a separately reviewed/local licensed boundary file is provided.
- The source licence and required LGPL-3.0-or-later texts for GSHHG/WDBII remain bundled under `data/landcover`, `data/hydrography` and `data/shorelines`. Reuse and distribution should preserve these terms.
- The preview has **not** been deployed. Public production promotion is prohibited pending verified geographic data, genuine rendering testing and performance evidence.

## Next engineering gates

1. Bundle a legally usable, independently reviewed political reference dataset, or retain a physical-only public view without any political claim.
2. Replace mock rendering tests with reproducible real MapLibre WebGL and visual tests on compatible devices.
3. Integrate actual licensed roads/railways and named places at source-supported scales, then validate legibility and geography on representative regions.
