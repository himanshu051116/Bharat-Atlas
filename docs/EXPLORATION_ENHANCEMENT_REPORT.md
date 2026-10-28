# Bharat Atlas — India + World Exploration Enhancement

## What changed

Built on the prior India + World research atlas, retaining the user-supplied Survey of India generalized national-claim outline.

### World Explorer
- Main map key identifies generalized countries, the separate India claim outline, and user's coordinate pin.
- Major named parallels and a prime-meridian label provide geographic orientation when the grid is enabled; graticule is explanatory, not a legal boundary.
- Collapsible WGS84 coordinate search (latitude -90..90 and longitude -180..180) positions a temporary pin and focuses the SVG map.
- Selected country detail adds three nearest **representative map points** from the same continent (great-circle approximations only). These are **not** shared political boundaries or travel routes.
- Searchable, read-only country-specific URL that preselects a country when opened via an HTTP-hosted viewer.
- Source-derived country-feature and geographic-group counts. The source grouping includes a 'Seven seas (open ocean)' unit; the UI does not call all eight groups continents.
- World map works as a static SVG; no WebGL requirement.

### India Explorer
- A compact overview row with 28 states, 8 UTs and quick search examples.
- Accessible collapsible source/legend explanation covering the supplied generalized India outline, historic water/shoreline layers, name-only region directory and basic map controls.
- One-click switch to World Explorer.
- Explicit notice that an actual Survey of India-derived generalized outline is included for **non-commercial local research**, without implying 2026 political-map or administrative-control certification.

## Data unchanged
- Existing Natural Earth generalized legacy 1:110m world polygons, 177 geographic features.
- Existing user-supplied generalized SoI-derived India outline and its verified SHA-256 manifest.
- India administrative **names** directory of 28 states and 8 UTs; no certified state/district polygons added.
- Existing sparse historical vector tiles and limited city catalogue remain unchanged.

## Verification
- Deterministic static build and 765 asset checks: pass.
- Original JavaScript unit tests: 143 pass.
- Python unit tests: 104 pass (one Shapely runtime warning).
- Original World Explorer Chromium desktop/mobile smoke scenarios: pass.
- New visitor interaction tests: desktop/mobile world, coordinates, guides, related reference points, share-link generation; India quick-search/legend checks: pass.
- Original legacy India browser suite: **not fully passing**. It assumes older provisional region polygons automatically load, whereas this source deliberately disables that unsafe fallback. The new India visitor checks pass independently. No physical-device or real GPU certification is claimed.

## Critical limitations
- The SoI-derived map follows source-declared generalized claims; it is not an independently certified match to the 2026 political-map edition and does not represent actual administrative control.
- The supplied SoI outline is subject to non-commercial-use restrictions. Do not deploy commercially without resolving rights.
- World countries/territories and areas reflect a dated, low-resolution Natural Earth sample; small territories may be absent, country names and disputed boundaries may be non-current.
- Coordinate pin is not geocoding; 'nearby' is measured between representative points, not borders or roads.
- The world-share URL requires a locally served or hosted page, not file:// or about:blank.
- No GitHub writes or deployment performed.

## Windows usage
1. Extract `Bharat_Atlas_Enhanced_Windows_Preview.zip`.
2. Open `START_PREVIEW_WINDOWS.bat`, or run `py -3 -m http.server 8000 --bind 127.0.0.1` from that folder.
3. World: http://127.0.0.1:8000/world.html
4. India: http://127.0.0.1:8000/
5. World: search a country, filter by continent, expand 'Jump to latitude / longitude', view nearby representative-point comparisons, and copy a country link.
6. India: use the quick search examples, explore the directory, and expand 'Map key & what is available' for source explanations.

Preview ZIP is a prebuilt static site; it does not contain GIS build scripts or Python requirements. The full source ZIP is for development.