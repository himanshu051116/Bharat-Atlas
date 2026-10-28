# Bharat Atlas v1.11 — optimized public research preview

**Publication status:** packaged and tested locally; no GitHub push or Vercel deployment verified as part of this artifact.

This public-safe version retains the 28 October 2026 performance improvements: frame-coalesced pan/pinch, low-jitter wheel zoom, delayed overlay redraw and compact mobile layer controls. The historical generalized research geography is not a certified political/legal boundary map. The Survey of India-sourced national claimed-outline files were **excluded** pending redistribution and official-source review. Missing-outline messaging remains visible in the application. Do not present this as an official political map of India.

Build locally with `python scripts/build.py`; static output is `dist/`. Vercel should serve `dist/` from a Git-linked source project, or host the contents of the separate ready-to-publish static archive at the repository root with framework preset Other and no build command.

Verification of this public-safe build: 166/166 JavaScript tests; 13/13 focused Python tests; 782 integrity-verified generated static assets. The full Python suite exceeded the execution limit; browser/GPU and physical-device acceptance were not performed for this exact public-safe rebuild.

See `V1_11_PERFORMANCE_FIX_REPORT.md`, `BOUNDARY_SOURCE_AND_USAGE_NOTICE.md`, and `README_OFFICIAL_INDIA_CLAIMS.md` for provenance and limitations.

---

## Latest local development milestone — v1.11 (28 October 2026)

The World Explorer's pan, wheel zoom, and pinch behavior now use an inexpensive SVG camera path. Expensive SVG country labels, reference capitals, scale, and optional geographic overlays update only after the camera settles. High-frequency pointer events are coalesced to display frames, and wheel input no longer restarts easing animations. Mobile Layers & tools are consolidated behind a native disclosure menu. **166 JavaScript and 114 Python tests passed; 784 preview assets verified.** Synthetic 100-wheel-event Chromium stress assertions measured one overlay rebuild per category, not device FPS. See `V1_11_PERFORMANCE_FIX_REPORT.md`. Geographic datasets and the Survey of India–derived claim outline remain unchanged. No production device acceptance or GitHub/Vercel deployment was performed.

## Latest local development milestone — v1.10 (26 October 2026)

A curated, source-labelled publisher GeoJSON extract was **actually installed** into the World Explorer: 226 world/India city points and 81 named elevation points now load offline. This is an *incomplete Natural Earth extract*, not the requested comprehensive 10m/50m import. The complete global state/province, named river and lake archives still need a networked importer run. See `V1_10_ACTUAL_NATURAL_EARTH_IMPORT_REPORT.md` and `SOURCE_DATA_IMPORT_README.md`. No GitHub or Vercel changes were made.

## Latest local development milestone — v1.9 (26 October 2026)

Bharat Atlas v1.9 improves the geographic processing foundation: a persistent offline indexed gazetteer makes source-installed cities, provinces and physical features searchable without rescanning every feature for each keystroke; indexed spatial envelopes lower line/polygon rendering work during pan and zoom. Search and index logic are unit-tested using large **synthetic performance fixtures**, which are not included as geographic map data. See `V1_9_GEOGRAPHY_AND_ACCEPTANCE.md`.

## Previous development milestone — v1.8 (26 October 2026)

This repository now includes unified country/capital/installed-feature search, a source-labelled feature inspector, a dynamic latitude-aware approximate world-scale bar, collision-reduced labels and a mobile toolbar that does not clip actions. See [`V1_8_CONSOLIDATED_DEVELOPMENT_REPORT.md`](V1_8_CONSOLIDATED_DEVELOPMENT_REPORT.md) for checks and outstanding source-data requirements. The Survey of India claim outline was preserved unchanged; v1.8 does not certify political borders or include complete Natural Earth 10m/50m data. No deployment was performed.

# Bharat Atlas v1.7 — India + World geography-first research build

This release adds viewport-correct world-detail rendering, an honest six-layer coverage inventory, safe geography import checks, and an updated offline shell. The same source-declared Survey of India non-commercial claimed national outline is retained; no state/district polygons are certified. Natural Earth 10m/50m comprehensive data is **not bundled**, and live GPU and physical-device acceptance are still pending.

**Windows preview:** Extract the preview ZIP, run `START_PREVIEW_WINDOWS.bat`, open `http://127.0.0.1:8000/world.html` or `/` for India. **Source:** Run `py -3 scripts/build.py` and `py -3 scripts/verify_preview.py`. To acquire authentic Natural Earth layers with network access, run `FETCH_WORLD_GEOGRAPHY_WINDOWS.bat`; imported assets must pass manifest checks.

