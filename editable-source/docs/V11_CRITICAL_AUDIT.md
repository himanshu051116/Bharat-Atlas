# Bharat Atlas v0.11 — Critical local development audit

**Status: local-only research build. No GitHub changes and no Vercel deployment.** This is not a verified political map, certified GIS dataset, or Google Maps alternative yet.

## Root causes and fixes implemented

| Confirmed issue | v0.11 correction | Validation |
|---|---|---|
| Sparse `.pbf` archives generate HTTP 404s for tiles that legitimately contain no features | `atlas-detail://` MapLibre custom protocol checks the tile index and returns an empty MVT tile without any network request for absent coordinates | JS unit test and mocked browser protocol smoke test |
| Checksums alone cannot detect an incorrectly encoded tile whose digest is also updated | A separate protobuf decoder checks layer names, keys/values, MVT v2, command structure, decoded coordinate bounds, feature types and feature properties | Python adversarial tests and bundle-time semantic audits |
| Mixed/nested Shapely geometry collections could omit clipped linework | Recursive line/point extraction before MVT encoding | Nested collection round-trip test |
| Rebuilding a tile pyramid deleted the previous valid archive before finishing | Generate into a temporary sibling directory, independently audit, then replace the archive; restore the previous archive on interrupted replacement | Forced-error rollback test |
| Hash manifest was dropped by the JavaScript validator | Preserve a frozen hash index for runtime sparse tile lookup and verification | JS source/digest tests |
| A recognized tile file might be altered after build | The browser's custom protocol verifies SHA-256 before passing its bytes to MapLibre | Tampering rejection unit test |
| Bundling a malformed but correctly rehashed tile could pass the static builder | Build now performs a full semantic MVT scan before copying locally licensed tiles | Python build rejection test |

## What has *not* been achieved

1. **No official Survey of India 2026 Shapefile has been integrated.** Pakistan-administered Kashmir, Gilgit-Baltistan, Aksai Chin and the Shaksgam Valley still require authoritative boundary review.
2. **No real production road/river/settlement dataset is included.** The static preview is boundary-only and may require an internet connection to obtain a pinned community preview. The MVT fixtures are explicitly fictional and kept in `tests/`.
3. **MapLibre JS/CSS is not locally bundled.** The browser smoke tests inject a fake MapLibre renderer. A genuinely rendered WebGL map has not been independently verified in this environment.
4. **No professional PDF/SVG export for the MapLibre viewer, directions, address geocoding, satellite imagery, live traffic or verified 1,000-user load test.** These are future work, not finished features.
5. The prototype should not be used as evidence of an official Indian border, legal survey boundaries, or guaranteed India territorial coverage.

## Verifiable local commands

```bash
node --test tests/*.test.mjs
python -m unittest discover -s tests -p 'test_*.py' -v
python scripts/build.py
python tests/browser_preview.py
python scripts/mvt_audit.py tests/fixtures/generated
python scripts/release_guard.py --target preview
python scripts/release_guard.py --target production  # deliberately fails
```

## Next most important work

**Data:** Obtain and license the Survey of India vector geometry; independently compare every administrative polygon and disputed territory, preserving geometry provenance.

**Renderer:** Install and lock MapLibre GL JS/CSS, exercise actual WebGL and inspect rendered tile coordinates/labels in Chromium, Firefox and mobile browsers. Validate the custom protocol against true MapLibre rather than a stub.

**Map content:** Use licensed, current place/road/waterway data, preferably preprocessed to PMTiles or vector tile pyramids; the hand-written sparse builder is a QA-first tool for modest datasets, not a high-scale tiler.

**Launch:** Build a server/CDN tile-request workload with warm and cold caches, gather real-user performance results, and do not release as official until geographic, legal and rendering gates are passed.
