# Bharat Atlas v0.18 — Critical engineering audit

**Date:** 23 October 2026  
**Scope:** Complete, modular local research application; **not deployed**.  
**Release decision:** Local research preview **allowed**; official/public-production release **blocked**.

## Confirmed bugs corrected

1. **The SVG map fallback was an image, not a usable map.** When MapLibre/WebGL failed, regions could only be chosen from the side list and the map's zoom controls did nothing. The fallback now renders an inline SVG from the current validated polygon collection. Each polygon has a safely escaped region identifier and can be selected with click, Enter or Space.
2. **Labels blocked geographic selection.** Initial v0.18 Playwright checks found that text labels intercepted clicks on smaller regions. The labels layer now has `pointer-events:none` in fallback mode; clickable polygons retain hover/focus styling.
3. **Pointer capture prevented normal taps.** The first pointer implementation captured all pointers immediately, retargeting clicks to the SVG root. Capture is now deferred until dragging begins; click-to-select works and drag panning remains available at increased zoom.
4. **Zoom controls were behind the overlay.** The no-WebGL overlay formerly obscured the map controls. The map stage now applies `fallback-active`, raising real zoom buttons above the overlay. Wheel/keyboard zoom and map reset work in the SVG mode.
5. **The hosted preview may be a simplified application.** Earlier releases deployed a small four-file viewer, not the complete modular app. `scripts/verify_preview.py` now verifies the build manifest SHA-256 digests, all ten application module signatures, 14 functional controls, noindex/source disclosures, and the production-lock flag. It rejects a simplified bundle even if someone rehashes it. The preview release guard executes this check; CI includes it.

## Evidence reproduced this turn

| Test | Result | Limitation |
|---|---|---|
| JavaScript unit tests | **56 passed** | Pure and simulated logic, not real WebGL GPU tests |
| Python GIS/build/contract tests | **50 passed** | Synthetic topological fixtures, no official boundary data |
| Desktop/mobile browser suite | **Passed** | Mock MapLibre, synthetic geometry and browser UI interactions |
| Real SVG fallback tests | **Passed** | Real inline SVG rendered in Chromium (no MapLibre) |
| SVG polygon taps, selected-state SVG, zoom/reset | **Passed** | Still using synthetic geography |
| Fallback keyboard region selection | **Passed** | Keyboard path/Enter in Chromium |
| Preview contract verification | **10 modules, 10 static assets passed** | Does not prove geographic accuracy or public site quality |
| Production promotion | **Blocked intentionally** | Missing authoritative geometry, GPU and load evidence |

## Geographic/production limitations (unchanged)

- The build contains **no official Survey of India 2026 boundary geometry**, and **no bundled national community geometry by default**. The app loads a pinned community source at runtime when connectivity allows; it can also import user GeoJSON. It is **not fully offline-capable** until a legally redistributable dataset and MapLibre assets are bundled.
- The community source is provisional; Shaksgam and other northern territorial claims are unresolved. Geometry/topology screening is not proof that territorial claims or administrative boundaries match official publications.
- Real MapLibre distribution/GPU rendering has not been verified, and nationwide streets, settlements, terrain, imagery, routing and high-quality map data remain absent.
- No real mobile GPU profiling, end-to-end hosted-site testing, accessibility certification or 1,000-concurrent-user load testing has been completed.
- The earlier Vercel v0.16 research preview was **not modified** in this iteration.

## Next highest-value engineering work

1. Obtain and assess authorized, reusable geographic datasets with authoritative border geometry and dated/source-labelled boundaries. Carry out spatial comparison (not point sampling alone).
2. Bundle the exact licensed MapLibre distribution, implement real MVT/PMTiles basemap layers, and test on browsers with working WebGL.
3. Keep one tested build artifact as the source for any future preview deployment. Use `python scripts/verify_preview.py dist` as a required release gate, and reject hand-authored simplified site substitutions.
4. Integrate legally reusable, nationwide searchable places and detailed map features; explicitly handle discrepancies between external basemap administrative outlines and official claimed boundaries.
5. Validate export rendering, mobile frame-time/memory, accessibility and concurrent visitor capacity using the real deployed artifact before approval.

**Do not describe v0.18 as an official map or a Google Maps feature-equivalent system.**
