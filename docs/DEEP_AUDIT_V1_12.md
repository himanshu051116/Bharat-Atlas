# Bharat Atlas v1.12 — Deep Engineering Audit

Date: 29 October 2026

## Release standard

The default public map is a source-labelled **physical-geography research viewer**. It is not a certified Indian political map. Survey of India national and state geometry is read only from an archive the visitor downloads directly from Survey of India and selects locally. No official shape file is bundled, uploaded, silently replaced, or automatically redistributed.

## Findings and corrective actions

| Severity | Finding | Correction | Verification |
| --- | --- | --- | --- |
| Critical | MapLibre GL 5.13.0 has a DOM attribution sanitization vulnerability (CVE-2026-85061). | Pin patched MapLibre 6.16.0; serve ES module and worker locally; remove the classic v5 global script. | npm audit now reports no findings; preview desktop/mobile render with no JavaScript exceptions. |
| High | Official RAR and ZIP were parsed before the pinned SHA-256 comparison. | Check exact source size and SHA-256 first, then extract and reproject. | Release regression test for order and release metadata. |
| High | The SoI regional geometry was independent of the 36-name directory. | Preserve 40 source polygons (including special internal dispute records), map the 36 canonical region names, enable zoom/selection and a highlighted border. | Real Chrome imported May 2026 source and matched 36 names. Selecting Madhya Pradesh zoomed and highlighted its boundary. |
| High | State boundary outlines were present even in physical-only appearance styles. | Zero political line/fill opacity when style is physical, muted, or coastline; restore when state-border style is chosen. | Chrome: 0 opacity in Physical, 0.92 in Regional state-border view. |
| High | Builds lacked a locked dependency tree. | Generate and commit npm package-lock.json with 6.16.0 fixed version. | Pinned lock and Vercel preview build completed. |
| Medium | Large 193 MB RAR import had no cancellation path and could lock devices with little available memory. | Add worker cancellation, worker cleanup, timeout, and minimum size limits. | Static/regression checks; direct Chrome cancellation remains to be retested on the exact final release. |
| Medium | UI still said “no verified polygon” after loading a matching official state shape. | Update sourced search result subtitle, counts and region detail panel. | Automated release test and browser source state mapping. |

## Critical acceptance

- Pinned MapLibre v6 must run on real Chrome desktop and mobile.
- Imported official May 2026 ABDB RAR retains **40 source features**, including disputed intra-India area records, without silently merging or deleting them.
- Directory matching is explicitly **36 administrative names**, not a claim that the source is only 36 polygons.
- The record for Madhya Pradesh must zoom to the region and display the selected sourced state outline; other regions should be independently tested.
- The default physical-only modes must not expose political state outlines.
- Original archive hashes must be checked *before* Shapefile decompression.
- Importing unsupported or modified archives must fail closed.
- Site build and route availability must not alone be treated as map-rendering proof.
- No authenticated user document or government geometry is bundled in the public repository.

## Outstanding limitations

- Individual device performance, very low-memory browsers, and long-session use have not been established.
- Official SoI archive identity and file integrity do not amount to independent visual certification against every line of the latest official political-map edition.
- No SoI dataset redistribution permission was established, so automatic installation for all visitors remains out of scope.
- Cancellation browser test was inconclusive in the first regression session and requires re-run.
- GIS topology validity beyond the existing screening requires specialist review.
- Some features in World Explorer remain generalized physical/research geography, not a legal or authoritative statement of India's borders.

## Links

- [Survey of India political map](https://surveyofindia.gov.in/pages/political-map-of-india)
- [Official administrative database](https://surveyofindia.gov.in/pages/administrative-boundary-data-base-abdb-)
- [CVE-2026-85061 detail](https://docs.devguard.org/vulnerability-database/CVE-2026-85061/)
