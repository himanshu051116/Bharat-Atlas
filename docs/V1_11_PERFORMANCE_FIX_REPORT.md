# Bharat Atlas v1.11 — Interaction Performance and Mobile UI Audit

**Release status:** Local research preview; not production-certified. 28 October 2026.

## Root causes confirmed in v1.10

- Every SVG `setView()` call rebuilt all country-name SVG nodes, recreated reference-capital nodes, rebuilt the distance-scale UI, and emitted a geography-camera event. Animation, dragging, and wheel events repeated these expensive tasks even when only the `viewBox` needed to change.
- Mouse wheels / trackpads restarted a 180 ms zoom easing animation on every event, creating an oscillating or lagging response.
- High-rate pointer events could generate more than one camera update per display frame.
- Pinch zoom was centered on the previous viewport rather than the midpoint of the fingers.
- City-label rendering repeatedly read SVG layout dimensions within the feature loop.
- Mobile toolbar options filled multiple rows and pushed the map down the page.

## Changes shipped

1. New `world-camera-scheduler.js`: the camera changes the SVG viewport immediately; labels, capitals, scale, and detailed layer redraws are coordinated after the camera settles (100 ms quiet window), or flushed on pointer release and completed animations.
2. Wheel zoom is continuous, bounded, and anchored to the mouse/touchpad position; it no longer restarts a short easing animation per wheel event.
3. Pointer drag and pinch updates are coalesced into `requestAnimationFrame`, with an explicit final frame on release. Pinch changes are anchored to the finger midpoint.
4. Detailed place label rendering calculates display width and height once per batch.
5. Mobile map has a native, keyboard-accessible **Layers & tools** expander instead of five crowded toolbar buttons. World scope, zoom and search remain directly available. Hover transitions are disabled while the SVG camera is moving.
6. Offline cache identity updated and the new camera module included among shell assets. The verified geographical source files and political-boundary disclaimers remain intact.

## Regression evidence

| Check | Result |
| --- | --- |
| Node.js tests | **166 passed** |
| Python unittest suite | **114 passed**, including local GIS/build provenance checks |
| Final `scripts/build.py` | **784 static assets created** |
| Final `scripts/verify_preview.py` | **784 assets hash verified**, edition v1.11 |
| Desktop isolated Chromium search/capital/feature checks | **Passed** |
| Mobile isolated Chromium search/capital/feature checks | **Passed** |
| 100 rapid synthetic wheel events (desktop) | **1 label rebuild, 1 capital rebuild, 1 distance-scale rebuild** |
| 100 rapid synthetic wheel events (mobile) | **Same assertion results**; browser-cleanup step subsequently hung in this runtime |
| Desktop/mobile mouse drag | **Map viewport changed; no JavaScript page errors during assertions** |
| Imported Survey of India–derived national claim GeoJSON | **Byte-for-byte unchanged** from v1.10 source ZIP |

The wheel counts measure **DOM rebuilds during a synthetic burst**, not end-to-end frame rate or a guarantee of 60 FPS. Browser testing was isolated and used simulated cryptographic hashing; static artifact SHA-256 values were validated separately. The mobile stress-test assertions were reached, but its cleanup exceeded the runtime limit. Windows device/GPU/Android/iOS field acceptance is still required.

## Run instructions

Extract the Windows Preview ZIP, double-click `START_PREVIEW_WINDOWS.bat`, and open:
- India: `http://127.0.0.1:8000/`
- World: `http://127.0.0.1:8000/world.html`

Do not launch `world.html` using `file://` because secure-origin digest and service-worker behavior need a local HTTP origin.

## Deliberate limits

- No official Indian state/district boundary certification, new Natural Earth complete-data import, or redistribution approval is implied.
- The generalized, source-declared Survey of India claim outline is subject to the original non-commercial-use notice.
- The previously outstanding physical-device/WebGL acceptance is **not** considered complete.
- No GitHub, Vercel, or production system was changed.