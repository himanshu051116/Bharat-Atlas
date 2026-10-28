# Bharat Atlas v0.24 — Settlement Data & Engineering Audit

**Release type:** Local research preview only · **Production:** blocked · **Deployment/GitHub:** unchanged.

## Purpose

Add genuine source-derived place labels and geographic search to the existing physical-research atlas. This is not a cadastral, district, road or address dataset and does not establish any territorial claims or survey certification.

## Source and selection

- Dataset: **Natural Earth 1:50m populated places** (public domain), pinned upstream Git blob `f692f6a1311569612a2d3fbb3554e97ec0bfe64c`.
- Source file: `https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_populated_places.geojson`; licences: https://www.naturalearthdata.com/about/terms-of-use/.
- 71 records with the upstream attribute `ADM0NAME=India` were reviewed and placed in `source-data/natural-earth-50m-india-places.tsv`. Subset SHA-256 `9bef07c58379fe977444a6cc0915346f033d6ba0899343cbc5f85eee2054d0d8`. This is not a geometrically checked political definition of India.
- The input is a **source-backed sampling of cities**, not every Indian town/city/village or even every state capital. It may miss the user-required Indian-claimed territories; it carries no independently verified borders.
- Names are upstream English spellings and Hindi aliases. Selected search aliases include Prayagraj, Jalandhar, Nashik, Solapur, Visakhapatnam and Bangalore. Historical spelling is not necessarily current official toponymy.
- **Important source error:** Natural Earth's `ADM1NAME` incorrectly assigns Ahmedabad, Rajkot, Surat and Vadodara to Dadra and Nagar Haveli. Its Odisha records say Orissa. The local **editorially reconciled** region field is NOT official administrative verification. Region assignments should be checked against an authoritative current administrative map before any trusted release.

## New application behaviour

1. The build now bundles `data/gazetteer/{places.geojson,manifest.json,SOURCE-AND-LICENCE.txt}`, validates all points and rights metadata, and checks SHA-256 and the fixed historical subset fingerprint.
2. Browser loading verifies the published digest. If data are absent or corrupt, the map and fallback keep functioning with the original 25 pilot city locations.
3. Search includes English, Hindi and the limited documented alternate spellings; map labels for the 71 source-labelled points appear as the user zooms. The original pilot source remains available only for names absent from the new source, avoiding duplicate pilot markers for 23 overlapping names. Panaji and Sri Vijaya Puram remain pilot-only.
4. Search result details disclose approximate coordinates and editorially reconciled state labels, public-domain provenance and the absence of address or political-boundary accuracy.
5. An independent quality-review plot overlays these 71 source points on GSHHG generalized land in a bounding rectangle. This **does not show political boundaries** and includes neighbouring countries. Screenshot does not prove GPU/WebGL rendering.

## Verification

- **87/87 Node JavaScript tests passed**, including source integrity, bilingual search and duplicate handling.
- **72/72 Python tests passed**, including deterministic regeneration, schema, collision and existing-build preservation on tampering.
- Chromium desktop/mobile interaction smoke tests passed with **mocked MapLibre**, including real city-point fixture loading, Hindi selection, source disclosure and fallback UI. Genuine MapLibre WebGL/GPU rendering **not verified**.
- Static preview asset integrity, full modular application contract and production release guard are enforced separately. Final count and hash are provided in `dist/build-manifest.json`.
- The data subset is traceable to a pinned upstream blob, but the manually copied/edited subset was not independently re-diffed against a full downloaded upstream file in the local container due network limitations; a future audit should automatically validate every record against the pinned blob.

## Known limitations / critical release blockers

1. Official Survey of India 2026 boundary geometry and associated redistribution rights absent, including unresolved Shaksgam discrepancy.
2. No licensed nationwide roads, railways, detailed settlement network or current named rivers. 71 city points do **not** make an urban basemap.
3. The whole static atlas still depends on third-party MapLibre distribution and unverified community political geometry, except for the standalone physical-only research SVG.
4. No true WebGL rendering tests, no screen-reader study, no load test of 1,000 users, no production monitoring.
5. Natural Earth source is generalized and has demonstrably inaccurate/outdated place/admin fields. Retain its research-only label and validate city names with updated records before publication.

## Suggested next priority

Acquire an independently licensed detailed road/rail/settlement extract for a clearly scoped region and run the complete, **real GPU-backed MapLibre** style; in parallel acquire and review legally reusable Survey of India official political boundaries. Do not equate the 71-point search pilot with a finished national gazetteer.
