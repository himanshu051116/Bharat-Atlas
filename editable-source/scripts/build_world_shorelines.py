#!/usr/bin/env python3
"""Produce generalized, labelled-as-historical physical shorelines and lake shapes.

Source: GSHHG/WDBII 2.3.6 distributed in basemap-data 2.0.0 (LGPL-3.0+).
This is physical reference data, not a political boundary or current water survey.
"""
from __future__ import annotations
import argparse,hashlib,importlib.metadata,json,math
from pathlib import Path
from mpl_toolkits.basemap import Basemap
from shapely.geometry import LineString,Polygon
R=Path(__file__).resolve().parents[1]

def make_svg_path(points,closed=False):
    segments=[];part=[]
    for lon,lat in points:
        if not all(map(math.isfinite,(lon,lat))) or abs(lon)>180.01 or abs(lat)>90.01:continue
        if part and abs(lon-part[-1][0])>170:
            if len(part)>1:segments.append(part)
            part=[]
        part.append((lon,lat))
    if len(part)>1:segments.append(part)
    parts=[]
    for seg in segments:
        d='M'+' '.join(f'{(lon+180)*4:.1f},{(90-lat)*4:.1f}' if i==0 else f'L{(lon+180)*4:.1f},{(90-lat)*4:.1f}' for i,(lon,lat) in enumerate(seg))
        if closed and abs(seg[0][0]-seg[-1][0])<.1 and abs(seg[0][1]-seg[-1][1])<.1:d+='Z'
        parts.append(d)
    return ' '.join(parts)

def build(output=R/'data/world/world-shorelines.json'):
    if importlib.metadata.version('basemap-data')!='2.0.0':raise RuntimeError('Expected pinned basemap-data 2.0.0')
    bm=Basemap(projection='cyl',llcrnrlon=-179.99,llcrnrlat=-89.99,urcrnrlon=179.99,urcrnrlat=89.99,resolution='i')
    geometries,tags=bm._readboundarydata('gshhs')
    coast,lakes=[],[]
    for pts,tag in zip(geometries,tags):
        if tag not in (1,2) or len(pts)<4:continue
        coords=[(float(x),float(y)) for x,y in pts]
        if not all(math.isfinite(x) and math.isfinite(y) for x,y in coords):continue
        line=LineString(coords)
        # Source is generalized conservatively for web, never inventing new locations.
        if line.length<.025:continue
        simpl=line.simplify(.026, preserve_topology=False)
        if len(simpl.coords)<3:continue
        feature=(round(line.length,3),make_svg_path(simpl.coords,closed=(tag==2)))
        if tag==1:coast.append(feature)
        else:lakes.append(feature)
    coast.sort(key=lambda r:-r[0]);lakes.sort(key=lambda r:-r[0])
    # Bounded web transport: retain the most geographically salient boundaries.
    coast=coast[:1150];lakes=lakes[:650]
    result={'schema':'bharat-world-historical-shorelines-v1','source':'GSHHG/WDBII 2.3.6 via basemap-data 2.0.0',
            'licence':'LGPL-3.0-or-later','current':False,'politicalAuthority':False,
            'coastSegments':len(coast),'inlandWaterParts':len(lakes),
            'coastPath':' '.join(x[1] for x in coast),'lakePath':' '.join(x[1] for x in lakes)}
    raw=(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n').encode()
    if len(raw)>3_000_000:raise ValueError('Overlarge shoreline data, reduce layer size')
    output.parent.mkdir(parents=True,exist_ok=True);output.write_bytes(raw)
    manifest={'schema':'bharat-world-shoreline-manifest-v1','file':output.name,'sha256':hashlib.sha256(raw).hexdigest(),
         'bytes':len(raw),'coastSegments':len(coast),'inlandWaterParts':len(lakes),'licence':'LGPL-3.0-or-later',
         'source':'GSHHG/WDBII 2.3.6 via basemap-data 2.0.0','current':False,'politicalAuthority':False}
    (output.parent/'shoreline-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    return manifest
if __name__=='__main__':print(json.dumps(build(),indent=2))
