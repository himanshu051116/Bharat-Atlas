# Bharat Atlas — India claimed national outline: dataset notice

This **local, non-commercial research build** incorporates a display-optimized derivative of the operator-supplied `Outline_of_India.zip` downloaded for this project. The upload contained one projected Survey of India-labelled Shapefile (`Outline_of_India.shp`, Lambert Conformal Conic / WGS84), not state/district polygons. The source is not independently authenticated against a second download from the Survey of India server.

- Dataset reference: https://surveyofindia.gov.in/pages/outline-maps-of-india
- Official source URL declared: https://surveyofindia.gov.in/documents/Outline_of_India.zip
- Usage notice: https://surveyofindia.gov.in/documents/ibd-vectorformat.pdf
- Official 2026 political map reference (not the same product): https://surveyofindia.gov.in/pages/political-map-of-india
- © Survey of India / Government of India. This vector is restricted to individual/internal/educational/research/website purposes under the published notice. **No commercial usage permitted**. Further republication may require explicit rights clarification.
- Generalized source scale: **1:16 million** per outline page (the usage PDF refers to 1:15m; verify publication scale with Survey of India if material).
- Display processing: reproject to EPSG:4326 and simplify topologically at 0.00008 degree; quantize to 0.000001 degree. No invented boundary points or artificial territorial polygon patches. Preserve 1,151 polygon parts including small islands. Relative geometric symmetric difference versus original source below 0.01%; exact value and checksums are in `data/official-india/manifest.json`.
- Territorial meaning: **Government of India claimed national extent**, not a geopolitical consensus, assertion of present-day administration, line of control, or state/district political map.
- `politicalMap2026GeometryMatched=false`, `administrativeControlVerified=false`, `commercialRedistributionAllowed=false`. The candidate is not approved for a public or commercial production deployment.
- The original Shapefile ZIP is **not** copied into this project archive. Keep the operator-provided original separately for independent source verification.