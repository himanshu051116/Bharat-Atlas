# Bharat Atlas — World Explorer expansion

## Scope and build

World Explorer is a new **world.html** entry point integrated into the existing Bharat Atlas focused India application via the primary header. The India experience, source-labelled river/shoreline layers, state/UT directory, GIS tools and fallback remain unchanged. This is not a production atlas or a boundary-certification project.

### Implemented

- Generalized global country/territory vector shapes, stored as checked-in GeoJSON and a deterministic derived web shape file; **177 features**, not every modern political unit.
- Clickable world map, distinct continent filter, native English/Hindi country search (Hindi using browser Intl region translations where ISO alpha-2 is available), one-click India/Asia/World extents, highlighting, area and approximate position readouts.
- Smooth SVG viewBox camera transitions, mouse-wheel zoom, pointer dragging, pinch, plus/minus/home, keyboard pan, `Home` reset, `/` search, labels and latitude/longitude grid toggles, reduced-motion support.
- Direct great-circle distance comparison between source-recorded representative points of two selected country features. This is neither a flight path nor a driving distance.
- Compact mobile layout, no external JavaScript/CDN dependency for the global SVG viewer, cacheable offline static geography, provenance warnings and a direct return to the India atlas.

## Provenance and limitations

The included dataset was exported from the **Natural Earth low-resolution country layer** distributed as a GeoPandas/pyogrio test fixture. Original record labels follow that historical 1:110m dataset. Natural Earth datasets are public domain. Version dates, current political recognition and legally authoritative lines **are not established by this copy**. Many small island states, territories and disputed depictions are absent or heavily simplified. Note particularly that its India polygon should not be treated as representing the full territorial extent officially claimed by India. The main India viewer deliberately does not inherit these world country geometries as certified state/district boundaries.

Data retained in full source:

- `data/world/world-countries.geojson` — geographic source records, coordinates, representative points and computed approximate areas
- `data/world/world-boundaries.json` — 177 derived SVG feature paths
- `data/world/manifest.json` — SHA-256 of input and output, public-domain basis and explicit non-certification
- `scripts/build_world_data.py` — reproducible no-network rebuild of the derived data

Primary sources:
- https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/
- https://www.naturalearthdata.com/about/terms-of-use/

**Neither the 177-feature number nor its map representation means 177 UN-recognized sovereign countries.** Some features are distinct political units/territories, while smaller units are omitted.

## Test evidence

- Existing India engine: `node --test tests/*.test.mjs` **142/142 passed**.
- Existing GIS/Python suite before addition: **99 passed, 6 subtests passed, 1 runtime warning**.
- New world source tests: **3 passed**; original/derived SHA-256, geography count, deterministic rebuild and malformed-input rejection.
- `python scripts/build.py`: passed; integrated static preview builds **762 asset files**.
- `python scripts/verify_preview.py dist`: passed; official geometry flag remains **false**, preview-only promotion guard retained.
- Chromium DOM/SVG tests: world desktop and mobile passed (177 clickable SVG countries, Hindi search, selection, zoom, source-based distance and reset, no JS page errors). Because this environment blocks HTTP navigation by Chromium, the test loaded the **exact built HTML/CSS/JavaScript** with the exact bundled world dataset through an injected fetch fixture instead of navigating localhost.
- **Not tested or not claimed:** full physical-device acceptance, MapLibre/WebGL2 correctness of the India view, hardware graphics performance, authoritative boundary alignment, completeness of 258-style Natural Earth admin-0 units, and route navigation.

## Windows preview

Extract `Bharat_Atlas_World_Explorer_Preview.zip` into a new folder and double-click `START_PREVIEW_WINDOWS.bat`. With the server running, open:

- `http://127.0.0.1:8000/` — dedicated India atlas
- `http://127.0.0.1:8000/world.html` — world explorer

No `pip install` or build script is required for the preview. The full source ZIP includes all scripts and geographic input data for further engineering.

## Next improvements to prioritize

1. Upgrade to Natural Earth **1:50m Admin-0 countries/map units**, requiring a trusted and tested acquisition of its latest geopackage/shapefile and renewed source/provenance checks.
2. Add Generalized **Admin-1** subnational layers by continent/region, where reusability and territorial sensitivity can be established.
3. Add explicitly sourced major world capitals and geographic POIs; index labels rather than inventing missing capitals.
4. Improve zoom-dependent label collision and orientation for high-latitude countries; test polar extents and Fiji/Russia wrapping.
5. Obtain independently approved India national/state/district data for official-claim representation; never silently merge those geometries into the de facto world boundary file.
6. Complete real Windows Android/iOS browser/device acceptance and accessibility evaluation before any public release.

No GitHub writes, external deployment or modification of the user's PC occurred.