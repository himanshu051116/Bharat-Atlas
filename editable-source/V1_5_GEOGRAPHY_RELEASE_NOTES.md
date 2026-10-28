# Bharat Atlas v1.5 — Geography and discovery engineering report

**Scope:** India + World Research Atlas. **Not a certified legal/political map.**

## Delivered in source

- Replaced manual multi-step Natural Earth importing with `scripts/install_world_geography.py` and `FETCH_WORLD_GEOGRAPHY_WINDOWS.bat`.
- Allowlisted original publisher-hosted HTTPS downloads for six datasets: 50m populated places, rivers, lakes, elevation points, countries and 10m states/provinces. Downloaded ZIP bytes and extracted Shapefile hashes are preserved in an acquisition report.
- Guarded ZIP unpacking: no traversal, no symlinks, required Shapefile sidecars, bounded archive/download sizes, no URLs supplied by remote data.
- Existing `import_world_natural_earth.py` retains validation, atomic replacement, manifest hashes, and exclusion of Natural Earth Indian admin-1 polygons.
- World Explorer searches installed named cities, provinces, rivers, lakes and mountain points with proper zoom/focus, layer enabling, and desktop/mobile input isolation.
- The preview manifest and cache identifiers now reflect **v1.5**, not an old v0.38/v1.4 label.

## Status of real data

The ZIP built in this environment retains existing 71 source-derived India city points, 163 older reference capitals, generalized world country outlines, historical waterways/shoreline layers, and the user-supplied Survey of India–derived national outline.

**The complete 50m/10m Natural Earth datasets are NOT bundled.** The environment cannot contact the public S3 dataset host. To install on a connected Windows machine, run `FETCH_WORLD_GEOGRAPHY_WINDOWS.bat` inside the full source folder. Successful source downloads, actual layer counts and compatibility must then be assessed from the generated acquisition report. No synthetic features are bundled.

Natural Earth: public domain. Original official India outline is separate and remains subject to the Survey of India published non-commercial-use conditions. A geographic source hash does not establish political certification.

## Acceptance limits

Software unit tests and isolated browser tests cannot establish contemporary national geometry, complete global city coverage, production readiness or actual physical-device support. Preview remains blocked from public production promotion.
