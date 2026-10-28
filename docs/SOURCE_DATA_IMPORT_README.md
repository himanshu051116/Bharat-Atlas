# Source-labelled Natural Earth extracts bundled in v1.10

- `source-data/natural-earth-geojson-extracts/major_cities_50m.tsv`: 160 named world city points, a curated publisher-source extract (not the 1,251-record original file).
- `source-data/natural-earth-geojson-extracts/elevation_points_50m.tsv`: 81 named elevation points, a curated publisher-source extract (not the 86-record original file).
- `scripts/import_publisher_extracts.py`: deterministic conversion into verified `data/world-detail/{cities,peaks}.geojson`, with the earlier 71 India points retained only when already present. To reproduce v1.10, use the shipped v1.9 initial city layer or v1.10 same file; repeated import is de-duplicated by country+name.
- `source-data/natural-earth-geojson-extracts/derived/source-review.json`: file SHA-256, source URLs and Git blob IDs; protects derived extracts, not a complete upstream archive.

Source publisher: https://github.com/nvkelso/natural-earth-vector (Natural Earth), public domain.

The full-download import workflow remains `FETCH_WORLD_GEOGRAPHY_WINDOWS.bat` and `scripts/install_world_geography.py` for connected machines. Global states/provinces, named rivers and lakes are **not** shipped as installed modern optional layers in this package.