See `V1_6_INTEGRATED_DEVELOPMENT_REPORT.md` for changes, tests, blocked deliverables and next-stage priorities.

---

# Bharat Atlas v1.5 — India + World Research Atlas

**Latest integrated build:** v1.5 (`dist/build-manifest.json`). The world viewer, independent India claim outline and 71 source-derived city markers remain bundled. Large Natural Earth 50m/10m geography is **not** bundled until fetched and imported on a connected machine. This is **not** certified contemporary political geography.

**Preview:** extract `Bharat_Atlas_v1_5_Windows_Preview.zip` and double-click `START_PREVIEW_WINDOWS.bat`.

**Full-source world geography:** extract `Bharat_Atlas_v1_5_Full_Source.zip`, install `requirements-geo.txt`, then double-click `FETCH_WORLD_GEOGRAPHY_WINDOWS.bat`. This optional installer downloads Natural Earth city, river, lake, mountain, country and non-Indian province layers, runs SHA-256/source validation, preserves India claim geometry, and rebuilds the research preview. It needs internet access, adequate memory and enough free disk space. Read `V1_5_GEOGRAPHY_RELEASE_NOTES.md`.

---

## Current local research update: source-labelled India national outline (25 October 2026)

The provided `Outline_of_India.zip` was imported after validating the projected Shapefile. The India and World views now include a **generalized national outline** representing India's territorial claim, including an SVG fallback on WebGL-incompatible computers. Source SHA-256, web geometry SHA-256, all original 1,151 polygon parts, area-fidelity measurements and the non-commercial restriction are recorded in `data/official-india/manifest.json` and `BOUNDARY_SOURCE_AND_USAGE_NOTICE.md`. This is **NOT** an independently certified match to Survey of India's 2026 1:4M political map, and it includes **NO** official state/UT/district polygons or de-facto control lines. For the map see `world.html` and `index.html`; production and commercial use remain blocked.

---

> Government-of-India claimed territory boundary support: see [README_OFFICIAL_INDIA_CLAIMS.md](README_OFFICIAL_INDIA_CLAIMS.md). No official vector dataset is bundled in this ZIP.

# Bharat Atlas — India + World Explorer (Integrated Research Edition)

**Two connected interactive maps:** India at `index.html` and the world at `world.html`.

World explorer ships 177 generalized Natural Earth low-resolution country/territory features. This is **not** a complete set of global political units or an authoritative territorial-boundary reference; small states/territories and contested boundaries may be omitted or simplified. India's own map and state catalogue remain independent. See `WORLD_EXPLORER_DEVELOPMENT_REPORT.md`.

## Local preview on Windows

Extract the preview archive, double-click `START_PREVIEW_WINDOWS.bat`, then open:
- `http://127.0.0.1:8000/` — India
- `http://127.0.0.1:8000/world.html` — World

In a shell, `py -3 -m http.server 8000 --bind 127.0.0.1` also serves the prebuilt preview directly. **Do not run `pip install` in the preview directory.**

## Source engineering

The full-source archive includes `scripts/build.py`, `scripts/build_world_data.py`, original `data/world/world-countries.geojson` and SHA-256 manifest. `python scripts/build.py` emits `dist` without deploying. `node --test tests/*.test.mjs` and `python -m pytest -q tests` run regressions; `python tests/browser_world.py` runs isolated SVG UI checks using Chromium (local browser network access is not required).

The world viewer is SVG-driven and works without WebGL. The India viewer retains existing optional MapLibre and SVG fallback. No official India political polygons are bundled or certified. Neither viewer should be used for navigation or legal decisions.

## Data sources and rights

Natural Earth data: public-domain historical generalized 1:110m Admin-0 country layer. See `data/world/manifest.json` and https://www.naturalearthdata.com/about/terms-of-use/ . Administrative area figures in country details are approximate geodesic computations from simplified polygons, not official statistics. Country labels are historical and should not be treated as current geopolitical endorsements.
# Bharat Atlas — Focused 1.0 Candidate

A lean, map-first Indian political/geographic atlas derived from the tested v0.38 research engine. This candidate has a bilingual **name and classification directory** for India's 28 states and 8 union territories, map-first UI, basic navigation and geodesic measurement, plus an expandable research toolkit. It does **not** include official political boundary vectors. See `FOCUSED_ATLAS_V1_SCOPE.md` for the exact scope and licensing cautions.

