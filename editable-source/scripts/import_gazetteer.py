#!/usr/bin/env python3
"""Offline, non-destructive CSV-to-GeoJSON place catalogue conversion.

Accepts licensed user-supplied CSV only. Does not geocode, crawl or assert completeness.
CSV columns: name,region,kind,longitude,latitude,aliases(optional; separated by |).
"""
import argparse,csv,hashlib,json,re,sys,unicodedata,tempfile,os
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from import_boundary_data import EXPECTED,ALIASES
KINDS={'city','town','village','landmark','station'}
MAX_RECORDS=10000

def clean(v):
    return unicodedata.normalize('NFC',str(v or '').strip())

def convert(source,output_dir,*,source_url,licence,attribution):
    source,output_dir=Path(source),Path(output_dir)
    if not source.is_file() or source.suffix.lower()!='.csv' or source.stat().st_size>4_000_000:
        raise ValueError('Supply an existing CSV no larger than 4 MB')
    if output_dir.exists():raise FileExistsError('Refusing to overwrite existing data/review evidence')
    if not output_dir.parent.is_dir():raise ValueError('Output parent must already exist')
    if not str(source_url).startswith('https://') or not all(clean(x) and len(clean(x))<=120 for x in (licence,attribution)):
        raise ValueError('Documented HTTPS source, licence and attribution required')
    records=[];duplicates=set();required={'name','region','kind','longitude','latitude'}
    with source.open('r',encoding='utf-8-sig',newline='') as f:
        reader=csv.DictReader(f)
        if not reader.fieldnames or not required.issubset(reader.fieldnames):raise ValueError('Missing required CSV columns')
        for i,row in enumerate(reader,2):
            if len(records)>=MAX_RECORDS:raise ValueError('Gazetteer exceeds 10,000 record review limit')
            name,region,kind=[clean(row.get(k)) for k in ('name','region','kind')]
            region=ALIASES.get(region,region)
            if not (0<len(name)<=120 and region in EXPECTED and kind in KINDS and all(ord(c)>=32 for c in name)):
                raise ValueError(f'Line {i}: invalid name, region or category')
            try:lon=float(clean(row.get('longitude')));lat=float(clean(row.get('latitude')))
            except (TypeError,ValueError):raise ValueError(f'Line {i}: invalid coordinates')
            if not (60<=lon<=102 and 3<=lat<=41):raise ValueError(f'Line {i}: coordinates outside supported study envelope')
            aliases=[clean(a) for a in clean(row.get('aliases')).split('|') if clean(a)]
            if len(aliases)>6 or any(len(a)>120 or any(ord(c)<32 for c in a) for a in aliases):
                raise ValueError(f'Line {i}: invalid alias')
            unique=(name.casefold(),region,lon,lat)
            if unique in duplicates:raise ValueError(f'Line {i}: exact duplicate location')
            duplicates.add(unique)
            records.append(dict(name=name,region=region,kind=kind,lon=lon,lat=lat,aliases=aliases))
    if not records:raise ValueError('Empty place catalogue')
    records.sort(key=lambda p:(p['region'],p['name'].casefold(),p['lat'],p['lon']))
    features=[]
    for i,p in enumerate(records,1):
        features.append({'type':'Feature','properties':{'id':f'g{i:05d}','name':p['name'],'region':p['region'],
             'kind':p['kind'],'aliases':p['aliases']},'geometry':{'type':'Point','coordinates':[p['lon'],p['lat']]}})
    content=(json.dumps({'type':'FeatureCollection','features':features},ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n').encode('utf-8')
    metadata={'format':'BharatAtlasGazetteer1','count':len(features),'sha256':hashlib.sha256(content).hexdigest(),
      'sourceUrl':source_url,'licence':clean(licence),'attribution':clean(attribution),'officiallyVerified':False,
      'sourceFileSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'coverage':'USER-PROVIDED; NOT A COMPLETE NATIONAL GAZETTEER',
      'approval':'LOCAL RESEARCH CANDIDATE, NOT A GOVERNMENT ENDORSEMENT'}
    with tempfile.TemporaryDirectory(prefix='.atlas-places-',dir=output_dir.parent) as temp:
        temp=Path(temp)
        (temp/'places.geojson').write_bytes(content)
        (temp/'manifest.json').write_text(json.dumps(metadata,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
        os.rename(temp,output_dir)
    return metadata

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('csv',type=Path);p.add_argument('--output-dir',type=Path,required=True)
    p.add_argument('--source-url',required=True);p.add_argument('--licence',required=True);p.add_argument('--attribution',required=True)
    a=p.parse_args()
    try:print(json.dumps(convert(a.csv,a.output_dir,source_url=a.source_url,licence=a.licence,attribution=a.attribution),indent=2))
    except Exception as e:raise SystemExit(f'Place import rejected: {e}')
