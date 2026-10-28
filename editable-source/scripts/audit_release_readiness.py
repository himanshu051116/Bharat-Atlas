#!/usr/bin/env python3
"""Evidence-led roadmap audit. Never replaces authoritative source or device verification.
Runs locally without network, never promotes production.
"""
import hashlib,json,argparse
from pathlib import Path
try:
    from .verify_preview import verify
except ImportError:
    from verify_preview import verify
ROOT=Path(__file__).resolve().parents[1]

def audit(root=ROOT):
    root=Path(root)
    preview=verify(root/'dist')
    manifest=json.loads((root/'dist/build-manifest.json').read_text())
    lab_files=('atlas-labs.html','atlas-labs.css','atlas-labs.mjs')
    assets={a['path'] for a in manifest['assets']}
    phase={
        'Core v1.0':{
            'implemented':['modular static map app','basic regional selection','research SVG export','provisional-data warning','physical SVG continuity','selected city search'],
            'blocking':['authoritative 2026 boundary and redistribution review','northern territorial comparison','modern India road and settlement basemap','genuine GPU/MapLibre validation','iOS/Android accessibility and performance','1,000-session test','verified nationwide address search','full production print export'],
            'releaseReady':False},
        'Learning & Studio v1.5':{
            'implemented':['State/UT classification quiz','physical map location worksheet and answer CSV','custom-title research physical SVG','browser print/PDF workflow'],
            'blocking':['independently reviewed lessons/answer keys','educator trials','political map worksheet with authorised borders','dedicated print-layout rendering','bilingual curriculum-reviewed content'],
            'releaseReady':False},
        'Geographic Intelligence v2.0':{
            'implemented':['source-selected place-count sample chart','region-filtered point list','great-circle city distance','CSV indicator import with source and boundary edition','strict temporal comparison guard','three-scene geographic source story'],
            'blocking':['verified district-level datasets','authoritative geographic crosswalks for changing districts','time-versioned political boundary layers','actual choropleth statistics','reviewed history/story content','audited import coverage'],
            'releaseReady':False},
        'Maintenance / Phase 11':{
            'implemented':['local file hash manifests','test suite and guard','source metadata retained','manual source and release audit'],
            'blocking':['production monitoring and error triage','licence/source update owner','deployment incident procedure','scheduled source freshness checks in connected infrastructure'],
            'releaseReady':False},
    }
    if not all(x in assets for x in lab_files):raise ValueError('Missing final-phase laboratory assets')
    if manifest.get('atlasLabsResearchOnly') is not True or manifest.get('officialGeometryVerified') is not False:raise ValueError('Release claim integrity violation')
    digest=hashlib.sha256((root/'dist/build-manifest.json').read_bytes()).hexdigest()
    return {'product':'Bharat Atlas','iteration':manifest['version'],'compiledPreviewVerified':True,'buildManifestSha256':digest,'coreModules':preview['modules'],'staticAssets':preview['assetsVerified'],'authoritativeGeographyApproved':False,'productionReleasePermitted':False,'lastPhaseReachedInResearchCode':True,'fullV2ProductComplete':False,'phaseEvidence':phase}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--output');a=p.parse_args()
    result=audit();text=json.dumps(result,indent=2,ensure_ascii=False)+'\n'
    if a.output:
        dest=Path(a.output)
        if dest.resolve().is_relative_to((ROOT/'dist').resolve()):raise ValueError('Readiness audit may not alter signed static preview')
        dest.write_text(text,encoding='utf-8')
    else:print(text)
