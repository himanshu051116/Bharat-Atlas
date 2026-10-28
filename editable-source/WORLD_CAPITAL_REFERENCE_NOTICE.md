# World capitals: archived orientation dataset

- Scope: optional points for browsing the generalized world atlas, **not** certified current political capitals.
- Upstream: `countryinfo` Python distribution version 0.1.2, MIT License.
- Coordinate convention: latitude / longitude WGS84-like numeric degrees, from the source snapshot.
- Matching: ISO-2 join against the existing 177 Natural Earth generalized country units.
- Exclusions: omit records with no join, missing coordinates, coordinates outside legal ranges,
  or a point clearly outside its matched country's generalized bounding rectangle (+/-3° tolerance).
  This excludes corrupted Chile, Timor-Leste and Bulgaria points and 11 unavailable entries.
- Result: 163 distinct source-linked records; no name/place data fabricated.
- Do NOT claim that this archival source captures recent capital changes, sovereignty, or
  legal boundaries. Confirm current government capital lists separately before any official use.
- Build evidence: `data/world/capitals-manifest.json` records source-file checksum summary,
  record count, exclusions and SHA-256 digest of `world-capital-references.json`.
- License: full MIT text in `data/world/capitals-license.txt`.
- Survey of India geometry unchanged; the India claim outline remains limited to
  noncommercial local research, without a 2026 political edition certification.
