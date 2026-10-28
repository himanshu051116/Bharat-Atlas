# Bharat Atlas v1.11 — optimized public research preview

**Publication status:** packaged and tested locally; no GitHub push or Vercel deployment verified as part of this artifact.

This public-safe version retains the 28 October 2026 performance improvements: frame-coalesced pan/pinch, low-jitter wheel zoom, delayed overlay redraw and compact mobile layer controls. The historical generalized research geography is not a certified political/legal boundary map. The Survey of India-sourced national claimed-outline files were **excluded** pending redistribution and official-source review. Missing-outline messaging remains visible in the application. Do not present this as an official political map of India.

Build locally with `python scripts/build.py`; static output is `dist/`. Vercel should serve `dist/` from a Git-linked source project, or host the contents of the separate ready-to-publish static archive at the repository root with framework preset Other and no build command.

Verification of this public-safe build: 166/166 JavaScript tests; 13/13 focused Python tests; 782 integrity-verified generated static assets. The full Python suite exceeded the execution limit; browser/GPU and physical-device acceptance were not performed for this exact public-safe rebuild.

See `V1_11_PERFORMANCE_FIX_REPORT.md`, `BOUNDARY_SOURCE_AND_USAGE_NOTICE.md`, and `README_OFFICIAL_INDIA_CLAIMS.md` for provenance and limitations.

---

## Publishing

Destination verified before packaging: https://github.com/himanshu051116/Bharat-Atlas (public, `main` branch). Existing Vercel site https://bharat-atlas-research.vercel.app/ serves an older preview and is **not** updated merely by generating this ZIP.

To deploy manually, extract the separate GitHub publishing kit and follow its README. For a Git-linked Vercel project, set `framework: Other`, root directory `/`, no build command (for the root-level site kit), and production branch `main`.

Retain the `noindex,nofollow` research-preview stance. Review all geographic source rights and legal depictions before any official/public-geography certification.
