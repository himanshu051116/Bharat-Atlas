# Bharat Atlas v0.26 — Genuine MapLibre/WebGL engineering audit

**Status: BLOCKED in this execution environment. Not a successful GPU proof.**

## Delivered

1. A dedicated browser proof page at `proof/renderer-proof.html` using the **actual MapLibre GL JS API** without any renderer mocks. The page reads the existing **608 local GSHHG/WDBII MVT tiles** through the shared, SHA-256-validating `atlas-detail` protocol, plus the original physical land GeoJSON. All geography is generalized source-derived research data; not official Indian political boundaries.
2. `scripts/vendor_maplibre.py` installs authentic, pinned **MapLibre 5.13.0** UMD/CSS/license files from the original npm package tarball. It supports a connected `npm pack` workflow and an already-downloaded tarball and records checksums. Existing build logic vendors these files, verifies their hashes and replaces the two CDN links with same-origin assets. The installer is tested on a miniature fixture; that fixture is *not* included as a runtime.
3. `scripts/run_renderer_proof.py` opens the real local HTTP-hosted proof page in Chromium desktop/mobile browser contexts. To pass, each context must have WebGL2, the locally bundled MapLibre runtime, successful requests to real tile files, loaded MapLibre styles and **non-zero rendered MVT features**. It saves screenshots and a JSON report on success. Mocked map renderers cannot satisfy this contract.
4. A separate GPU capability diagnostic uses actual canvas WebGL context creation, including alternate ANGLE/SwiftShader flags. A manual, non-deploying GitHub Actions workflow is provided to rerun the full proof with npm and browser dependencies. A GitHub-hosted runner may likewise lack WebGL2; a failed GPU test remains failed, not waived.
5. The published static preview builder packages the renderer-proof page, JS and shared tile source, and the preview verifier requires these assets.

## What testing proved here

| Check | Outcome |
|---|---|
| JavaScript regression | 100 of 100 passed |
| Python/GIS/build regression | 82 of 82 passed |
| Existing atlas desktop/mobile UI smoke tests | Passed **with mock MapLibre** (not WebGL evidence) |
| Atlas Labs real SVG/interactive browser smoke | Passed (not WebGL evidence) |
| Renderer-proof assets packaged and verified | Passed |
| 608 original real-source physical vector tiles packaged | Passed asset verification; still geographically generalized |
| Local MapLibre npm binary acquisition | **Blocked:** container DNS cannot resolve npm or JSDelivr |
| Actual Chromium WebGL2 (desktop and mobile emulation) | **Blocked:** no WebGL1 or WebGL2 contexts, even using SwiftShader flags |
| Genuine MapLibre map with verified rendered vector features | **Not proven** |
| Physical Android/iOS GPU proof | **Not performed** |

The exact evidence is in `docs/real-webgl-evidence/`. The `real-webgl-proof.json` status is `blocked_missing_local_renderer`. **Do not interpret a successful unit-test count, or a mock browser screenshot, as a real GPU-rendering result.**

## How to complete the missing proof

On a network-connected Windows/macOS/Linux computer with working WebGL2 and a current Chrome/Chromium:

```bash
python scripts/vendor_maplibre.py --fetch
python scripts/build.py
python scripts/verify_preview.py
python -m pip install playwright
python -m playwright install chromium
python scripts/run_renderer_proof.py
```

For an offline computer, obtain `maplibre-gl-5.13.0.tgz` from the authentic npm registry on another machine and substitute:

```bash
python scripts/vendor_maplibre.py --tarball /path/to/maplibre-gl-5.13.0.tgz
```

For development preview, serve `dist/` by HTTP and open `/proof/renderer-proof.html`. The proof report and images are written to `docs/real-webgl-evidence/`. If either viewport lacks real rendered vector features, the runner exits non-zero.

A successful two-viewport run **still does not** certify compatibility with physical Android Chrome or iOS Safari devices. Those require separate human or device-farm tests. It also does not verify political geometry, territorial claims, Shaksgam, official licences, roads or nationwide search.

## Release decision

**No-go.** No production deployment or GitHub changes were performed. Maintain the official-geography and real-rendering release gates.
