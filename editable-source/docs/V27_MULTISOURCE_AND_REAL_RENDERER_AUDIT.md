# Bharat Atlas — v0.27 evidence-led engineering audit

**Status: LOCAL RESEARCH PREVIEW ONLY. Core v1.0 not approved.**

## Implemented in this sprint

- Rebuilt the deterministic vector archive from previously authenticated local GSHHG historical rivers (1,723 segments), coastlines (39), lake shores (93), and the 71 existing Natural Earth 1:50m selected city coordinates. **608 `.pbf` tiles, zoom 3–8**; because tile coverage overlaps the prior archive, tile count did not have to increase.
- `settlements` is now an actual decoded MVT feature layer, not merely a separately rendered collection of city dots. The generated tiles contain 426 settlement tile occurrences due to repetition across zoom levels, **not 426 distinct towns**.
- Added layer-specific licence and SHA-256 provenance into the MVT catalogue. GSHHG/WDBII is identified as LGPL-3.0-or-later, Natural Earth as public domain. The tile decoder, static build and browser-side manifest validator reject missing/falsely verified layer source records.
- Eliminated duplicate gazetteer dots when MVT settlements are active, while preserving city search and map selection.
- Added optional `railways` MVT layer support and a dedicated cartographic style **without claiming that any rail lines have been sourced**.
- Improved the unmocked MapLibre proof: counts verified local tile bytes *after* SHA-256 validation, requires visible physical lines **and** real MVT settlement points, inspects WebGL2 and canvas readback, and separately reports software vs hardware/unknown renderer.
- Fixed a real MapLibre npm installation defect: the standard npm package's `LICENSE.txt` lives in `package/`, not necessarily under `package/dist/`. The installer can still read the legacy alternative.
- Added verified-data coverage and pending official geography gates.

## What these results do not prove

**Real MapLibre still not successfully run in this container.** The MapLibre v5.13.0 distribution is not available locally and this environment cannot resolve the npm CDN; available Chromium creates neither WebGL1 nor WebGL2. The proof script therefore fails CLOSED. No real MapLibre performance, Android hardware, iOS hardware or high-volume load measurements are claimed.

**Official political geography is still unverified.** The Survey of India English 13th-edition 2026 political map is an official *reference*, with Government of India copyright. Its Shapefile source, reuse rights and exact vector comparison have not been established. Shaksgam, Gilgit-Baltistan and Aksai Chin require documented manual GIS review. No new Indian political boundaries were invented here.

**Modern transport detail is missing.** Nationwide real roads, railways and named current rivers were not obtained. The installer accepts licensed road/rail line GeoJSON as future inputs, but the shipped tiles contain neither. Selected Natural Earth city points are incomplete, dated cartographic data, not address-level geocoding.

## Acceptance gates

1. A trusted network machine must `python scripts/vendor_maplibre.py --fetch` and then run `scripts/build.py`; the exact checked assets must be included in the preview.
2. Run `python scripts/run_renderer_proof.py` on a browser with a *real* WebGL2 context. It must pass desktop and mobile-emulated viewports with screenshots, verified bytes, nonzero rendered line and settlement features and no critical browser errors. Do not relabel emulation as physical-device testing.
3. Run a separate physical Android Chrome and iOS Safari test with touch gestures, source selection, zoom, label layout and memory. Test reports must identify device/OS/browser versions.
4. Obtain reviewable authorised Indian political geometry, confirm redistribution permission and compare against Survey of India 2026 reference. Report all unresolved disagreement before national-map claims.
5. Acquire legally reusable modern roads/railways/waterways data, construct production-scale tiles, and validate sample localities across every state/UT and special border area.

**Production decision:** no-go. No GitHub changes or live deployment.