**Windows:** Extract the preview ZIP and run `START_PREVIEW_WINDOWS.bat`. Do not run GIS build steps in the preview folder. For the full source: run `python scripts/build.py`, `python scripts/verify_preview.py`, `node --test tests/*.test.mjs`, `python tests/browser_preview.py`, and `python tests/browser_focused.py` (Chromium/Playwright required for browser tests). Production approval remains blocked.

---

# Bharat Atlas v0.36 — unified engineering program

Read `README_PROGRAM.md` and `MASTER_ROADMAP_AND_ENGINEERING_SPEC.md` for the complete integrated roadmap, status, local setup and one-command audit. All existing research features continue below. Production remains blocked.

---

# Bharat Atlas v0.35 — Critical reliability and geographic-state fixes

This development iteration addresses reproducible UI/renderer lifecycle defects found during source review and mocked-browser regression checks. It does not bundle authoritative Indian boundaries, nationwide contemporary transport data or independently verified real WebGL rendering.

## Fixed in v0.35

- Boundary fetch failure no longer destroys a healthy interactive MapLibre map. The physical-only style is loaded independently of political data, and existing imported regions are retained after an unsuccessful refresh.
- If WebGL reports a context loss (or a GPU-specific map error), the map instance is retired so buttons, selections and camera actions operate on the SVG fallback instead of the failed GPU instance. Stale style callbacks are invalidated before asynchronous cleanup.
- Physical-only Reset now fits the generalized research extent instead of returning early when political polygons are absent.
- SVG mouse-wheel zoom anchors to the stable viewport rather than the SVG's already-transformed bounding box.
- The geographical coverage heading now reports real loaded/provisional status rather than claiming 36 loaded regions when there are none.
- A standalone Retry region data button can attempt to recover optional provisional polygons without restarting or discarding the map.
- When physical-only historical landcover has loaded, SVG export is available even if the GPU map remains active and no region dataset exists.

## Verification

- Node JS test suite: 123 passed / 0 failed.
- Python unittest suite: 92 passed / 0 failed.
- Headless Chromium browser scenarios using a simulated MapLibre renderer: passed, including new missing-boundaries+GPU-survival, data retry, physical reset, and context-loss SVG-zoom regression checks.
- Deterministic static build: 648 assets, 23 bundled modules, SHA-256 checks passed.
- Production release guard correctly refuses promotion.

**LIMITS:** These do not constitute authentic WebGL2, device compatibility, source geometry, official sovereignty/territorial claims, or live performance acceptance. Only selected Natural Earth places and generalized historical GSHHG/WDBII features are locally present. Modern India-wide roads, railways, current named rivers, address search, authoritative Indian boundary data and redistribution clearance remain unresolved. Google Maps-like capability is not achieved.

Windows preview: extract `bharat-atlas-v34-local-preview.zip`, double click `START_PREVIEW_WINDOWS.bat` or serve the extracted folder with `py -3 -m http.server 8000 --bind 127.0.0.1`. Do **not** run source-only `scripts/build.py` or `requirements-geo.txt` in the preview folder. Full GIS/build scripts are in the **source** ZIP.

See `docs/V34_CRITICAL_AUDIT.md` for the prioritized follow-up architecture and remaining blockers.

---

# Bharat Atlas v0.33 — source-backed place comparison and improved cartographic exploration

A new compare-two-places workspace uses the selected Natural Earth gazetteer (not political polygons) to show spherical distance, initial and reverse bearing, compass direction, midpoint and a great-circle research line in MapLibre or SVG fallback. It supports accessible input controls, map fit animation respecting reduced-motion settings, and an export with provenance and non-navigation warnings. See `docs/V33_PLACE_COMPARISON.md`. The existing v0.32 motion, nearby places and GIS capabilities remain.

**LOCAL RESEARCH PREVIEW ONLY.** MapLibre real GPU proof, official Indian political geometry and rights review, nationwide roads, railways and address search remain outstanding. Building and unit/browser smoke testing do not constitute final real-device acceptance.

---

# Bharat Atlas v0.32 — source-aware cartographic exploration and motion

This update adds a meaningful nearby-source city explorer, approximate scale bar, geodesically interpolated *direct-line* story trail, improved selection recovery in the SVG fallback, and place search independent of unavailable political boundary geometry. All new source-location cards come from the existing Natural Earth source-backed catalogue. The additions do **not** provide navigation, nationwide roads, official territory vectors or survey-accurate scale. See `docs/V32_CARTOGRAPHIC_EXPLORATION.md`.

**LOCAL RESEARCH PREVIEW ONLY** — no public deployment, no official boundary certification, no production approval. Real MapLibre WebGL2 and physical mobile-device proof remain pending.

