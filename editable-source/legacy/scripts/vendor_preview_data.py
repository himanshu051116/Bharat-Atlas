#!/usr/bin/env python3
"""Opt-in download of pinned community ODbL geometry for local research only.
This dataset is explicitly NOT official and may omit Shaksgam Valley.
"""
import hashlib,json,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
COMMIT='2c829a3543171810a4b28162ea736fb76dfdef40'
URL=f'https://raw.githubusercontent.com/Vardhan-Systems/vardhan-maps/{COMMIT}/src/data/generated/states.low.json'
DEST=ROOT/'data'/'states.provisional.geojson'

def main():
    with urllib.request.urlopen(URL,timeout=30) as r:
        if r.status!=200: raise RuntimeError('Upstream HTTP '+str(r.status))
        body=r.read(2_000_001)
    if len(body)>2_000_000:raise ValueError('Unexpectedly large community source')
    obj=json.loads(body)
    if obj.get('type')!='FeatureCollection' or len(obj.get('features',[]))!=36:raise ValueError('Not the 36-region data file')
    DEST.write_bytes(body)
    report={'source':URL,'sha256':hashlib.sha256(body).hexdigest(),'sizeBytes':len(body),'geometryStatus':'COMMUNITY / UNVERIFIED',
     'licence':'Open Database License (ODbL) 1.0, © OpenStreetMap contributors',
     'documentation':'https://github.com/Vardhan-Systems/vardhan-maps/blob/main/ATTRIBUTION.md',
     'warning':'Do not label official or verified. Shaksgam and other boundaries need independent review.'}
    (ROOT/'data'/'community-preview-provenance.json').write_text(json.dumps(report,indent=2)+'\n')
    print('Downloaded provisional ODbL map:',DEST,report['sizeBytes'],'bytes; sha256',report['sha256'])

if __name__=='__main__':main()
