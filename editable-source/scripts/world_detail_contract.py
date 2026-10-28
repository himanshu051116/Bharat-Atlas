"""Fail-closed world-detail asset verification shared by build and unit tests."""
from __future__ import annotations
from pathlib import Path
import hashlib,json
LAYERS={'countries','admin1','cities','rivers','lakes','peaks'}
LIMITS={'countries':9000000,'admin1':11000000,'cities':3500000,'rivers':8500000,'lakes':6500000,'peaks':2000000}
COUNTS={'countries':500,'admin1':12000,'cities':20000,'rivers':15000,'lakes':12000,'peaks':10000}

def validate(root:Path):
    root=Path(root)
    manifest=json.loads((root/'manifest.json').read_text(encoding='utf8'))
    if (manifest.get('schema')!='bharat-world-detail-manifest-v1' or
        manifest.get('publisher')!='Natural Earth' or
        manifest.get('licence')!='Public domain' or
        manifest.get('approvedForBundle') is not True or
        manifest.get('officialPoliticalAuthority') is not False or
        manifest.get('indiaAdministrativePolygonsCertified') is not False):
        raise ValueError('World detail manifest source review failed')
    declared=manifest.get('layers')
    if not isinstance(declared,dict) or not declared or set(declared)-LAYERS:raise ValueError('Invalid detailed geography layer list')
    if {p.name for p in root.iterdir()}!=set(k+'.geojson' for k in declared)|{'manifest.json'}:
        raise ValueError('Undeclared world-detail files')
    for layer,record in declared.items():
        path=root/(layer+'.geojson')
        if path.is_symlink() or not path.is_file():raise ValueError('Missing or symlinked layer '+layer)
        raw=path.read_bytes()
        if (not 0<len(raw)<=LIMITS[layer] or record.get('bytes')!=len(raw) or
            record.get('sha256')!=hashlib.sha256(raw).hexdigest() or record.get('licence')!='Public domain' or
            not str(record.get('sourceUrl','')).startswith('https://') or
            not 1<=record.get('count',0)<=COUNTS[layer]):raise ValueError('Layer source mismatch '+layer)
        payload=json.loads(raw)
        if payload.get('type')!='FeatureCollection' or len(payload.get('features',[]))!=record['count']:raise ValueError('Layer content count mismatch '+layer)
        if layer=='admin1':
            for f in payload['features']:
                prop=f.get('properties') or {}
                if prop.get('countryIso3')=='IND' or str(prop.get('countryName','')).casefold()=='india':
                    raise ValueError('Unreviewed India admin-1 boundary in public overlay')
    return manifest
