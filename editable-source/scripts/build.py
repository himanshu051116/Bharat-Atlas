#!/usr/bin/env python3
"""Build a local static MapLibre research viewer. No network/deploy effects.
Source modules remain edited independently; emitted app.bundle.js is deterministic.
"""
import re,hashlib,json,shutil,sys,subprocess
from pathlib import Path
R=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(Path(__file__).resolve().parent))
from mvt_audit import audit_archive
from world_detail_contract import validate as validate_world_detail
MODULES=['src/geography.mjs','src/gazetteer.mjs','src/hydrology.mjs','src/shorelines.mjs','src/landcover.mjs','src/physical-only.mjs','src/places.mjs','src/coordinates.mjs','src/search.mjs','src/region-catalog.mjs','src/search-shards.mjs','src/tiles.mjs','src/export.mjs','src/style.mjs','src/data.mjs','src/renderer-health.mjs','src/transport-pack.mjs','src/detail-math.mjs','src/coverage-inspector.mjs','src/compare.mjs','src/motion.mjs','src/explorer-tools.mjs','src/router.mjs','src/data-readiness.mjs','src/explorer-ui.mjs','src/compare-ui.mjs','src/main.mjs']
def check_module_function_names(root=R,modules=MODULES):
    """Detect cross-module function declarations which a concatenation build silently overwrites.

    This is deliberately a conservative check for top-level declarations, not a full JS parser.
    The final Node --check and browser suite remain mandatory.
    """
    seen={}
    for module in modules:
        source=(root/module).read_text(encoding='utf-8')
        for name in re.findall(r'(?m)^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(',source):
            if name in seen:
                raise ValueError(f'Function declaration collision: {name} in {seen[name]} and {module}')
            seen[name]=module
    return len(seen)

