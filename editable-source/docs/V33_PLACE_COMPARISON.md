# Bharat Atlas v0.33 — Source-backed place comparison

**Status: local research development build. No production release approval.**

## Delivered changes

1. **Pair comparison:** a separate accessible panel with two selectable entries from the loaded Natural Earth place catalogue. It does not introduce fictional settlements or reuse unrelated political polygon imports as place facts.
2. **Spherical geometry:** haversine distance, forward and reverse initial great-circle bearings, eight-sector compass description, spherical midpoint and 48-segment great-circle polyline. Earth mean radius 6371.0088 km. These are approximate geographic values, not surveying measurements or travel routes.
3. **Two visualization paths:** source/layers in the existing MapLibre v8 style, and a projected polyline with two dots in the existing SVG fallback when WebGL is unavailable. Existing selection, source attribution, and cartography remain intact.
4. **Motion and accessibility:** Fit the selected pair on the map with bounded animation; obey prefers-reduced-motion. The comparison requires explicit user selection and offers Swap, Clear, and a browser-local JSON/GeoJSON export.
5. **Integrity gates:** Add both new modules to the deterministic bundle; extend preview verifier and retain official-geometry and production-release blocks.

## Verification (24 October 2026)

- `node --test tests/*.test.mjs`: **123 passed / 0 failed**, including four new comparison-math tests.
- `python -m unittest discover -s tests -p 'test_*.py' -q`: **92 passed / 0 failed**.
- `python scripts/build.py`: succeeded with **648 static assets**.
- `python scripts/verify_preview.py`: succeeded, **23 modules / 648 assets**, no official-geometry claim.
- `python tests/browser_preview.py`: passed using mocked MapLibre interactions, with additional source-backed comparison swap/focus/clear/export and explicit no-MapLibre SVG comparison checks.
- `python scripts/release_guard.py --target production`: correctly **BLOCKED**. No live deployment or external hardware acceptance performed.

## Limits

Real MapLibre GL/WebGL2 GPU proof is not available in this environment and no Android or iOS device has been tested. No 2026 Survey of India verified political vector geometry or redistribution rights have been acquired, and Shaksgam/northern territory GIS review remains incomplete. No nationwide current roads, railways, named rivers, address geocoding or navigation-grade road routing are bundled. The limited Natural Earth places dataset is NOT a complete or precision-surveyed national gazetteer. Comparison lines must never be presented as real travel routes, actual borders, or official cartographic products.

## Next development prerequisites

- Source modern, permission-reviewed road/rail/waterway/settlement data, audit coverage and provenance and generate scalable countrywide MVT pyramids.
- Acquire authorized SoI political vectors and conduct independent territorial comparison and rights review.
- Validate real MapLibre browser rendering on physical desktop, Android and iOS, then complete security, performance and accessibility acceptance.

**GitHub and Vercel unchanged.**
