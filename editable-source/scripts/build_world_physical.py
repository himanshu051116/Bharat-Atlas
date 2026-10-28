#!/usr/bin/env python3
"""World-scale historical unlabelled rivers from installed WDBII/GSHHG (LGPL-3.0+).
Never represent this as contemporary named waterways or legally authoritative geography.
"""
from __future__ import annotations
import hashlib, importlib.metadata, json, math, argparse
from pathlib import Path
from mpl_toolkits.basemap import Basemap
from shapely.geometry import LineString
ROOT=Path(__file__).resolve().parents[1]

def build(out=ROOT/'data/world/world-hydrography.json'):
    v=importlib.metadata.version('basemap-data')
    if v!='2.0.0':raise RuntimeError('Expected basemap-data 2.0.0; got '+v)
    map_=Basemap(projection='cyl',llcrnrlon=-179.99,llcrnrlat=-89.99,urcrnrlon=179.99,urcrnrlat=89.99,resolution='i')
    parts,tags=map_._readboundarydata('rivers')
    picked=[]
    for i,pts in enumerate(parts):
        if len(pts)<2:continue
        points=[(float(x),float(y)) for x,y in pts]
        if not all(math.isfinite(x) and math.isfinite(y) and -180.00001<=x<=180.00001 and -90<=y<=90 for x,y in points):continue
        g=LineString(points)
        if not g.is_valid or g.length<.65:continue
        simp=g.simplify(.09,preserve_topology=False)
        if len(simp.coords)<2:continue
        picked.append((round(float(g.length),2),i,simp))
    picked.sort(key=lambda it:(-it[0],it[1]))
    picked=picked[:7000]
    paths=[];count=0
    for _,i,g in picked:
        xy=list(g.coords)
        # Data crosses dateline in some records; do not draw a line spanning the world.
        start=[]
        for lon,lat in xy:
            if start and abs(lon-start[-1][0])>170:
                if len(start)>=2:paths.append(start);count+=1
                start=[]
            start.append((lon,lat))
        if len(start)>=2:paths.append(start);count+=1
    def svg(poly):return 'M'+' L'.join(f'{(x+180)*4:.1f} {(90-y)*4:.1f}' for x,y in poly)
    output={'schema':'bharat-world-historical-hydrography-v1','source':'GSHHG/WDBII 2.3.6 through basemap-data 2.0.0','licence':'LGPL-3.0-or-later','current':False,'named':False,'lines':count,'svgPath':' '.join(svg(x) for x in paths)}
    out.parent.mkdir(parents=True,exist_ok=True)
    blob=(json.dumps(output,ensure_ascii=False,separators=(',',':'))+'\n').encode()
    out.write_bytes(blob)
    meta={'schema':'bharat-world-hydrography-manifest-v1','file':out.name,'sha256':hashlib.sha256(blob).hexdigest(),'bytes':len(blob),'source':'GSHHG/WDBII 2.3.6 via basemap-data 2.0.0','licence':'LGPL-3.0-or-later','worldLines':count,'named':False,'current':False}
    (out.parent/'hydrography-manifest.json').write_text(json.dumps(meta,indent=2)+'\n')
    return meta
if __name__=='__main__':print(json.dumps(build(),indent=2))