# Bharat Atlas v0.31 — motion & detail build

This is a research development build, not a certified map. Added a guided journey from the existing 71 selected Natural Earth places, reduced-motion-aware MapLibre camera transitions, zoom-dependent source coverage descriptions, smoother SVG panning/zooming including touch pinch and keyboard, and optional source-backed transport labels. No new nationwide roads or official Indian political geometry are bundled. See `docs/V31_MOTION_AND_DETAIL.md`.

# Bharat Atlas v0.30 — Integrated feature-development candidate

**This is a consolidated development deliverable, not the final released product or an acceptance test.** It contains the implemented research tools, modern-data import/pack interface and road-graph exploratory route capability. It does **not** include authoritative national political vectors, modern nationwide roads or navigation-grade routing. Production stays blocked. Detailed specification: `docs/V30_INTEGRATED_PRODUCT_SPEC.md`.

## Run the static research preview on Windows

Extract the `local-preview.zip` and run `py -3 -m http.server 8000 --bind 127.0.0.1`. Open http://127.0.0.1:8000/ in Chrome. No requirements file is present in that small preview package; do not run pip/build scripts there.

Extract the **full-source** package for development. Its Windows launcher is `START_LOCAL_WINDOWS.bat`; Python GIS requirements are in `requirements-geo.txt`. The new overlay, measuring, bookmarking, route research and data coverage controls are below the main map. Real MapLibre installation still requires appropriate permitted npm assets and WebGL hardware. The SVG fallback is useful without them.

## New application modules

- `src/explorer-tools.mjs` — geodesic research calculations, GeoJSON import contracts, bookmarks and share link schema
- `src/explorer-ui.mjs` — integrated workspace UI, local storage/export and fallback drawing
- `src/router.mjs` — locally bounded road-graph exploratory shortest path, not navigation
- `src/transport-pack.mjs` — separate optional modern research MVT source/protocol/styles
- `scripts/build_research_data_pack.py` — licence/provenance-screened source-to-MVT pack builder
- `offline-shell.js` — same-origin public research asset cache, not an offline licence to external tiles

---

# Bharat Atlas v0.29 — Renderer recovery and shareable local diagnostics

**LOCAL RESEARCH PREVIEW ONLY — NOT PRODUCTION READY.** Built from the actual v0.28 source; no official political geometry or current national roads/rails added.

## What changed in v0.29
- Visible **Retry map engine** button rebuilds the map instance on demand after a WebGL context failure, instead of silently claiming a GPU restore is successful. Existing research map data and user-selected import remain in memory.
- The SVG fallback stays visible when WebGL is unavailable or lost. A restored context alone does not certify successful rendering.
- **Download diagnostics** exports local-only JSON with MapLibre availability, WebGL2 context-creation probe, app data state and the failure category. This is not independent GPU attestation. Review your browser's user-agent before sharing the file.
- Retried physical-only GPU viewer can render land without political boundaries if locally sourced data are present, but no official Indian political outline is inferred.
- Synthetic browser recovery tests and unit tests added. Real desktop/Android/iOS GPU proof remains BLOCKED unless separately tested.

## Windows setup
Extract `bharat-atlas-v29-local-preview.zip`, open PowerShell in the extracted folder, then run:

```powershell
py -3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/` in Chrome. **The local preview has no `requirements-geo.txt`** and does not need a build or venv. The renderer may require network access to the pinned MapLibre CDN; SVG fallback still works without it.

For development, extract `bharat-atlas-v29-source.zip` into its *own folder*, install Python dependencies with `py -3 -m pip install -r requirements-geo.txt`, and run `START_LOCAL_WINDOWS.bat`. This process serves `dist/`. It does not deploy.

## How to share diagnostics
1. Load the atlas locally and try **Retry map engine** once if the SVG fallback is shown.
2. Click **Download diagnostics** below the map or **Download renderer report** on the SVG overlay.
3. Review the file for browser user-agent details and upload the JSON and optionally a screenshot into ChatGPT. No screenshots or diagnostics are sent automatically.
4. If further verification is required, run `py -3 scripts/run_renderer_proof.py` from the *full source* after installing authentic MapLibre with `py -3 scripts/vendor_maplibre.py --fetch` and a browser that supports WebGL2.

## Tests
`node --test tests/*.test.mjs`; `py -3 -m unittest discover -s tests -p 'test_*.py' -q`; `py -3 scripts/verify_preview.py`; `py -3 tests/browser_preview.py`; `py -3 scripts/release_guard.py --target production` (must reject).

