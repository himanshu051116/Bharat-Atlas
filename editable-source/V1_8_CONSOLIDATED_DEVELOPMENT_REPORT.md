# Bharat Atlas v1.8 — Consolidated exploration and reliability milestone

## Scope

Built from the verified v1.7 full-source ZIP. This version upgrades visitor-facing India/World exploration **without inventing boundaries, downloading unsourced data, touching GitHub, or deploying production**.

## Completed

1. **Unified geographic search.** The visible desktop and mobile search suggestions include bundled world country/territory units, source-labelled reference capitals, and locally installed named cities, administrative features, peaks, rivers and lakes. English/Hindi country aliases are supported wherever the catalogue supplies them. Result types and countries are displayed, and keyboard arrow/Enter selection works. Selecting a result focuses the map or country; no internet geocoding is implied. Exact matches are not discarded after hundreds of weaker substring matches.
2. **Source-feature inspector.** Focusing an installed natural-geography feature reveals its name, category, available country reference and its source point coordinates or geographic extent. The inspector expressly excludes legal-boundary and navigation certification.
3. **Geographic scale.** Equirectangular world view shows a dynamic approximate kilometre ruler derived from actual SVG screen geometry and the viewport-centre latitude; updates on zoom, pan and resize. It is not a geodesic map projection or measurement instrument.
4. **Cartographic legibility.** Fixed country labels that used to become disproportionately large at close zoom. Labels now maintain screen-pixel-sized typography and suppress overlaps. Removed clipped mobile distance control by allowing toolbar wrapping.
5. **Maintained data provenance.** The same data/official-india/india-claim.geojson, its manifest, and world-boundaries JSON were verified byte-for-byte unchanged against the v1.7 source ZIP. No new territorial geometry was fabricated.
6. **Consistent build:** deterministic v1.8 source and manifest; refreshed same-origin offline shell cache and source tests.

## Tests and independently observed limits

- 143 legacy ESM JavaScript tests passed.
- 16 CommonJS JavaScript tests passed (including 6 new search/scale tests).
- 110 Python `unittest` tests passed.
- v1.8 static preview manifest: **782 integrity-verified files** (as reported by `scripts/verify_preview.py`), no official-boundary certification.
- Desktop and mobile Chromium interactions passed in the **isolated HTML test with simulated SubtleCrypto digest and local fetch**: unified country search, capital keyboard search, city selection, source feature information, distance scale and no page exceptions. The downloadable source contains the runnable test: `tests/browser_world_v18_isolated.py`.
- A direct localhost Chromium test was **blocked by this execution environment** (`net::ERR_BLOCKED_BY_ADMINISTRATOR`). Consequently, localhost Web Crypto integration, true offline revisit on Windows, hardware GPU and physical-device acceptance are **not verified**.
- Publisher downloads for higher-detail global data were unreachable from the container (DNS failure). The **full Natural Earth 1:10m provinces and 1:50m populated places, peaks, river/lake packs are not included**. The research installer stays available in the full-source ZIP. Existing 71 source-listed India cities, historical hydrography and legacy capital references remain.

## Boundaries and licensing

- The Survey of India–derived national claim outline is generalized, source-declared and stored separately from Natural Earth world geography. A point being inside the polygon does not certify the official 2026 political map or current administrative control.
- Indian states/districts do **not** have verified polygon geometry in the research preview. Do not represent this as an official 28-state/8-UT or district-boundary map.
- Source restrictions for the Survey of India outline preclude assuming unconditional commercial redistribution; see `BOUNDARY_SOURCE_AND_USAGE_NOTICE.md` and `README_OFFICIAL_INDIA_CLAIMS.md`.
- Natural Earth reference map units are generalized and may not represent present-day legal borders or all smaller territories.

## Remaining requirements before v2.0

1. Source-backed import of comprehensive Natural Earth world data and measured test coverage.
2. Legally permissible, independently reviewed India state/UT and district geometries consistent with official source and claim notices.
3. Locale-appropriate geography labels and search in all supported layers; render/label-collision performance trials with full datasets.
4. Real local HTTP/HTTPS test with native Web Crypto, physical Android/iOS/Windows acceptance, accessible keyboard/touch and offline-cache validation.
5. Release rights and boundary provenance review before any public deployment.

## Run locally

Extract `Bharat_Atlas_v1_8_Windows_Preview.zip` on Windows, run `START_PREVIEW_WINDOWS.bat`, then open `http://127.0.0.1:8000/` for India or `/world.html` for world. For source development, run `python scripts/build.py`, `python scripts/verify_preview.py`, `node --test tests/*.test.mjs tests/*.test.cjs` and `python -m unittest discover -s tests -p 'test_*.py'`.
