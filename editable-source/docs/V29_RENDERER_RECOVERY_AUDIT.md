# Bharat Atlas v0.29 — renderer recovery and diagnostic audit

Date: 2026-10-24. Release: LOCAL RESEARCH PREVIEW. Production: NO-GO.

## Source changes
- `src/renderer-health.mjs`: pure failure classification, recovery cooldown, and local diagnostic schema; no analytics or external diagnostic submission.
- `src/main.mjs`: visible recovery/report actions, explicit WebGL lost-context fallback, no automatic success claims on context restoration, manual recreation of the MapLibre instance, and restoration of user region/city/coordinate selection after a successful new map load.
- `index.html` and `styles.css`: accessible, persistent controls for map-engine retry and export of a diagnostic JSON, including small viewport layout.
- `scripts/build.py`, `scripts/verify_preview.py`, `scripts/run_renderer_proof.py`, `scripts/release_guard.py` and test version checks: v0.29 staging, manifest and fail-closed production gates.
- `tests/renderer-health.test.mjs` and `tests/browser_preview.py`: regression test for a simulated context loss and manual retry.

## Reproduced bug and fix
**Confirmed in mock browser test:** on renderer restart, `fitAll(false)` reset selected regions, even if they were active before the context was lost. In v0.29 new map loads first reapply the previous selection and camera target; default India zoom is applied only if nothing is selected. Re-run passed after fix.

## Verification completed here
- JS tests: **106 passed / 0 failed**.
- Python unit tests: **92 passed / 0 failed**. One expected Shapely invalid-geometry fixture warning appears during negative tests.
- Desktop and mobile-*emulated* Chromium smoke tests with **synthetic MapLibre**: pass.
- Injected browser `webglcontextlost` event, SVG fallback, JSON download, manual new-map attempt, retained state/selection: **pass with synthetic MapLibre**.
- Staged static build and SHA-256 preview: **645 assets verified**.
- Research preview release guard: pass.
- Production guard: refuse as intended.
- Genuine MapLibre hardware/WebGL2 proof: **BLOCKED (`blocked_missing_local_renderer`, exit 2)**. No actual GPU acceptance claimed.

## Outstanding blocking issues
- Authentic pinned MapLibre distribution not vendored in this environment; real WebGL2 support and device screenshots are not validated here.
- Official Survey of India 2026 political boundary geometry, correct claim/control representations and redistribution rights are not approved.
- Current nationwide roads, railways, waterways, geocoding and verified state/village data are still missing.
- Real mobile hardware, load tests, print/8K and accessibility certification are incomplete.

## Windows review instructions
For the `local-preview.zip`, extract, open PowerShell in the extracted directory, and run `py -3 -m http.server 8000 --bind 127.0.0.1`; visit `http://127.0.0.1:8000/`.
If the GPU map fails, click **Retry map engine** once, then **Download diagnostics**. Review the browser user-agent field and upload the JSON in ChatGPT. The app does not send diagnostics automatically.

This continuation did not deploy or push any GitHub repository.