## Remaining P0 gates
- Genuine, authentic MapLibre WebGL2 proof on GPU desktop plus physical Android Chrome and iOS Safari; automated mock tests are not proof.
- Official Survey of India 2026 vector geometry, rights and independent northern claim/control reconciliation (including Shaksgam).
- Contemporary licensed roads, railways, named waterways and settlements; accurate labels/geocoder.
- External HTTPS/CDN dependency and fallback testing, realistic performance and full release QA.

---

# Bharat Atlas v0.28 — Verified dependency supply chain and interaction proof

**Development continuation of the real v0.27 source. LOCAL RESEARCH PREVIEW ONLY.**

This iteration pins the MapLibre 5.13.0 npm tarball to its independently obtained
`dist.integrity` SHA-512 checksum. The installer rejects a missing or mismatched
value and preserves the previously installed vendor on failed installation.
Offline installation requires the registry-published integrity supplied explicitly:

```bash
python scripts/vendor_maplibre.py --tarball maplibre-gl-5.13.0.tgz --npm-sha512 "sha512-<trusted integrity from npm view>"
```

On a machine with npm access, `python scripts/vendor_maplibre.py --fetch` obtains
both the tarball and independent registry integrity metadata. Then run:

```bash
python scripts/build.py
python scripts/verify_preview.py
python scripts/run_renderer_proof.py
```

The renderer proof requires pinned real MapLibre, WebGL2, SHA-256-validated vector
tiles, rendered physical lines and settlement points, canvas pixel readback,
**actual Chromium mouse/touch pan and wheel zoom**, and a baseline camera return.
Mobile *browser emulation* is still not proof of a physical Android or iOS device.
There is no working WebGL2 and no authenticated MapLibre distribution in this
execution environment, so the proof must fail closed, not assert success.

Nothing in this iteration creates licensed official political boundaries or
adds real nationwide road/rail/address data. Shaksgam and the 2026 Survey of
India vector rights review remain unresolved. See `docs/V28_DEVELOPMENT_AUDIT.md`.

---

# Bharat Atlas v0.27 — Research vector map and fail-closed WebGL proof

**Local-only research build; not an official political map.**

### This sprint

- **608 independently decoded MVT tiles** now include four actual source-backed layers: generalized historical rivers, coastlines and lakes (GSHHG/WDBII 2.3.6), plus 71 selected Natural Earth 1:50m populated places. Different zooms repeat city points; `featureOccurrences` does not mean unique towns.
- Every tile layer now carries an independent URL, source hash, licence and attribution. Natural Earth is public domain; GSHHG is LGPL-3.0-or-later.
- Optional railway line tiles and matching styles are supported **only when a separately licensed railway dataset is supplied**. No real road or railway data is bundled.
- The strict unmocked proof now checks both line geometry and settlement features from SHA-256-authenticated tiles, actual WebGL2 context and canvas readback. **It cannot run successfully here:** MapLibre npm assets are unavailable and Chromium does not create WebGL2 in this environment.
- Fixed the pinned MapLibre installer to read the correct `package/LICENSE.txt` path and verify the BSD notice.
- Source-coverage evidence: `docs/V27_DATA_COVERAGE_GATE.json`. Audit: `docs/V27_MULTISOURCE_AND_REAL_RENDERER_AUDIT.md`. Manual physical device checklist: `docs/REAL_DEVICE_RENDERER_CHECKLIST.md`.

Reproducible local checks:

```bash
python scripts/build_research_multisource_tiles.py
python scripts/build.py
node --test tests/*.test.mjs
python -m unittest discover -s tests -p "test_*.py"
python scripts/verify_preview.py
python scripts/run_renderer_proof.py  # fails closed until authentic renderer + WebGL2 are available
```

To install the real renderer on a machine with npm network access:

```bash
python scripts/vendor_maplibre.py --fetch
python scripts/build.py
python scripts/run_renderer_proof.py
```

Do not consider mobile emulation an actual Android/iOS hardware validation. Survey of India 2026 boundaries and their redistribution rights are NOT yet approved.

---

# Bharat Atlas v0.25 — Learning, Studio and research laboratories

**Research-stage expansion of the roadmap's final phases, not the complete final production platform.**

Open `atlas-labs.html` from a local HTTP server after running `python scripts/build.py`. Five working areas: verified physical Map Studio (SVG export and browser PDF print), 28-state/8-UT quizzes and source-sampled physical worksheets, 71-city sample observatory and distance tool, a strict dated CSV indicator comparison that blocks changed-boundary comparisons, and a three-scene guided source story. The lab modules read only the already-reviewed landcover, historical hydrography, shoreline and Natural Earth gazetteer bundles; hash checks precede rendering.

