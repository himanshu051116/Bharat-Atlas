#!/usr/bin/env python3
"""Normalize polygon datasets for Bharat Atlas; never auto-certify official accuracy.

Accepts GeoJSON, Shapefile, or a ZIP containing a Shapefile. Always outputs
**review** assets, regardless of test results. A separate documented comparison
with the Survey of India current political map is required for release.

Example:
 python scripts/prepare_boundaries.py file.zip --name-field STATE_NAME \
   --source 'Survey of India Administrative Boundary Database, edition ...' \
   --licence '...source licence/permission...' --version 'YYYY-MM' \
   --output data/india-states.review.geojson --report data/audit-report.json
"""
import argparse
import json
import sys
from pathlib import Path
import geopandas as gpd
from shapely.geometry import Point
from shapely.ops import unary_union
from shapely.validation import explain_validity

STATES={"Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal"}
UTS={"Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry"}
ALIASES={"Orissa":"Odisha","Uttaranchal":"Uttarakhand","Andaman and Nicobar":"Andaman and Nicobar Islands","Jammu & Kashmir":"Jammu and Kashmir","Pondicherry":"Puducherry","NCT of Delhi":"Delhi"}
CHECKS=[("Gilgit city approximate",74.3,35.92,"Ladakh"),("Muzaffarabad approximate",73.47,34.37,"Jammu and Kashmir"),("Aksai Chin approximate",79.1,35,"Ladakh"),("Shaksgam sample",76.41987,36.11126,"Ladakh")]

def prepare(src, name_field=None):
    path=str(src)
    if path.lower().endswith('.zip'): path='zip://'+str(Path(src).resolve())
    gdf=gpd.read_file(path)
    if gdf.empty: raise ValueError('The geographic file has no features')
    if gdf.crs is None: raise ValueError('Unknown CRS. Define a CRS in your GIS software before import; do not guess EPSG:4326')
    candidates=['name','NAME_1','ST_NM','st_nm','STATE','STATE_NAME','state_name','UT_NAME','NAME','State_Name']
    if name_field and name_field not in gdf.columns: raise ValueError(f'No field {name_field!r}. Available: {list(gdf.columns)}')
    if not name_field: name_field=next((x for x in candidates if x in gdf.columns),None)
    if not name_field: raise ValueError(f'Cannot detect state-name column; pass --name-field. Columns: {list(gdf.columns)}')
    gdf=gdf.to_crs('EPSG:4326')
    gdf=gdf[[name_field,'geometry']].rename(columns={name_field:'name'})
    gdf['name']=gdf['name'].astype(str).str.strip().replace(ALIASES)
    if gdf.geometry.isna().any():raise ValueError('Dataset contains missing geometries')
    nonpoly=[x for x in gdf.geom_type.unique() if x not in ('Polygon','MultiPolygon')]
    if nonpoly:raise ValueError(f'Non-polygon input features found: {nonpoly}')
    invalid=[{'name':str(row['name']),'problem':explain_validity(row.geometry)} for _,row in gdf.iterrows() if not row.geometry.is_valid]
    if invalid:raise ValueError(f'Invalid geometry in input: {invalid[:6]}')
    # District-level inputs are dissolved by their state/UT names.
    gdf=gdf.dissolve(by='name',as_index=False)
    gdf=gdf.sort_values('name',kind='stable').reset_index(drop=True)
    return gdf,name_field

def audit(gdf):
    names=set(gdf['name']);required=STATES|UTS
    report={'features':len(gdf),'states_found':len(names&STATES),'uts_found':len(names&UTS),'missing':sorted(required-names),'unexpected':sorted(names-required),'tests':[],'geometry':{},'certified':False,'reason':'Automated checks cannot establish equivalence with Survey of India political map'}
    entries=list(zip(gdf['name'],gdf.geometry))
    violations=[]
    for name,geom in entries:
        if not geom.is_valid:violations.append({'name':name,'why':explain_validity(geom)})
        minx,miny,maxx,maxy=geom.bounds
        if minx<60 or maxx>102 or miny<3 or maxy>41:violations.append({'name':name,'why':'extent outside expected India geographic envelope'})
    report['geometry']['violations']=violations
    # Spatial screening: shared state borders should not have substantial interior overlaps.
    overlaps=[]
    for i,(name,a) in enumerate(entries):
        for other,b in entries[i+1:]:
            if not a.bounds or not b.bounds or not a.intersects(b):continue
            inter=a.intersection(b)
            if inter.area>0.00002:
                overlaps.append({'regions':[name,other],'overlap_sq_degrees':round(inter.area,8)})
    report['geometry']['overlaps']=overlaps
    for title,lon,lat,expected in CHECKS:
        point=Point(lon,lat)
        actual=[name for name,geom in entries if geom.covers(point)]
        report['tests'].append({'name':title,'expected':expected,'actual':actual,'pass':actual==[expected]})
    report['screening_pass']=(len(names)==36 and not report['missing'] and not report['unexpected'] and not violations and not overlaps and all(t['pass'] for t in report['tests']))
    return report

def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__,formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('input',help='Input Shapefile, GeoJSON, or Shapefile ZIP')
    p.add_argument('--name-field',help='State name attribute in the input Shapefile')
    p.add_argument('--source',required=True,help='Original source title/agency, NOT a claim of verification')
    p.add_argument('--licence',required=True,help='Source licence / permissions statement')
    p.add_argument('--version',required=True,help='Source edition or vintage')
    p.add_argument('--output',default='data/india-states.review.geojson')
    p.add_argument('--report',default='data/audit-report.json')
    args=p.parse_args(argv)
    gdf,name_field=prepare(args.input,args.name_field)
    out=audit(gdf)
    out['source']={'title':args.source,'licence':args.licence,'vintage':args.version,'original_filename':Path(args.input).name,'name_field':name_field}
    dest=Path(args.output);dest.parent.mkdir(parents=True,exist_ok=True)
    report=Path(args.report);report.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(gdf.to_json(drop_id=True,to_wgs84=True),encoding='utf-8')
    report.write_text(json.dumps(out,indent=2,ensure_ascii=False),encoding='utf-8')
    print(json.dumps({k:out[k] for k in ('features','states_found','uts_found','missing','unexpected','screening_pass','certified')},indent=2))
    print('Review-only file:',dest,'\nQA report:',report)
    if not out['screening_pass']:
        print('GEOMETRY REVIEW REQUIRED: automated checks found issues.',file=sys.stderr)
        return 1
    print('Preliminary geometry checks passed. Still NOT certified against Survey of India.')
    return 0

if __name__=='__main__':sys.exit(main())
