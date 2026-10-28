#!/usr/bin/env python3
"""Independent topology screening; never proof of agreement with Survey of India.
Requires shapely + pyproj, analyses valid polygon shapes and pairwise area overlaps.
"""
import argparse,json,sys
from pathlib import Path
from shapely.geometry import shape
from shapely.validation import explain_validity
from shapely.ops import transform
from pyproj import Transformer

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'legacy/scripts'))
from validate_geojson import name,inside,STATES,UTS,SAMPLES
TRANSFORMER=Transformer.from_crs('EPSG:4326','EPSG:6933',always_xy=True)
def audit(path,require_complete=False,overlap_threshold_km2=1.0):
    data=json.loads(Path(path).read_text())
    if data.get('type')!='FeatureCollection':raise ValueError('Require GeoJSON FeatureCollection')
    feats=data.get('features',[])
    names=[name(f) for f in feats]
    invalid=[];geoms=[]
    for f,n in zip(feats,names):
        try:
            geom=shape(f['geometry'])
            if geom.geom_type not in {'Polygon','MultiPolygon'}:raise ValueError('not polygon geometry')
            if not geom.is_valid: invalid.append({'name':n,'why':explain_validity(geom)})
            geoms.append(geom)
        except Exception as e:invalid.append({'name':n,'why':str(e)});geoms.append(None)
    overlaps=[]
    valid=[(n,transform(TRANSFORMER.transform,g)) for n,g in zip(names,geoms) if g is not None and g.is_valid]
    for i,(a,g) in enumerate(valid):
        for b,h in valid[i+1:]:
            if not g.bounds[2]>=h.bounds[0] or not h.bounds[2]>=g.bounds[0] or not g.bounds[3]>=h.bounds[1] or not h.bounds[3]>=g.bounds[1]:continue
            area=g.intersection(h).area/1_000_000
            if area>overlap_threshold_km2:overlaps.append({'a':a,'b':b,'areaKm2':round(area,3)})
    expected=STATES|UTS
    missing=sorted(expected-set(names))
    unexpected=sorted(set(names)-expected)
    duplicate=sorted({n for n in names if names.count(n)>1})
    checks=[]
    for title,lon,lat,expected in SAMPLES:
        found=[n for n,f in zip(names,feats) if inside(f,lon,lat)]
        checks.append({'sample':title,'expected':expected,'actual':found,'matches':found==[expected]})
    return {'sourceFile':str(path),'officiallyVerified':False,'regions':len(feats),'missingRegions':missing,'unexpectedRegions':unexpected,'duplicateRegions':duplicate,'invalidGeometry':invalid,'overlapsKm2':overlaps,'sampleLocations':checks,'screeningPass':not(invalid or overlaps or unexpected or duplicate or (require_complete and missing) or any(not c['matches'] for c in checks)),
            'disclaimer':'Topological screening is NOT official territorial verification, and does not establish map completeness.'}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('file',type=Path);p.add_argument('--complete',action='store_true');p.add_argument('--output',type=Path)
    args=p.parse_args();result=audit(args.file,args.complete)
    rendered=json.dumps(result,indent=2)+'\n'; print(rendered)
    if args.output:args.output.write_text(rendered)
    if result['invalidGeometry'] or result['overlapsKm2'] or result['unexpectedRegions'] or (args.complete and result['missingRegions']):sys.exit(1)
