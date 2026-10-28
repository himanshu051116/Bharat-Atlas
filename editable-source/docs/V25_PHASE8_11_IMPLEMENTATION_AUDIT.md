# Bharat Atlas v0.25 — Final-roadmap-phase implementation audit

**Status:** locally tested research extension. **Not Bharat Atlas v2.0 complete. Not production-ready. No deployment.**

## Objective

Continue from the v0.24 modular source and implement real pieces of the roadmap's later phases, using only geographic datasets already included in the project. Prefer source-limited but honest functionality to unsupported district statistics or fictitious historical map layers.

## New user-facing page

`atlas-labs.html` is linked from the full primary atlas. Its ES module `src/atlas-labs.mjs` and dedicated responsive CSS are packaged as independently verifiable assets alongside the full 14-module viewer. The `scripts/verify_preview.py` contract blocks packaging if Labs is missing or one of its five tabs was silently removed.

### Phase 8: Learning & Studio (research implementation)

- 10-question deterministic **28 states versus 8 union territories classification** quiz with scoring and retry.
- **Physical city-location worksheet** using selected Natural Earth 1:50m populated place positions, an SVG download and a separate CSV answer key.
- **Map Studio** from source-derived GSHHG/WDBII land, rivers, coastlines and lakes, configurable city labels and coordinate grid, editable SVG, browser print/Save as PDF.
- Source and accuracy warnings appear in exports. Geography is not a certified political map; classroom answer keys need independent review before formal use.

**Not built:** reviewed textbook lessons, classroom user trials, an authoritative political-map worksheet, a custom PDF typesetting pipeline, curriculum-vetted Hindi content, saved school progress.

### Phase 9: Geographic data observatory (research implementation)

- Chart of **catalogue record counts** by editorial state/UT label from the **71-record selected Natural Earth dataset**. Explicitly not population, settlement density, economic development or complete town coverage.
- Side-by-side comparison of the **list of sampled locations** within two selected region labels.
- Great-circle distance between two selected source-backed point centres, not road distance.
- CSV export of the record-count sample with formula-injection protection.

**Not built:** official district observatory, district geometry or district time series, comprehensive nationwide place catalogue, real choropleth statistics, population/forest/rainfall indicators.

### Phase 10: Timeline, comparisons and story maps (research implementation)

- Dated user-supplied CSV comparison: required `region,year,value,boundary_edition` columns and a source citation. Strict type limits, duplicate rejection, and **block automatic comparisons if boundary editions differ**. No user file uploaded to a server.
- Three-scene guided physical-geography explanation: land, historical waterways and a selected city sample. Scenes reuse real source-backed physical features and label their limits.

**Not built:** historic political boundary geometry, area-weighted district crosswalk, synchronous two-map cartography, verified historical narratives, analytical district trends, GIS overlay processing, offline map packs.

### Phase 11: Maintenance and safety

- New offline machine-readable `scripts/audit_release_readiness.py` checks the signed static artifact and reports phase-specific evidence and blockers (`docs/V25_ROADMAP_GATE_AUDIT.json`).
- Preview integrity now requires all three Atlas Labs public assets, source warnings and five functional tabs. The existing production release gate remains **blocked**.
- Existing hash records, data source manifests, licence notices, build rollback, and GitHub CI testing retained. CI also checks the Labs script syntax and generates a readiness report.

**Not built:** production monitoring, incident alerts, release-on-call/operations, fully funded hosting, real visitor performance data, ongoing source freshness verification.

## Actual source evidence

- `data/gazetteer`: Natural Earth 1:50m selected India-tagged populated places, 71 records, public domain, with manually reconciled region names and approximate coordinates; manifest has a pinned Git blob, explicit licence and exact digest.
- `data/landcover`, `data/hydrography`, `data/shorelines`: historical/generalized GSHHG/WDBII 2.3.6, source metadata and LGPL-3.0-or-later licence copies. Geometry covers a rectangular 68–99 E / 6–38 N study window **including neighbouring countries**.
- Regional categories for the quiz are from the canonical 28-state and 8-UT lists; **not derived from or proof of the provisional boundary polygon dataset**.

## Verified in this iteration

- Node unit tests cover quiz correctness, unique IDs and counts, XLS/CSV formula-injection safeguards, physical SVG geometry and XML escaping, workbook point positions, accurate great-circle calculation, strict dated CSV parsing, and different-boundary-edition refusal.
- Python tests cover integration of new Labs pages into the exact signed `dist/` package and tamper rejection, roadmap blockers, and the legacy core build/GIS safeguards.
- Chromium functional tests display **actual bundled physical land SVG** and selected Natural Earth points, download map and worksheet SVG, navigate classroom quiz, review catalogue bar chart, compute distance, reject unsupported history, and advance guided story. **Network and SHA browser APIs are mocked** because localhost navigation in the test environment is restricted. No MapLibre GPU engine is used on the Labs page. Desktop/mobile screenshots are included and represent actual browser-rendered SVG, not AI-generated geography.
- The original core browser suite retains **mocked MapLibre** and synthetic political polygons; this does not validate national political map rendering.

## Critical remaining blocks to the final product

1. Obtain legally reusable *authoritative political boundaries* and verify all 2026 territorial changes; resolve Shaksgam, Gilgit-Baltistan, Aksai Chin and control/claim representations without silently fabricating geometry.
2. Integrate genuine modern nationwide roads, rails, settlements, labelled rivers, detailed elevation and correctly tiled multi-scale data.
3. Bundle MapLibre for local use and run actual WebGL on desktop, Android and iOS. Complete responsive, accessibility and visual-map audits.
4. Create a complete licensed national geocoder and authoritative district hierarchy; upgrade from sample counts to source-dated statistical observations with matching boundary editions.
5. Validate professional SVG/A3/PDF/high-resolution raster exports with scale, source attribution, fonts and output QA on real printer and browser environments.
6. Establish 1,000-session load evidence, availability/monitoring, costs, security review, source-change workflows and live rollback drills.
7. Add educator verification, curriculum references, historical dataset provenance and independent accuracy review before issuing a public v1.0/v1.5/v2.0 claim.

**Release rule:** The existence of a functional Phase 8–11 *prototype component* does not mean the phase or the entire end-to-end roadmap has passed. Production guard remains closed.

## Reproducibility

```bash
cd bharat-atlas-v25
python scripts/build.py
python scripts/verify_preview.py
node --test tests/*.test.mjs
python -m unittest discover -s tests -p 'test_*.py' -q
python tests/browser_preview.py
python tests/browser_labs.py
python scripts/audit_release_readiness.py --output docs/V25_ROADMAP_GATE_AUDIT.json
python -m http.server 8000 --directory dist
# Open http://localhost:8000/atlas-labs.html
```

**No GitHub changes or Vercel deployment were performed.**
