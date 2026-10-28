#!/usr/bin/env python3
"""Bharat Atlas boundary QA. Diagnostic checks, NOT legal/official certification.
Usage: python validate_geojson.py india-states.geojson
Only requires Python standard library.
"""
import json
import sys
from pathlib import Path

STATES={"Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"}
UTS={"Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"}
ALIASES={"Orissa":"Odisha", "Uttaranchal":"Uttarakhand", "Andaman and Nicobar":"Andaman and Nicobar Islands", "Jammu & Kashmir":"Jammu and Kashmir", "Pondicherry":"Puducherry"}
SAMPLES=[("Gilgit (sample)",74.3,35.92,"Ladakh"),("Muzaffarabad (sample)",73.47,34.37,"Jammu and Kashmir"),("Aksai Chin (sample)",79.1,35.0,"Ladakh"),("Shaksgam Valley (sample)",76.41987,36.11126,"Ladakh")]

def name(f):
    p=f.get("properties") or {}
    x=next((p[k] for k in ["name","NAME_1","st_nm","STNAME","STATE"] if p.get(k)),"(unnamed)")
    return ALIASES.get(x,x)

def in_ring(x,y,r):
    yes=False
    for i in range(len(r)):
        a,b=r[i-1],r[i]
        if ((a[1]>y)!=(b[1]>y)) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:
            yes=not yes
    return yes

def inside(f,x,y):
    g=f.get("geometry") or {}
    coords=g.get("coordinates",[])
    polygons=[coords] if g.get("type")=="Polygon" else coords if g.get("type")=="MultiPolygon" else []
    return any(p and in_ring(x,y,p[0]) and not any(in_ring(x,y,h) for h in p[1:]) for p in polygons)

def check(file):
    data=json.loads(Path(file).read_text(encoding="utf-8"))
    if data.get('type')!='FeatureCollection' or not isinstance(data.get('features'),list):
        raise ValueError('Expected GeoJSON FeatureCollection')
    features=data['features'];names=[name(f) for f in features]
    matches=set(names)&(STATES|UTS)
    print('BHARAT ATLAS — preliminary geographic boundary audit')
    print('Source:',file)
    print(f'Features: {len(features)}  |  Canonical states: {len(matches & STATES)}/28  |  Canonical UTs: {len(matches & UTS)}/8')
    print('Missing:',', '.join(sorted((STATES|UTS)-set(names))) or '(none)')
    print('Unexpected names:',', '.join(sorted(set(names)-(STATES|UTS))) or '(none)')
    print('Duplicates:',', '.join(sorted({x for x in names if names.count(x)>1})) or '(none)')
    for title,lon,lat,expected in SAMPLES:
        actual=', '.join(name(f) for f in features if inside(f,lon,lat)) or 'NOT COVERED'
        outcome='PASS' if actual==expected else 'REVIEW'
        print(f'{outcome}: {title}: {actual} (expected {expected})')
    print('\nWarning: passing these checks does not prove geometric agreement with Survey of India 2026.')

if __name__=='__main__':
    if len(sys.argv)!=2:
        print(__doc__.strip());sys.exit(2)
    check(sys.argv[1])
