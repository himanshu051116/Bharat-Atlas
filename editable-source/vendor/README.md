# Genuine, pinned MapLibre distribution

This directory is intentionally **not** a fake MapLibre bundle. The environment where
this package was generated could not reach the npm registry. To install MapLibre GL JS
**5.13.0** from its authentic published npm package:

```bash
python scripts/vendor_maplibre.py --fetch
# Or download `maplibre-gl-5.13.0.tgz` from npm on a connected machine and run:
python scripts/vendor_maplibre.py --tarball ./maplibre-gl-5.13.0.tgz
python scripts/build.py
python scripts/run_renderer_proof.py
```

On success, vendor_maplibre.py extracts `dist/maplibre-gl.js`, `dist/maplibre-gl.css`
and `dist/LICENSE.txt` and records SHA-256 hashes. The builder verifies those hashes
and switches the atlas to same-origin MapLibre files. The runtime worker is included
by MapLibre's prebuilt v5 UMD bundle; there is no stub or API mock.

**Security:** Supplying an unauthenticated tarball lets the supplier control code.
Prefer `npm pack` over a verified TLS connection, or independently validate the
tarball's npm integrity digest against trusted registry metadata.

The renderer-proof page deliberately errors when the files are unavailable. It never
uses the mock objects from the legacy browser tests. A proof passes only when WebGL2
and MapLibre successfully render actual local vector tiles on desktop and mobile
browser configurations. Mobile emulation does not substitute for an actual iOS or
Android GPU test.
