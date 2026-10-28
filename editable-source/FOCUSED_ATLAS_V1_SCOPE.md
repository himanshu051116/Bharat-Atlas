# Bharat Atlas — focused v1 candidate

**Product intent:** A readable, bilingual India geography explorer, not a Google Maps replica.

## Included
- 28 state / 8 UT name-and-type catalogue, independent of boundary network failures
- Hindi alias search for the 36 administrative names
- Simple prominent map with optional existing MapLibre engine and SVG fallback
- Region selection with transparency: no political outline without a vetted polygon
- Existing source-backed city/coordinate search, major physical geography, reset/zoom, distance tools, optional location permission, sharing and SVG exports where licensed
- Advanced research tools accessible only on request, preserving existing functionality

## Not certified / not included
- Official Indian boundary polygons, official district polygons and district catalogue
- Survey-of-India-validated disputed-region geometry or republication rights
- Navigation-grade routing, traffic, turn-by-turn guidance, current complete road networks
- Real GPU testing on physical Android/iOS devices

## Catalogue provenance
English administrative names and 28/8 classification: National Portal of India, IGOD directory: https://www.india.gov.in/directory/web-directory/state-uts . Hindi aliases are interface translations. No state polygon coordinates are included in this catalogue.
Boundary reference: Survey of India Political Map of India (2026): https://surveyofindia.gov.in/pages/political-map-of-india. Publishing/reuse of Survey of India digital map data has separate permission/licensing requirements: https://surveyofindia.gov.in/pages/pricing-of-digital-data .

## Source to preview
Run `python scripts/build.py` then `python scripts/verify_preview.py`. Run static preview from dist: `py -3 -m http.server 8000 --directory dist` on Windows. Optional genuine renderer use requires verified MapLibre vendor distribution and a functional WebGL2 context. This remains a **local research candidate**.

## Focus mode
Default interface is streamlined. `More tools` reveals advanced map comparison, data coverage, source-provenance, and diagnostic panels without deleting features. Region classification works even when boundary fetch fails; only actually loaded polygons may be highlighted.