The observatory charts show **counts of selected catalogue records**, never population, urbanization or settlement density. Its compare tool cannot establish district indicators. Dated CSV data is user supplied and never automatically trusted; the source and boundary edition must accompany it. No actual geographic boundary timeline, district data, real routing, accurate historic political maps, or official Survey of India geometry is bundled.

No production release until the independent geographic, WebGL, licensing, accessibility and load-testing gates pass.

---

# Bharat Atlas v0.24 — Source-backed settlement names

**Local-only research build; no deployment or official-boundary certification.**

## New: 71 public-domain city points, including Hindi search aliases

The previous application included 25 manually curated pilot city points. This build also includes **71 real Natural Earth 1:50m populated-place records** originally tagged `ADM0NAME=India`. The local subset and dataset are pinned to the Git blob `f692f6a1311569612a2d3fbb3554e97ec0bfe64c`. Natural Earth is public domain. See `source-data/natural-earth-50m-india-places.tsv`, `data/gazetteer/manifest.json`, `data/gazetteer/SOURCE-AND-LICENCE.txt`.

The original source incorrectly assigns several cities in Gujarat to Dadra and Nagar Haveli, and uses some outdated labels (e.g., Orissa). The included **editorially reconciled state labels are still not independently survey-certified**. This is a historical cartographic selection, *not* all Indian towns or villages, a current administrative registry, geocoded addresses, or evidence for sovereignty. Coordinates are approximate. Some Hindi/English labels are historical and require review. No maps are generated from settlement labels.

The map uses the source-backed 71 entries wherever available, suppresses overlapping manually curated pilot points with matching names, supports the supplied Hindi aliases and common English variants, and exposes its provenance. Unavailable or tampered place data will not block the political or physical atlas. The places are visible at intermediate map zooms but have not been tested with a genuine MapLibre GPU renderer.

### Rebuild the settlement catalogue

```bash
python scripts/prepare_natural_earth_places.py --source source-data/natural-earth-50m-india-places.tsv --output /path/to/new-empty-directory
python scripts/build.py
python scripts/verify_preview.py
node --test tests/*.test.mjs
python -m unittest discover -s tests -p 'test_*.py' -q
python tests/browser_preview.py
```

`prepare_natural_earth_places.py` refuses to overwrite existing data. The checked-in `data/gazetteer` folder is the data source for this release; regenerate into an unused directory to review first. No public site or repo was modified.

---

# Bharat Atlas v0.24 — physical-only geographic continuity mode

**Local-only research build. Not a verified Indian political map. No Vercel deployment, production promotion or GitHub changes.**

## Map-data failure recovery and physical-only research map

**New in v0.23:** when provisional political boundaries cannot be loaded (network outage, invalid provenance or missing GeoJSON), the locally bundled, hash-checked land mask can still be displayed as an interactive zoomable SVG physical map with coasts, lakes and optional historic rivers. Download SVG remains available. This mode deliberately includes neighbouring countries and contains no political or sovereignty lines. The original political map loads normally when its data is available. Source integrity failures are not silently replaced by alternate boundary geometry.

A standalone, fully self-contained offline `docs/V23_PHYSICAL_ONLY_ATLAS.svg` is also included; it has no renderer or network dependency.

## The existing geographic map

- Added a **Physical** map theme. It displays a source-derived GSHHG land/water polygon mask underneath the clickable state and UT geometry; state fill is nearly transparent, while administrative outlines remain light and explicitly provisional. The mask shows the real generalized peninsular coastline, the larger GSHHG lakes and islands, and adjoining countries rather than arbitrarily clipping physical land to provisional political boundaries.
- The same physical layer can appear in the **interactive no-WebGL SVG fallback** and **research SVG exports**. The physical source is excluded when a user imports unrelated custom political geography.
- Generated **41 GSHHG land polygons with lake holes** (158,402 bytes) from installed `basemap-data==2.0.0`, source GSHHG 2.3.6, WGS84 68–99°E / 6–38°N. Geographic completeness is **limited to the research window**. This is generalized physical geography, NOT India territorial boundaries, disputed borders, navigation-grade shoreline mapping, or newly verified survey data.
- Existing historic watercourse (1,723 segments), GSHHG coastlines (39 segments), lake shores (93 segments) and 608 MVT physical tiles are preserved unchanged. No roads, railways, contemporary river names or nationwide settlement index were obtained in this release.

