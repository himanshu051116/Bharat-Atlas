#!/usr/bin/env python3
"""Extract generalized, unlabelled GSHHG coast and inland-water outlines.

Boundary-clipping edges on the study rectangle are NOT physical coastlines.
These are historical (GSHHG 2.3.6) physical features, not sovereign borders,
administrative lines, navigational shore surveys, or a complete Indian atlas.
"""
from __future__ import annotations
import argparse,hashlib,importlib.metadata,json,math
from pathlib import Path
from mpl_toolkits.basemap import Basemap
from shapely.geometry import LineString,box

WINDOW=(68,6,99,38)
EPSILON=1e-5

def on_frame_edge(p,q,region=WINDOW):
    x1,y1,x2,y2=region
    return any(abs(p[k]-v)<EPSILON and abs(q[k]-v)<EPSILON for k,v in [(0,x1),(0,x2),(1,y1),(1,y2)])

def split_frame_edges(coords,region=WINDOW):
    """Split contour into real source edges; remove artificial rectangle frame seams."""
    chain=[]
    for a,b in zip(coords,coords[1:]):
        if on_frame_edge(a,b,region):
            if len(chain)>=2:yield chain
            chain=[]
            continue
        if not chain:chain=[a,b]
        elif chain[-1]==a:chain.append(b)
        else:
            if len(chain)>=2:yield chain
            chain=[a,b]
    if len(chain)>=2:yield chain

def extract(output:Path,min_length=.009):
    version=importlib.metadata.version('basemap-data')
    if version!='2.0.0':raise ValueError('Pinned basemap-data 2.0.0 required')
    m=Basemap(projection='cyl',llcrnrlon=68,llcrnrlat=6,urcrnrlon=99,urcrnrlat=38,resolution='i')
    segments,types=m._readboundarydata('gshhs')
    if len(segments)!=len(types):raise ValueError('Invalid GSHHS source')
    region=box(*WINDOW)
    result={'coastlines':[],'lakes':[]}
    for idx,(segment,source_type) in enumerate(zip(segments,types)):
        # Basemap GSHHS types: 1 = land/coast, 2 = lakes.
        if source_type not in (1,2):continue
        kind='coastlines' if source_type==1 else 'lakes'
        coords=[(float(a),float(b)) for a,b in segment]
        if len(coords)<2 or any(not math.isfinite(v) for p in coords for v in p):continue
        for split_index,points in enumerate(split_frame_edges(coords)):
            g=LineString(points)
            if not g.is_valid or g.length<min_length:continue
            clipped=g.intersection(region)
            shapes=[clipped] if clipped.geom_type=='LineString' else list(getattr(clipped,'geoms',[]))
            for piece_index,item in enumerate(shapes):
                if item.geom_type!='LineString' or item.length<min_length:continue
                xy=[[round(float(x),6),round(float(y),6)] for x,y in item.coords]
                if len(set(map(tuple,xy)))<2:continue
                result[kind].append({'type':'Feature','properties':{'name': 'Unlabelled generalized shoreline' if kind=='coastlines' else 'Unlabelled generalized lake shore',
                    'source_id':f'gshhs-{idx:05d}-{split_index}-{piece_index}'},'geometry':{'type':'LineString','coordinates':xy}})
    if len(result['coastlines'])<25 or len(result['lakes'])<35:raise ValueError('Coastal source unexpectedly incomplete')
    output.mkdir(parents=True,exist_ok=True)
    metrics={}
    for name,features in result.items():
        raw=(json.dumps({'type':'FeatureCollection','features':features},separators=(',',':'),ensure_ascii=False)+'\n').encode()
        (output/f'{name}.geojson').write_bytes(raw)
        metrics[name]={'count':len(features),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
    return metrics

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',required=True)
    args=parser.parse_args()
    print(json.dumps(extract(Path(args.output)),indent=2))
