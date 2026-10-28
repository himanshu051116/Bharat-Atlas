# Bharat Atlas v1.11 — GitHub-ready public research preview

## Intended destination
`https://github.com/himanshu051116/Bharat-Atlas` currently contains just a short README. This release **has not been committed** to the remote repository.

## Release choice
- **Static website ZIP** (`Bharat_Atlas_v1_11_Public_GitHub_Site.zip`): files directly at repository root, ready for GitHub Pages or Vercel static hosting. Use this only as a preview, not a production political map.
- **Editable source ZIP** (`Bharat_Atlas_v1_11_Public_Source.zip`): developer scripts, application, tests. After extraction run `python scripts/build.py` to produce `dist/`; publish **dist/**, not the whole source project, to a static host.

## Scope and licensing
This public build deliberately excludes `data/official-india/india-claim.geojson`, the Survey of India-based claim outline and its manifest. It therefore **cannot depict or certify official Indian political borders**, but remains a world/India geography research preview. No commercial-redistribution permission is asserted. All included Natural Earth and historical physical reference layers retain source and licence notices. They are not certified navigation or legal boundary data.

## How to use with the existing repository
The repository has a README already. Review files and replace that minimal README with the release README if desired; do not blindly force-push. Copy the static ZIP contents into the repository root; commit on a preview branch first and review any Vercel/GitHub Pages deployment preview before promoting. The static archive does not make any remote changes by itself.

## Local tests
The release was built and passed static-manifest checks. JavaScript unit tests completed successfully. Native Chromium hardware rendering, physical devices, and certified political boundaries remain unverified. See `V1_11_PERFORMANCE_AND_UI_AUDIT.md` for a broader prior test report.