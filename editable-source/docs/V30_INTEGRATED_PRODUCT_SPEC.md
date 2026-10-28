# Bharat Atlas — Integrated research implementation, v0.30

**Development scope:** integrated map workspace and source-backed data ingestion. This document is an implementation specification, **not an acceptance certificate**. The user requested feature development before the separate acceptance-testing phase.

## Research product contract

- Geographic coordinate standard: WGS84 longitude, latitude (EPSG:4326/CRS84). Geographic research window 60°–102°E, 3°–41°N.
- Map status: **not an official Indian political boundary map**. Historical GSHHG coast/lake/river/land features are not contemporary Indian boundaries; provisional community administrative polygons cannot be used as a sovereignty determination. Independent Survey of India geometry, licences and human review are required.
- Sources: historically generalized GSHHG physical mask; 71 Natural Earth India-tagged selected populated places; independently hashed 608 sparse source-labelled MVT tiles. No bundled modern nationwide roads, railways or address geocoder.
- Renderer: MapLibre GL JS 5.13.0 with integrity-checked optional local vendor and SHA-256-verified sparse vector tiles; accessible SVG fallback and explicit retry/diagnostic exports. Real GPU proof is still required.
- Architecture: deterministic Python static builder, modular browser JavaScript, provenance and tile manifest validators, static browser-hosted local app, separate Atlas Labs research modules.

## Implemented feature surfaces in the v0.30 code

| Feature | Behaviour | Critical caveat |
|---|---|---|
| Interactive map | Pan/zoom/style selection, state/city search, layer visibility, coordinate search | Requires functional MapLibre GPU; research SVG fallback supports offline pan/zoom |
| On-device location | Optional explicit browser geolocation permission, WGS84 coordinate focus | Not address verification; never auto-uploaded |
| Map research measurement | Direct distance, approximate spherical area, export JSON, manual coordinates or click map, SVG measurement drawing | Not a route, cadastral area or surveying instrument |
| Local saved locations | Bookmarks limited to 40, browser-only localStorage, export and clear | Optional device storage; shared device privacy |
| Share view | URL with style and coordinates/region; no imported geometry, cookies or source data included | A shared region needs matching boundaries; never shares actual GeoJSON |
| Source-labelled import | Point/line GeoJSON from browser session with source URL, attribution and declared rights, limits and WGS84 checks | Declared rights do not grant legal clearance; overlays not persisted or uploaded |
| Research route | Weighted shortest path on explicitly supplied connected road-line vertices only | NO access/traffic/turns, roads may not be connected, not navigation |
| Modern transport research tile pack | Separate static tile source and independent protocol, zoom-dependent roads/rail/water/settlement styles, metadata hashes | Not bundled until user provides approved source data |
| Offline research shell | Same-origin public app assets cached after initial access; historical SVG mode can work offline once data were cached | Not all map tiles, CDN renderer or external political data guaranteed offline |
| Data-coverage inspector | Current map, settlement, tile/transport and official verification status visibly disclosed | Counts cannot be taken as evidence of nationwide coverage |
| Atlas Labs | Physical SVG Map Studio, learning worksheets, partial observatory, dated data and stories | Research lessons/data not independently certified |
| Print/export | Research SVG and Labs print/PDF paths with source notices | Not official map reproduction or high-resolution certified boundary export |

## How to supply a modern detail data pack

Obtain a permitted WGS84 source extract and written licence/provenance review. The source metadata JSON must contain:

```json
{
  "officiallyVerified": false,
  "redistributionReview": "approved_for_research_preview",
  "sourceSha256": "<64 lowercase hexadecimal SHA-256 characters of input GeoJSON>",
  "sourceUrl": "https://original-source.example/dataset",
  "licence": "<the applicable source licence>",
  "attribution": "<data owner and any required notice>",
  "snapshotDate": "2026-10-24",
  "coverageClaim": "regional_extract"
}
```

These are placeholders, not a licence grant or real dataset. To create a local pack without altering the original source:

```powershell
py -3 scripts\build_research_data_pack.py --geojson C:\atlas-data\roads.geojson --metadata C:\atlas-data\source-metadata.json --output C:\atlas-data\prepared-pack --minzoom 4 --maxzoom 8
```

After independent human review, copy the contents of `prepared-pack\tiles` into `data\transport-pack` in the **full source project** and rebuild the static app. Never replace the historical `data\tiles` archive. No pack is included by default.

## Deferred requirements that block a legitimately complete Google Maps-class product

1. Acquire, document and legally authorize the relevant Survey of India 2026 digital geometry; independently compare disputed/northern territories (Shaksgam, Aksai Chin, Gilgit-Baltistan), control vs official Indian claim, and unsettled district boundaries. Certification cannot be synthesized in code.
2. Acquire nationwide licensed up-to-date road/rail/water/place datasets at appropriate zooms, maintain an ingest pipeline and source freshness, and build address-level geocoder coverage.
3. Build an actual navigable directed road graph including topology, junction detection, bridges, vehicle restrictions, turn restrictions, speed/traffic, licensing, coverage checks and routing service capacity. The v0.30 **research path** is intentionally much narrower.
4. Verify real MapLibre WebGL2 rendering in a GPU-backed browser and real Android Chrome/iOS Safari devices. Existing mocked Chromium checks cannot replace this.
5. End-to-end accessibility audit, quality evaluation, content rights, multilingual coverage review, printable accurate official maps, realistic load testing, observability, security and deployment/rollback.
6. Commercial / public distribution rights and approvals per source and allowed geographic-layer representation.

**Production release: blocked. No GitHub/Vercel writes or deployments authorized.**

## Future acceptance test sequence (not run as user sign-off for this milestone)

- Code and deterministic build: Node module syntax; Python compilation; UI module contracts; static asset integrity and no unreviewed copyright content.
- Functionality: real browser all layout breakpoints, search, focus recovery, SVG fallback, keyboard, file safety, measurement, imports and graph routes.
- Source fidelity: exact GIS source version, hashes, rights, independent spatial comparisons, topology/coverage; transport archive integrity.
- Real hardware: GPU/WebGL2 desktop and physical Android/iOS screenshots and runtime/console/viewport evidence.
- Production: accessibility, monitor and rollback, traffic/load simulation; sign off boundaries/data legality separately.