## How to run

```bash
python scripts/build.py
python scripts/verify_preview.py
python -m http.server 8000 --directory dist
# Browser: http://localhost:8000
```

For full geographic data regeneration (not necessary for serving the packaged data), install `basemap-data==2.0.0` and dependencies, then run:

```bash
python scripts/extract_gshhg_landcover.py --output data/landcover
python scripts/render_landcover_review.py
```

All changes can be reproduced offline **except initial community political geography and the externally loaded MapLibre runtime**. The local static preview therefore is not a fully offline national atlas; the SVG fallback is available when MapLibre/WebGL fails and boundary geometry is obtainable.

## Verification

```bash
node --test tests/*.test.mjs
python -m unittest discover -s tests -p 'test_*.py' -q
python scripts/build.py
python scripts/verify_preview.py
python tests/browser_preview.py
python scripts/release_guard.py --target preview
! python scripts/release_guard.py --target production
```

The land archive passes independent Python/Shapely topology screening, strict browser input checks, published hash checks and rollback-on-tamper tests. Browser smoke tests use mocked MapLibre, **not genuine hardware/GPU rendering**. Export accuracy and exact political geometry need further independent human and source review.

## Geographic licensing, boundaries and review

- **GSHHG 2.3.6**, attributed to Paul Wessel, Walter H. F. Smith and NOAA/University of Hawai'i; from Basemap Data 2.0.0. **LGPL-3.0-or-later**, with `COPYING.LESSER`, `COPYING.GPL`, modification/provenance files bundled. NOAA confirms GSHHG is a historical land/coast/lakes geographic source, not current survey certification.
- Political state/UT shapes are still **provisional community approximations** loaded externally if a separate licensed local boundary file is absent; the **Shaksgam discrepancy is unresolved**. No information in this release establishes sovereignty, actual administration or legal borders.
- Do not publish as the Government of India's official map or remove the source/accuracy warnings. Obtain, license and check a suitable Survey of India edition independently.

See `docs/V22_PHYSICAL_LAND_AUDIT.md` and `docs/V22_PHYSICAL_LAND_REVIEW.png`.

### Standalone map (no network needed)

Open `docs/V23_PHYSICAL_ONLY_ATLAS.svg` in any SVG-capable browser or vector graphics editor. The associated PNG is a visual-review copy, not proof of survey accuracy. Regenerate both from source as follows:

```bash
python scripts/render_physical_only.py
```

**New quality checks**: `tests/physical_only.test.mjs`, `tests/test_bundle_function_names.py`, and a browser regression that simulates loss of both community boundary endpoints. The build now rejects duplicate top-level function declarations which would silently shadow each other in the no-npm concatenation bundler.

## Executable final-roadmap-phase research modules (v0.25)

- `atlas-labs.html`: accessible from the main atlas top navigation.
- **Map Studio:** real physical GSHHG land/water, historical rivers, 71-place subset overlay, editable attributed SVG and browser PDF printing.
- **Learning:** state/UT classification quiz plus approximate city-location SVG worksheet and CSV teacher answer key.
- **Observatory:** sample record counts and place comparison, not demographic statistics; great-circle distances.
- **Dated Data:** strict session-only CSV comparison; refuses automatic time-series changes across different political boundary editions.
- **Stories:** three real-source geographic explanation scenes.
- **Release:** `scripts/audit_release_readiness.py` reports machine-readable remaining blocks for every release. No final v2.0 certification is implied.

Start locally using `python scripts/build.py` and `python -m http.server 8000 --directory dist`, then visit `/atlas-labs.html` over HTTP. Modules validate source SHA-256 with browser Web Crypto, which requires a secure context (localhost or HTTPS); opening `atlas-labs.html` directly with `file://` is not a supported workflow.

Review `docs/V25_PHASE8_11_IMPLEMENTATION_AUDIT.md` for the explicit distinction between implemented research capabilities and the unresolved production-grade requirements.

## Sprint v0.26 — Genuine WebGL evidence gate

This sprint introduces a **fail-closed genuine MapLibre proof**, not a simulated
WebGL certification. Run `python scripts/vendor_maplibre.py --fetch` on a machine
with npm access, then `python scripts/build.py` and
`python scripts/run_renderer_proof.py`. The `proof/renderer-proof.html` page uses
a real locally hosted MapLibre GL JS 5.13.0 runtime, verified local GSHHG MVT
files, and real WebGL2 rendering. No JS renderer mock is involved.

