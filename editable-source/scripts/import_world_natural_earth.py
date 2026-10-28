#!/usr/bin/env python3
"""Install reviewed Natural Earth 50m/10m world geometry into an optional local pack.

No network requests. Source hashes and public-domain status must be explicitly provided.
This does not certify political geometry. Survey of India geometry remains separate.
"""
from __future__ import annotations
import argparse,hashlib,json,math,sys,shutil,tempfile
from pathlib import Path
import geopandas as gpd
from shapely.geometry import mapping,Point,shape
from shapely.ops import transform
from world_detail_contract import validate as validate_pack

R=Path(__file__).resolve().parents[1]
LAYER_SPECS={
 'countries':('Polygon','MultiPolygon'),
 'admin1':('Polygon','MultiPolygon'),
 'cities':('Point',),
 'rivers':('LineString','MultiLineString'),
 'lakes':('Polygon','MultiPolygon'),
 'peaks':('Point',)
}
MAX_COUNTS={'countries':500,'admin1':12000,'cities':20000,'rivers':15000,'lakes':12000,'peaks':10000}
MAX_BYTES={'countries':9000000,'admin1':11000000,'cities':3500000,'rivers':8500000,'lakes':6500000,'peaks':2000000}
TOLERANCES={'countries':.017,'admin1':.035,'rivers':.055,'lakes':.035}

# Shapefiles are multi-file datasets. All required sidecars must be hashed together.
COMPONENTS=('.shp','.shx','.dbf','.prj')
def component_hashes(path):
    path=Path(path)
    if path.suffix.lower() in ('.geojson','.json'):
        if not path.is_file() or path.is_symlink(): raise ValueError('Unsafe geographic input')
        return {path.suffix.lower():hashlib.sha256(path.read_bytes()).hexdigest()}
    if path.suffix.lower()!='.shp': raise ValueError('Only reviewed GeoJSON or complete Shapefile inputs are supported')
    result={}
    for ext in COMPONENTS:
        sidecar=path.with_suffix(ext)
        if not sidecar.is_file() or sidecar.is_symlink():
            raise ValueError('Missing or unsafe shapefile component: '+sidecar.name)
        if sidecar.stat().st_size>160_000_000:
            raise ValueError('Oversized shapefile component: '+sidecar.name)
        result[ext]=hashlib.sha256(sidecar.read_bytes()).hexdigest()
    optional=path.with_suffix('.cpg')
    if optional.exists():
        if not optional.is_file() or optional.is_symlink() or optional.stat().st_size>10000:
            raise ValueError('Unsafe shapefile encoding sidecar')
        result['.cpg']=hashlib.sha256(optional.read_bytes()).hexdigest()
    return result


def one(row,*names):
    for n in names:
        v=row.get(n)
        if v is not None and str(v).strip() and str(v).lower()!='nan':return str(v).strip()
    return ''
def csv_fields(row,layer):
    p={"name":one(row,'NAME','name','NAME_EN','name_en','NAMEASCII','nameascii'),
       'countryIso3':one(row,'ADM0_A3','adm0_a3','SOV_A3','sov_a3','ISO_A3','iso_a3'),
       'countryName':one(row,'admin','ADMIN','SOVEREIGNT','sov_a3'),
       'rank':one(row,'SCALERANK','scalerank','LABELRANK','labelrank')}
    if layer=='cities':p['type']=one(row,'FEATURECLA','featurecla') or 'Populated place'
    if layer=='peaks':p['elevation']=one(row,'ELEVATION','elevation','ELEV','elev')
    if layer=='admin1':p['code']=one(row,'ISO_3166_2','iso_3166_2','HASC','hasc')
    return p

def _finite_coords(geometry):
    from shapely.geometry import Polygon
    bounds=geometry.bounds
    return len(bounds)==4 and all(math.isfinite(x) for x in bounds) and -180.01<=bounds[0]<=180.01 and -180.01<=bounds[2]<=180.01 and -90.01<=bounds[1]<=90.01 and -90.01<=bounds[3]<=90.01

