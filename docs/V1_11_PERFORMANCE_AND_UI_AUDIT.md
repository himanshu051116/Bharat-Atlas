# Bharat Atlas v1.11 — Map Smoothness & UI Engineering Audit

**Date:** 27 October 2026  
**Starting artifact:** `Bharat_Atlas_v1_10_Source_With_NE_Extracts.zip`  
**Scope:** Repair SVG World Explorer jitter, prevent redundant redraws, stabilize India fallback zoom, simplify visitors' map UI. **No geographic coordinates, boundary or dataset content was changed.**

## Root causes established in source

1. **Excessive DOM churn per camera move.** `world.js:setView()` previously regenerated country label elements, recreated reference capital markers, refreshed distance scale (with screen-CTM reads), and fired a `bharat-world-camera` event on **every** map-camera step. The receiving detail layer could then recalculate and replace additional SVG paths. Dragging, pinching or easing therefore interleaved costly DOM/layout work with input updates.
2. **Overlapping wheel ease animations.** Every discrete wheel event started a fresh animation; frequently arriving events continuously interrupted and restarted motion, producing unstable wheel response.
3. **Pan and finger-lift handling.** Pointer motion was processed at browser-input frequency rather than screen-paint frequency; pinch-to-drag transitions could retain an old pointer origin and jump when one finger was lifted.
4. **SVG letterboxing.** Zoom calculations using the full CSS viewport dimension even when `preserveAspectRatio` added margins could shift the wheel's focal point.
5. **India SVG fallback** recalculated zoom annotations and reset SVG accessibility text for each gesture change, and repeated CSS transform easing on the wheel.
6. **Visual hierarchy.** Very large display headings, miniature capitalized micro-labels, abundant rounded chips and promotional phrasing competed with the actual map.

## Actual engineering changes

- The World Explorer now separates **cheap, immediate `viewBox` updates** from **deferred label, capital, scale and detail-layer work**. A settled camera event fires at gesture completion or after an idle period, rather than every intermediate frame.
- Pointer and wheel events are coalesced with `requestAnimationFrame`, avoiding multiple map-camera updates within one paint interval. Wheel zoom is direct rather than restarting easing animations; map-button navigation retains brief easing and respects reduced-motion settings.
- Drag calculations retain the initial world-unit-to-screen-pixel scale. Pinch zoom anchors the geographic position under the touch midpoint. On finger lift, single-touch drag is rebased to the new camera position.
- Wheel pointer anchoring uses **painted SVG dimensions** so `xMidYMid/meet` margins do not skew the target.
- The India SVG fallback prevents stacked CSS wheel transitions and defers expensive scale/accessibility updates until a paint frame.
- The World Atlas has restrained headings, consistent readable search and button text, simpler cards and reduced geographic path hover transitions; mobile controls remain accessible.
- Application version updated to **1.11**, service-worker cache revision updated, and optional peak data included in the shell cache list.
- The official-claim GeoJSON remains identical to the v1.10 input: **3,912,257 bytes**, SHA-256 `41755f415288ed375bae81a52fa977cd8061e9f5da8424de0f98326674b588ff`.

## Verification results

| Check | Observed result |
|---|---|
| JavaScript tests (`node --test ...`) | **164 passed**, zero failures |
| Python unittest suite (`unittest discover`) | **114 passed**, zero failures; includes mocked/blocked renderer checks |
| Static build | **783 assets verified**, version `1.11` |
| Desktop World Explorer interaction | Passed isolated Chromium: Hindi search, selecting countries, zoom, distance and reset |
| Mobile World Explorer interaction | Passed isolated Chromium: same functionality |
| Source-labelled city and named-peak search | Passed desktop and mobile isolated Chromium (browser hash check simulated; static file integrity checked independently) |
| Official India outline browser overlay | Synthetic overlay display/selection tested; **NOT official geometry certification** |
| New 96-event pan stress fixture | Desktop: **1** camera event, **26** country-label mutation records, **0** capital mutations; mobile rerun: **1–2** camera events, **15–30** country-label mutation records, **0** capital mutations; both moved the camera without JS errors |
| Two-finger pinch, finger lift, and burst wheel input | Passed isolated desktop/mobile Chromium: 230 → 147.2 map units when fingers separate, 2.4–6.1 map units of continuous drag after finger lift, and 147.2 → 234.1 map units after 40 wheel steps, without JS errors |
| Official-claim source preservation | SHA-256 matches v1.10 input, byte-for-byte unchanged |

The pointer-dispatch interval under isolated Chromium testing was approximately 1 ms for 96 synchronous events. This **is not a real hardware frame-time measurement** and does not prove target-device FPS, smoothness under GPU load, or physical touch-device behavior. Event counts demonstrate elimination of repeated costly camera notifications within a single burst.

## Outstanding acceptance

1. Run the packaged preview on real Windows and Android devices and observe 1-finger pan, 2-finger pinch, 100-event wheel burst, resizing, repeated country selections, UI scrolling and memory use. Isolated Chromium cannot certify physical-device smoothness.
2. Test real MapLibre WebGL2 on supported hardware; the environment cannot certify GPU-accelerated rendering.
3. Import complete Natural Earth 10m/50m source files and separately profile maximum loaded provinces/cities. The installed world data remains incomplete.
4. Independently validate official India state/UT and district polygons and rights. The Survey of India–labelled national outline is **not** independently certified as the 2026 political map and remains subject to non-commercial use restrictions. The atlas is **research-only**, not official geography or navigation.
5. No external deployment, code push or data upload was performed.

## Manual Windows smoke test

Extract `Bharat_Atlas_v1_11_Smooth_Windows_Preview.zip`; double-click `START_PREVIEW_WINDOWS.bat`; open `http://127.0.0.1:8000/world.html`. Repeatedly drag the map, scroll 10+ wheel notches, toggle cities and reference capitals, search `Nairobi` and `Mount Everest`, switch to India (`http://127.0.0.1:8000/`) and exercise the fallback SVG using a browser with WebGL disabled. Disable and re-enable Wi-Fi after first loading to test cached resources. Review browser console for exceptions and use browser Performance tools to measure actual frame rate and long tasks.