#!/usr/bin/env python3
"""Reproducible public-domain Natural Earth generalised world atlas extraction.
The checked-in world-countries.geojson is the input after initial third-party
extraction, so end users do NOT need pyogrio/GeoPandas to rebuild.
Do not call the output official political boundaries.
"""
import json,hashlib,math
from pathlib import Path
from functools import reduce
R=Path(__file__).resolve().parents[1]; D=R/'data/world'

def rings_of(geometry):
    t=geometry['type']; a=geometry['coordinates']
    if t=='Polygon': return [a]
    if t=='MultiPolygon': return a
    raise ValueError('Expected country Polygon or MultiPolygon')

def path_of(geometry):
    parts=[]
    for polygon in rings_of(geometry):
        for ring in polygon:
            if len(ring)<4:continue
            commands=[]
            for i,position in enumerate(ring):
                lon,lat=position[:2]
                if not -180.01<=lon<=180.01 or not -90.01<=lat<=90.01:raise ValueError('Invalid country coordinate')
                x=(lon+180)*4;y=(90-lat)*4
                commands.append(('M' if i==0 else 'L')+f'{x:.2f} {y:.2f}')
            parts.append(' '.join(commands)+' Z')
    return ' '.join(parts)

def make(input_path=D/'world-countries.geojson',output_path=D/'world-boundaries.json'):
    raw=input_path.read_bytes();collection=json.loads(raw)
    if collection.get('type')!='FeatureCollection':raise ValueError('Not a GeoJSON collection')
    rows=[];ids=set()
    for i,feature in enumerate(collection.get('features',[])):
        p=feature['properties'];name=p['name'];continent=p['continent'];iso=p.get('iso_a3','-99'); iso2=p.get('iso_a2','')
        if not name or not continent or not isinstance(name,str):raise ValueError('Bad country properties')
        identifier=f'ne110-{i:03d}'
        if identifier in ids:raise ValueError('Duplicate country ID')
        ids.add(identifier)
        path=path_of(feature['geometry'])
        if not path:raise ValueError('Empty country geometry')
        rows.append({'id':identifier,'name':name,'continent':continent,'iso3':iso,'iso2':iso2,'areaKm2':round(float(p.get('area_km2',0))),'lon':round(float(p['lon']),3),'lat':round(float(p['lat']),3),'bbox':p['bbox'],'path':path})
    if not 170<=len(rows)<=300: raise ValueError('World country coverage suspicious')
    result={'schema':'bharat-world-generalized-v1','coverage':'Natural Earth low-resolution legacy map units; NOT full political certification','inputSha256':hashlib.sha256(raw).hexdigest(),'features':rows}
    output_path.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    manifest={'dataset':'Natural Earth low-resolution legacy 1:110m Admin-0 countries / geopandas test fixture copy','sourceUrl':'https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/','termsUrl':'https://www.naturalearthdata.com/about/terms-of-use/','licence':'Public domain (Natural Earth)','precision':'generalized small-scale','officiallyVerified':False,'suitableForLegalBoundaryDecisions':False,'inputSha256':result['inputSha256'],'outputSha256':hashlib.sha256(output_path.read_bytes()).hexdigest(),'count':len(rows),'omissions':'Many small islands, dependent territories and disputed representations are absent or generalized; differences from India official territorial claims are expected.'}
    (D/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    return result

if __name__=='__main__':
    data=make();print('World geographic features:',len(data['features']))