def import_world(inputs,provenance,output,replace=False):
    if not inputs:raise ValueError('At least one Natural Earth input is required')
    if output.exists() and any(output.iterdir()) and not replace:raise ValueError('Output exists; refusing overwrite without --replace')
    prior_meta={}
    prior_files={}
    if output.exists() and any(output.iterdir()):
        prior_meta=validate_pack(output)['layers']
        prior_files={key+'.geojson':(output/(key+'.geojson')).read_bytes() for key in prior_meta}
    provenance=json.loads(Path(provenance).read_text(encoding='utf-8'))
    if provenance.get('reviewed') is not True or provenance.get('publisher')!='Natural Earth' or provenance.get('licence')!='Public domain':
        raise ValueError('Explicit Natural Earth public-domain review metadata required')
    sources=provenance.get('sources',{});staged={};report={}
    for layer,p in inputs.items():
        if layer not in LAYER_SPECS:raise ValueError('Unsupported geography layer: '+layer)
        p=Path(p)
        if not p.is_file() or p.is_symlink():raise ValueError('Missing or unsafe data file: '+str(p))
        if p.stat().st_size>160000000:raise ValueError('Source input oversized')
        raw=p.read_bytes()
        sidecars=component_hashes(p)
        declared=sources.get(layer,{})
        digest=hashlib.sha256(raw).hexdigest()
        if (declared.get('sha256')!=digest or declared.get('components')!=sidecars or not declared.get('url','').startswith('https://') or
            not declared.get('version') or declared.get('licence')!='Public domain'):
            raise ValueError('Missing exact source integrity and rights record for '+layer)
        gdf=gpd.read_file(p)
        if gdf.crs is None:raise ValueError('No CRS supplied in '+layer)
        if len(gdf)>MAX_COUNTS[layer]:raise ValueError('Too many source features in '+layer)
        gdf=gdf.to_crs('EPSG:4326')
        output_features=[];seen=set();skipped=0
        for _,row in gdf.iterrows():
            geom=row.geometry
            if geom is None or geom.is_empty or geom.geom_type not in LAYER_SPECS[layer] or not _finite_coords(geom):
                skipped+=1;continue
            props=csv_fields(row,layer)
            if not props['name'] and layer not in ('rivers','lakes','countries'):
                skipped+=1;continue
            if layer=='admin1' and (props['countryIso3']=='IND' or props['countryName'].casefold()=='india'):
                # Never confuse NE de-facto admin1 with official Indian states/UTs.
                skipped+=1;continue
            if layer in TOLERANCES:
                geom=geom.simplify(TOLERANCES[layer],preserve_topology=layer in ('countries','admin1','lakes'))
                if geom.is_empty or not geom.is_valid or geom.geom_type not in LAYER_SPECS[layer]:skipped+=1;continue
            if layer in ('cities','peaks'):
                xy=(round(geom.x,6),round(geom.y,6))
                key=(props['name'].casefold(),xy)
                if key in seen:skipped+=1;continue
                seen.add(key)
            output_features.append({'type':'Feature','properties':props,'geometry':mapping(geom)})
        if not output_features:raise ValueError('No usable source features for '+layer)
        blob=(json.dumps({'type':'FeatureCollection','features':output_features},separators=(',',':'),ensure_ascii=False)+'\n').encode('utf8')
        if len(blob)>MAX_BYTES[layer]:raise ValueError(f'Layer {layer} exceeds safe web bundle; provide a more generalized input')
        staged[layer+'.geojson']=blob
        report[layer]={'count':len(output_features),'skipped':skipped,'sourceSha256':digest,'sourceComponents':sidecars,'sha256':hashlib.sha256(blob).hexdigest(),'bytes':len(blob),'sourceUrl':declared['url'],'sourceVersion':declared['version'],'licence':'Public domain','scale':'Natural Earth research representation, not legal boundary certification'}
    # --replace merges reviewed new layers with existing source-verified ones.
    # Refuse partial writes and retain a backup until the replacement validates.
    manifest={'schema':'bharat-world-detail-manifest-v1','publisher':'Natural Earth','licence':'Public domain','approvedForBundle':True,'officialPoliticalAuthority':False,'indiaAdministrativePolygonsCertified':False,'layers':{**prior_meta,**report}}
    output.parent.mkdir(parents=True,exist_ok=True)
    staged_files={**prior_files,**staged}
    tmp=Path(tempfile.mkdtemp(prefix='.world-detail-',dir=output.parent))
    backup=output.with_name(output.name+'.backup')
    if backup.exists():shutil.rmtree(tmp);raise ValueError('Previous world-detail backup exists; inspect before replacing')
    try:
        for name,blob in staged_files.items():(tmp/name).write_bytes(blob)
        (tmp/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
        validate_pack(tmp)
        if output.exists():output.rename(backup)
        try:tmp.rename(output)
        except Exception:
            if backup.exists() and not output.exists():backup.rename(output)
            raise
        if backup.exists():shutil.rmtree(backup)
    finally:
        if tmp.exists():shutil.rmtree(tmp)
    return manifest

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--provenance',required=True);p.add_argument('--output',default=str(R/'data/world-detail'))
    p.add_argument('--countries');p.add_argument('--admin1');p.add_argument('--cities');p.add_argument('--rivers');p.add_argument('--lakes');p.add_argument('--peaks');p.add_argument('--replace',action='store_true')
    a=p.parse_args();inputs={k:getattr(a,k) for k in LAYER_SPECS if getattr(a,k)}
    print(json.dumps(import_world(inputs,a.provenance,Path(a.output),a.replace)['layers'],indent=2))
