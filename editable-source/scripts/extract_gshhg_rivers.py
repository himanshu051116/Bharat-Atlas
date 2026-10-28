#!/usr/bin/env python3
"""Rebuild a *historical, unlabelled* GSHHG river overlay from installed basemap-data.

The packaged basemap-data v2.0.0 derives its WDBII/GSHHG hydrography from
GSHHG 2.3.6 (not current Indian administrative reference geography).
This source is LGPL-3.0-or-later; the extracted data and corresponding
source mapping must retain attribution, licence and modification notice.
This program never extracts borders or claims India-only legal territory.
"""
from __future__ import annotations
import argparse, hashlib, importlib.metadata, json, math
from pathlib import Path
from shapely.geometry import LineString, box
from mpl_toolkits.basemap import Basemap

WINDOW=(68,6,99,38) # geographic *viewport*, includes neighboring countries

def _valid_lines(geom):
    if geom.is_empty:return
    if geom.geom_type=='LineString':
        if len(geom.coords)>=2 and geom.length>0:yield geom
    elif geom.geom_type in ('MultiLineString','GeometryCollection'):
        for child in geom.geoms:yield from _valid_lines(child)

def extract(output:Path, minimum_length=0.015):
    version=importlib.metadata.version('basemap-data')
    if version!='2.0.0':
        raise ValueError(f'Pinned basemap-data 2.0.0 required; found {version}')
    if not 0<=minimum_length<=0.1:raise ValueError('Invalid length cutoff')
    lon_min,lat_min,lon_max,lat_max=WINDOW
    m=Basemap(projection='cyl',llcrnrlon=lon_min,llcrnrlat=lat_min,
              urcrnrlon=lon_max,urcrnrlat=lat_max,resolution='i')
    segments,types=m._readboundarydata('rivers')
    assert len(segments)==len(types)
    region=box(*WINDOW)
    features=[]
    for i,original in enumerate(segments):
        points=[(float(lon),float(lat)) for lon,lat in original]
        if len(points)<2 or any(not all(math.isfinite(v) for v in p) for p in points):continue
        path=LineString(points)
        if path.is_empty or not path.is_valid:continue
        for j,clipped in enumerate(_valid_lines(path.intersection(region))):
            if clipped.length<minimum_length:continue
            coords=[[round(x,6),round(y,6)] for x,y in clipped.coords]
            if len(set(map(tuple,coords)))<2:continue
            features.append({'type':'Feature','properties':{
                # Names are not provided in GSHHG/WDBII; *never* invent named rivers.
                'name':'Unlabelled historical watercourse','source_id':f'wdbii-{i:05d}-{j}'},
                'geometry':{'type':'LineString','coordinates':coords}})
    if len(features)<250:raise ValueError('Too few river segments; dataset extraction may have failed')
    record={'type':'FeatureCollection','features':features}
    output.parent.mkdir(parents=True,exist_ok=True)
    raw=(json.dumps(record,ensure_ascii=False,separators=(',',':'))+'\n').encode('utf-8')
    output.write_bytes(raw)
    return {'featureCount':len(features),'sha256':hashlib.sha256(raw).hexdigest(),
            'bytes':len(raw),'source':'GSHHG 2.3.6 / WDBII via basemap-data 2.0.0',
            'bbox':list(WINDOW),'licence':'LGPL-3.0-or-later',
            'administrativeAccuracy':'Not applicable; physical watercourse overlay, some features are outside India',
            'names':'Not provided; intentionally unlabelled'}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output',required=True)
    a=p.parse_args()
    path=Path(a.output);result=extract(path)
    path.with_suffix('.extraction.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result))
