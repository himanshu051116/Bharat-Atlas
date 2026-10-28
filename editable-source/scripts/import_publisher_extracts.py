#!/usr/bin/env python3
"""Build strictly labelled PARTIAL Natural Earth features already reviewed from
publisher's GitHub GeoJSON. These are NOT complete 50m or 10m datasets.

The TSV snapshots are transcribed from publisher files and deliberately carry
upstream Git blob IDs. A hash of the derived local GeoJSON proves only local
integrity, not that the entire publisher archive was downloaded or authenticated.
"""
from __future__ import annotations
import hashlib,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from import_world_natural_earth import import_world,component_hashes

SOURCE=ROOT/'source-data'/'natural-earth-geojson-extracts'
UPSTREAM={
 'cities':('geojson/ne_50m_populated_places_simple.geojson','3fad8f0038ba95c7758800f3f3c148418e7c76d1',1251),
 'peaks':('geojson/ne_50m_geography_regions_elevation_points.geojson','70050da0bc83a0736d6c6ca92a6a3a09b710e316',86)
}
def _feature(name,iso,lon,lat,elevation=None):
 p={'name':name,'adm0_a3':iso,'admin':'','scalerank':'4','featurecla':'Populated place'}
 if elevation is not None:p={'name':name,'elevation':int(elevation),'scalerank':'4'}
 return {'type':'Feature','properties':p,'geometry':{'type':'Point','coordinates':[lon,lat]}}
def build(output=None):
 output=Path(output or ROOT/'data/world-detail')
 source_dir=SOURCE/'derived';source_dir.mkdir(exist_ok=True)
 snapshot={}
 cityrows=[];seen=set()
 for raw in (SOURCE/'major_cities_50m.tsv').read_text(encoding='utf8').splitlines():
  name,iso,x,y=raw.split('|')
  lon,lat=int(x)/10000,int(y)/10000
  assert -180<=lon<=180 and -90<=lat<=90
  key=(name.casefold(),iso)
  if key in seen:continue
  seen.add(key)
  cityrows.append(_feature(name,iso,lon,lat))
 # Preserve the original 71 Indian Natural Earth point references rather than regress coverage.
 previous=json.loads((output/'cities.geojson').read_text(encoding='utf8'))['features']
 for old in previous:
  p=old['properties']; key=(p['name'].casefold(),p.get('countryIso3') or '')
  if key in seen:continue
  seen.add(key)
  x,y=old['geometry']['coordinates']
  cityrows.append(_feature(p['name'],p.get('countryIso3') or '',x,y))
 peaks=[]
 for raw in (SOURCE/'elevation_points_50m.tsv').read_text(encoding='utf8').splitlines():
  name,x,y,height=raw.split('|')
  lon,lat=int(x)/10000,int(y)/10000
  assert -180<=lon<=180 and -90<=lat<=90
  peaks.append(_feature(name,'',lon,lat,height))
 files={}
 for layer,feats in [('cities',cityrows),('peaks',peaks)]:
  p=source_dir/(layer+'.geojson')
  p.write_text(json.dumps({'type':'FeatureCollection','crs':{'type':'name','properties':{'name':'EPSG:4326'}},'features':feats},ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
  files[layer]=p
 prov={'reviewed':True,'publisher':'Natural Earth','licence':'Public domain','sources':{}}
 for layer,p in files.items():
  path,blob_sha,original_count=UPSTREAM[layer]
  prov['sources'][layer]={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'components':component_hashes(p),
    'version':f'Natural Earth 50m GitHub curated extract ({len(cityrows) if layer=="cities" else len(peaks)} included; NOT original full dataset)',
    'url':f'https://github.com/nvkelso/natural-earth-vector/blob/master/{path}',
    'licence':'Public domain',
    'sourceGitBlobSHA1':blob_sha,'publisherFeatureCount':original_count}
 prop=source_dir/'source-review.json';prop.write_text(json.dumps(prov,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 meta=import_world(files,prop,output,replace=True)
 # External evidence added separately; importer only enforces SHA-256 of files it actually read.
 mpath=output/'manifest.json';m=json.loads(mpath.read_text(encoding='utf8'))
 for layer in files:
  m['layers'][layer]['sourceGitBlobSHA1']=UPSTREAM[layer][1]
  m['layers'][layer]['curatedSubsetNotFullDataset']=True
  m['layers'][layer]['publisherFileFeatureCount']=UPSTREAM[layer][2]
  if layer=='cities':m['layers'][layer]['includesInheritedIndiaPlaceSubset']=True
 mpath.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 from world_detail_contract import validate
 validate(output)
 return {layer:m['layers'][layer]['count'] for layer in files}
if __name__=='__main__':print(json.dumps(build(),indent=2))