An evidence report is saved to `docs/real-webgl-evidence/real-webgl-proof.json`,
with screen captures for desktop/mobile if and only if the test succeeds.
`python scripts/check_webgl_environment.py` independently diagnoses hardware
context availability. The research preview continues to use external MapLibre
**until authentic vendor assets are installed**; it must not be described as
fully bundled or actual WebGL-verified before these checks pass.

Official boundary verification and GIS source rights remain separate release
blockers. No deployment is performed by these scripts.

## New in v0.28: reviewed transport inputs

`python scripts/prepare_detailed_layers.py --help` describes a fail-closed
path from human-reviewed **OSM-tagged local GeoJSON** to independently decoded
research MVT. Sample input and explicit rights/provenance keys are documented
in `docs/V28_DEVELOPMENT_AUDIT.md`. This is not national roads or political
geography, and the importer does not automatically ingest `.osm.pbf` files.

On Windows, run `START_LOCAL_WINDOWS.bat` from the extracted **source** folder
with Python, Node.js and the requirements installed. For the **static-preview**
archive, unzip and run `python -m http.server 8000 --bind 127.0.0.1` in the
extracted directory. Localhost is required for browser cryptographic checks.

---

## v0.35 — Inspect declared data coverage and prevent unbounded browser reads

The new **Inspect real map-data coverage at a location** section shows the actual declared XYZ tile path at a chosen WGS84 coordinate and zoom. Historical and optional contemporary research catalogues are compared independently, including their available zoom ranges and overzoom status. It works when only the physical SVG fallback is available.

Tile manifests and vector tile payloads now have streaming memory caps; source SHA-256 checks remain mandatory. See `docs/V35_COVERAGE_AND_STREAMING_AUDIT.md`. The local catalogue is not a proof of complete feature coverage or official boundary geometry. Hardware MapLibre and independent geographic acceptance remain blocked.


## India + World visitor experience upgrade (25 October 2026)
The map-first India view now offers quick search examples and a compact, accessible guide to physical layers, the separately supplied generalized national-claim outline and navigation. World Explorer adds labeled major parallels, a WGS84 latitude/longitude marker, country deep links, nearest representative-point comparisons, and a simple map/source inventory. Both continue to use the existing generalized world and supplied Survey of India-derived India outline. Nearby distances are great-circle distances **between sample geographic reference points**, not shared borders or routes. Share links identify a country **name** from the source list; they are not legal boundary evidence. The source is research-only and non-commercial where SoI data is involved.

## World Explorer reference capitals upgrade

The `world.html` map now offers **163 optional source-linked capital-location markers**
from a historical `countryinfo 0.1.2` offline dataset. Searches match country names,
Hindi country names and reference capital names. The data are not authoritative/current;
three corrupt geocodes and other missing/unsupported entries were excluded rather than
invented. This layer is off by default and can be switched on with **Capitals**.
The source hash, records, and MIT license live in `data/world/`. Regenerate only with
`python scripts/build_world_capitals.py` and the specified package version, then run
`python scripts/build.py` and the project's verification suite.
The source-verified Survey of India generalized outline remains unchanged and is
non-commercial research material—not the certified 2026 political map.


### v1.2 optional world geography

The World Explorer includes SHA-checked historical global waterways, 71 source-listed Indian city points, and a reviewed Natural Earth 10m/50m importer for states/provinces outside India, cities, lakes, rivers, peaks, and country outlines. Detailed data not bundled stays visibly disabled; no geographic coverage is invented. See [WORLD_DETAIL_IMPORT_GUIDE.md](WORLD_DETAIL_IMPORT_GUIDE.md).

## World geography v1.3 addendum (25 October 2026)

This candidate includes 1,150 GSHHG/WDBII historical simplified shore segments and 650 inland-water polygon parts in the **World Explorer**. New layer controls, source labels, zoom-stable place text and a corrected early-search camera lifecycle are included. The **India Survey of India national claim outline was not altered**. The Natural Earth detailed global admin-1 and 50m city datasets remain optional external source imports, not bundled geography. See `V1_3_WORLD_GEOGRAPHY_REPORT.md` and `WORLD_DETAIL_IMPORT_GUIDE.md`.

## v1.4 security, map-detail, and offline upgrade

See [`CRITICAL_AUDIT_V1_4.md`](CRITICAL_AUDIT_V1_4.md) for the new geometry/viewport protections, buffered streaming data validation, optional source-backed province name search, and bounded offline India-claim caching. The project's legacy internal static-build ID remains `0.38`; this is an incremental world-explorer version, **not** production approval.
