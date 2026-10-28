# Bharat Atlas integrated engineering foundation (v0.37)

**Use the full-source folder** for research development, not the small local-preview folder. The original application and v0.35 features are preserved.

This consolidated branch preserves the previous engineering foundation and adds independently decoded per-tile feature inventories, a safer bounded gazetteer loader, and a source-reviewed one-command regional transport tile workflow. See `V37_INTEGRATED_DEVELOPMENT_REPORT.md` for evidence and limitations. Local JSON export does not transmit user data.

- Complete roadmap: `MASTER_ROADMAP_AND_ENGINEERING_SPEC.md`
- One-command audit: `python scripts/atlas_program.py --run-tests`
- Working preview build: `python scripts/build.py`
- Verify published-static integrity: `python scripts/verify_preview.py`
- Preview server: `python -m http.server 8000 --directory dist --bind 127.0.0.1`
- Real hardware renderer proof (only after genuine MapLibre assets and WebGL2): `python scripts/run_renderer_proof.py`

**Release remains blocked.** Historical physical features and 71 Natural Earth city points are not an authoritative India basemap, the national modern road/rail network is absent, and actual India political vectors/rights, Shaksgam review, real WebGL2 and physical-device evidence are not present.

Do not run `pip install -r requirements-geo.txt` or `scripts/build.py` in the small **local-preview ZIP**. It contains prebuilt `index.html` and static assets; serve it with `py -3 -m http.server 8000` in that folder.

## v0.38 integrated progress
See `V38_INTEGRATED_ENGINEERING_STATUS.md` and `DATA_IMPORT_AND_WINDOWS_ACCEPTANCE.md` for data/import, search, routing, offline, boundary and GPU status. This is a source-backed research preview, not the finished India basemap.