def _build_staged(root=R):
    dist=root/'.dist-staging'
    if dist.exists():shutil.rmtree(dist)
    dist.mkdir()
    for name in ['index.html','styles.css','atlas-focus.css','atlas-labs.html','atlas-labs.css','START_PREVIEW_WINDOWS.bat','README_PREVIEW.txt','world.html','world.css','world-camera-scheduler.js','world.js','world-detail-geometry.js','world-place-search.js','world-explore-search.js','world-scale.js','world-detail.js','atlas-visitor.js']:
        shutil.copy2(root/name,dist/name)
    shutil.copy2(root/'src/atlas-labs.mjs',dist/'atlas-labs.mjs')
    shutil.copy2(root/'offline-shell.js',dist/'offline-shell.js')
    # Unmocked renderer-proof page imports the real shared tile protocol module.
    (dist/'proof').mkdir()
    shutil.copy2(root/'proof/renderer-proof.html',dist/'proof/renderer-proof.html')
    shutil.copy2(root/'proof/renderer-proof.mjs',dist/'proof/renderer-proof.mjs')
    (dist/'src').mkdir()
    shutil.copy2(root/'src/tiles.mjs',dist/'src/tiles.mjs')
    result_labs=subprocess.run(['node','--check',str(dist/'atlas-labs.mjs')],capture_output=True,text=True)
    if result_labs.returncode:raise ValueError('Atlas Labs module has invalid syntax: '+result_labs.stderr[:300])
    check_module_function_names(root)
    segments=[]
    for name in MODULES:
        src=(root/name).read_text()
        src=re.sub(r'^import\s+.*?\s+from\s+[\'"][^\'"]+[\'"];?\s*$', '', src, flags=re.M)
        src=re.sub(r'\bexport\s+(?=(?:const|let|function|async function|class)\b)','',src)
        if re.search(r'(?m)^\s*(?:import|export)\s+',src):raise ValueError(f'Unbundled import/export in {name}')
        segments.append(f'\n/* {name} */\n'+src)
    bundle='/* Bharat Atlas v1.11 — deterministic local application bundle. */\n(()=>{\n'+''.join(segments)+'\n})();\n'
    (dist/'app.bundle.js').write_text(bundle)
    # The no-npm concatenation build has a shared JS scope. Fail closed on symbol collisions.
    result=subprocess.run(['node','--check',str(dist/'app.bundle.js')],capture_output=True,text=True)
    if result.returncode:raise ValueError('Bundled application is not syntactically valid: '+result.stderr[:400])
    html=(dist/'index.html').read_text()
    html=html.replace('<script type="module" src="./src/main.mjs"></script>','<script defer src="./app.bundle.js"></script>')
    (dist/'index.html').write_text(html)
    # Copy unrestricted static data before specialized source-checking.
    shutil.copytree(root/'data',dist/'data',ignore=shutil.ignore_patterns('*.geojson','*.zip','tiles','gazetteer','search-index','preview-provenance.json','boundary-screen.json','hydrography','shorelines','landcover','official-india'))
    # World geography is a separate, source-labelled Natural Earth preview, never
    # a substitute for official Indian boundary geometry.
    world=root/'data/world'
    for name in ('world-countries.geojson','world-boundaries.json','manifest.json'):
        if not (world/name).is_file() or (world/name).is_symlink():
            raise ValueError('Missing or unsafe world geography source: '+name)
    world_meta=json.loads((world/'manifest.json').read_text(encoding='utf-8'))
    world_data=json.loads((world/'world-boundaries.json').read_text(encoding='utf-8'))
    if (world_meta.get('officiallyVerified') is not False or
        world_meta.get('suitableForLegalBoundaryDecisions') is not False or
        world_meta.get('licence')!='Public domain (Natural Earth)' or
        world_data.get('schema')!='bharat-world-generalized-v1' or
        world_meta.get('count')!=len(world_data.get('features',[])) or
        not 170<=world_meta.get('count',0)<=300):
        raise ValueError('World geography cannot be certified or has invalid metadata')
    if (hashlib.sha256((world/'world-boundaries.json').read_bytes()).hexdigest()!=world_meta.get('outputSha256') or
        hashlib.sha256((world/'world-countries.geojson').read_bytes()).hexdigest()!=world_meta.get('inputSha256') or
        world_data.get('inputSha256')!=world_meta.get('inputSha256')):
        raise ValueError('World geographic source and output SHA-256 mismatch')
    (dist/'data/world').mkdir(parents=True,exist_ok=True)
    shutil.copy2(world/'world-boundaries.json',dist/'data/world/world-boundaries.json')
    shutil.copy2(world/'manifest.json',dist/'data/world/manifest.json')
    # Optional independently hashed reference capitals, not a certified current list.
    capdata=world/'world-capital-references.json';capmeta=world/'capitals-manifest.json'
    if capdata.exists() or capmeta.exists():
        if not capdata.is_file() or not capmeta.is_file() or capdata.is_symlink() or capmeta.is_symlink():
            raise ValueError('Capitals data/manifest must be a safe complete pair')
        raw=capdata.read_bytes();info=json.loads(capmeta.read_text(encoding='utf8'))
        capital=json.loads(raw)
        ids={x['id']:x['name'] for x in world_data['features']}
        if (info.get('schema')!='bharat-world-capital-manifest-v1' or
            info.get('sourceVersion')!='0.1.2' or info.get('sourceLicense')!='MIT' or
            info.get('file')!='world-capital-references.json' or
            info.get('sha256')!=hashlib.sha256(raw).hexdigest() or len(raw)>80000 or
            capital.get('schema')!='bharat-world-capital-references-v1' or
            not isinstance(capital.get('features'),list) or
            not 120<=len(capital['features'])<=200 or info.get('count')!=len(capital['features'])):
            raise ValueError('Capitals reference integrity/reuse check failed')
        seen=set()
        for record in capital['features']:
            if (record.get('countryId') not in ids or ids[record['countryId']]!=record.get('country')
                or record['countryId'] in seen or not 1<=len(record.get('name',''))<=120
                or not all(isinstance(record.get(key),(int,float)) and not isinstance(record.get(key),bool)
                           for key in ('lat','lon')) or not -90<=record['lat']<=90
                or not -180<=record['lon']<=180):
                raise ValueError('Invalid source-linked capital record')
            seen.add(record['countryId'])
        shutil.copy2(capdata,dist/'data/world/world-capital-references.json')
        shutil.copy2(capmeta,dist/'data/world/capitals-manifest.json')
        licence=world/'capitals-license.txt'
        if not licence.is_file() or 'MIT' not in licence.read_text(encoding='utf8'):
            raise ValueError('World capitals must retain upstream MIT licence')
        shutil.copy2(licence,dist/'data/world/capitals-license.txt')

    # World physical hydrography: actual historical source, never named/current.
    hydro_files=['world-hydrography.json','hydrography-manifest.json']
    hydro_meta=json.loads((world/hydro_files[1]).read_text(encoding='utf8'))
    hydro_raw=(world/hydro_files[0]).read_bytes()
    if (hydro_meta.get('schema')!='bharat-world-hydrography-manifest-v1' or
        hydro_meta.get('licence')!='LGPL-3.0-or-later' or hydro_meta.get('current') is not False or
        hydro_meta.get('named') is not False or hydro_meta.get('bytes')!=len(hydro_raw) or
        hydro_meta.get('sha256')!=hashlib.sha256(hydro_raw).hexdigest() or
        not 100<=hydro_meta.get('worldLines',0)<=25000 or len(hydro_raw)>2000000):
        raise ValueError('Invalid world river licence or source bytes')
    if json.loads(hydro_raw).get('lines')!=hydro_meta['worldLines']:raise ValueError('World watercourse count mismatch')
    for name in hydro_files:shutil.copy2(world/name,dist/'data/world'/name)
    # Historical physical shorelines and inland water from pinned GSHHG/WDBII.
    # Never treat these line/polygon shapes as political boundary data.
    shoreline=world/'world-shorelines.json';shoremeta=world/'shoreline-manifest.json'
    if shoreline.exists() != shoremeta.exists():
        raise ValueError('World physical shoreline data and manifest must be a complete pair')
    world_shores=0
    if shoreline.exists():
        if shoreline.is_symlink() or shoremeta.is_symlink():raise ValueError('Unsafe shoreline files')
        blob=shoreline.read_bytes();meta=json.loads(shoremeta.read_text(encoding='utf8'))
        payload=json.loads(blob)
        if (meta.get('schema')!='bharat-world-shoreline-manifest-v1' or
            meta.get('licence')!='LGPL-3.0-or-later' or meta.get('current') is not False or
            meta.get('politicalAuthority') is not False or
            meta.get('sha256')!=hashlib.sha256(blob).hexdigest() or
            meta.get('bytes')!=len(blob) or len(blob)>3_000_000 or
            payload.get('schema')!='bharat-world-historical-shorelines-v1' or
            payload.get('source')!='GSHHG/WDBII 2.3.6 via basemap-data 2.0.0' or
            payload.get('licence')!='LGPL-3.0-or-later' or payload.get('current') is not False or
            payload.get('politicalAuthority') is not False or
            payload.get('coastSegments')!=meta.get('coastSegments') or
            payload.get('inlandWaterParts')!=meta.get('inlandWaterParts') or
            not 100<=meta.get('coastSegments',0)<=3000 or not 100<=meta.get('inlandWaterParts',0)<=1500):
            raise ValueError('Physical shoreline data failed provenance and integrity verification')
        for name in ('world-shorelines.json','shoreline-manifest.json'):
            shutil.copy2(world/name,dist/'data/world'/name)
        world_shores=meta['coastSegments']
        for file in ('COPYING.LESSER','COPYING.GPL','LICENSE-AND-SOURCE.txt'):
            src=root/'source-data'/file
            if not src.is_file() or src.is_symlink():raise ValueError('Historical physical data licence missing: '+file)
            shutil.copy2(src,dist/'data/world'/file)
    # Optional public-domain Natural Earth geographic detail, importable from reviewed local files.
    detail=root/'data/world-detail'
    detail_count={}
    if detail.exists():
        meta=validate_world_detail(detail)
        shutil.copytree(detail,dist/'data/world-detail',dirs_exist_ok=True)
        detail_count={layer:rec['count'] for layer,rec in meta['layers'].items()}

    # Optional SoI source-declared claimed national outline. No unpublished SoI
    # copyrighted vectors are bundled by default; user must provide approved data.
    soi=root/'data/official-india'
    if soi.exists():
        if not soi.is_dir() or soi.is_symlink() or {p.name for p in soi.iterdir()}!={'india-claim.geojson','manifest.json'}:
            raise ValueError('Official India outline folder must contain only the approved two-file pair')
        meta=json.loads((soi/'manifest.json').read_text(encoding='utf-8'))
        raw=(soi/'india-claim.geojson').read_bytes()
        if (meta.get('schema')!='bharat-atlas-soi-claim-outline-v1' or
            meta.get('sourceUrl')!='https://surveyofindia.gov.in/documents/Outline_of_India.zip' or
            meta.get('outlineSha256')!=hashlib.sha256(raw).hexdigest() or
            meta.get('claimOnly') is not True or meta.get('commercialRedistributionAllowed') is not False or
            meta.get('politicalMap2026GeometryMatched') is not False or
            meta.get('administrativeControlVerified') is not False or
            not meta.get('sourceSha256') or len(raw)>12_000_000):
            raise ValueError('Official claim outline missing safe provenance and source checks')
        from shapely.geometry import shape
        collection=json.loads(raw)
        if collection.get('type')!='FeatureCollection' or len(collection.get('features',[]))!=1:
            raise ValueError('Official claim outline must be a one-feature GeoJSON FeatureCollection')
        geometry=shape(collection['features'][0]['geometry'])
        if geometry.geom_type not in ('Polygon','MultiPolygon') or geometry.is_empty or not geometry.is_valid or not (60<=geometry.bounds[0]<geometry.bounds[2]<=102 and 3<=geometry.bounds[1]<geometry.bounds[3]<=42):
            raise ValueError('Official claim outline geometry failed independent build checks')
        shutil.copytree(soi,dist/'data/official-india')
    subprocess.run(['node','--check',str(dist/'world.js')],check=True,capture_output=True)
    subprocess.run(['node','--check',str(dist/'atlas-visitor.js')],check=True,capture_output=True)
    # Optional self-hosted MapLibre vendor package: both distribution files and the BSD licence are required.
    vend=root/'vendor'
    engine_local=False
    if (vend/'maplibre-gl.js').exists() or (vend/'maplibre-gl.css').exists():
        if not all((vend/f).is_file() for f in ['maplibre-gl.js','maplibre-gl.css','MAPLIBRE-LICENSE.txt']):
            raise ValueError('MapLibre vendoring is incomplete: JS, CSS and licence must be provided together')
        for filename in ['maplibre-gl.js','maplibre-gl.css','MAPLIBRE-LICENSE.txt']:
            shutil.copy2(vend/filename,dist/filename)
        html=(dist/'index.html').read_text()
        html=html.replace('https://cdn.jsdelivr.net/npm/maplibre-gl@5.13.0/dist/maplibre-gl.css','./maplibre-gl.css')
        html=html.replace('https://cdn.jsdelivr.net/npm/maplibre-gl@5.13.0/dist/maplibre-gl.js','./maplibre-gl.js')
        (dist/'index.html').write_text(html)
        engine_local=True
        provenance=vend/'maplibre-provenance.json'
        if not provenance.exists():raise ValueError('MapLibre must carry pinned npm distribution provenance')
        detail=json.loads(provenance.read_text())
        if detail.get('version')!='5.13.0' or detail.get('package')!='maplibre-gl':
            raise ValueError('Unexpected MapLibre version or package')
        if not __import__('re').fullmatch(r'sha512-[A-Za-z0-9+/]{86}==',detail.get('npmIntegrity','')) or not __import__('re').fullmatch(r'[0-9a-f]{64}',detail.get('tarballSha256','')):
            raise ValueError('Authentic npm SHA-512 provenance is required before publishing renderer assets')
        if set(detail.get('sha256',{})) != {'maplibre-gl.js','maplibre-gl.css','MAPLIBRE-LICENSE.txt'}:
            raise ValueError('MapLibre provenance must cover every required renderer asset')
        for name,digest in detail.get('sha256',{}).items():
            if name not in ['maplibre-gl.js','maplibre-gl.css','MAPLIBRE-LICENSE.txt'] or hashlib.sha256((vend/name).read_bytes()).hexdigest()!=digest:
                raise ValueError('MapLibre provenance checksum mismatch')
        shutil.copy2(provenance,dist/'maplibre-provenance.json')
    # Publish only legacy browser assets; never expose local GIS/build/release scripts.
    (dist/'legacy').mkdir()
    for filename in ['index.html','app.js','styles.css']:
        shutil.copy2(root/'legacy'/filename,dist/'legacy'/filename)

    source=root/'data/states.provisional.geojson';meta=root/'data/preview-provenance.json'
    bundled=False
    boundary_screen=None
    if source.exists() != meta.exists():
        raise ValueError('Provisional geography and provenance metadata must be provided together')
    if source.exists():
        if not meta.is_file():raise ValueError('Provisional GeoJSON requires provenance metadata')
        details=json.loads(meta.read_text())
        if details.get('officiallyVerified') is not False:raise ValueError('Research geography may not claim official verification')
        if details.get('sha256')!=hashlib.sha256(source.read_bytes()).hexdigest():raise ValueError('Geography checksum mismatch')
        if not details.get('licence') or not details.get('attribution') or not details.get('sourceUrl','').startswith('https://'):raise ValueError('Missing geographic licence, attribution, or source')
        from boundary_gate import screen_file
        boundary_screen = screen_file(source)
        (dist/'data/boundary-screen.json').write_text(json.dumps(boundary_screen,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
        shutil.copy2(source,dist/'data/states.provisional.geojson');shutil.copy2(meta,dist/'data/preview-provenance.json')
        bundled=True
    # Optional separately sourced modern research transport pack. Strictly separate
    # from the historical physical tiles and unavailable for official border claims.
    transport_dir=root/'data/transport-pack'
    if transport_dir.exists():
        if transport_dir.is_symlink() or not transport_dir.is_dir():raise ValueError('Transport pack must be a real directory')
        manifest_path=transport_dir/'atlas-tiles.json'
        if not manifest_path.is_file():raise ValueError('Transport pack missing atlas-tiles.json')
        audit_archive(transport_dir)
        info=json.loads(manifest_path.read_text(encoding='utf-8'))
        if (info.get('officiallyVerified') is not False or not info.get('sourceLayers')
            or not info.get('attribution') or not info.get('licence')
            or not str(info.get('sourceUrl','')).startswith('https://')
            or not set(info.get('layers',[]))<= {'roads','railways','rivers','settlements'}):
            raise ValueError('Transport pack has incomplete provenance or unsupported layers')
        hashes=info.get('tileHashes',{})
        if len(hashes)!=info.get('tileCount') or len(hashes)>25000:raise ValueError('Transport pack tile count invalid')
        for name,digest in hashes.items():
            if not re.fullmatch(r'(?:[0-9]|1[0-2])/(?:0|[1-9][0-9]*)/(?:0|[1-9][0-9]*)\.pbf',name):
                raise ValueError('Unexpected transport tile path')
            tile=transport_dir/name
            if not tile.is_file() or tile.is_symlink() or hashlib.sha256(tile.read_bytes()).hexdigest()!=digest:
                raise ValueError('Transport tile checksum mismatch: '+name)
        if any(f.is_symlink() for f in transport_dir.rglob('*')):raise ValueError('Transport pack must not contain symlinks')
        if {str(f.relative_to(transport_dir)) for f in transport_dir.rglob('*.pbf')}!=set(hashes):
            raise ValueError('Unregistered transport tiles present')
        shutil.copytree(transport_dir,dist/'data/transport-pack')
    # Bundled historical river data, reviewed for structure, source rights and hash.
    # Only the specific hydrology directory is approved; generic GeoJSON is ignored.
    hydro_dir=root/'data/hydrography'
    bundled_hydro=False
    if hydro_dir.exists():
        permitted={'rivers.geojson','manifest.json','LICENSE-AND-SOURCE.txt','COPYING.LESSER','COPYING.GPL'}
        if set(p.name for p in hydro_dir.iterdir())!=permitted:raise ValueError('Incomplete hydrology source/rights files')
        hydro_info=json.loads((hydro_dir/'manifest.json').read_text(encoding='utf-8'))
        raw=(hydro_dir/'rivers.geojson').read_bytes()
        if (hydro_info.get('format')!='BharatAtlasHydrology1' or hydro_info.get('officiallyVerified') is not False
            or hydro_info.get('riverNamesVerified') is not False or hydro_info.get('licence')!='LGPL-3.0-or-later'
            or not str(hydro_info.get('sourceUrl','')).startswith('https://')
            or not hydro_info.get('attribution') or hydro_info.get('sha256')!=hashlib.sha256(raw).hexdigest()
            or len(raw)>900_000):raise ValueError('Historical hydrology provenance or data integrity invalid')
        from shapely.geometry import shape,box
        features=json.loads(raw)
        if features.get('type')!='FeatureCollection' or not isinstance(features.get('features'),list) or len(features['features'])!=hydro_info.get('featureCount') or not 1<=len(features['features'])<=2400:
            raise ValueError('Historical hydrology collection/count invalid')
        study=box(68,6,99,38);point_count=0
        for f in features['features']:
            g=shape(f.get('geometry'))
            if g.geom_type!='LineString' or g.is_empty or not g.is_valid or not study.covers(g):
                raise ValueError('Invalid or out-of-window hydrology geometry')
            point_count+=len(g.coords)
            if point_count>35_000:raise ValueError('Hydrology vertex complexity too high')
        shutil.copytree(hydro_dir,dist/'data/hydrography')
        bundled_hydro=True
    # Optional locally supplied gazetteer: require provenance and verify every point at build-time.
    gaz_dir=root/'data/gazetteer'
    bundled_places=False; natural_earth_count=0
    if gaz_dir.exists():
        manifest_path=gaz_dir/'manifest.json';points_path=gaz_dir/'places.geojson'
        if not manifest_path.is_file() or not points_path.is_file():
            raise ValueError('Place dataset must have places.geojson and manifest.json')
        if any(x.name not in ('places.geojson','manifest.json','SOURCE-AND-LICENCE.txt') for x in gaz_dir.iterdir()):
            raise ValueError('Unrecognized place dataset file; refuse publishing unrelated private data')
        info=json.loads(manifest_path.read_text(encoding='utf-8'))
        data=points_path.read_bytes()
        if (info.get('format')!='BharatAtlasGazetteer1' or info.get('officiallyVerified') is not False
            or not info.get('sourceUrl','').startswith('https://') or not info.get('licence')
            or not info.get('attribution') or info.get('sha256')!=hashlib.sha256(data).hexdigest()
            or len(data)>4_000_000):
            raise ValueError('Place catalogue provenance, checksum or size invalid')
        entries=json.loads(data)
        import math
        from import_boundary_data import EXPECTED,ALIASES
        allowed={'city','town','village','landmark','station'}
        seen=set()
        if entries.get('type')!='FeatureCollection' or not isinstance(entries.get('features'),list) or not 1<=len(entries['features'])<=10000 or info.get('count')!=len(entries['features']):
            raise ValueError('Place catalogue count/structure invalid')
        for f in entries['features']:
            p=f.get('properties',{});g=f.get('geometry',{});id=p.get('id');name=p.get('name','');region=ALIASES.get(p.get('region'),p.get('region'))
            c=g.get('coordinates',[])
            if (f.get('type')!='Feature' or g.get('type')!='Point' or not isinstance(c,list) or len(c)!=2
                or not all(type(v) in (int,float) and math.isfinite(v) for v in c)
                or not (60<=c[0]<=102 and 3<=c[1]<=41) or not isinstance(id,str) or not re.fullmatch('[A-Za-z0-9_-]{1,70}',id)
                or id in seen or not isinstance(name,str) or not (0<len(name.strip())<=120)
                or region not in EXPECTED or p.get('kind') not in allowed
                or not isinstance(p.get('aliases',[]),list) or len(p.get('aliases',[]))>6
                or any(not isinstance(v,str) or not 0<len(v.strip())<=120 for v in p.get('aliases',[]))):
                raise ValueError('Malformed or duplicate place catalogue entry')
            seen.add(id)
        # Natural Earth carries additional provenance, including a pinned blob identity.
        if info.get('sourceDataset')=='Natural Earth 1:50m populated places':
            ne_file=root/'source-data/natural-earth-50m-india-places.tsv'
            source_license=gaz_dir/'SOURCE-AND-LICENCE.txt'
            if (not ne_file.is_file() or not source_license.is_file() or
                info.get('count')!=71 or info.get('licence')!='Public Domain (Natural Earth)' or
                info.get('pinnedGitBlobSha')!='f692f6a1311569612a2d3fbb3554e97ec0bfe64c' or
                info.get('inputSubsetSha256')!='9bef07c58379fe977444a6cc0915346f033d6ba0899343cbc5f85eee2054d0d8' or
                info.get('inputSubsetSha256')!=hashlib.sha256(ne_file.read_bytes()).hexdigest() or
                'public domain' not in source_license.read_text(encoding='utf-8').lower()):
                raise ValueError('Pinned Natural Earth data provenance or subset invalid')
        elif (gaz_dir/'SOURCE-AND-LICENCE.txt').exists():
            raise ValueError('Unexpected license file for unrelated gazetteer')
        natural_earth_count=71 if info.get('sourceDataset')=='Natural Earth 1:50m populated places' else 0
        shutil.copytree(gaz_dir,dist/'data/gazetteer')
        bundled_places=True
    # Independently indexed, source-checked public-domain or reviewed place names.
    search_dir=root/'data/search-index'
    search_bundled=False
    if search_dir.is_dir():
        manifest_file=search_dir/'manifest.json'
        if not manifest_file.is_file():raise ValueError('Search index missing manifest')
        m=json.loads(manifest_file.read_text(encoding='utf-8'))
        if (m.get('format')!='BharatAtlasSearchShards1' or m.get('researchOnly') is not True
            or m.get('officiallyVerified') is not False or not m.get('licence') or not m.get('attribution')
            or not str(m.get('sourceUrl','')).startswith('https://') or not isinstance(m.get('shards'),dict)
            or not 1<=m.get('recordCount',0)<=500000):raise ValueError('Invalid source review for search')
        listed={'manifest.json'}
        for key,detail in m['shards'].items():
            if not re.fullmatch(r'(?:[a-f0-9]{6}){2}',key) or detail.get('path')!=key+'.jsonl':
                raise ValueError('Unsafe search shard identifier')
            file=search_dir/detail['path'];listed.add(detail['path'])
            if (not file.is_file() or file.is_symlink() or file.stat().st_size!=detail.get('bytes')
                or file.stat().st_size>8_000_000 or hashlib.sha256(file.read_bytes()).hexdigest()!=detail.get('sha256')):
                raise ValueError('Tampered search shard: '+key)
        if {f.name for f in search_dir.iterdir()}!=listed:
            raise ValueError('Search index contains unreviewed files')
        shutil.copytree(search_dir,dist/'data/search-index');search_bundled=True
    # Historical physical shoreline outlines. No arbitrary GeoJSON reaches the public build.
    shores=root/'data/shorelines'; bundled_shores=False
    if shores.exists():
        permitted={'coastlines.geojson','lakes.geojson','manifest.json','LICENSE-AND-SOURCE.txt','COPYING.LESSER','COPYING.GPL','tile-source.json'}
        if {p.name for p in shores.iterdir()}!=permitted:raise ValueError('Incomplete physical shoreline source and rights files')
        info=json.loads((shores/'manifest.json').read_text())
        if info.get('format')!='BharatAtlasShorelines1' or info.get('officiallyVerified') is not False or info.get('namesVerified') is not False or info.get('licence')!='LGPL-3.0-or-later' or not info.get('attribution') or not str(info.get('sourceUrl','')).startswith('https://') or info.get('extent')!=[68,6,99,38]:
            raise ValueError('Historical shoreline source metadata invalid')
        for layer in ('coastlines','lakes'):
            raw=(shores/f'{layer}.geojson').read_bytes();meta=info.get('layers',{}).get(layer,{})
            if len(raw)>350_000 or len(raw)!=meta.get('bytes') or hashlib.sha256(raw).hexdigest()!=meta.get('sha256'):
                raise ValueError('Historical shoreline bytes not verified')
            fc=json.loads(raw)
            if fc.get('type')!='FeatureCollection' or not isinstance(fc.get('features'),list) or len(fc['features'])!=meta.get('count') or not 1<=len(fc['features'])<=300:raise ValueError('Invalid physical shoreline features')
            vertices=0
            for f in fc['features']:
                g=f.get('geometry',{});coords=g.get('coordinates',[]);vertices+=len(coords)
                if f.get('type')!='Feature' or g.get('type')!='LineString' or not isinstance(coords,list) or len(coords)<2 or not str(f.get('properties',{}).get('name','')).startswith('Unlabelled'):
                    raise ValueError('Invalid shoreline geometry / invented names')
                if vertices>20000 or any(not isinstance(p,list) or len(p)!=2 or not all(type(x) in (int,float) and __import__('math').isfinite(x) for x in p) or not 68<=p[0]<=99 or not 6<=p[1]<=38 for p in coords):
                    raise ValueError('Shoreline coordinate or complexity invalid')
        shutil.copytree(shores,dist/'data/shorelines');bundled_shores=True
    land_dir=root/'data/landcover';bundled_land=False
    if land_dir.exists():
        expected={'land.geojson','manifest.json','LICENSE-AND-SOURCE.txt','COPYING.LESSER','COPYING.GPL'}
        if {f.name for f in land_dir.iterdir()}!=expected:raise ValueError('Incomplete physical land mask and licence files')
        info=json.loads((land_dir/'manifest.json').read_text())
        raw=(land_dir/'land.geojson').read_bytes()
        if (info.get('format')!='BharatAtlasLandcover1' or info.get('officiallyVerified') is not False
            or info.get('administrativeBoundaries') is not False or info.get('licence')!='LGPL-3.0-or-later'
            or not str(info.get('sourceUrl','')).startswith('https://') or not info.get('attribution')
            or info.get('extent')!=[68,6,99,38] or len(raw)>400_000 or len(raw)!=info.get('bytes')
            or hashlib.sha256(raw).hexdigest()!=info.get('sha256')):
            raise ValueError('Physical land mask provenance or digest invalid')
        from shapely.geometry import shape,box
        fc=json.loads(raw);features=fc.get('features',[])
        if fc.get('type')!='FeatureCollection' or not isinstance(features,list) or len(features)!=info.get('featureCount') or not 1<=len(features)<=200:
            raise ValueError('Physical land mask feature count invalid')
        study=box(68,6,99,38);total=0
        for f in features:
            if f.get('type')!='Feature' or f.get('properties',{}).get('name')!='Unlabelled generalized land' or f.get('geometry',{}).get('type')!='Polygon':
                raise ValueError('Physical land mask content invalid')
            g=shape(f['geometry'])
            if not g.is_valid or g.is_empty or not study.buffer(1e-6).covers(g):
                raise ValueError('Physical land mask topology invalid')
            total+=len(g.exterior.coords)+sum(len(r.coords) for r in g.interiors)
            if total>30000:raise ValueError('Physical land mask too complex')
        shutil.copytree(land_dir,dist/'data/landcover');bundled_land=True
    # Optional static vector tile archive. All file contents must match its declared hashes.
    tiles_dir=root/'data/tiles'
    tile_manifest=tiles_dir/'atlas-tiles.json'
    bundled_tiles=False
    if tiles_dir.exists():
        if not tile_manifest.is_file():raise ValueError('Tile directory requires atlas-tiles.json')
        tile_info=json.loads(tile_manifest.read_text(encoding='utf-8'))
        if (tile_info.get('format')!='BharatAtlasMVT1' or tile_info.get('officiallyVerified') is not False
            or not tile_info.get('licence') or not tile_info.get('attribution')
            or not str(tile_info.get('sourceUrl','')).startswith('https://')):
            raise ValueError('Invalid or unlicensed tile catalogue')
        if (not isinstance(tile_info.get('layers'),list) or not tile_info['layers'] or
            any(x not in {'roads','railways','rivers','settlements','coastlines','lakes'} for x in tile_info['layers']) or
            not isinstance(tile_info.get('minzoom'),int) or not isinstance(tile_info.get('maxzoom'),int) or
            tile_info['minzoom']<0 or tile_info['maxzoom']>12 or tile_info['minzoom']>tile_info['maxzoom']):
            raise ValueError('Invalid tile zoom or layers')
        b=tile_info.get('bounds')
        if not isinstance(b,list) or len(b)!=4 or not all(isinstance(x,(int,float)) for x in b) or b[0]>=b[2] or b[1]>=b[3]:
            raise ValueError('Tile bounds are invalid')
        hashes=tile_info.get('tileHashes',{})
        if (not isinstance(hashes,dict) or not hashes or len(hashes)!=tile_info.get('tileCount')
            or len(hashes)>25000):raise ValueError('Tile count invalid')
        layers_sources=tile_info.get('sourceLayers')
        if layers_sources is not None:
            if not isinstance(layers_sources,dict) or set(layers_sources)!=set(tile_info['layers']):
                raise ValueError('Vector tile source registry does not cover every layer')
            for layer,source_record in layers_sources.items():
                if (not isinstance(source_record,dict) or source_record.get('officiallyVerified') is not False
                    or not str(source_record.get('sourceUrl','')).startswith('https://') or not source_record.get('licence')
                    or not source_record.get('attribution') or not __import__('re').fullmatch('[0-9a-f]{64}',str(source_record.get('sourceSha256','')))):
                    raise ValueError('Vector tile source attribution and rights invalid for '+layer)
        import re as _re
        for name,digest in hashes.items():
            if not _re.fullmatch(r'(?:[0-9]|1[0-2])/(?:0|[1-9][0-9]*)/(?:0|[1-9][0-9]*)\.pbf',name):
                raise ValueError('Unexpected tile path')
            z,x,y=[int(v) for v in name[:-4].split('/')]
            if z<tile_info.get('minzoom',0) or z>tile_info.get('maxzoom',12) or x>=2**z or y>=2**z:
                raise ValueError('Tile coordinate outside zoom range')
            f=tiles_dir/name
            if not f.is_file() or hashlib.sha256(f.read_bytes()).hexdigest()!=digest:
                raise ValueError(f'Corrupt/missing tile: {name}')
        actual={str(f.relative_to(tiles_dir)) for f in tiles_dir.rglob('*.pbf')}
        if actual!=set(hashes):raise ValueError('Tile tree differs from declared tile list')
        audit_archive(tiles_dir)  # Protobuf structure, geometry and properties checked, not only hashes.
        shutil.copytree(tiles_dir,dist/'data/tiles')
        bundled_tiles=True
    (dist/'robots.txt').write_text('User-agent: *\nDisallow: /\n')
    # Portable static caching and security headers. Deployment is still opt-in.
    deployment_headers = [
        {'source':'/(.*)', 'headers':[
            {'key':'X-Content-Type-Options','value':'nosniff'},
            {'key':'Referrer-Policy','value':'strict-origin-when-cross-origin'},
            {'key':'X-Frame-Options','value':'DENY'},
            {'key':'X-Robots-Tag','value':'noindex, nofollow'},
        ]},
        {'source':'/data/(.*)','headers':[
            {'key':'Cache-Control','value':'public, max-age=300, s-maxage=3600'}
        ]},
        {'source':'/(app.bundle.js|styles.css|atlas-focus.css)','headers':[
            {'key':'Cache-Control','value':'public, max-age=0, must-revalidate'}
        ]},
    ]
    (dist/'vercel.json').write_text(json.dumps({'version':2,'headers':deployment_headers},indent=2)+'\n')
    (dist/'_headers').write_text(
        '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n'
        '  X-Frame-Options: DENY\n  X-Robots-Tag: noindex, nofollow\n'
        '/data/*\n  Cache-Control: public, max-age=300, s-maxage=3600\n'
    )
    manifest={'name':'Bharat Atlas','version':'1.11','productEdition':'india-world-research-atlas','catalogueSource':'National Portal of India IGOD (names only)','regionCatalogueCount':36,'verifiedAdminPolygonsBundled':False,'releaseMode':'LOCAL RESEARCH ONLY',
        'officialGeometryVerified':False,'hasAuthoritativeData':False,'externalMapLibreDependency':not engine_local,'usesRemoteGlyphService':False,'pilotPlaceCount':25,'cityDataSurveyVerified':False,'bundledProvisionalMap':bundled,'boundaryTopologyScreening':('passed' if boundary_screen else 'not-run (no bundled data)'),
        'boundarySampleFailures':(boundary_screen['failedSamples'] if boundary_screen else []),'bundledHistoricRivers':bundled_hydro,'bundledPhysicalShorelines':bundled_shores,'bundledPhysicalLand':bundled_land,'bundledLocalVectorTiles':bundled_tiles,'transportResearchPackBundled':transport_dir.exists(),'researchToolkitModules':['measurement','bookmarks','local-source-overlay','optional-road-graph','coverage','shareable-view','offline-shell','source-backed-place-comparison'],'bundledGazetteer':bundled_places,'bundledSearchShards':search_bundled,'naturalEarthPlaceCount':natural_earth_count,'atlasLabsModules':['studio','classroom','observatory','dated-data','story-maps'],'atlasLabsResearchOnly':True,'sparseTileProtocol':'atlas-detail','decodedMVTIntegrityVerified':bundled_tiles,'localVectorTileVerification':'hash integrity only, geography NOT certified','noProductionPromotion':True,
        'worldDetail':{'source':'Natural Earth optional 10m/50m reviewed inputs','layers':detail_count,'indiaAdmin1Certified':False,'historicalWorldWatercourses':hydro_meta['worldLines'],'historicalWorldCoastlineSegments':world_shores},'worldExplorer':{'mapUnits':world_meta['count'],'source':'Natural Earth legacy generalized 110m','officiallyVerified':False,'availableOffline':True},'assets':[]}
    for f in sorted(dist.rglob('*')):
        if f.is_file(): manifest['assets'].append({'path':str(f.relative_to(dist)),'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
    (dist/'build-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    return dist,manifest

def build(root=R):
    """Keep the previously successful site intact until a complete new build passes."""
    stable=root/'dist';staging=root/'.dist-staging';old=root/'.dist-previous'
    if old.exists():
        raise RuntimeError('Previous build backup exists; inspect it before continuing')
    try:
        temp,manifest=_build_staged(root)
        if stable.exists():stable.rename(old)
        try:temp.rename(stable)
        except Exception:
            if old.exists() and not stable.exists():old.rename(stable)
            raise
        if old.exists():shutil.rmtree(old)
        return stable,manifest
    except Exception:
        if staging.exists():shutil.rmtree(staging)
        raise

if __name__=='__main__':
 d,m=build(); print('Built local research viewer:',d,'with',len(m['assets']),'assets')
