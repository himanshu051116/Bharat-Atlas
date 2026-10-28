#!/usr/bin/env python3
"""Regenerate generalized physical land and inland-water holes from pinned GSHHG via Basemap.

Does not generate national boundaries, distinguish political control, or certify surveying precision.
"""
import argparse, hashlib, importlib.metadata, json, shutil
from pathlib import Path
from mpl_toolkits.basemap import Basemap
from shapely.geometry import Polygon, mapping
from shapely.ops import unary_union

def rounded_coords(v):
 if isinstance(v,(list,tuple)):
  if v and isinstance(v[0],(int,float)):return [round(float(n),6) for n in v]
  return [rounded_coords(x) for x in v]
 return v

def extract(dest):
 if importlib.metadata.version('basemap-data')!='2.0.0':raise ValueError('Pin basemap-data==2.0.0')
 m=Basemap(projection='cyl',llcrnrlon=68,llcrnrlat=6,urcrnrlon=99,urcrnrlat=38,resolution='i')
 land=unary_union([Polygon(p.get_coords()).buffer(0) for p in m.landpolygons]);lakes=unary_union([Polygon(p.get_coords()).buffer(0) for p in m.lakepolygons])
 physical=land.difference(lakes)
 if not physical.is_valid or physical.area<600:raise ValueError('GSHHG land unexpectedly incomplete')
 features=[]
 for i,poly in enumerate(physical.geoms):
  if poly.area<1e-7:continue
  features.append({'type':'Feature','properties':{'name':'Unlabelled generalized land','id':f'gshhg-land-{i:03d}'},'geometry':{'type':'Polygon','coordinates':rounded_coords(mapping(poly)['coordinates'])}})
 raw=(json.dumps({'type':'FeatureCollection','features':features},ensure_ascii=False,separators=(',',':'))+'\n').encode()
 destination=Path(dest);destination.mkdir(parents=True,exist_ok=True)
 (destination/'land.geojson').write_bytes(raw)
 meta={'format':'BharatAtlasLandcover1','dataset':'GSHHG 2.3.6 via basemap-data 2.0.0','sourceUrl':'https://www.soest.hawaii.edu/wessel/gshhg/','licence':'LGPL-3.0-or-later','attribution':'GSHHG 2.3.6; Wessel & Smith; Basemap Data 2.0.0','extent':[68,6,99,38],'officiallyVerified':False,'administrativeBoundaries':False,'featureCount':len(features),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'purpose':'Historical physical land and inland-water mask, including surrounding countries; not political borders'}
 (destination/'manifest.json').write_text(json.dumps(meta,indent=2)+'\n')
 (destination/'LICENSE-AND-SOURCE.txt').write_text('GSHHG 2.3.6 via Basemap Data 2.0.0; LGPL-3.0-or-later. Derived by unioning land polygons and subtracting lake polygons, clipped to 68–99 E, 6–38 N. Includes neighbouring countries. Not administrative or current shoreline survey data. Source: https://www.soest.hawaii.edu/wessel/gshhg/\n')
 for name in ('COPYING.GPL','COPYING.LESSER'):shutil.copy2(destination.parent/'shorelines'/name,destination/name)
 return meta

if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--output',default='data/landcover');args=ap.parse_args();print(json.dumps(extract(args.output),indent=2))
