INTERNAL static preview hosting scaffold (no deployment, no production certification).
Run from the source root after scripts/build.py: docker build -f infra/Dockerfile -t bharat-atlas-research .
Run only on an isolated internal test machine. Intended for real mobile/device acceptance later.
Production gate MUST pass after official data rights, physical GPU verification,
accessibility, routing, datasets, load/caching, rollback and monitoring.
Note: the current Dockerfile references nginx:1.27-alpine and needs internet
or preloaded image. No container image has been built in this environment.
