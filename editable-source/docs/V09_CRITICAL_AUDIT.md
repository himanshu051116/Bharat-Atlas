# Bharat Atlas v0.9 — Critical engineering audit and continuation

**Deployment state:** no production or preview deployment was made this turn. No GitHub writes. Existing Vercel installation remains unchanged.

| Area | Before | v0.9 change | Evidence | Still missing |
|---|---|---|---|---|
| Interactive depth | 36 boundaries at every zoom | 25 pilot city points at zoom >= 5.4; labels at zoom >= 6 | 8 new JS unit tests + mocked browser search test | Real vector basemap, roads, buildings, terrain |
| Search | State/UT names only | Ranked region and pilot city search, aliases and typo tolerance | Unit and browser checks | Official comprehensive place database, geocoder, addresses |
| Data attribution | Map geometry source-aware | Pilot source explicitly labelled approximate; automatically hidden for custom GeoJSON | Imported-file smoke test | Pilot points are not survey verified |
| Font loading | MapLibre demo remote glyphs | Uses local-font path supported by MapLibre >= 5.11 | Style JSON check | Actual WebGL/font rendering untested |
| Renderer distribution | Third-party CDN only | Optional local vendored JS/CSS with licence guard | Build code, manifest assertions | Cannot acquire the upstream runtime in this environment |
| Style-switch reliability | Stale event potential | Style epoch prevents obsolete style event from modifying state | Static code inspection and mocked style tests | Real rapid WebGL style switching not measured |
| Release policy | Fail-closed guard | Remains fail closed | Script execution | Survey of India, performance, licence and GIS signoff |

## Results

- JavaScript: **21/21 passed** (13 existing + 8 new).
- Python: **7/7 passed**.
- Isolated desktop/mobile tests: passed for search, pilot place selection, map controls, QA export, stylesheet switching, imported-data separation, import rejection, and legacy fallback.
- Syntax check: `node --check dist/app.bundle.js` passed.
- Preview release guard: passed; **production guard: blocked by design**.
- **Not tested:** actual MapLibre browser rendering, full dataset load in offline mode, current national border accuracy, real tile throughput, live URL, printed map visual QA or 1,000 simultaneous users.

## Critical observations

1. **Data accuracy is the principal blocker.** The current state geometry remains provisional, with an unresolved Shaksgam discrepancy. A 36-feature count and four point samples cannot certify the map.
2. **The MapLibre executable was unavailable during this sprint.** npm/CDN access from the container failed; mocked browser tests cannot confirm native text, WebGL layers or pinch zoom behavior.
3. **City points are approximate UI test data.** Do not expose them as official capitals, navigation coordinates, point-of-interest addresses or a complete gazetteer. No fabricated roads were added.
4. **No offline public atlas yet.** Without a licensed bundled map source and locally vendored runtime, a fully air-gapped preview cannot display actual Indian geometry.
5. **High-resolution PNG/PDF exports are not implemented in the new WebGL viewer.** The existing legacy SVG export cannot automatically provide additional map detail.

## Next development sprint (v0.10, local only)

A. Acquire and legally vet actual national boundary geometry. Produce full Shapely/topology and Survey of India reference comparison; reconcile every known northern discrepancy before any accuracy claim.

B. Vendor MapLibre with authentic licence; run **real WebGL** tests on a local served application, using network-recorded/supplied fixtures. Verify text rendering without remote demo glyphs.

C. Implement licensed progressive detail using **vector tiles/PMTiles** for water, roads and settlements, with appropriate zoom thresholds and explicit source separation. No unofficial road or street drawings should be invented.

D. Replace pilot city list with an attributable, versioned geographic name dataset and real geocoding logic, once permitted. Test aliases and local Indian language scripts.

E. Build a dedicated print pipeline and staged concurrency tests, then separately validate accessibility and mobile GPU/memory budgets.
