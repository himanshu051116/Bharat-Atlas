#!/usr/bin/env python3
"""Build an immutable, static Bharat Atlas RESEARCH PREVIEW for CDN hosting.

Does not vendor unverified community geography and must NOT be used as
production certification. Every build emits SHA-256 checksums for review.
"""
import hashlib
import json
import shutil
import math
from pathlib import Path
from release_guard import check
from validate_geojson import STATES, UTS, name as canonical_name

ROOT=Path(__file__).resolve().parents[1]
FILES=('index.html','app.js','styles.css','_headers','robots.txt','vercel.json')


def build(root=ROOT):
    failures=check('preview',root)
    if failures:raise ValueError('Refusing preview build: '+'; '.join(failures))
    dist=root/'dist'
    if dist.exists():shutil.rmtree(dist)
    dist.mkdir()
    items=[]
    for name in FILES:
        source=root/name
        if not source.is_file():raise FileNotFoundError(source)
        data=source.read_bytes()
        (dist/name).write_bytes(data)
        items.append({'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
    (dist/'data').mkdir()
    for name in ('source-register.json',):
        data=(root/'data'/name).read_bytes()
        (dist/'data'/name).write_bytes(data)
        items.append({'path':'data/'+name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
    preview_data=root/'data'/'states.provisional.geojson'
    if preview_data.exists():
        dataset=preview_data.read_bytes()
        provenance_path=root/'data'/'community-preview-provenance.json'
        if not provenance_path.is_file():
            raise ValueError('Bundled community data requires a pinned provenance manifest')
        provenance=json.loads(provenance_path.read_text(encoding='utf-8'))
        digest=hashlib.sha256(dataset).hexdigest()
        if provenance.get('sha256')!=digest or provenance.get('geometryStatus')!='COMMUNITY / UNVERIFIED':
            raise ValueError('Community source checksum or unverified status is inconsistent')
        if '2c829a3543171810a4b28162ea736fb76dfdef40' not in provenance.get('source','') or 'ODbL' not in provenance.get('licence',''):
            raise ValueError('Unknown community source or missing ODbL terms')
        geo=json.loads(dataset)
        if geo.get('type')!='FeatureCollection' or len(geo.get('features',[]))!=36:
            raise ValueError('Bundled source must contain the expected 36 research features')
        features=geo['features']
        names=[canonical_name(f) for f in features]
        if len(set(names))!=36 or set(names)!=(STATES|UTS):
            raise ValueError('Bundled geometry must have precisely 28 states and 8 UTs with no duplicate identities')
        for f in features:
            g=f.get('geometry') or {}
            typ=g.get('type')
            if typ not in ('Polygon','MultiPolygon'):
                raise ValueError('Bundled geographic feature is not a polygon')
            polys=[g.get('coordinates')] if typ=='Polygon' else g.get('coordinates')
            if not isinstance(polys,list) or not polys:
                raise ValueError('Bundled geographic feature has no polygons')
            for poly in polys:
                if not isinstance(poly,list) or not poly:
                    raise ValueError('Bundled feature includes an empty polygon')
                for ring in poly:
                    if not isinstance(ring,list) or len(ring)<4 or ring[0]!=ring[-1]:
                        raise ValueError('Bundled feature includes an invalid or unclosed ring')
                    for coord in ring:
                        if not isinstance(coord,list) or len(coord)<2 or not all(isinstance(v,(int,float)) and math.isfinite(v) for v in coord[:2]):
                            raise ValueError('Bundled feature includes invalid coordinates')
        (dist/'data'/'states.provisional.geojson').write_bytes(dataset)
        provenance_data=provenance_path.read_bytes()
        (dist/'data'/'community-preview-provenance.json').write_bytes(provenance_data)
        items.append({'path':'data/community-preview-provenance.json','bytes':len(provenance_data),'sha256':hashlib.sha256(provenance_data).hexdigest()})
        items.append({'path':'data/states.provisional.geojson','bytes':len(dataset),'sha256':hashlib.sha256(dataset).hexdigest()})
    manifest={'project':'Bharat Atlas','version':'0.7','deploymentMode':'RESEARCH PREVIEW ONLY',
              'officialGeometryVerified':False,'requiresExternalCommunityDataset':not (root/'data'/'states.provisional.geojson').is_file(),
              'neverPromoteWithoutGeographicReview':True,'assets':items}
    (dist/'build-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    return dist,manifest

if __name__=='__main__':
    folder,manifest=build()
    print('Built',folder,'with',len(manifest['assets']),'hashed assets')
