#!/usr/bin/env python3
"""Build an optional legacy reference capital-point layer.

The CountryInfo 0.1.2 MIT licensed offline snapshot is NOT an up-to-date
political or administrative source. Avoid displaying corrupt geocodes by
checking the points against Natural Earth's coarse country extent. A failed
match or uncertain capital is omitted, never invented.
"""
from pathlib import Path
import hashlib,json,glob,importlib.metadata,importlib.util,sys
R=Path(__file__).resolve().parents[1]
BASE=R/'data/world'

def build():
    assert importlib.metadata.version('countryinfo') == '0.1.2', 'Review source version change before regenerating.'
    lib=Path(importlib.util.find_spec('countryinfo').origin).parent
    cc={}
    fingerprints=[]
    for path in sorted((lib/'data').glob('*.json')):
        raw=path.read_bytes(); info=json.loads(raw)
        if len(info)==1 and 'ISO' not in info: info=next(iter(info.values()))
        if not isinstance(info,dict):continue
        code=info.get('ISO',{}).get('alpha2')
        if code:cc[code]=info
        fingerprints.append(path.name+':'+hashlib.sha256(raw).hexdigest())
    world=json.loads((BASE/'world-boundaries.json').read_text())
    records=[];skipped=[]
    for item in world['features']:
        code=item.get('iso2'); ref=cc.get(code)
        cap=ref and ref.get('capital'); coords=ref and ref.get('capital_latlng')
        if not isinstance(cap,str) or not cap.strip() or not isinstance(coords,list) or len(coords)!=2:
            skipped.append(item['name']);continue
        lat,lon=coords
        if not all(isinstance(v,(int,float)) and not isinstance(v,bool) for v in (lat,lon)) or not (-90<=lat<=90 and -180<=lon<=180):
            skipped.append(item['name']);continue
        west,south,east,north=item['bbox']
        # Guard against known corrupted coordinates in this archival snapshot.
        within = south-3<=lat<=north+3 and (west-3<=lon<=east+3 or east-west>300)
        if not within:
            skipped.append(item['name']);continue
        records.append({'countryId':item['id'],'iso2':code,'country':item['name'],
                        'name':cap.strip(),'lat':round(lat,5),'lon':round(lon,5)})
    records.sort(key=lambda c:c['countryId'])
    payload={'schema':'bharat-world-capital-references-v1','status':'legacy-reference-not-current-administrative-proof',
             'source':'countryinfo 0.1.2 offline snapshot (MIT); coordinates not independently verified',
             'features':records}
    raw=(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n').encode('utf8')
    manifest={'schema':'bharat-world-capital-manifest-v1','sourceLibrary':'countryinfo',
              'sourceVersion':'0.1.2','sourceLicense':'MIT',
              'sourceFileListSha256':hashlib.sha256('\n'.join(fingerprints).encode()).hexdigest(),
              'status':'legacy snapshot; may omit or misclassify current national capitals',
              'count':len(records),'skipped':skipped,'file':'world-capital-references.json',
              'sha256':hashlib.sha256(raw).hexdigest()}
    if not (120<=len(records)<=200):raise RuntimeError(f'Unexpected capital reference coverage: {len(records)}')
    (BASE/'world-capital-references.json').write_bytes(raw)
    (BASE/'capitals-manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
    print('capital reference points:',len(records),'omitted:',len(skipped))
if __name__=='__main__':build()
