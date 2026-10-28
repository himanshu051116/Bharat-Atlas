#!/usr/bin/env python3
"""Independent, dependency-free structural decoder for Bharat Atlas MVT road/river/place tiles.

Verifies *encoded data* rather than trusting source GIS objects or SHA-256 alone.
Not a cartographic accuracy/Survey of India certification tool.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

MAX_TILE_BYTES = 3 * 1024 * 1024
MAX_MESSAGE_DEPTH = 6
MAX_FIELD_SIZE = 3 * 1024 * 1024
MAX_POINTS_PER_FEATURE = 100_000

class MVTError(ValueError):
    pass


def varint(data: bytes, at: int):
    value = 0
    for i in range(10):
        if at >= len(data):
            raise MVTError('Truncated protobuf varint')
        b = data[at]; at += 1
        if i == 9 and b > 1:
            raise MVTError('Overflowing protobuf varint')
        value |= (b & 127) << (7*i)
        if b < 128:
            return value, at
    raise MVTError('Oversized protobuf varint')


def fields(data: bytes):
    at=0
    while at < len(data):
        tag,at=varint(data,at)
        number,wire=tag>>3,tag&7
        if number<=0:
            raise MVTError('Invalid protobuf field number')
        if wire==0:
            value,at=varint(data,at)
        elif wire==2:
            size,at=varint(data,at)
            if size>MAX_FIELD_SIZE or at+size>len(data):
                raise MVTError('Truncated/oversized protobuf byte field')
            value=data[at:at+size]; at+=size
        else:
            raise MVTError(f'Unsupported protobuf wire type {wire}')
        yield number,value


def single(items, number, *, required=True):
    found=[v for n,v in items if n==number]
    if len(found)>1 or (required and not found):
        raise MVTError(f'Field {number} has invalid cardinality')
    return found[0] if found else None


def decode_text(data, *, limit=300):
    if not isinstance(data, bytes) or len(data)>limit:
        raise MVTError('Invalid text field')
    try: s=data.decode('utf-8')
    except UnicodeDecodeError:raise MVTError('Invalid UTF-8') from None
    if not s.strip(): raise MVTError('Empty text field')
    return s


def packed_uint(blob):
    pos=0;out=[]
    while pos<len(blob):
        v,pos=varint(blob,pos);out.append(v)
        if len(out)>MAX_POINTS_PER_FEATURE*2:
            raise MVTError('Too many packed integers')
    return out


def signed(n):return (n>>1)^-(n&1)


def decode_geometry(blob, feature_type: int, extent: int):
    ops=packed_uint(blob)
    if not ops:raise MVTError('Empty feature geometry')
    x=y=0;at=0;parts=[];current=[]
    while at<len(ops):
        instruction=ops[at];at+=1
        cmd,repeat=instruction&7,instruction>>3
        if repeat==0: raise MVTError('Zero-length geometry command')
        if cmd in (1,2):
            if at+repeat*2>len(ops):raise MVTError('Truncated coordinate deltas')
            if cmd==1 and feature_type==2 and repeat!=1:raise MVTError('Line MoveTo must contain one position')
            if cmd==2 and (feature_type!=2 or not current):raise MVTError('Unexpected LineTo')
            if cmd==1 and current:
                if feature_type==2 and len(current)<2:raise MVTError('Degenerate line')
                parts.append(current);current=[]
            for _ in range(repeat):
                x+=signed(ops[at]);y+=signed(ops[at+1]);at+=2
                if not(-64<=x<=extent+64 and -64<=y<=extent+64):
                    raise MVTError('Coordinate outside supported tile extent')
                current.append((x,y))
        else:
            raise MVTError(f'Unexpected geometry command {cmd}')
    if current:parts.append(current)
    if not parts:raise MVTError('Missing decoded geometry')
    if feature_type==2 and any(len(seq)<2 for seq in parts):raise MVTError('Invalid short line')
    if feature_type==1 and any(len(seq)!=1 for seq in parts):raise MVTError('Point geometry uses line commands')
    if sum(len(v) for v in parts)>MAX_POINTS_PER_FEATURE:raise MVTError('Excessive feature vertices')
    return parts


def decode_tile(data: bytes):
    if not data or len(data)>MAX_TILE_BYTES:raise MVTError('Empty/oversized tile')
    top=list(fields(data))
    if any(n!=3 for n,v in top):raise MVTError('Unexpected tile field')
    if not top:raise MVTError('Tile has no layers')
    output={}
    for _,packet in top:
        m=list(fields(packet))
        name=decode_text(single(m,1));extent=single(m,5);version=single(m,15)
        if name in output:raise MVTError('Duplicate layer name')
        if extent!=4096 or version!=2:raise MVTError('Unexpected MVT extent or version')
        if name not in {'roads','railways','rivers','settlements','pois','coastlines','lakes'}:raise MVTError('Unknown data layer')
        keys=[decode_text(v) for n,v in m if n==3]
        values=[decode_text(single(list(fields(v)),1)) for n,v in m if n==4]
        if keys[:2]!=['name','kind'] or len(set(keys))!=len(keys) or not values or any(k not in {
            'name','kind','highway','railway','waterway','place','oneway','access','motor_vehicle','vehicle','layer','bridge','tunnel','amenity','tourism','shop','historic','name:hi','name:en','id'
        } for k in keys):raise MVTError('Invalid feature key/value dictionary')
        decoded=[]
        for n,p in m:
            if n!=2:continue
            f=list(fields(p))
            fid=single(f,1);t=single(f,3);tag_field=single(f,2);geometry=single(f,4)
            if not isinstance(fid,int) or fid<1:raise MVTError('Invalid feature id')
            if t!=(1 if name in ('settlements','pois') else 2):raise MVTError('Incorrect feature geometry type')
            tags=packed_uint(tag_field)
            if not tags or len(tags)%2:raise MVTError('Bad feature tags')
            props={}
            for i in range(0,len(tags),2):
                ki,vi=tags[i],tags[i+1]
                if ki>=len(keys) or vi>=len(values):raise MVTError('Feature tag points outside dictionary')
                props[keys[ki]]=values[vi]
            if not props.get('name') or props.get('kind')!=name:raise MVTError('Feature has inconsistent attribution')
            decoded.append({'id':fid,'properties':props,'parts':decode_geometry(geometry,t,extent)})
        if not decoded:raise MVTError('Tile contains empty feature layer')
        output[name]=decoded
    return output


def audit_archive(archive: Path):
    import hashlib
    archive=Path(archive)
    cat=json.loads((archive/'atlas-tiles.json').read_text(encoding='utf-8'))
    if cat.get('format')!='BharatAtlasMVT1' or cat.get('officiallyVerified') is not False:
        raise MVTError('Unrecognized/unverified tile catalogue')
    hashes=cat.get('tileHashes')
    if not isinstance(hashes,dict) or not hashes or len(hashes)>25000 or len(hashes)!=cat.get('tileCount'):
        raise MVTError('Invalid tile count')
    per_tile=cat.get('tileLayerCounts')
    if per_tile is not None and (not isinstance(per_tile,dict) or set(per_tile)!=set(hashes)):
        raise MVTError('Tile-layer count inventory must match the tile hashes')
    layers=set();total=0
    for rel,digest in sorted(hashes.items()):
        from re import fullmatch
        if not fullmatch(r'(?:[0-9]|1[0-2])/(?:0|[1-9]\d*)/(?:0|[1-9]\d*)\.pbf',rel):
            raise MVTError('Invalid tile path')
        z,x,y=[int(v) for v in rel[:-4].split('/')]
        if not(cat['minzoom']<=z<=cat['maxzoom']) or x>=2**z or y>=2**z:
            raise MVTError('Tile coordinate outside declared zoom')
        fp=archive/rel
        if not fp.is_file():raise MVTError('Missing tile '+rel)
        data=fp.read_bytes()
        if hashlib.sha256(data).hexdigest()!=digest:raise MVTError('Tile checksum mismatch '+rel)
        o=decode_tile(data)
        if per_tile is not None:
            expected={name:len(features) for name,features in sorted(o.items())}
            if per_tile[rel]!=expected:
                raise MVTError('Tile-layer count mismatch '+rel)
        layers.update(o);total+=sum(len(v) for v in o.values())
    actual={p.relative_to(archive).as_posix() for p in archive.rglob('*.pbf')}
    if actual!=set(hashes):raise MVTError('Tile archive has undeclared/missing files')
    if layers!=set(cat['layers']):raise MVTError('Decoded layers disagree with tile manifest')
    return {'tiles':len(hashes),'layers':sorted(layers),'decodedFeatureOccurrences':total,'officiallyVerified':False}


if __name__=='__main__':
    ap=argparse.ArgumentParser(description='Decode and audit a local Bharat Atlas MVT pyramid')
    ap.add_argument('directory',type=Path)
    args=ap.parse_args()
    print(json.dumps(audit_archive(args.directory),indent=2))
