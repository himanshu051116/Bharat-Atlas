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
