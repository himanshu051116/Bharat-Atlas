# Bharat Atlas — v1.11.1 public physical research preview

**Important:** The site intentionally does NOT draw an Indian national political claim outline or state/UT administrative borders: there is no published source-verified SoI 2026 vector dataset in this repository. The **Survey of India 13th edition (2026) political map** is the authoritative reference: https://surveyofindia.gov.in/pages/political-map-of-india.

This repair addresses an incorrect/misleading map display and browser-loading failures. The home page opens with a labeled historical physical coastline SVG with **no national borders**. On browsers with WebGL, locally bundled MapLibre powers interactive physical layers. On browsers without WebGL, the physical SVG remains available.

Source code is in \`editable-source/\`. The deployable, edited site is in \`public-site/\`. \`site.zip\` is the historic v1.11 archive and **is not used** by the Vercel build.

## Release

- Run \`npm install\`, \`npm run build\`; output is \`dist/\`.
- Pin \`maplibre-gl@5.13.0\`; it is bundled into \`dist/vendor/\` at build time and no CDN is necessary.
- SHA-256 is verified for all previously published, unmodified geographic assets. Modified app files are packaged and rehashed to generate the new deployment manifest.
- The official SoI political boundaries, geographic completeness, physical device performance, and real browser interaction **remain unverified**. Do not describe the map as certified or fit for legal or navigational use.

The world atlas uses public-domain Natural Earth historical generalized features; its inaccurate generalized India polygon is hidden. It is not a political map of India.

## Load official Survey of India political boundaries (on-device)

The public GitHub/Vercel build **does not redistribute** Survey of India's Shapefile data. Survey of India's site copyright policy requires permission for reproduction, even though the 2021 geospatial guidelines allow digital display. Source materials are therefore downloaded directly from SoI by the visitor and interpreted locally by a sandboxed browser worker. No official archive is sent to Bharat Atlas servers or stored persistently.

1. Open the app and expand **Load official Survey of India boundaries** in the sidebar.
2. Download the May 2026 [State/District/Subdistrict ABDB RAR](https://surveyofindia.gov.in/documents/State_District_Subdistrict_PAN%20INDIA.rar) from SoI (202,524,438 bytes), or the February 2026 [national outline ZIP](https://surveyofindia.gov.in/documents/Outline_of_India.zip) (7,513,409 bytes).
3. Click **Open downloaded RAR / ZIP** and choose the file in a desktop browser. The RAR importer extracts **only** the State Boundary Shapefile, not the full district data, reprojects the official Lambert Conformal Conic coordinates to WGS84, and draws the source polygons on the map. The smaller ZIP draws the one-feature national outline; it does not supply the states.
4. The importer checks the **SHA-256** digest against the specific original SoI archives downloaded on October 28, 2026. A changed archive is rejected pending a new provenance review. Inspect the status message to ensure the lines finished rendering.
5. The source comprises **40 State Boundary polygons**, including **four specially marked disputed internal areas**. Do not collapse them into the 36-item administrative name list without independent geographic review. The official SoI 2026 [political map](https://surveyofindia.gov.in/pages/political-map-of-india) is the reference for cartographic comparison.

**Source: Survey of India, Government of India.** Local use of officially published source data must comply with its terms; this website does not claim Survey of India endorsement. A successfully loaded, SHA-256-verified source is not the same as independent confirmation that the displayed geometry matches every boundary in the current 2026 political-map edition.


## v1.12.0 security and reliability audit (29 October 2026)

- Migrated self-hosted MapLibre from the affected 5.13.0 release to patched **6.16.0**, served as an ES module with its local worker asset. The previous 5.x package was flagged critical by npm audit. The updated version must pass real browser acceptance in the deployment preview before promotion.
- Validates official ABDB and national-outline archive size and SHA-256 **before** invoking archive extraction or geometry parsing; rejects unmatched files without parsing them. These digests identify specific releases, not a government certificate of the rendered map's accuracy.
- Adds local archive cancellation and clearer memory requirements. Large administrative RAR imports may consume significant browser memory and are best performed on desktop.
- Connects locally imported Survey of India state features to catalogue selection and zoom-to-region while preserving the source's disputed-area records instead of conflating them with the 36 administrative catalogue names.
- Hides political state lines in nonpolitical physical-color styles, keeps a separate national-outline overlay, and highlights selected state boundaries.
- Uses a pinned npm lockfile after generating and reviewing it in CI, for reproducible deployment builds.

The public website remains a **research preview** without automatically bundled Survey of India geometries. The reference source must be downloaded from Survey of India and imported locally by each visitor; import validation does not constitute independent SoI map-edition certification.
