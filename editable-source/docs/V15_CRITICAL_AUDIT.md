# Bharat Atlas v0.15 — Critical engineering audit

## Release decision
**LOCAL RESEARCH BUILD ONLY. NO DEPLOYMENT. NO GITHUB MUTATION.**
The public research preview remains on its earlier version. Do not represent this code as a verified political map, navigational map, or Google Maps competitor with nationwide data coverage.

## Changes implemented in this cycle

1. Created a non-destructive offline CSV gazetteer importer. It requires the actual source URL, documented licence, attribution, declared WGS84 coordinates, valid Indian state/UT associations, unique place IDs, reasonable aliases and a limit of 10,000 points per review dataset.
2. Generated deterministic `places.geojson` and `manifest.json`, including SHA-256 of geographic content and source CSV. The resulting place dataset is optional, explicitly provisional and separate from political boundary verification.
3. Added a bounded, checksum-verified browser loader for optional gazetteers, independent of the political-boundary request. A bad optional gazetteer never blocks the core atlas.
4. Integrated searching in English or native scripts (including Devanagari) across available user-provided places, displayed with category and state/UT context. Distinct place IDs prevent similarly named places from being confused during selection.
5. Added zoom-dependent MapLibre place point and label layers, highlighting for selected gazetteer places, and contextual source attribution. Importing unrelated custom political geometry hides both pilot cities and the gazetteer.
6. Added a strict optional-bundling gate: actual location files and their metadata must match SHA-256 and pass schema/identity validation. A failed build preserves the previously valid static package.
7. Fixed an actual packaging regression discovered in the new tests: optional gazetteers were initially staged twice. The build now excludes the source gazetteer folder from the general data copy, then includes it exactly once after validation.
8. Made search results use Unicode letter/digit/mark matching so Indian-language diacritics are preserved. Reduced fuzzy search processing by performing it only when direct matches are insufficient.

## Test evidence and limits
- 56 JavaScript unit tests: passing, including Web Crypto checksum checks, malformed place data and native-script search.
- 36 Python tests: passing, including authentic CSV-to-review conversion, integrity and failed-build rollback.
- Isolated Chromium interaction suites: passed on desktop and mobile using a mocked MapLibre renderer and synthetic geometry; positive gazetteer test covers Hindi search, map focus, attribution, style change, and isolation from imported political maps.
- Browser test environment uses an explicitly mocked checksum **only in the UI integration test**, because the `about:blank` fixture is not a secure context. The JavaScript unit tests verify checksums with a real crypto implementation.
- No authenticated real MapLibre/WebGL test, live host test, official GIS comparison or 1,000-concurrent-user test was performed.

## Material remaining blockers
- **Authoritative 2026 geometry**: official Survey of India boundary data and the specific licence required for public reproduction are still absent. Shaksgam and other sensitive claimed/administered areas remain unresolved against the official reference.
- **Real map engine**: local MapLibre vendor assets not available; the project still links a remote dependency. WebGL rendering cannot be certified from these tests.
- **Place coverage**: optional gazetteer loader works, but **no real licensed nationwide gazetteer is included**. Pilot cities remain demonstrations; fake places exist only in tests.
- **Road detail**: no approved nationwide basemap tile archive, complete addresses, routable network, live traffic or terrain/satellite assets.
- **Professional exports**: only research SVG using the loaded outline is available in the MapLibre viewer; current zoom/pan, 8K PNG and printable PDF are not production-grade.
- **Capacity/performance**: no genuine GPU device benchmarks, realistic tile cache traffic, independent accessibility audit or concurrent-user test.
- **Scalability of search**: browser-side linear lookup of 10,000 place names is suitable only for small research extracts. Nationwide geocoding needs a dedicated index and paginated/spatial search before broad release.

## Priority after v0.15
1. Secure legally usable official geometry; validate topology and border depiction against the official 2026 publication with a GIS expert.
2. Install and license a genuine local MapLibre distribution, then verify real WebGL and cross-browser camera, label, hover and touch behavior.
3. Obtain and independently review genuine licensed place data; the new gazetteer path can consume it without changing the main UI.
4. Introduce vector basemap data and performance budgets, replace the pilot place index with a scalable place/search service, and implement professional print exports.

There is no production approval and no operational claim of Google Maps feature parity.
