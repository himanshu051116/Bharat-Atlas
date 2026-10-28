# Bharat Atlas — detailed global geography

**Build status:** source-backed research maps, not a certified current political atlas. The web interface deliberately retains the separate Survey of India national claim outline and does not construct India's state boundaries from Natural Earth.

## Currently included

- Existing **177** low-resolution Natural Earth country/map-unit features (1:110m).
- Existing **163** legacy capital reference points (historical; not certified as current).
- **71** inherited Natural Earth 1:50m selected India-tagged city locations (research reference, *not* India-wide gazetteer).
- **7,000** source-derived global, simplified, unlabelled historical river segments extracted from GSHHG/WDBII 2.3.6 via basemap-data 2.0.0, LGPL-3.0-or-later. The layer is not a contemporary named-river network.
- **1,150** additional simplified historical GSHHG/WDBII shoreline segments and **650** inland-water polygon parts from the pinned local `basemap-data 2.0.0` distribution (LGPL-3.0-or-later). These are **physical map layers only**, not national borders and not a current water survey. Their own SHA-256 manifest and licence copies are included.
- Zoom-sensitive city labels from the 71 inherited places, with collision suppression and constant apparent font size.
- The user-provided Survey of India general national claim outline (separate layer, non-commercial-use restrictions apply).

## Detailed world data you can add

Download from the **original Natural Earth publisher** (avoid unverified mirrors). The code intentionally does not auto-fetch geopolitically sensitive map data.

| Import option | Recommended original Natural Earth dataset | Detail |
|---|---|---|
| `--countries` | 50m Admin-0 Countries | More generalized edge vertices than 110m; de-facto reference |
| `--admin1` | **10m** Admin-1 States/Provinces | First-level divisions; 50m admin-1 only covers USA/Canada |
| `--cities` | 50m Populated Places | City/capital/regionally relevant points, not all cities or a current verified gazetteer |
| `--rivers` | 50m Rivers and Lake Centerlines | Named features when present in source |
| `--lakes` | 50m Lakes | Cartographic lakes, not water-management boundaries |
| `--peaks` | 10m Geographic Lines/Points — mountain peaks | Limited peak reference points |

Publisher pages:

- https://www.naturalearthdata.com/downloads/50m-cultural-vectors/
- https://www.naturalearthdata.com/downloads/10m-cultural-vectors/
- https://www.naturalearthdata.com/downloads/50m-physical-vectors/
- https://www.naturalearthdata.com/downloads/10m-physical-vectors/
- https://www.naturalearthdata.com/about/terms-of-use/

### Example Windows PowerShell workflow

Place downloaded original shapefile ZIPs in a `datasets` folder next to the scripts, then from the *full-source project folder*:

```powershell
py -3 -m pip install -r requirements-geo.txt
py -3 scripts\prepare_world_detail_metadata.py --countries datasets\ne_50m_admin_0_countries.zip --admin1 datasets\ne_10m_admin_1_states_provinces.zip --cities datasets\ne_50m_populated_places.zip --version "Natural Earth 5.1.x (confirm the actual downloaded edition)" --confirm-reviewed --output source-metadata.json
py -3 scripts\import_world_natural_earth.py --countries datasets\ne_50m_admin_0_countries.zip --admin1 datasets\ne_10m_admin_1_states_provinces.zip --cities datasets\ne_50m_populated_places.zip --provenance source-metadata.json --replace
py -3 scripts\build.py
py -3 scripts\verify_preview.py dist
py -3 -m http.server 8000 --directory dist
```

The source-input hash and version are recorded for every layer; the importer checks CRS and geographic coordinates, simplifies geometry, excludes India admin-1 reference polygons, preserves source names, and hashes the resulting files. Existing detailed packs cannot be overwritten without `--replace`. If a layer is too large for the static viewer's bounds, the importer fails rather than silently producing a partial dataset.

### Important limitations

- The 50m world layer does not establish legally accurate modern world borders. There are politically disputed representations and changes that may not be included in Natural Earth.
- 10m admin-1 is *more detailed*, not legally certified. India's states/UTs must come from a separately licensed authoritative source, reviewed at the right edition and then integrated as their own claimed/administered layer.
- This is a general-purpose SVG world atlas at small and medium scales. It is **not** a street-level navigation map, a current capital registry, or an address database.
- Only the initial **71 selected Indian cities** are bundled in the optional city detail layer. An expanded world city layer needs the additional Natural Earth data downloaded and imported.
- The official SOI outline permits only certain non-commercial uses. This local research build has no authorization for commercial or unrestricted publication of that geometry.

### Rebuild the historical shorelines from a pinned source

The project carries the generated physical data already. To reproduce that asset in a Python environment with `basemap-data==2.0.0` and `basemap` installed:

```powershell
py -3 scripts\build_world_shorelines.py
py -3 scripts\build.py
py -3 scripts\verify_preview.py dist
```

The shoreline/lake shapes are separately documented physical geography. They must **never** replace the Survey of India national-claim layer or imply official borders. The higher-detail *contemporary* world city, named-river, lake and 10m province datasets are still not bundled.

### v1.7 input integrity hardening
A Shapefile must include matching `.shp`, `.shx`, `.dbf` and `.prj` sidecars (plus `.cpg` if supplied). The recorded SHA-256 component hashes are checked at import time. If any companion file changes after the provenance record was prepared, re-review the source and regenerate the record rather than bypassing verification. A reviewed `.geojson` input remains a single-file alternative.
