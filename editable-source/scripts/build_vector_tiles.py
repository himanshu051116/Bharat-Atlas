#!/usr/bin/env python3
"""Produce a sparse static XYZ/MVT tile set from *licensed* geographic inputs.

No default OSM tile scraping, no downloads, no implied government verification.
This is a deterministic local GIS build tool, not a replacement for an
established production tile builder such as tippecanoe.
"""
from __future__ import annotations
import argparse, hashlib, json, math, shutil, sys, os, tempfile, uuid
from pathlib import Path
from collections import defaultdict
from shapely.geometry import shape, box
from shapely import transform as shp_transform
import numpy as np

EXTENT = 4096
ALLOWED = {'roads': 2, 'rivers': 2, 'settlements': 1, 'pois': 1, 'railways': 2, 'coastlines': 2, 'lakes': 2}
MAX_INPUT_BYTES = 30 * 1024 * 1024
MAX_TILES = 25000
MAX_FEATURES = 50000
INDIA_LIMITS = (60.0, 3.0, 102.0, 41.0)

def varint(n):
    if n < 0: raise ValueError('varint must be unsigned')
    out = bytearray()
    while n > 127:
        out.append((n & 127) | 128); n >>= 7
    out.append(n)
    return bytes(out)

def key(n, wire): return varint((n << 3) | wire)
def vint(n, v): return key(n, 0) + varint(v)
def field(n, blob): return key(n, 2) + varint(len(blob)) + blob

def zigzag(n): return (n << 1) ^ (n >> 31)
def command(n, repeat): return (repeat << 3) | n

def signed_area(ring):
    return sum(ring[i][0] * ring[(i+1)%len(ring)][1] - ring[(i+1)%len(ring)][0] * ring[i][1] for i in range(len(ring)))

def geometry_cmd(geom, kind):
    chunks=[]; cursor=[0,0]
    def delta(x, y):
        dx=x-cursor[0];dy=y-cursor[1];cursor[:]=[x,y]
        return [zigzag(dx),zigzag(dy)]
    def line(seq, closed=False):
        coords=[]
        for x,y in seq:
            pt=(round(x),round(y))
            if not coords or coords[-1]!=pt:coords.append(pt)
        if closed and len(coords)>1 and coords[0]==coords[-1]: coords.pop()
        if len(coords)<(3 if closed else 2):return
        chunks.append(command(1,1));chunks.extend(delta(*coords[0]))
        chunks.append(command(2,len(coords)-1))
        for xy in coords[1:]:chunks.extend(delta(*xy))
        if closed:chunks.append(command(7,1))
    def visit(g):
        if g.is_empty:return
        if g.geom_type in {'GeometryCollection','MultiPoint','MultiLineString'}:
            for sub in g.geoms:visit(sub)
        elif kind==1 and g.geom_type=='Point':
            chunks.append(command(1,1));chunks.extend(delta(round(g.x),round(g.y)))
        elif kind==2 and g.geom_type=='LineString':
            line(g.coords)
        elif kind==3 and g.geom_type=='Polygon':
            outer=list(g.exterior.coords)
            if signed_area(outer)<0:outer.reverse()
            line(outer,True)
            for hole in g.interiors:
                inner=list(hole.coords)
                if signed_area(inner)>0:inner.reverse()
                line(inner,True)
    visit(geom)
    return b''.join(varint(x) for x in chunks)

