# Bharat Atlas v0.28 — engineering continuation, 24 October 2026

**Status:** LOCAL RESEARCH PREVIEW; **production NO-GO**. This is a continuation of the user's existing v0.27 source archive, not a newly invented visual demo. No public deployment, GitHub commit, licensed political-boundary acquisition, or physical mobile certification is claimed.

## Implemented and actually inspected

### 1. Authentic MapLibre dependency integrity
- `scripts/vendor_maplibre.py` now needs an independent registry-published SHA-512 `dist.integrity` value for the original npm tarball. It refuses absent/mismatched values before inspecting package contents. `--fetch` requests registry metadata independently; `--tarball` requires `--npm-sha512`. A caller must obtain the offline digest from a trusted source, not derive it from untrusted bytes.
- The installer validates identity/version, checks included JavaScript/CSS/licence, records the tarball SHA-256 and per-file SHA-256, stages the installation and restores a previous vendor on an installation failure.
- The builder rejects vendor provenance without checksum fields; the browser proof independently rechecks the bundled JS/CSS/licence hashes. A build can establish local integrity only to the supplied provenance record; it cannot by itself prove the registry metadata was independently trusted.

### 2. Strict unmocked renderer and navigation proof
- The proof rejects unexpected MapLibre versions and expects real WebGL2, source-backed verified MVT bytes, rendered physical line features and settlements, a nonempty preserved canvas readback and a real MapLibre canvas; explicitly identified software WebGL renderers cannot satisfy the hardware proof gate.
- Chromium automation now exercises desktop mouse dragging, mobile-*emulated* Chrome touch input via CDP, wheel zoom and return to original map center/zoom; an idle map is not counted as a successful interactive proof. Failures/errors prevent promotion.
- The present execution environment has **neither an authentic vendored MapLibre JS bundle nor usable Chromium WebGL2**. Therefore **no unmocked proof has passed**; expected runner outcome is `blocked_missing_local_renderer`, exit code 2.

### 3. Optional local transport/settlement preparation
- Added `scripts/prepare_detailed_layers.py`. It consumes user-supplied, OSM-tagged WGS84 **GeoJSON**, NOT a nationwide PBF or remote tile service. It requires explicit research-preview redistribution review, source URL, snapshot date, attribution, licence and original source SHA-256.
- It classifies source-backed named/unnamed roads, rail lines and waterways, and named settlement points, clips to a declared 60–102°E, 3–41°N *research window* (which includes neighbouring territory), rejects invalid input and produces layer GeoJSON plus `tile-source.json` with provenance for `build_vector_tiles.py`.
- Tests successfully convert one synthetic source record of each type into independently decoded actual MVT tiles. **No real nationwide roads, railways, current named rivers, complete settlement inventory, OSM PBF ingestion or published map detail has been added.**

Example after obtaining explicit rights review and a file from a permitted source:

```sh
python scripts/prepare_detailed_layers.py --geojson /path/to/reviewed-local-extract.geojson --source-metadata /path/to/reviewed-source.json --output local-output/prepared
python scripts/build_vector_tiles.py --roads local-output/prepared/roads.geojson --railways local-output/prepared/railways.geojson --rivers local-output/prepared/rivers.geojson --settlements local-output/prepared/settlements.geojson --source-metadata local-output/prepared/tile-source.json --output local-output/transport-tiles --minzoom 4 --maxzoom 8
```

Provide only those layer switches whose GeoJSON was actually emitted. An example source metadata structure (replace placeholders with reviewed evidence):

```json
{
  "officiallyVerified": false,
  "redistributionReview": "approved_for_research_preview",
  "sourceSha256": "<64 lowercase hex digits of actual file>",
  "sourceUrl": "https://www.openstreetmap.org/copyright",
  "licence": "ODbL-1.0 (review obligations before distribution)",
  "attribution": "© OpenStreetMap contributors",
  "snapshotDate": "2026-10-24",
  "coverageClaim": "regional_extract"
}
```

**Do not** claim the review marker itself grants redistribution rights, or silently replace the v0.27 production data with sample or clipped research files.

## Verification / limitations

- `python scripts/build.py` and `python scripts/verify_preview.py`: pass, 645 static assets locally verified.
- `node --test tests/*.test.mjs`: pass, 103 tests.
- `python -m unittest discover -s tests -p 'test_*.py' -q`: see accompanying run output for final count.
- `python tests/browser_preview.py`: pass, desktop/mobile-emulated mocks, SVG and fallback. No real MapLibre or GPU proof.
- `python scripts/run_renderer_proof.py`: **blocked**, exit 2. No images of actual hardware rendering.
- `python scripts/release_guard.py --target production`: **blocked**, exit 1, as intended.

Remaining P0 release gates: authentic MapLibre from trusted registry and WebGL2 desktop test; physical Android Chrome and iOS Safari; licensed and human-reviewed Survey of India vector geometry and northern-region claim/control distinctions; current nationally comprehensive licensed basemap detail; source-aware place geocoding and attribution; real performance, accessibility, print and load testing.
