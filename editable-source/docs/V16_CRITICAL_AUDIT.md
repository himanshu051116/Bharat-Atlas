# Bharat Atlas v0.16 — Critical engineering audit

## Changes tested locally
- v0.15 MapLibre project is retained as modular engineering source.
- Added generated static SVG fallback using the currently loaded, attribution-labelled polygons, not a hardcoded shape or broken-engine message only.
- SVG fallback retains the export watermark: provisional, not survey-verified.
- The renderer error cause is preserved across asynchronous geography loading.
- A browser assertion now verifies that unsupported-WebGL mode actually renders a fallback map image.

## Preview deployment
- Vercel deployment: `dpl_DjgcAFjMry3hPb8DMYN3j4norSHY` (preview, not production)
- URL: https://bharat-atlas-research-mh1lkyyq3-himanshusubh1510-3246s-projects.vercel.app
- Deployment status: READY as reported by the Vercel API; static file tree confirmed.
- The deployed preview is a **streamlined public-facing viewer**, not the complete modular engineering workspace in this source archive. It includes local `states.geojson` (36 provisional community region features), interactive state selection/search, alternate political/outline styles, SVG export and a non-WebGL static fallback.
- The deployed map dataset is based on `Vardhan-Systems/vardhan-maps` `src/data/generated/states.low.json`; repository provenance is OpenStreetMap contributors and Open Database License v1.0 (ODbL).
- The preview references a MapLibre CDN script. Independent browser/WebGL verification of the hosted URL was not completed. An external web fetch tool could not retrieve the preview, although the deployment API reported READY.

## Unresolved blockers
1. Survey of India 2026 official boundary geometry and redistribution permissions have not been integrated or approved.
2. Shaksgam Valley and other disputed northern boundaries remain provisional and may be absent/misassigned.
3. Public WebGL rendering not measured; tests use a mocked map engine. New static export fallback did render within the local browser harness.
4. No nationwide street/road/river/settlement layers, verified gazetteer or comprehensive address search.
5. No load test of 1,000 concurrent visitors; Vercel READY is not performance certification.
6. Deployed streamlined preview does not contain the full importer, tiled-detail and other internal research tools from the development source. Do not claim feature parity with local engineering source.

## Release decision
Preview only. The production guard MUST remain closed until geography, licensing, GPU rendering and capacity evidence pass.
