# Bharat Atlas — Government of India territorial-claims view

## What the update does

- World Explorer can **replace the older Natural Earth India footprint** with a separately installed Survey of India sourced national **claimed outline** (ochre line). The toggle lets visitors compare the generalized world dataset with this source-backed claimed outline.
- India Atlas draws the same supplied claimed national extent as a prominent separate outline over physical geography. The independent 28 state and 8 UT catalogue remains available.
- Default India mode does **not** silently fetch and draw community state boundary polygons as if they were the Government of India's border.
- No geometry claiming to be official is bundled into this release. A working converter and build-time verification are included. Neither the generalized SoI outline nor its checksum is proof that the vector exactly matches the 2026 political map.

## Obtain the source

The Survey of India [Outline Maps of India](https://surveyofindia.gov.in/pages/outline-maps-of-india) page links to a **generalized 1:16-million scale national-outline vector**, currently at:

`https://surveyofindia.gov.in/documents/Outline_of_India.zip`

Compare it with the [Political Map of India, English 13th Edition, 2026](https://surveyofindia.gov.in/pages/political-map-of-india). The latter is a government-copyright PDF reference; it is **not** an automatic licence for PDF vectorization or unrestricted redistribution.

The Survey of India's outline-vector usage notice permits individual, internal, educational, research and non-commercial website uses, but **does not permit commercial use**. This is not permission to redistribute outside the notice's scope, sublicense the dataset or describe it as certified. See [their published notice](https://www.surveyofindia.gov.in/documents/ibd-vectorformat.pdf).

## Windows installation (full-source package)

1. Extract `Bharat_Atlas_Official_Claims_Source.zip` to a folder, e.g. `C:\BharatAtlas`.
2. Download the original Survey of India outline ZIP yourself to `C:\Downloads\Outline_of_India.zip`. Do not substitute Natural Earth, OSM, or a traced screenshot and call it government data.
3. Open PowerShell inside the extracted **full-source** folder (the small preview cannot run build scripts).
4. Install packages and import **only if you have read and accepted the restrictions for your intended use**:

```powershell
py -3 -m pip install -r requirements-geo.txt
py -3 scripts\prepare_soi_claim_outline.py "C:\Downloads\Outline_of_India.zip" --acknowledge-noncommercial-terms
py -3 scripts\build.py
py -3 scripts\verify_preview.py
py -3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

5. Browse `http://127.0.0.1:8000/world.html` (World) or `http://127.0.0.1:8000/` (India). The World Explorer shows **India claim outline** as an enabled control only when valid source-linked data is included.

The outline importer expects one Shapefile layer inside the official ZIP, or a supported GeoJSON/GeoPackage. If the source archive layout changes, do **not** guess layer selection or hack the geometry; inspect the official download and adapt the importer openly.

## Important boundaries and control distinctions

- India's stated territorial claim includes the entire Union Territories of Jammu & Kashmir and Ladakh, including areas administered by Pakistan or China, and its position on the Shaksgam Valley transfer differs from China and Pakistan's. See the [Ministry of External Affairs response](https://www.mea.gov.in/Images/CPV/RTI-03-05-03-2023.pdf).
- This overlay represents *India's claimed external territorial boundary*. It does **not** assert who administers each location, show the Line of Control or Line of Actual Control, or prove the internal boundary between Ladakh and Jammu & Kashmir.
- Check Shaksgam, Gilgit, Muzaffarabad, Aksai Chin, the Northeast and islands visually and by independent GIS comparison. The automated coordinate samples are **warnings**, not legal/geodetic certificates.
- The 2026 Survey of India political map itself contains caveats about certain internal district/state boundaries needing authentication. A 1:16m outline is too generalized to redraw those precisely.
- The present source pipeline reports `politicalMap2026GeometryMatched: false`, `administrativeControlVerified: false` and `commercialRedistributionAllowed: false` even after a file is installed.

## Project/release safeguards

The original national-outline bytes are **never checked into this source ZIP**; `data/official-india/` is .gitignored. Building with a damaged hash or invalid topology fails closed. The app's preview remains labelled research-only and the production promotion gate continues to block publication.

If you need the **exact state and district borders of the 2026 political map**, obtain the appropriately licensed administrative vector products directly from Survey of India and separately validate their edition and geometry. Do not infer those divisions from a generalized national outline.

## Imported 2026-02 source data in this local research release

An operator supplied the `Outline_of_India.zip` Shapefile, with a Lambert Conformal Conic WGS84 projection and a multipart polygon. The importer uses a topology-preserving 0.00008° display simplification and 0.000001° coordinate precision. It must keep every source polygon part and less than 0.01% normalized symmetric-difference area. The source SHA-256 and processed GeoJSON SHA-256 are recorded in `data/official-india/manifest.json`. This is a **non-commercial research reproduction**; do not resell or treat it as an authenticated vector copy of the 2026 1:4M political map. The local archive omits the original 7.2 MB Shapefile ZIP and contains the derived source-attributed outline only.
