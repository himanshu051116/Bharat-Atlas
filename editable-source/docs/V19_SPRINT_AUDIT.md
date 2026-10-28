# Bharat Atlas — Sprint 1 implementation audit (v0.19)

**Date:** 23 October 2026  
**Input:** v0.18 source archive and the end-to-end execution blueprint.  
**Decision:** Local **research-preview artifact passed**. Official production publication **blocked**. No hosting or GitHub update made.

## Scope delivered

### BA-001 — Recover and reproduce the actual source
- Restored the complete v0.18 source from the existing full-source archive, not from the pared-down hosted v0.16 preview.
- Retained all ten modular application files, legacy fallback, SVG exporter, tile pipeline, optional gazetteer and geography tools.
- Kept existing semantic map interactions and versioned build output. All 66 JavaScript and 56 Python tests now pass.

### BA-002 — Prevent simplified preview substitution
- Added `scripts/package_preview.py`: validates the *actual* `dist/`, then creates a reproducible ZIP containing exactly its verified assets and `build-manifest.json`.
- Added `scripts/verify_hosted_preview.py`: **after** an authorized research preview deployment, compares the hosted build manifest byte-for-byte against the tested local manifest, then verifies all public assets by size and SHA-256. Vercel configuration-only files (`vercel.json`, `_headers`) are excluded from remote HTTP checks but remain in the local artifact contract.
- Added positive and adversarial tests for both tools. CI creates the same validated preview ZIP as a local test step. The online verifier has only been tested with a simulated remote response: no deployed v0.19 site has been checked.

### BA-001 follow-up — Fix confirmed geographic-import security defects
- Added `validateUserImport()` as a stricter *untrusted upload* entry point and wired the real GeoJSON import control to it.
- New browser-stage screening covers: intersections in large polygon rings (including >512 vertices), duplicate/partially overlapping state footprints, crossing/nested holes, overlapping pieces in one multipolygon, and excessive geometry complexity.
- Legitimate adjoining/shared boundaries and disconnected multipolygon islands pass these regression cases.
- When strict screening fails, the currently loaded map and source attribution remain intact. Very dense or adversarial data fail closed with instructions to use the offline GEOS/GIS workflow.
- **Important distinction:** the ordinary `validateCollection()` still uses a lightweight screening mode for the pinned community research preview. This sprint closes the browser-*import* pathway; it does not independently certify remotely loaded geographic data, and the offline GEOS/topological and authoritative spatial-comparison gates remain mandatory.

## Reproducible checks (this working session)

| Check | Result | What it proves |
|---|---|---|
| `node --test tests/*.test.mjs` | **66/66 passed** | Module logic and new import adversarial fixtures |
| `python -m unittest discover -s tests -p 'test_*.py' -q` | **56/56 passed** | Build, GIS fixtures, packaging, hosted-parity simulation |
| `python scripts/build.py` | **Passed** | Complete static research build assembled |
| `python scripts/verify_preview.py` | **10 modules / 10 assets** | Full modular bundle and local file integrity |
| `node --check dist/app.bundle.js` | **Passed** | Generated script parses |
| `python tests/browser_preview.py` | **Passed** | Desktop/mobile, imported overlaps and >512 self-crossing rejected, fallback UX; MapLibre is **mocked** |
| Synthetic MVT build and decode audit | **Passed** | MVT internal structure of fictional data, **not** real Indian roads |
| `python scripts/release_guard.py --target preview` | **Passed** | Safe local research-preview eligibility |
| `python scripts/release_guard.py --target production` | **Correctly blocked** | No unsupported official geography or WebGL claims |
| `python scripts/package_preview.py --output ...zip` | **Passed** | Immutable ZIP of the exact verified `dist/` |

**Verified preview ZIP SHA-256:** `95fff7d5d50960a494cff660d619b3528772c5072fbbfe3dfb391c50b623ccef`.

## Confirmed blockers remaining

1. **Authoritative geography & permission gate (BA-003–BA-006):** No authorized Survey of India 2026 vector layer in this build. Northern claims and Shaksgam have not been spatially reconciled; community polygons are provisional.
2. **Genuine renderer proof (BA-007):** MapLibre JavaScript is externally loaded unless licensed local vendor files are supplied. This environment did not establish WebGL success on real devices.
3. **Real vector basemap (BA-008–BA-010):** No nationwide licensed roads/water/settlement tile archive. Only fictional tiles are used by tests.
4. **Nationwide place search:** Optional gazetteer machinery exists, but no complete verified catalogue is integrated.
5. **Operational validation:** Real-device graphics profiling, accessible map alternatives, public deployment parity check, and a 1,000-user traffic simulation have not been completed.

## What to do in Sprint 2

- Obtain an authorized, versioned GIS political-boundary candidate, retain licence/rights evidence, and run region-by-region geographic comparison with exceptions and northern-border review.
- Independently vendor pinned MapLibre + license and reproduce a **real** working WebGL map on browsers/devices; record screenshots and failures.
- Create a licensed real-data regional road/river/settlement tile pilot, keeping political boundaries as a distinct reviewed overlay.
- Only after deploying the **same v0.19 `dist/` artifact** to a research-preview environment, run:

```sh
python scripts/verify_hosted_preview.py https://YOUR-PREVIEW-DEPLOYMENT.vercel.app/ --dist dist
```

This verifies site parity, **not** geographic accuracy or readiness for production. Do not promote until every release gate is satisfied.
