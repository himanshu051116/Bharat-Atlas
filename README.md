# Bharat Atlas v1.11 — public research preview

This repository contains the **complete public-safe Bharat Atlas v1.11 application**.
The deployable static site (`site.zip`, 783 files) is archived at the root to ensure the large tile assets are transferred losslessly. Its contents are unpacked into `dist/` during Vercel builds using a dependency-free Node.js extractor.

## Build and run

```bash
npm run build
cd dist
python3 -m http.server 8000
```

On Vercel use **Framework: Other**, **Build Command: `npm run build`**, **Output Directory: `dist`**, and **Node: 20+**. The repo includes `vercel.json` with the public release's HTTP response headers. No external build dependencies are needed.

## Editable source

The complete public-safe source (1,076 files) is retained in four byte-for-byte archive parts under `release/source-parts/` to fit upload limits. Reconstitute it with:

```bash
node scripts/reconstruct-source.mjs
```

The produced `bharat-atlas-v1.11-public-safe-source.zip` has SHA-256 `4689ac8875be8c05af0f8fcf9624edb8312374afaaa6dadbe667147468851e06`.

## Scope and limitations

This is a **research preview**, not a certified official Indian political map or navigational service. The separately supplied Survey of India claim-boundary vector and derivative cache were excluded from this public version pending a documented redistribution review. Historical/generalized layers and their source notices remain, and absence of official boundary certification must not be concealed.

The site ZIP builds successfully and was verified to unpack 783 files. Release tests and source-data audits are documented in `docs/`. Authentic GPU/device acceptance and boundary validation remain outstanding.