def tile_lat(y,z): return math.degrees(math.atan(math.sinh(math.pi*(1-2*y/(2**z)))))
def tile_of(lon,lat,z):
    n=2**z;lat=max(-85.0511287,min(85.0511287,lat))
    return ((lon+180)/360*n,(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n)

def as_tile_space(g,z,x,y):
    n=2**z
    def transform_array(coords):
        lon=coords[:,0];lat=np.clip(coords[:,1],-85.0511287,85.0511287)
        yy=(1-np.arcsinh(np.tan(np.radians(lat)))/np.pi)/2*n
        return np.column_stack([((lon+180)/360*n-x)*EXTENT,(yy-y)*EXTENT])
    return shp_transform(g,transform_array)

def read_input(path,layer):
    p=Path(path)
    if not p.is_file() or p.stat().st_size>MAX_INPUT_BYTES:raise ValueError(f'{layer}: missing or oversized GeoJSON')
    fc=json.loads(p.read_text(encoding='utf-8'))
    if fc.get('type')!='FeatureCollection' or not isinstance(fc.get('features'),list):raise ValueError(f'{layer}: expected GeoJSON FeatureCollection')
    if fc.get('crs') and '4326' not in json.dumps(fc['crs']) and 'CRS84' not in json.dumps(fc['crs']):raise ValueError(f'{layer}: WGS84 required')
    if len(fc['features'])>MAX_FEATURES:raise ValueError(f'{layer}: too many features')
    out=[]
    for i,f in enumerate(fc['features']):
        g=shape(f['geometry'])
        if g.is_empty or not g.is_valid:raise ValueError(f'{layer} feature {i}: invalid geometry')
        if not g.bounds or not all(math.isfinite(v) for v in g.bounds):raise ValueError(f'{layer}: invalid coordinates')
        w,south,e,north=g.bounds
        if w<INDIA_LIMITS[0] or south<INDIA_LIMITS[1] or e>INDIA_LIMITS[2] or north>INDIA_LIMITS[3]:
            raise ValueError(f'{layer} feature {i}: coordinates outside India-focused data extent')
        allowed=({'Point','MultiPoint'} if ALLOWED[layer]==1 else {'LineString','MultiLineString'})
        if g.geom_type not in allowed:raise ValueError(f'{layer} feature {i}: expected {sorted(allowed)}')
        props=f.get('properties') or {}
        name=str(props.get('name','')).strip()[:100]
        if not name:continue
        safe={'name':name,'kind':layer}
        for attribute in ('highway','railway','waterway','place','oneway','access','motor_vehicle','vehicle','layer','bridge','tunnel','amenity','tourism','shop','historic','name:hi','name:en','id'):
            val=props.get(attribute)
            if isinstance(val,(str,int)) and 0<len(str(val))<=120 and all(ord(c)>=32 for c in str(val)):
                safe[attribute]=str(val)
        out.append((i+1,g,safe))
    return out

def make_layer(name,features):
    if not features:return b''
    keys=['name','kind']+sorted({key for _,_,props in features for key in props if key not in ('name','kind')});values=sorted({str(v) for _,_,p in features for v in p.values()})
    value_ids={v:i for i,v in enumerate(values)}
    payload=[field(1,name.encode())]
    for fid,g,props in features:
        shape_type=ALLOWED[name]
        geo=geometry_cmd(g,shape_type)
        if not geo:continue
        tags=[]
        for i,k in enumerate(keys):
            if k in props:tags.extend([i,value_ids[str(props[k])]])
        feat=vint(1,fid)+field(2,b''.join(varint(v) for v in tags))+vint(3,shape_type)+field(4,geo)
        payload.append(field(2,feat))
    if len(payload)==1:return b''
    payload.extend(field(3,k.encode()) for k in keys)
    payload.extend(field(4,field(1,v.encode())) for v in values)
    payload += [vint(5,EXTENT),vint(15,2)]
    return field(3,b''.join(payload))

def make_pyramid(inputs, meta, output, min_zoom, max_zoom):
    source=json.loads(Path(meta).read_text(encoding='utf-8'))
    if source.get('officiallyVerified') is not False:raise ValueError('Tiles must be marked NOT officially verified')
    if not source.get('licence') or not source.get('attribution') or not str(source.get('sourceUrl','')).startswith('https://'):
        raise ValueError('Missing source licence, attribution or HTTPS source URL')
    if min_zoom<0 or max_zoom>12 or max_zoom<min_zoom:raise ValueError('Invalid zoom range (0..12)')
    if not inputs:raise ValueError('At least one licensed input layer required')
    shapes={layer:read_input(path,layer) for layer,path in inputs.items()}
    dest=Path(output)
    resolved=dest.resolve()
    for original in [meta,*inputs.values()]:
        source_path=Path(original).resolve()
        if resolved==source_path or resolved in source_path.parents:
            raise ValueError('Output must not contain input files or source metadata')
    if dest.is_symlink():raise ValueError('Tile output must not be a symbolic link')
    if dest.exists():
        if not dest.is_dir() or any((f.is_symlink() or (f.is_file() and f.name!='atlas-tiles.json' and f.suffix!='.pbf')) for f in dest.rglob('*')):
            raise ValueError('Refusing to overwrite an unrelated directory')
    dest.parent.mkdir(parents=True,exist_ok=True)
    staging=Path(tempfile.mkdtemp(prefix=f'.{dest.name}-building-',dir=dest.parent))
    try:
        hashes={}; counts=defaultdict(int); tile_counts={}
        for z in range(min_zoom,max_zoom+1):
            jobs=defaultdict(lambda:defaultdict(list))
            for layer,features in shapes.items():
                for fid,g,props in features:
                    x1,y1=tile_of(g.bounds[0],g.bounds[3],z);x2,y2=tile_of(g.bounds[2],g.bounds[1],z)
                    for x in range(max(0,int(math.floor(x1))),min(2**z-1,int(math.floor(x2)))+1):
                        for y in range(max(0,int(math.floor(y1))),min(2**z-1,int(math.floor(y2)))+1):
                            jobs[(x,y)][layer].append((fid,g,props))
            if len(jobs)>MAX_TILES or len(jobs)+len(hashes)>MAX_TILES:raise ValueError('Tile count exceeds safety budget')
            for (x,y),groups in sorted(jobs.items()):
                payload=[]
                lon1=x/2**z*360-180;lon2=(x+1)/2**z*360-180
                clip_geo=box(lon1,tile_lat(y+1,z),lon2,tile_lat(y,z))
                for layer,feats in sorted(groups.items()):
                    clipped=[]
                    for fid,g,props in feats:
                        if not g.intersects(clip_geo):continue
                        gg=g.intersection(clip_geo)
                        if gg.is_empty:continue
                        gg=as_tile_space(gg,z,x,y)
                        if layer not in ('settlements','pois'):gg=gg.simplify(0.4,preserve_topology=True)
                        clipped.append((fid,gg,props))
                    packet=make_layer(layer,clipped)
                    if packet:payload.append(packet)
                if not payload:continue
                rel=f'{z}/{x}/{y}.pbf';p=staging/rel;p.parent.mkdir(parents=True,exist_ok=True)
                data=b''.join(payload);p.write_bytes(data)
                hashes[rel]=hashlib.sha256(data).hexdigest()
                # Independent MVT decoder proves which layers have *encoded* features
                # in each cell; a tile's mere existence is not local layer coverage.
                from mvt_audit import decode_tile
                decoded=decode_tile(data)
                tile_counts[rel]={name:len(features) for name,features in sorted(decoded.items())}
                for name,number in tile_counts[rel].items():counts[name]+=number

        if not hashes:raise ValueError('Inputs contained no valid tile features')
        manifest={
          'format':'BharatAtlasMVT1','officiallyVerified':False,
          'licence':source['licence'],'attribution':source['attribution'],'sourceUrl':source['sourceUrl'],
          'sourceDescription':str(source.get('description','Not authoritative'))[:500],
          'minzoom':min_zoom,'maxzoom':max_zoom,'layers':sorted(shapes),'tileCount':len(hashes),
          'tileHashes':hashes,'tileLayerCounts':tile_counts,'featureOccurrences':dict(counts),'bounds':list(INDIA_LIMITS),
          'note':'Research tile package; not verified by Survey of India. No official boundary certification.',
          **({'sourceLayers':source['sourceLayers']} if 'sourceLayers' in source else {})
        }
        (staging/'atlas-tiles.json').write_text(json.dumps(manifest,indent=2,sort_keys=True)+'\n',encoding='utf-8')
        # Independent protobuf decoding runs before any existing archive is replaced.
        from mvt_audit import audit_archive
        audit_archive(staging)
    except BaseException:
        if staging.exists():shutil.rmtree(staging)
        raise
    backup=None
    try:
        if dest.exists():
            backup=dest.parent/f'.{dest.name}-backup-{uuid.uuid4().hex}'
            os.replace(dest,backup)
        os.replace(staging,dest)
    except Exception:
        if backup and backup.exists() and not dest.exists():os.replace(backup,dest)
        raise
    finally:
        if staging.exists():shutil.rmtree(staging)
        if backup and backup.exists() and dest.exists():shutil.rmtree(backup)
    return manifest

def main():
    p=argparse.ArgumentParser(description=__doc__)
    for n in ALLOWED:p.add_argument('--'+n,help=f'Licensed {n} GeoJSON')
    p.add_argument('--source-metadata',required=True)
    p.add_argument('--output',required=True)
    p.add_argument('--minzoom',type=int,default=4)
    p.add_argument('--maxzoom',type=int,default=8)
    a=p.parse_args()
    args={n:getattr(a,n) for n in ALLOWED if getattr(a,n)}
    report=make_pyramid(args,a.source_metadata,a.output,a.minzoom,a.maxzoom)
    print(f"Created {report['tileCount']} static MVT tiles; layers={report['layers']}; officialVerified=false")

if __name__=='__main__': main()
