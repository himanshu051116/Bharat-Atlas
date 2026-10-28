#!/usr/bin/env python3
"""Install a Survey of India supplied *national claim outline* as a local map overlay.

Only converts geometry supplied by the operator. Does NOT fetch, trace or invent
territorial boundaries; cannot establish legal authority or administrative control.
The official 1:16m outline is generalized, not the 2026 1:4m political edition.
"""
import argparse
import hashlib
import json
import re
import shutil
import tempfile
from pathlib import Path
from urllib.parse import urlparse

import geopandas as gpd
from shapely.geometry import Point, mapping
from shapely import set_precision
from shapely.ops import unary_union

CHECKS={
 'Shaksgam sample (approximate)':(76.41987,36.11126),
 'Aksai Chin sample (approximate)':(79.1,35.0),
 'Gilgit sample (approximate)':(74.3,35.92),
 'Muzaffarabad sample (approximate)':(73.47,34.37)
}
OFFICIAL_OUTLINE='https://surveyofindia.gov.in/documents/Outline_of_India.zip'
OFFICIAL_REFERENCE='https://surveyofindia.gov.in/pages/political-map-of-india'
LIMIT=55_000_000


def prepare(source,output,*,source_url=OFFICIAL_OUTLINE,noncommercial_ack=False):
    source=Path(source);output=Path(output)
    if not source.is_file() or source.suffix.lower() not in {'.shp','.gpkg','.geojson','.zip'}:
        raise ValueError('Supply an existing .zip/.shp/.gpkg/.geojson national-outline vector file')
    if source.stat().st_size>LIMIT:raise ValueError('Input too large for this generalized outline importer')
    if not noncommercial_ack:raise ValueError('Confirm non-commercial research/website use and follow Survey of India copyright terms')
    u=urlparse(source_url)
    if u.scheme!='https' or u.hostname not in {'surveyofindia.gov.in','www.surveyofindia.gov.in'}:
        raise ValueError('Only a Survey of India source URL may be declared as government supplied')
    if output.exists():raise FileExistsError('Output already exists; refusing to overwrite the earlier source')
    if not output.parent.is_dir():raise ValueError('Create the output parent folder first')
    if source.suffix.lower()=='.zip':
        import zipfile
        with zipfile.ZipFile(source) as z:
            names=z.namelist()
            if len(names)>200 or any(n.startswith('/') or '..' in Path(n).parts or n.startswith('\\') for n in names):
                raise ValueError('Unexpected archive entries')
            candidates=[n for n in names if n.lower().endswith('.shp')]
            if len(candidates)!=1:raise ValueError('Official archive should contain exactly one Shapefile layer; inspect manually otherwise')
        layer=f'zip://{source.resolve()}!{candidates[0]}'
    else:layer=str(source)
    try:df=gpd.read_file(layer)
    except Exception as e:raise ValueError('Cannot read selected vector layer: '+str(e)) from e
    if df.crs is None:raise ValueError('No CRS metadata; coordinate conversion cannot be guessed')
    if df.empty or len(df)>2000:raise ValueError('Unexpected number of geographic features')
    if df.geometry.isna().any() or df.geometry.is_empty.any():raise ValueError('Empty geometry encountered')
    if any(g.geom_type not in ('Polygon','MultiPolygon') or not g.is_valid for g in df.geometry):
        raise ValueError('Source must contain valid polygonal outline geometry')
    transformed=df.to_crs('EPSG:4326')
    outline=unary_union(list(transformed.geometry))
    if outline.is_empty or not outline.is_valid or outline.geom_type not in ('Polygon','MultiPolygon'):
        raise ValueError('Unioned outline invalid; source requires human GIS review')
    # Keep the imported source geometry as the fidelity reference.  The source
    # has ~630,000 vertices and a naive 15-decimal GeoJSON cannot be served by
    # the bounded atlas viewer. A topology-preserving, sub-10-metre web
    # generalization retains every original polygon part (including islands).
    # Do NOT use this web export as a substitute for the source GIS dataset.
    original=outline
    tolerance=0.00008  # degrees, <~9m; far below the source's 1:16m display scale
    outline=set_precision(original.simplify(tolerance,preserve_topology=True),1e-6)
    if not outline.is_valid or outline.is_empty:
        raise ValueError('Web display generalization invalid')
    original_parts=len(original.geoms) if original.geom_type=='MultiPolygon' else 1
    export_parts=len(outline.geoms) if outline.geom_type=='MultiPolygon' else 1
    if export_parts!=original_parts:
        raise ValueError('Web generalization altered number of island/polygon parts')
    sym_diff=original.symmetric_difference(outline).area/max(original.area,1e-12)
    if sym_diff>0.0001:
        raise ValueError('Web generalization drift exceeds 0.01% area tolerance')
    minx,miny,maxx,maxy=outline.bounds
    if not (60<=minx<maxx<=102 and 3<=miny<maxy<=42):
        raise ValueError('Outline outside plausible Indian geographic envelope')
    original_checks={name:bool(original.covers(Point(lon,lat))) for name,(lon,lat) in CHECKS.items()}
    checks={name:bool(outline.covers(Point(lon,lat))) for name,(lon,lat) in CHECKS.items()}
    if original_checks!=checks:
        raise ValueError('Geographic checkpoint containment changed during web simplification')
    vertex_count=sum(len(g.exterior.coords)+sum(len(r.coords) for r in g.interiors)
                     for g in (outline.geoms if outline.geom_type=='MultiPolygon' else [outline]))
    feature={'type':'Feature','properties':{'kind':'India claimed territory','source':'Survey of India source-declared, independent verification pending'},'geometry':mapping(outline)}
    raw=(json.dumps({'type':'FeatureCollection','features':[feature]},ensure_ascii=False,separators=(',',':'))+'\n').encode('utf-8')
    if len(raw)>12_000_000:raise ValueError('Outline too complex to serve safely as a static overlay')
    meta={
      'schema':'bharat-atlas-soi-claim-outline-v1',
      'sourceDeclared':'Survey of India', 'sourceUrl':source_url, 'reference2026':OFFICIAL_REFERENCE,
      'dataScale':'Generalized 1:16m, NOT the 2026 political map edition',
      'copyright':'© Survey of India / Government of India',
      'usage':'Non-commercial individual/internal/educational/research/website use only; conditions apply',
      'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
      'outlineSha256':hashlib.sha256(raw).hexdigest(),
      'sourceFeatureCount':len(df),'bounds':[minx,miny,maxx,maxy],
      'sourceCrs':str(df.crs), 'sourcePolygonParts':original_parts,'webPolygonParts':export_parts,
      'webVertexCount':vertex_count,'webSimplificationToleranceDegrees':tolerance,
      'webPrecisionDegrees':1e-6, 'relativeSymmetricDifference':sym_diff,
      'webDerivedFromSource':True,
      'screeningCheckpoints':checks, 'claimOnly':True,
      'provenanceReviewed':False,'politicalMap2026GeometryMatched':False,'administrativeControlVerified':False,
      'commercialRedistributionAllowed':False,
      'warning':'Source-labelled, generalized national outline. Small display simplification applied; no state boundaries, control lines, or independent 2026 political-map match.'
    }
    with tempfile.TemporaryDirectory(prefix='.atlas-soi-',dir=output.parent) as tmp:
        tmp=Path(tmp)
        (tmp/'india-claim.geojson').write_bytes(raw)
        (tmp/'manifest.json').write_text(json.dumps(meta,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
        shutil.move(str(tmp),str(output))
    return meta


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('source',type=Path)
    p.add_argument('--output-dir',type=Path,default=Path(__file__).resolve().parents[1]/'data'/'official-india')
    p.add_argument('--source-url',default=OFFICIAL_OUTLINE)
    p.add_argument('--acknowledge-noncommercial-terms',action='store_true')
    args=p.parse_args()
    print(json.dumps(prepare(args.source,args.output_dir,source_url=args.source_url,noncommercial_ack=args.acknowledge_noncommercial_terms),indent=2))
