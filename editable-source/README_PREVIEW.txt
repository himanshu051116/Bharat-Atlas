Bharat Atlas v1.10 India + World Research Preview

Extract this PREVIEW ZIP and double-click START_PREVIEW_WINDOWS.bat on Windows.
Or open PowerShell inside the preview folder and run:
  py -3 -m http.server 8000 --bind 127.0.0.1
Then visit http://127.0.0.1:8000/ .

This preview contains no requirements-geo.txt or build scripts. For code/GIS editing, use the Full Source ZIP.

Default interface: map-first with regions, Hindi/English name search, basic navigation controls and quick measurements. More tools reveals research exports and advanced workflows. The generalized national territorial-claim outline from the operator-supplied Survey of India dataset IS bundled, but state/UT/district boundary polygons are NOT included or certified. The 28/8 region list comes from the National Portal of India directory; it does not establish state borders. The SVG fallback shows historical physical geography PLUS the imported source-labelled national outline when MapLibre is unavailable.

The research viewer is not suitable for legal territorial decisions, navigation or government publication. Genuine MapLibre WebGL2 and device testing are pending. Nothing is automatically uploaded or deployed.

WORLD ATLAS: visit http://127.0.0.1:8000/world.html or use Explore the world in the header.
The world explorer works with SVG even if MapLibre/WebGL is missing, and bundles generalized Natural Earth 110m country/territory map units for offline browser use after shell caching. It does NOT supply authoritative or updated political frontiers; small islands/dependencies may be absent. World country search is English plus browser-provided Hindi region names where ISO-2 codes are available.

India claimed-outline integration: A Survey of India source-declared, generalized 1:16m outline is included for **local non-commercial research only**. It is NOT the 2026 political-map shapefile, not a state/district dataset, and not a depiction of de-facto control. The original Shapefile is not bundled. The derived geometry and SHA-256 manifest are under data/official-india/. The source copyright and non-commercial restrictions apply. Do not use this preview for commercial redistribution.

VISITOR EXPLORATION UPDATE: The India homepage includes a concise start-here guide, quick state/UT search examples, and a collapsible map legend explaining available map sources. The World Explorer includes labelled reference parallels, on-demand coordinate search, approximate nearby reference-point comparison, a country-specific shareable link, and an at-a-glance map inventory. These enhancements use only the existing bundled datasets; they do not create new official borders or imply road navigation.

WORLD CAPITAL REFERENCE UPDATE: The World Explorer has an optional Capitals toggle and search by
country or reference capital name. The 163 bundled points come from the archived countryinfo
0.1.2 MIT-licensed snapshot, not an official or current world capital gazetteer. Bad/missing
coordinates were omitted. Confirm current political capitals from authoritative references.
The India claim outline and its non-commercial research restriction remain unchanged.
Mobile World Explorer now starts with the map, followed by the full country directory;
mobile search is available immediately above the map.

WORLD DETAIL RESEARCH UPGRADE (v1.2 code branch): Open World atlas, expand "More map detail". The optional historical worldwide watercourse layer uses 7,000 generalized, unlabelled GSHHG/WDBII segments (LGPL-3.0+); the city layer has 71 existing source-listed Natural Earth India points, NOT a complete worldwide city registry. The layer buttons for admin-1, lakes, peaks and 50m country detail remain disabled until their reviewed 10m/50m source files are imported using scripts/import_world_natural_earth.py (full source only).
See WORLD_DETAIL_IMPORT_GUIDE.md. This package retains the non-commercial Survey of India-derived national outline. No uncertified Indian provincial polygons are inserted.

Detailed-geography source guide lives in the FULL SOURCE archive at WORLD_DETAIL_IMPORT_GUIDE.md.
The optional cities and historical waterways are already installed in this preview. Global 10m states/provinces, modern named rivers, lakes and peak files have NOT been downloaded into this preview.

WORLD GEOGRAPHY INSTALLATION (FULL SOURCE ZIP ONLY; REQUIRES INTERNET)
Extract the FULL SOURCE ZIP, then double-click FETCH_WORLD_GEOGRAPHY_WINDOWS.bat.
It downloads ONLY allowlisted public-domain Natural Earth 50m/10m Shapefile ZIPs,
retains source SHA-256 records, rejects unsafe archives, and produces optional
country, non-Indian state/province, city, rivers, lakes and peak layers.
The Windows preview ZIP intentionally does NOT contain these datasets until imported.
If downloads are blocked, manually obtain the matching ZIP names from
https://naturalearthdata.com/ and place them into downloads/natural-earth/,
then run: py -3 scripts/install_world_geography.py --replace
Follow with: py -3 scripts/build.py
No data is official or sufficient for legal political boundary decisions.
India claim outline is preserved and Indian Natural Earth admin-1 polygons are excluded.

V1.8 UPDATE: Unified country/capital/detail search, source feature inspection and approximate latitude-aware scale. v1.7 introduced: World source-backed city/province/waterway/mountain suggestions appear next to the active search input. Matching labels are source-derived, not a live geocoder. Exact historical reference-capital search focuses its point. Desktop country panel can scroll independently on small laptop screens.

The full source Natural Earth installer now verifies all required Shapefile companion files (.shp/.shx/.dbf/.prj) and optional .cpg when present. The complete worldwide inputs have not been bundled.

V1.9 GEOGRAPHY SEARCH/RENDERING UPDATE: The browser now uses reusable spatial/name indexes so larger imported Natural Earth city, province and waterway layers can be searched and drawn with less work. This does NOT increase the number of installed actual world-city or province records. See V1_9_GEOGRAPHY_AND_ACCEPTANCE.md in the Full Source ZIP. Hardware and official source-rights acceptance remain pending.
