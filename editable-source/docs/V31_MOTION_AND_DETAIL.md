# Bharat Atlas v0.31 — Geographic detail and accessible motion

**Research/development candidate, 24 October 2026.** This is a genuine continuation of the v0.30 source ZIP. It is not a nationally complete map, and it is not approved for production, official geography, or navigation. No GitHub push or remote deployment is part of this package.

## Implemented

1. **Source-derived guided journey:** selects seven geographically diverse coordinates from the bundled 71 Natural Earth populated-place points. Play, pause, previous/next, and adjustable pace controls drive real MapLibre camera movements when a renderer exists. Place labels, research region labels and source warnings remain visible. The algorithm selects *only* existing points and never invents cities or coordinates. Journeys are paused on manual map drags, source replacement and tab hiding; imported political sources cannot inherit unrelated city tours.
2. **Motion engine:** travel-aware duration between 360–1,450 ms; cap/speed scaling; prefers-reduced-motion disables animated flyovers. A zoom-stage narrative changes as users explore the map; it never presents sparse tiles as nationwide street coverage.
3. **SVG fallback interaction:** multi-pointer pinch, mouse-wheel focal zoom, drag, keyboard arrows, plus/minus/reset, pointer-aware region clicks, bounded displacement, and focus on supplied coordinates. Browser users without WebGL can explore the locally checked historic physical SVG instead of a blank area. Zoom and pan are approximate display operations, not navigation-grade geometry.
4. **Progressive cartographic labeling:** optional tile road-name and waterway-name symbols appear at suitable zooms, and only when **actual source-supplied** `name` fields and corresponding modern transport layers are present. The project still does **not** bundle modern nationwide road/rail/waterway tiles.
5. **Source disclosure panel:** live local inventory for political polygons, historical land/water, source-labelled selected populated places and research transport availability; clear licensing and completeness limits. No unsupported official-border claims.
6. **Regression repair:** standalone `src/router.mjs` now imports its geodesic helpers explicitly; the research SVG export now preserves its projector metadata instead of accessing an undefined field. A pointer capture regression found during integration was fixed so interactive SVG region selection remains clickable.
7. **Offline cache bump:** service-worker cache version incremented to prevent old v0.30 JS/CSS from silently remaining after local upgrades.

## Verified locally

- JavaScript Node tests: **115 passed, 0 failed**, including pure camera math, source-derived tour selection, zoom narratives and modern transport label contracts.
- Python unittests: **92 passed, 0 failed**.
- Python browser smoke script: passed desktop/mobile layouts, geographic fallback, source-backed 71-place search, guided journey UI with mocked MapLibre, imports, export, simulated WebGL failure recovery. *Mocked MapLibre is not proof of actual GPU map rendering.*
- Static build verifies 648 assets and 20 concatenated source modules. Archive integrity and no-production guards remain active.
- `scripts/release_guard.py --target production`: **blocked by design**.
- `scripts/run_renderer_proof.py`: **blocked_missing_local_renderer** — authentic pinned MapLibre is absent and no real GPU/WebGL2 acceptance is claimed. Physical Android Chrome and iOS Safari remain untested.

## Remaining external data/hardware requirements

- Properly licensed official Survey of India 2026 political geometry, independent Kashmir/Ladakh/Gilgit-Baltistan/Aksai Chin/Shaksgam spatial review, and distinct claim/control semantics.
- Modern roads, railways, current named water networks, nationwide settlement/address geocoding and validated coverage at appropriate zoom levels; do not confuse a pipeline's capability with bundled data.
- Authentic MapLibre GPU runtime on desktop plus physical Android/iOS; navigation routing and large-scale deployment/caching/performance/accessibility testing.

## Windows preview

Extract `bharat-atlas-v31-local-preview.zip` and double-click `START_PREVIEW_WINDOWS.bat`, or open PowerShell in the extracted folder and run `py -3 -m http.server 8000 --bind 127.0.0.1`. Navigate to http://127.0.0.1:8000/. The local-preview ZIP is prebuilt and has no `requirements-geo.txt`. The full-source ZIP contains GIS requirements, build scripts, tests and reproducible-data contracts.

**Scope disclaimer:** Only local development and synthetic browser validation were performed. No national completeness, device-level frame rate, real MapLibre rendering success, certified border accuracy, or production readiness is asserted.
