# Bharat Atlas v0.12 — Local-only critical engineering audit

**Deployment:** No GitHub or Vercel changes. The pre-existing live research preview has not been touched. This is NOT a certified national map.

## Actual v0.12 implementation

| Issue | Resolution | Verification |
|---|---|---|
| No scalable vector export in the MapLibre viewer | Added source-labelled SVG exporter for all India or selected state/UT, maintaining islands and holes with even-odd fill | Five SVG unit tests; browser download smoke test with synthetic polygons |
| Locally bundled geography could change after build without client detecting it | Browser checks SHA-256 of downloaded GeoJSON against provisional metadata | Unit tests for correct and incorrect digests |
| A broken local file could silently trigger a remote fallback | Once valid local metadata is found, missing or corrupted file produces an explicit failure | Unit tests ensure remote fallback is not used after local metadata is present |
| Invalid candidate build could remove previous valid static output | Build uses staging and preserves previous release on failure | Python atomic build regression test |
| Optional tile integrity errors were ignored in rendering log | Visible degraded-detail status and console warning | JavaScript syntax/browser smoke; complete actual WebGL failure handling still unverified |

## Limitations and accuracy boundaries

1. The map geometry is NOT official, and no Survey of India 2026 authoritative geographic archive has been incorporated. GIS disputes and the Shaksgam discrepancy remain unresolved.
2. The SVG's equirectangular display projection uses a single latitude-dependent horizontal correction; it is designed for an attractive overview, not surveying, area measurement or precise map scaling. Region label placement is approximate and may collide in densely packed areas. An SVG export is not proof of geometric accuracy.
3. The self-hosted GeoJSON digest detects accidental drift, corruption or mismatched transfers. If an attacker can replace the data *and* its metadata, this self-declared hash is not cryptographic source authentication. Authenticated trusted signatures and CI source pins would be needed for that.
4. Chromium page-content tests use mocked MapLibre. Genuine MapLibre WebGL and visual rendering remain unverified because the rendering package is not locally accessible; no Google Maps-quality rendering claim is made.
5. Public map data still depends on a remotely pinned community preview unless a properly licensed local dataset is bundled. The release contains NO real nationwide roads, rivers, addresses or imagery.
6. No documented 1,000-user load test, cross-browser QA or official-map use licence. The production guard deliberately blocks launch.

## Next recommended stage

Prioritize acquiring legitimate official reference data, then complete boundary-review evidence for all 36 top-level units and disputed areas. Vendor MapLibre with its licence and test actual WebGL, tile integration, label positions and mobile performance. After that, ingest a licensed nationwide roads/waterways/settlement dataset, and add tile-based place search.

## Reproduction

```sh
node --test tests/*.test.mjs
python -m unittest discover -s tests -p 'test_*.py' -v
python scripts/build.py
python tests/browser_preview.py
python scripts/release_guard.py --target preview
python scripts/release_guard.py --target production # Expected failure
```
