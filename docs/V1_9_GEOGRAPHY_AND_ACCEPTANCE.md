# Bharat Atlas v1.9 — Geographic Search & Rendering Hardening

Date: 26 October 2026  
Status: **Local research development candidate**, not a certified or production-ready atlas.

## What changed since v1.8

1. **Persistent browser-side search index.** `world-explore-search.js` now indexes source-backed country, historical capital, installed city, province, lake, river, and mountain names one time rather than rescanning every geographic feature on each keystroke. Both English and supported Hindi/diacritic-insensitive queries retain exact/prefix/substring ranking. `world-detail.js` invalidates the index whenever newly verified detail layers or capital records become available. No online geocoding or newly invented place names.
2. **Polygon/line spatial-envelope index.** `world-detail-geometry.js` now indexes bounding boxes of installed country/province/river/lake features into map cells. `world-detail.js` queries geographic envelopes in/near the current view, filters administrative boundaries by selected country, and maintains conservative visibility for shapes crossing the date line. No geometry or political border is edited.
3. **Bounded repaint scheduling.** World place markers and labels are regenerated only after meaningful pan/zoom changes, because the SVG camera itself already moves existing shapes between updates. Layer toggles still force refreshes.
4. **Test and version contracts.** v1.9 build manifest and offline service-worker cache identifier updated. Source and Windows preview remain separate. Added unit tests for 18,000 synthetic searchable place records and 13,000 synthetic indexed geographic envelopes. Added desktop/mobile isolated-browser integration tests for source-installed city search and temporary administrative-layer fixtures.

## Measured synthetic performance (local Node environment; not phone benchmarks)

Using **18,000 synthetic city features** and **100 search queries**:

| Operation | Observed local time |
| --- | ---: |
| Build the offline search catalog once | ~131 ms |
| Query the reusable catalog 100 times | ~98 ms |
| Run the legacy `find` API 100 times (rebuilds each time) | ~10,771 ms |

These are diagnostic fixture measurements, not guarantees for actual worldwide Natural Earth data, slower phones or the bundled 71-city catalog. The v1.9 interface uses the reusable catalog; the backwards-compatible `find` test API retains the old signature.

## Verification

- **164/164 Node tests passed.**
- **111/111 Python tests passed**, plus six Python unittest subtests. One existing Shapely runtime warning relates to the deliberate invalid-geometry test fixture.
- **782 build assets hash/size verified.** The preview manifest reports v1.9.
- **Desktop and mobile isolated Chromium tests passed** for unified search, reference capital navigation, source-listed city inspection, approximate scale and no uncaught errors; **SHA-256 was simulated inside isolated Chromium**. Build hashes were independently checked against actual local files.
- **Desktop/mobile synthetic province test passed**: only one viewport/country-relevant polygon displayed after the source feature was selected. The synthetic polygons are **not** distributed as geography.
- **Real localhost Chromium attempt failed** with `net::ERR_BLOCKED_BY_ADMINISTRATOR`, an environment restriction. Native browser cryptography over localhost, actual hardware rendering and physical Windows/Android/iOS acceptance remain unverified.
- **India claimed outline unchanged byte-for-byte** from v1.8. SHA-256: `41755f415288ed375bae81a52fa977cd8061e9f5da8424de0f98326674b588ff`.

## Geographic data inventory: what is and isn't present

Bundled: 177 generalized legacy world country/territory map units; 163 historically sourced reference capital points; 71 selected source-backed Indian city points; historical unlabeled world waterways (7,000 generalized segments); historical coastlines (1,150 segments) and inland water (650 shapes); a separately sourced generalized Survey of India claimed national outline.

**Not bundled:** a full Natural Earth 50m worldwide populated-place file, 10m province polygons, current named river/lake/peak files, verified official Indian state/UT or district polygons. The Natural Earth publisher could not be reached from this runtime (DNS/connection failure). No synthetic boundary or place geometry was inserted into published assets. The existing `FETCH_WORLD_GEOGRAPHY_WINDOWS.bat` installer remains the reproducible import route for a connected machine, with source ZIP/component hashes and fail-closed manifest verification.

- Natural Earth downloads and reuse information: https://www.naturalearthdata.com/downloads/
- 50m populated places: https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-populated-places/
- India outline source: https://surveyofindia.gov.in/pages/outline-maps-of-india

## Licensing/political boundaries

The India national outline is the **source-declared, display-generalized 1:16 million Survey of India claim**, not an independently certified match to the 2026 political map; source metadata explicitly records `provenanceReviewed=false`, `politicalMap2026GeometryMatched=false`, and `commercialRedistributionAllowed=false`. Derived files must not be redistributed commercially without an appropriate rights review. Natural Earth admin-1 Indian polygons are intentionally excluded because they cannot substitute for India's official administrative claim depiction. Existing historical physical-geography sources retain LGPL-3.0-or-later notices.

## Local use on Windows

Extract the Windows preview and run `START_PREVIEW_WINDOWS.bat`; open `http://127.0.0.1:8000/world.html` for World or `/` for India. For the editable source version, install the documented geographic Python dependencies on a network-connected Windows PC and run `FETCH_WORLD_GEOGRAPHY_WINDOWS.bat`, then the provided build verification. Do not distribute or deploy until the Survey of India data rights and geographic representation are reviewed.

## Remaining release blockers

1. Import and validate full Natural Earth world geography on a network-connected machine; test real city/river/state query performance rather than fixtures.
2. Obtain appropriate Government of India administrative polygons or explicitly scope India state/UT coverage to a verified names directory, without misleading borders.
3. Independent 2026 political-map comparison, licensing, WebGL2/physical-device, offline and accessibility acceptance tests.

No GitHub/Vercel changes or deployment made.