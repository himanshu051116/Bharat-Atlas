# Bharat Atlas v1.4 — Critical engineering review and source upgrade

**Scope:** India + World Atlas visitor experience, derived from the supplied v1.3 source. This is a **local research build**; the application's historical internal build contract remains `0.38` for compatibility. No remote deployment, repository write, boundary invention, or official certification took place.

## Engineering defects addressed in this iteration

| Priority | Reproduced / audited issue | Code change and outcome |
|---|---|---|
| P0 | A geographic HTTP response with unknown Content-Length could be fully buffered before the browser rejected an oversized world-detail file. | `world-detail.js` now enforces a byte ceiling while reading the stream, cancels an oversized stream, verifies SHA-256, then decodes JSON. A simulated unknown-length oversized response is rejected in Chromium. |
| P0 | Loading the official India claim outline, world boundaries and capital references similarly relied on whole-body reads before enforcing all size limits. | `world.js` now uses bounded streaming for those three actual datasets. The source SHA-256 check and the separate India-claim display contract are retained. |
| P1 | Detailed state/province paths were rendered from the first input features without viewport filtering. A visible province could be omitted while offscreen features consumed the path budget. | `world-detail.js` calculates and validates geometry bounds, rejects invalid coordinates, culls offscreen features with a conservative margin and caches generated SVG paths. Browser tests with **synthetic test provinces** confirm only the viewport-overlapping selected-country province is displayed. |
| P1 | Optional map geometry could be rebuilt on every animated camera frame, even for insignificant panning. | Buffered viewport thresholds and frame scheduling now reduce redundant polygon redraws; city markers continue to update during movement. |
| P1 | Users could search source-listed cities but not installed non-Indian states/provinces directly in the world-detail results. | Search results now include installed admin-1 names, show their classification, select their country, activate the province overlay and focus the source polygon. They are explicitly identified as *generalized*, not government-certified. |
| P1 | The 3 MB offline cache ceiling excluded the approximately 3.9 MB source-checked India claimed outline and could leave an offline return visit without the saved boundary. | `offline-shell.js` adds the source outline, manifest and limited city details to the shell list, with a *specific* 5 MiB bound for the India GeoJSON and the existing 3 MiB bound elsewhere. This is static-path/cache-policy verification, not a full physical offline-browser acceptance test. |

## Checks actually performed

- `node --test tests/*.test.mjs`: **143 passed**, 0 failed.
- `python -m pytest -q tests/test_*.py`: **108 passed**, 1 expected upstream Shapely warning; 6 subtests passed.
- `python scripts/build.py` and `python scripts/verify_preview.py`: **778 static files verified**, no missing files, non-production guard remains set.
- `python tests/browser_world_detail.py`: historical river, map layer, city-search and focus scenarios **passed on desktop and mobile Chromium**, with a simulated digest in the isolated test harness.
- `python tests/browser_world_v14_hardening.py`: viewport-culling and province search **passed on desktop and mobile** using **synthetic test-only province polygons**; an unknown-length oversized map response was **rejected**.
- Actual India-claim GeoJSON unchanged byte-for-byte from input v1.3 source archive; no guessed political boundaries added.

## Remaining blockers and product risks

**Geographic substance (high priority):** The installed world-country layer is still a legacy Natural Earth 1:110m generalized reference (177 features). The extended installed city layer still contains 71 source-listed Indian places, with the older capital-point reference layer separate. Complete Natural Earth 1:50m populated places, global 1:10m states/provinces, and current named lakes/rivers/peaks are **not included**. Province search activates only after a permitted source dataset is imported.

**Sovereignty and provenance (high priority):** The supplied Survey of India–derived India national outline is a *generalized source-declared claim outline*. It is not a validated edition-matched 2026 political map; no state/district administrative polygons, international control lines, or certified dispute geometry were added. Commercial reuse of that source must not be assumed.

**Rendering and offline/device acceptance (high priority):** SVG map paths and desktop/mobile Chromium browser interactions were tested, but actual low-end Android/iOS devices, full screen-reader audits, offline service-worker behavior on a real phone, and hardware MapLibre performance are not proven.

**Performance (medium priority):** Large imported 1:10m multi-polygon detail packs should ultimately be tiled and decoded incrementally instead of being kept as monolithic client-side GeoJSON. The new viewport/caching logic improves the current SVG viewer but is not a substitute for a proper vector-tile architecture at very high zoom.

**Search coverage (medium priority):** Bilingual translations are available for some countries and India's 36 administrative region names. Place-name variants and up-to-date international administrative names still need a verified broader data source. Country/capital directory reference records are not certified current facts.

## Next highest-impact work

1. Import and record the exact current Natural Earth 1:50m populated-places and 1:10m admin-1 data, excluding India admin-1 from claims-layer use. Preserve source download URL/version/checksum and re-run integrity and browser tests.
2. Build a continent/country-level vector-tile or spatially partitioned detail-pack pipeline for truly smooth higher-zoom international geography.
3. Improve cartographic styling for real imported city and province features with zoom-aware label ranking and conflict management.
4. Establish authorized political boundary data and edition checks for India's states and districts; disclose differences between claims and actual control.
5. Finish real physical-device, accessibility, and offline-first acceptance before any public release.

## Source and rights references

- [Natural Earth downloads](https://www.naturalearthdata.com/downloads/) — public-domain, multi-scale research cartography; **not** authoritative legal boundaries.
- [Survey of India political map](https://surveyofindia.gov.in/pages/political-map-of-india) — official political-map reference, with separate digital geometry and reuse conditions.
- `BOUNDARY_SOURCE_AND_USAGE_NOTICE.md` and `README_OFFICIAL_INDIA_CLAIMS.md` contain the inherited boundary source/usage restrictions.