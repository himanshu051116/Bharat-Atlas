# Bharat Atlas v0.17 — Critical engineering audit

**Date:** 23 October 2026  
**Scope:** locally built modular research source, not the previously deployed simplified v0.16 preview.

## Verified corrections

1. **Bundled geographic integrity was too weak.** v0.16 checked a matching SHA-256 provenance record, but did not independently re-run a full GEOS topology screen during the static build. An invalid file with a freshly calculated hash could slip through. v0.17 adds `scripts/boundary_gate.py`, invoked from `scripts/build.py`, checking administrative identities, geographic envelope/finite coordinates, ring closure, GEOS validity and substantial pairwise polygon overlaps. Seven unit tests cover nominal, missing, duplicate, bow-tie, overlapping and invalid-coordinate inputs. A build-level regression demonstrates that a rehashed invalid file still fails and preserves the previous good build.
2. **Orphaned source metadata could break loading.** v0.16's general data-folder copy could publish `preview-provenance.json` without its matching `states.provisional.geojson`, forcing runtime failure rather than clean remote fallback. v0.17 rejects orphaned files and only copies verified provenance with its geographic file.
3. **No-WebGL selection was misleading.** Selecting a state changed the side panel but not the displayed SVG. v0.17 regenerates a state-specific SVG after selection and restores the full-India image on reset; the optional labels toggle also refreshes the fallback.
4. **Map-style exceptions could strand the viewer.** On an exception in MapLibre `setStyle`, v0.16 could leave the map marked unready and cover it with a nonfunctional overlay. v0.17 switches to a usable SVG fallback and restores the selected style control. This is covered by a browser regression test.
5. **No explicit static cache/security policy.** The build now includes Vercel and Cloudflare Pages compatible headers with `nosniff`, referrer protection, frame denial, `noindex` for the unverified preview, and conservative data-asset caching. This is *not* load-test evidence.

## Actual test evidence

| Check | Result | Limitation |
|---|---|---|
| JavaScript tests | 56 passed | Pure logic, not GPU performance |
| Python GIS/build tests | 46 passed | Synthetic geometries; official map absent |
| Desktop/mobile browser harness | Passed | MapLibre mocked; synthetic geography |
| New no-WebGL state focus/reset | Passed | SVG generated in browser fixture |
| Map style failure -> SVG | Passed | Controlled exception in fixture |
| Local build / JS syntax | Passed | Remote MapLibre asset still needed |
| Production release guard | Correctly rejects | No production approval evidence |
| Actual WebGL context | Unavailable in local Chromium | Not a genuine MapLibre render test |
| Geographic comparison with Survey of India | Not performed | Official vector file not obtained |
| 1,000 concurrent visitors | Not tested | CDN configuration alone is insufficient |

## Most important limitations

- The deployed Vercel research preview is still **v0.16** and is **not equivalent** to the full local engineering workspace. No v0.17 deployment or GitHub push was performed.
- The current local static build **does not include an authoritative Indian boundary dataset**. It uses a pinned community fallback when online, and the map's source remains explicitly unverified.
- The northern-border spot checks include an unresolved Shaksgam Valley mismatch. Topology validation cannot establish sovereignty, the accuracy of India's official depiction or current administration.
- MapLibre is currently loaded from a CDN; a local vendor distribution was not obtained. No nationwide detailed vector basemap, addresses, satellite imagery or turn-by-turn routing is present.
- The HTML/JS mock tests show interactions and fallbacks, not the fidelity or performance of real MapLibre on mobile GPUs. Exported SVGs inherit geographic uncertainty from their source.
- The 1,000-user scalability milestone needs separate real-browser and tile-caching load tests on deployment infrastructure.

## Required next work

1. Obtain a reusable authoritative Survey of India boundary dataset with licence, edition, and primary-source checks; compare geometry region-by-region and resolve northern-border discrepancies without silent editing.
2. Complete a reproducible vendored MapLibre build and run genuine WebGL in a compatible environment, including keyboard, touchscreen and low-memory mobile tests.
3. Replace provisional/demo geographic layers with properly attributed licensed nationwide roads, rivers, settlements, terrain and a scalable place index.
4. Establish preview-to-source parity in the deployment pipeline; never publish an undocumented manually recreated viewer as though it contained all source functionality.
5. Test concurrent load, distribution costs, accessibility and complete map export on the actual hosted version before production promotion.

**Release decision:** Local research build approved for further development and manual preview only. *Not approved as official geographic data or production mapping service.*
