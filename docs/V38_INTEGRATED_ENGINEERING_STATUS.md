# Bharat Atlas v0.38 — Integrated engineering and acceptance status

**25 October 2026 | LOCAL RESEARCH ONLY | NO production approval**

This is a source-modifying development milestone from v0.37. It is not an Indian governmental map, a verified national basemap, a certified navigation system or a Google Maps replacement. No deployment or GitHub write was made.

## Evidence summary

- 142 JavaScript Node tests passed; 99 Python unittest cases passed.
- Existing Playwright browser smoke scenarios passed with a **synthetic MapLibre replacement**, including SVG fallback, renderer recovery and Hindi aliases. These are **not** real GPU tests.
- Build successfully produces 756 checksum-verified static assets from 26 modules.
- 608 historical source-backed MVT tile files remain bundled; no new nationwide roads or rails are claimed.
- Offline research ZIP packages the entire verified static preview; it provides static physical SVG without internet. Without authentic self-hosted MapLibre, offline GPU rendering cannot be claimed.
- Strict production-release guard rejected promotion, which is the expected result.

## Six integrated workstreams

| Requirement | New implementation | Still blocking completion |
|---|---|---|
| Contemporary nationwide roads/rails/rivers/settlements/POIs | OSM-tagged GeoJSON classification extends to POIs; MVT decoder/encoder preserves selected source attributes; reviewed regional PBF conversion entrypoint; progressive cartographic road classes | Actual 2026 India PBF/zone files not imported; partitioning/compute and ODbL compliance required; 30 MB per GeoJSON input and 25k tiles constrain current research pipeline |
| Bilingual village/address search | Incremental source-backed CSV/GeoJSON indexing, SHA-256 checked downloadable shards, browser on-demand matching using supplied Hindi/English names/aliases; seeded from 71 Natural Earth points | National authoritative addresses, PING/administrative ID mapping, complete village/POI catalogue, normalized address geocoding and Indic transliteration remain missing |
| Authentic MapLibre + physical devices | Existing pinned npm vendor procedure and unmocked WebGL proof retained; SVG recovery preserved | Authentic v5.13.0 JS/CSS unavailable in this environment; no GPU/WebGL2 or physical Android Chrome/iOS Safari proof; cannot mark these as verified |
| Authoritative political boundaries | Offline checksum- and edition-gated polygon comparison, EPSG:6933 symmetric difference, named checkpoint review, fail-closed non-publication | No licensed 2026 Survey of India vector candidate; Shaksgam and other disputed/control-vs-claim areas unresolved; explicit derivative/redistribution rights and external GIS/legal signoff missing |
| Navigation-grade routing | Source-backed road direction, vehicle access, grade-separated vertices and optional reviewed turn prohibitions; synthetic topology tests | National routable network, turn-relation extraction, access completeness, speed/ETA, road safety, snapping by nearest road segment, real-world routing acceptance missing. Current paths MUST remain 'research only' |
| Offline/performance/production | Offline static research archive with checksum validation, search shards and bounded loader; hardened static preview nginx scaffold; release guard retained | Full phone-download manager, storage quotas, real CDN traffic, cache update policy, load tests, monitoring/rollback and physical device validation; not production-ready |

## Tested changes and defects

1. Original road graph connected only exact shared coordinates, but it silently treated every road as two-way. The updated graph uses explicit oneway and vehicle access tags, excludes footway/cycleway for car mode, distinguishes bridge/tunnel/layer vertices and can prohibit supplied road-to-road turns.
2. A routing fixture demonstrated how a generous **1 km endpoint snap radius** can snap a different location to a nearby road node. Tests now assert strict snapping where topology matters. The UI continues to mark all paths as research calculations, not dependable travel instructions.
3. Original research vector tile encoder discarded metadata besides `name/kind`. Current *newly generated* tiles may retain bounded source category, name and direction tags; the decoder checks this controlled schema. Historical pre-existing tiles were not falsely upgraded.
4. Original bounded CSV place import limited catalogues to 10,000 places. A separate on-demand sharded research-search pipeline can index up to 500,000 rows with explicit 8 MB shard caps; it fails safely on oversized or unreviewed data. National dataset not included.
5. Official-reference comparison reports cannot set `officiallyCertified` or `mayBePublished` true; they only produce private spatial-difference evidence.
6. Offline archive manifests match the verified static website; ZIP extraction and a local server are still required on Windows. This is not a native downloadable mobile map app.

## File map

- `scripts/build_search_shards.py`, `src/search-shards.mjs`: source-reviewed sharded bilingual search.
- `scripts/stage_osm_regional_pbf.py`: offline, rights-checked osmium staging (requires external osmium-tool).
- `scripts/prepare_detailed_layers.py`, `scripts/build_regional_pack.py`, `scripts/build_vector_tiles.py`, `scripts/mvt_audit.py`: GIS ingestion and independent tile verification.
- `src/router.mjs`: research road graph with access, direction, grade and turn constraints.
- `scripts/compare_boundary_candidates.py`: local non-certifying political reference comparison.
- `scripts/build_offline_research_pack.py`: immutable offline research archive.
- `scripts/vendor_maplibre.py`, `scripts/run_renderer_proof.py`, `docs/REAL_DEVICE_RENDERER_CHECKLIST.md`: authentic renderer/device gate.
- `infra/`: undeployed local static hosting scaffold.
- `scripts/atlas_program.py`: reproducible integrated audit and release-block verification.

## Release criteria (do not bypass)

**No production release** until: (a) lawful source and ODbL compliance records; (b) authoritative territorial reference review with rights; (c) independent GIS topology, source date and checkpoint validation; (d) genuine desktop GPU and physical Android/iOS browser evidence; (e) real routable network safety; (f) nationwide coverage/search QA; (g) security, WCAG, load, CDN, offline upgrade and rollback tests.

## Official public source references (not bundled datasets)

- Geofabrik India OSM regional extracts: https://download.geofabrik.de/asia/india.html
- OSM copyright and ODbL: https://www.openstreetmap.org/copyright
- Survey of India political maps (2026 English 13th edition): https://surveyofindia.gov.in/pages/political-map-of-india
- Survey of India vector products/licence terms: https://onlinemaps.surveyofindia.gov.in/AboutPortal.aspx
- MapLibre GL JS: https://maplibre.org/maplibre-gl-js/docs/
- Nominatim public use limitations: https://operations.osmfoundation.org/policies/nominatim/