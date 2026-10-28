#!/usr/bin/env python3
"""Build an integrity-checked, on-demand bilingual place-search index.

Accept only a reviewed WGS84 GeoJSON Point catalogue (<=10,000 entries) or a
streamed CSV (<=500,000 rows) with documented source rights. Neither source is
geocoded, translated or claimed complete. Hindi/English search uses supplied
name and alternate-name tags, not fabricated automatic transliteration.
"""
import argparse,csv,hashlib,json,os,re,tempfile,unicodedata
from pathlib import Path

MAX_SOURCE_BYTES=90_000_000
MAX_ROWS=500_000
MAX_SHARD_BYTES=8_000_000
ALLOWED_KINDS={'city','town','village','hamlet','locality','station','landmark','poi','hospital','school','shop'}

def normalize(v):
    s=unicodedata.normalize('NFKD',str(v or '')).lower()
    s=''.join(c for c in s if not (0x300<=ord(c)<=0x36f))
    return ' '.join(''.join(c if (c.isalnum() or unicodedata.category(c).startswith('M')) else ' ' for c in s).split())

def keys(names):
    result=set()
    for n in names:
        value=normalize(n)
        for word in value.split():
            if len(word)>=2:
                result.add(''.join(f'{ord(ch):06x}' for ch in word[:2]))
    return result

def candidates(path):
    path=Path(path)
    if path.stat().st_size>MAX_SOURCE_BYTES:raise ValueError('Input exceeds 90 MB controlled-ingest limit')
    if path.suffix.lower()=='.csv':
        with path.open(encoding='utf-8-sig',newline='') as handle:
            reader=csv.DictReader(handle)
            if not {'name','longitude','latitude','kind','region'}.issubset(reader.fieldnames or []):
                raise ValueError('CSV requires name,longitude,latitude,kind,region')
            for row in reader:
                alias=row.get('aliases','') or ''
                yield {'name':row.get('name'),'aliases':alias.split('|') if alias else [],'lon':row.get('longitude'),'lat':row.get('latitude'),'region':row.get('region'),'kind':row.get('kind'),'id':row.get('id')}
    elif path.suffix.lower() in {'.json','.geojson'}:
        data=json.loads(path.read_text(encoding='utf-8'))
        if data.get('type')!='FeatureCollection':raise ValueError('FeatureCollection required')
        for feature in data.get('features',[]):
            if feature.get('geometry',{}).get('type')!='Point':raise ValueError('Only point features accepted')
            p=feature.get('properties',{})
            lon,lat=feature['geometry']['coordinates']
            yield {'name':p.get('name'),'aliases':p.get('aliases',[]),'lon':lon,'lat':lat,'region':p.get('region'),'kind':p.get('kind'),'id':p.get('id')}
    else:raise ValueError('Supported sources: CSV or GeoJSON')

def build(source,metadata_path,output):
    source,metadata_path,output=map(Path,(source,metadata_path,output))
    if not source.is_file() or not metadata_path.is_file():raise ValueError('Source and rights metadata are required')
    if output.exists() or output.is_symlink():raise ValueError('Output exists: never overwrite')
    metadata=json.loads(metadata_path.read_text(encoding='utf-8'))
    sha=hashlib.sha256(source.read_bytes()).hexdigest()
    if metadata.get('sourceSha256')!=sha or metadata.get('officiallyVerified') is not False:
        raise ValueError('Source digest mismatch or invalid verification claim')
    if not str(metadata.get('sourceUrl','')).startswith('https://') or not metadata.get('licence') or not metadata.get('attribution'):
        raise ValueError('Source URL, licence and attribution required')
    if metadata.get('redistributionReview')!='approved_for_research_preview':
        raise ValueError('Separate human redistribution review is required')
    output.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(dir=output.parent,prefix='.search-build-') as td:
        stage=Path(td)/'shards';stage.mkdir()
        handles={};counts={};size={};ids=set();total=0
        try:
            for i,row in enumerate(candidates(source),1):
                if i>MAX_ROWS:raise ValueError('More than 500,000 indexed places')
                name=str(row['name'] or '').strip();aliases=row.get('aliases') or []
                if not isinstance(aliases,list):raise ValueError('Aliases must be an array')
                aliases=[str(v).strip() for v in aliases if str(v).strip()]
                if not name or len(name)>120 or len(aliases)>10 or any(len(v)>120 for v in aliases):raise ValueError('Invalid name or alternate names')
                try:lon=float(row['lon']);lat=float(row['lat'])
                except (ValueError,TypeError):raise ValueError('Invalid coordinate')
                if not (-180<=lon<=180 and -85.051129<=lat<=85.051129 and 60<=lon<=102 and 3<=lat<=41):raise ValueError('Outside India study envelope')
                kind=str(row['kind'] or '').strip().lower();region=str(row['region'] or '').strip()
                if kind not in ALLOWED_KINDS or not region or len(region)>100:raise ValueError('Invalid place kind or region')
                if any(any(ord(c)<32 for c in s) for s in [name,*aliases,region]):raise ValueError('Control character in names')
                key_id=str(row.get('id') or f'place-{i}')
                if not re.fullmatch(r'[\w-]{1,70}',key_id,re.UNICODE) or key_id in ids:raise ValueError('Duplicate or unsafe place ID')
                ids.add(key_id)
                record={'id':key_id,'name':name,'aliases':aliases,'region':region,'kind':kind,'lon':lon,'lat':lat}
                line=(json.dumps(record,ensure_ascii=False,separators=(',',':'))+'\n').encode('utf-8')
                for bucket in keys([name,*aliases]):
                    newsize=size.get(bucket,0)+len(line)
                    if newsize>MAX_SHARD_BYTES:raise ValueError('A search shard exceeds 8MB; use a smaller regional index')
                    if bucket not in handles:handles[bucket]=(stage/(bucket+'.jsonl')).open('ab')
                    handles[bucket].write(line);size[bucket]=newsize;counts[bucket]=counts.get(bucket,0)+1
                total+=1
        finally:
            for handle in handles.values():handle.close()
        if not total:raise ValueError('Empty search index')
        shards={k:{'path':f'{k}.jsonl','sha256':hashlib.sha256((stage/(k+'.jsonl')).read_bytes()).hexdigest(),'bytes':size[k],'records':counts[k]} for k in sorted(counts)}
        manifest={'format':'BharatAtlasSearchShards1','researchOnly':True,'officiallyVerified':False,'recordCount':total,'sourceSha256':sha,'sourceUrl':metadata['sourceUrl'],'licence':metadata['licence'],'attribution':metadata['attribution'],'coverageClaim':metadata.get('coverageClaim','unverified_extract'),'shards':shards}
        (stage/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        os.rename(stage,output)
        return manifest

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',required=True,type=Path);p.add_argument('--metadata',required=True,type=Path);p.add_argument('--output',required=True,type=Path)
    a=p.parse_args();r=build(a.source,a.metadata,a.output)
    print(json.dumps({'records':r['recordCount'],'shards':len(r['shards']),'sourceSha256':r['sourceSha256'],'researchOnly':True},indent=2))
