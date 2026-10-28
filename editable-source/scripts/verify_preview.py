#!/usr/bin/env python3
"""Verify the complete modular Bharat Atlas preview artifact (not sovereignty certification).

This check exists because earlier hosting used a pared-down single-page preview
instead of the complete modular research application. It verifies the emitted
static assets, feature-contract markers, safe release metadata and attribution.
It is deliberately read-only and does not deploy anything.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from world_detail_contract import validate as validate_world_detail

FEATURE_MODULES = [
    'src/geography.mjs', 'src/gazetteer.mjs', 'src/hydrology.mjs', 'src/shorelines.mjs', 'src/landcover.mjs', 'src/physical-only.mjs', 'src/places.mjs',
    'src/coordinates.mjs', 'src/search.mjs', 'src/region-catalog.mjs', 'src/search-shards.mjs', 'src/tiles.mjs',
    'src/export.mjs', 'src/style.mjs', 'src/data.mjs', 'src/renderer-health.mjs','src/transport-pack.mjs','src/detail-math.mjs','src/coverage-inspector.mjs','src/compare.mjs','src/motion.mjs','src/explorer-tools.mjs','src/router.mjs','src/data-readiness.mjs','src/explorer-ui.mjs','src/compare-ui.mjs', 'src/main.mjs',
]
REQUIRED_CONTROLS = [
    'search-input', 'atlas-extra-toggle', 'atlas-quick-search', 'atlas-quick-measure', 'atlas-region-source', 'region-list','region-coverage-tag','coverage-inspector-result','coverage-inspector-check','coverage-inspector-map-center','retry-boundaries','boundary-retry-actions', 'map', 'mobile-menu', 'import-btn',
    'compare-from','compare-to','compare-focus','compare-message','compare-download','compare-available','journey-clear', 'nearby-places', 'atlas-scale-bar', 'atlas-scale-label', 'journey-line-status','journey-play', 'journey-prev','journey-next','journey-progress','zoom-story-title','atlas-layer-inventory',
    'download-svg', 'download-qa', 'my-location','toolkit-status','measure-type','measure-download','route-calculate','save-place','research-overlay-file','coverage-facts','coverage-report-download','source-dialog', 'zoom-in',
    'zoom-out', 'qa-toggle', 'place-toggle', 'tile-status','rivers-toggle','hydrology-attribution','shore-toggle','shore-attribution','land-attribution',
]


def verify(directory):
    site=Path(directory)
    manifest=json.loads((site/'build-manifest.json').read_text(encoding='utf-8'))
    if manifest.get('version')!='1.11':
        raise ValueError('Stale build: expected Bharat Atlas v1.11')
    if (manifest.get('productEdition')!='india-world-research-atlas' or manifest.get('regionCatalogueCount')!=36
        or manifest.get('verifiedAdminPolygonsBundled') is not False):
        raise ValueError('Focused atlas catalogue/release metadata missing or unsafe')
    for k in ('officialGeometryVerified', 'hasAuthoritativeData'):
        if manifest.get(k) is not False:
            raise ValueError(f'Unsupported official-data claim in {k}')
    if manifest.get('noProductionPromotion') is not True:
        raise ValueError('Preview is missing the production release gate')
    files=manifest.get('assets')
    if not isinstance(files,list) or not files:
        raise ValueError('Missing asset manifest')
    seen=set()
    for a in files:
        name=a.get('path')
        if not isinstance(name,str) or name in seen or '..' in Path(name).parts or Path(name).is_absolute():
            raise ValueError('Duplicate or unsafe manifest file')
        seen.add(name)
        path=site/name
        if not path.is_file() or path.stat().st_size!=a['bytes']:
            raise ValueError(f'Missing or truncated file: {name}')
        if hashlib.sha256(path.read_bytes()).hexdigest()!=a['sha256']:
            raise ValueError(f'Tampered deployed asset: {name}')
    if {str(p.relative_to(site)) for p in site.rglob('*') if p.is_file() and p.name!='build-manifest.json'}!=seen:
        raise ValueError('Static directory differs from recorded assets')
    # Global atlas integration: source-derived and independently hashed.
    world_info=manifest.get('worldExplorer',{})
    if world_info.get('mapUnits') != 177 or world_info.get('officiallyVerified') is not False:
        raise ValueError('World explorer count or non-certification missing')
    for name in ('world.html','world.js','world.css','data/world/manifest.json','data/world/world-boundaries.json'):
        if name not in seen or not (site/name).is_file():
            raise ValueError('Incomplete world atlas: '+name)
    if './world.html' not in (site/'index.html').read_text(encoding='utf-8'):
        raise ValueError('India atlas does not link to the World Explorer')
    world_source=json.loads((site/'data/world/manifest.json').read_text(encoding='utf-8'))
    world_paths=(site/'data/world/world-boundaries.json').read_bytes()
    if (world_source.get('count')!=world_info['mapUnits'] or
        world_source.get('officiallyVerified') is not False or
        world_source.get('outputSha256')!=hashlib.sha256(world_paths).hexdigest()):
        raise ValueError('World atlas source integrity or status mismatch')
    # Public domain optional detail and historical physical layer are independent from India claims.
    if not {'world-detail.js','world-detail-geometry.js','world-explore-search.js','world-scale.js'} <= seen or not all(name in (site/'world.html').read_text(encoding='utf8') for name in ('world-detail.js','world-detail-geometry.js','world-explore-search.js','world-scale.js')):
        raise ValueError('World detail browser code missing')
    hydro_meta=json.loads((site/'data/world/hydrography-manifest.json').read_text())
    hydro_raw=(site/'data/world/world-hydrography.json').read_bytes()
    if (hydro_meta.get('schema')!='bharat-world-hydrography-manifest-v1' or
        hydro_meta.get('sha256')!=hashlib.sha256(hydro_raw).hexdigest() or
        hydro_meta.get('named') is not False or hydro_meta.get('current') is not False):
        raise ValueError('World hydrography provenance missing')
    detail=site/'data/world-detail'
    if detail.exists():validate_world_detail(detail)

    # Optional historical capital markers are independently hashed and source-labelled.
    cap_set={'data/world/capitals-manifest.json','data/world/world-capital-references.json','data/world/capitals-license.txt'}
    if cap_set & seen:
        if not cap_set <= seen: raise ValueError('Incomplete capital reference archive')
        cmeta=json.loads((site/'data/world/capitals-manifest.json').read_text(encoding='utf-8'))
        craw=(site/'data/world/world-capital-references.json').read_bytes()
        capital=json.loads(craw)
        country_ids={x['id']:x['name'] for x in json.loads(world_paths)['features']}
        if (cmeta.get('schema')!='bharat-world-capital-manifest-v1' or cmeta.get('sourceVersion')!='0.1.2' or
            cmeta.get('sourceLicense')!='MIT' or cmeta.get('sha256')!=hashlib.sha256(craw).hexdigest() or
            not (120<=len(capital.get('features',[]))<=200) or
            cmeta.get('count')!=len(capital.get('features',[]))):
            raise ValueError('Invalid capital reference metadata, count or hash')
        seen_countries=set()
        for point in capital['features']:
            cid=point.get('countryId')
            if cid not in country_ids or cid in seen_countries or country_ids[cid]!=point.get('country'):
                raise ValueError('Capital reference identity mismatch')
            seen_countries.add(cid)
        if 'MIT' not in (site/'data/world/capitals-license.txt').read_text(encoding='utf-8'):
            raise ValueError('Missing capital data MIT licence')
    html=(site/'index.html').read_text(encoding='utf-8')
    bundle=(site/'app.bundle.js').read_text(encoding='utf-8')
    if 'atlas-focus.css' not in seen or not (site/'atlas-focus.css').is_file():
        raise ValueError('Focused atlas stylesheet missing')
    for control in REQUIRED_CONTROLS:
        if f'id="{control}"' not in html:
            raise ValueError(f'Incomplete viewer: missing #{control}')
    # A genuine renderer proof is a separate, unmocked test, never inferred from asset existence.
    proof_html=site/'proof/renderer-proof.html'
    proof_js=site/'proof/renderer-proof.mjs'
    proof_tiles=site/'src/tiles.mjs'
    if not all(f.is_file() for f in (proof_html,proof_js,proof_tiles)):
        raise ValueError('Missing unmocked renderer proof assets')
    if 'maplibre-gl.js' not in proof_html.read_text() or 'queryRenderedFeatures' not in proof_js.read_text():
        raise ValueError('Invalid renderer proof entry point')
    if manifest.get('externalMapLibreDependency') is False:
        if not all((site/f).is_file() for f in ('maplibre-gl.js','maplibre-gl.css','MAPLIBRE-LICENSE.txt','maplibre-provenance.json')):
            raise ValueError('Locally claimed MapLibre assets are missing')
    if manifest.get('naturalEarthPlaceCount',0):
        metadata=json.loads((site/'data/gazetteer/manifest.json').read_text(encoding='utf-8'))
        if (manifest.get('naturalEarthPlaceCount')!=71 or metadata.get('count')!=71 or
            metadata.get('officiallyVerified') is not False or
            metadata.get('licence')!='Public Domain (Natural Earth)' or
            not (site/'data/gazetteer/SOURCE-AND-LICENCE.txt').is_file()):
            raise ValueError('Verified preview must include the pinned public-domain settlement dataset')
    labs=(site/'atlas-labs.html').read_text(encoding='utf-8')
    labmod=(site/'atlas-labs.mjs').read_text(encoding='utf-8')
    if 'atlas-labs.html' not in html or 'src/atlas-labs.mjs' in labs or 'atlas-labs.mjs' not in labs:
        raise ValueError('Full app does not link to bundled Atlas Labs')
    for marker in ('data-lab-tab=\"studio\"','data-lab-tab=\"learn\"','data-lab-tab=\"observatory\"','data-lab-tab=\"history\"','data-lab-tab=\"stories\"'):
        if marker not in labs:raise ValueError('Incomplete Atlas Labs navigation: '+marker)
    for marker in ('makePhysicalSVG','parseSnapshotCSV','compareSnapshots','worksheetPoints','quizQuestions','haversineKm'):
        if marker not in labmod:raise ValueError('Incomplete Atlas Labs code: '+marker)
    if manifest.get('atlasLabsResearchOnly') is not True or len(manifest.get('atlasLabsModules',[]))!=5:
        raise ValueError('Atlas Labs research gates incomplete')
    for mod in FEATURE_MODULES:
        if f'/* {mod} */' not in bundle:
            raise ValueError(f'Incomplete viewer: missing module {mod}')
    for marker in ('setupFallbackSVG','renderResearchSVG','loadTileManifest','loadLandcover','renderPhysicalOnlySVG','loadGazetteer','loadCommunity','verifyBoundaryDigest'):
        if marker not in bundle:
            raise ValueError(f'Incomplete viewer: missing capability {marker}')
    if 'Survey of India' not in html or ('Provisional geography' not in html and 'Government-claims mode' not in html):
        raise ValueError('Geographic claim/source disclaimer missing')
    if 'noindex' not in html or 'Disallow: /' not in (site/'robots.txt').read_text():
        raise ValueError('Unverified preview must not be indexed')
    return {'version':manifest['version'],'modules':len(FEATURE_MODULES),'assetsVerified':len(seen),'officialGeometryVerified':False,'previewOnly':True}


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('directory',nargs='?',default=str(Path(__file__).resolve().parents[1]/'dist'))
    args=parser.parse_args()
    print(json.dumps(verify(args.directory),indent=2))
