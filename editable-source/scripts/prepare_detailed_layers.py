#!/usr/bin/env python3
"""Safely prepare permitted source-derived India-focused transport/place GeoJSON.

This processes local OSM-tagged GeoJSON, not live PBF/online tiles. It never
creates official political geography or infers nationwide coverage.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import tempfile
from datetime import datetime
from shapely.geometry import shape, mapping, box

INDIA_RESEARCH_WINDOW = (60.0, 3.0, 102.0, 41.0)
FEATURE_LIMIT = 50000
BYTE_LIMIT = 30 * 1024 * 1024
ALLOWED = ('roads', 'railways', 'rivers', 'settlements', 'pois')
TAGS = {
    'roads': {'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'service', 'living_street', 'pedestrian', 'track', 'path', 'footway', 'cycleway'},
    'railways': {'rail', 'light_rail', 'subway', 'tram', 'narrow_gauge'},
    'rivers': {'river', 'stream', 'canal', 'drain'},
    'settlements': {'city', 'town', 'village', 'hamlet', 'suburb', 'locality'},
}


def classify(properties, geometry):
    if not isinstance(properties, dict): return None
    if geometry.geom_type in {'LineString', 'MultiLineString'}:
        for name, key in [('roads', 'highway'), ('railways', 'railway'), ('rivers', 'waterway')]:
            if str(properties.get(key, '')).lower() in TAGS[name]: return name
    if geometry.geom_type in {'Point', 'MultiPoint'}:
        if str(properties.get('place', '')).lower() in TAGS['settlements'] and str(properties.get('name', '')).strip():
            return 'settlements'
    if geometry.geom_type in {'Point','MultiPoint'} and str(properties.get('name','')).strip() and any(properties.get(k) for k in ('amenity','tourism','shop','historic','healthcare')):
        return 'pois'
    return None


def validate_metadata(path, digest):
    source=json.loads(Path(path).read_text(encoding='utf-8'))
    if source.get('officiallyVerified') is not False:
        raise ValueError('Research extraction must explicitly state officiallyVerified=false')
    if source.get('redistributionReview') != 'approved_for_research_preview':
        raise ValueError('Recorded human redistribution review required (does not imply legal clearance)')
    if source.get('sourceSha256') != digest:
        raise ValueError('Source SHA-256 does not match the original file')
    if not str(source.get('sourceUrl','')).startswith('https://') or not source.get('licence') or not source.get('attribution'):
        raise ValueError('Source URL, specific licence and attribution required')
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', str(source.get('snapshotDate', ''))):
        raise ValueError('Source snapshotDate must be YYYY-MM-DD')
    try:datetime.strptime(source['snapshotDate'],'%Y-%m-%d')
    except ValueError as exc:raise ValueError('Invalid snapshot date') from exc
    if source.get('coverageClaim') not in ('local_sample', 'regional_extract', 'unverified_extract'):
        raise ValueError('Prohibited implicit nationwide coverage claim')
    return source


def prepare(input_path, source_metadata_path, output):
    input_path=Path(input_path);output=Path(output);source_metadata_path=Path(source_metadata_path)
    if not input_path.is_file() or input_path.stat().st_size>BYTE_LIMIT:
        raise ValueError('Missing or oversized GeoJSON input')
    if output.exists() or output.is_symlink():
        raise ValueError('Destination must not exist; never overwrite reviewed geographic data')
    raw=input_path.read_bytes();digest=hashlib.sha256(raw).hexdigest()
    source=validate_metadata(source_metadata_path,digest)
    data=json.loads(raw)
    if data.get('type')!='FeatureCollection' or not isinstance(data.get('features'),list):
        raise ValueError('Expected a GeoJSON FeatureCollection')
    if len(data['features'])>FEATURE_LIMIT:raise ValueError('Too many input geographic features')
    if data.get('crs') and not any(t in json.dumps(data['crs']) for t in ('4326','CRS84')):
        raise ValueError('WGS84 geographic coordinates are required')
    clip=box(*INDIA_RESEARCH_WINDOW)
    layers={kind:[] for kind in ALLOWED}
    rejected=0;outside=0;unclassified=0
    for idx,f in enumerate(data['features']):
        if not isinstance(f,dict) or f.get('type')!='Feature':raise ValueError(f'Invalid feature {idx}')
        try:g=shape(f.get('geometry'))
        except Exception as exc:raise ValueError(f'Unparseable feature geometry {idx}') from exc
        if g.is_empty or not g.is_valid or not g.bounds or not all(math.isfinite(x) for x in g.bounds):
            raise ValueError(f'Invalid geometry for feature {idx}')
        properties=f.get('properties') or {}
        layer=classify(properties,g)
        if not layer:unclassified+=1;continue
        if not g.intersects(clip):outside+=1;continue
        g=g.intersection(clip)
        if g.is_empty:outside+=1;continue
        if g.geom_type not in ({'Point','MultiPoint'} if layer in ('settlements','pois') else {'LineString','MultiLineString'}):
            rejected+=1;continue
        name=str(properties.get('name','')).strip()
        # Missing geographic names must not become invented proper nouns.
        if not name:
            name={'roads':'Unnamed road','railways':'Unnamed railway','rivers':'Unnamed waterway'}[layer]
        if len(name)>120 or any(ord(c)<32 for c in name):raise ValueError(f'Invalid name for feature {idx}')
        # Preserve source access/direction/level tags for cautious road research routing.
        safe={'name':name,'kind':layer,'sourceIndex':idx}
        if layer in ('roads','pois','settlements'):
            for key in ('highway','oneway','access','motor_vehicle','vehicle','junction','bridge','tunnel','layer','id','amenity','tourism','shop','historic','name:hi','name:en','place'):
                value=properties.get(key)
                if isinstance(value,(int,str)) and len(str(value))<=40:
                    safe[key]=str(value)
        layers[layer].append({'type':'Feature','properties':safe,'geometry':mapping(g)})
    if not any(layers.values()):raise ValueError('No qualified source-derived details remain')
    output.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='atlas-prepared-',dir=output.parent) as td:
        stage=Path(td)/'prepared';stage.mkdir()
        for layer,features in layers.items():
            if features:
                (stage/f'{layer}.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features},ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
        layer_names=[l for l in ALLOWED if layers[l]]
        details={key:source[key] for key in ('sourceUrl','licence','attribution')}
        summary={
            'officiallyVerified':False,**details,'sourceSha256':digest,
            'coverageClaim':source['coverageClaim'],'snapshotDate':source['snapshotDate'],
            'description':'User-supplied research extract, unverified spatial coverage; no official borders',
            'sourceLayers':{layer:{**details,'sourceSha256':digest,'officiallyVerified':False} for layer in layer_names},
            'featureCounts':{layer:len(layers[layer]) for layer in ALLOWED},
            'unclassified':unclassified,'outsideResearchWindow':outside,'clippedOrRejected':rejected,
            'note':'Licensing was reviewed by an external human; this script does not certify redistribution or coverage.'
        }
        (stage/'tile-source.json').write_text(json.dumps(summary,indent=2,sort_keys=True)+'\n',encoding='utf-8')
        # Refuse overwrites including a last-moment concurrent destination creation.
        if output.exists() or output.is_symlink():raise ValueError('Destination appeared during processing')
        os.rename(stage,output)
    return summary


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--geojson',required=True,type=Path)
    ap.add_argument('--source-metadata',required=True,type=Path)
    ap.add_argument('--output',required=True,type=Path)
    args=ap.parse_args()
    result=prepare(args.geojson,args.source_metadata,args.output)
    print(json.dumps({'preparedLayers':result['featureCounts'],'sourceHash':result['sourceSha256'], 'officiallyVerified':False},indent=2))

if __name__=='__main__': main()
