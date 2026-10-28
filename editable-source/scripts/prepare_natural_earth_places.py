#!/usr/bin/env python3
"""Generate a source-backed, explicitly non-authoritative India city-point catalogue.

This is a reviewed subset of Natural Earth 1:50m populated places pinned to GitHub
blob f692f6... NOT a complete national gazetteer or a source of political boundaries.
Editorial region reconciliation is documented, not claimed as survey-certified.
"""
from __future__ import annotations
import argparse, csv, hashlib, io, json, tempfile
from pathlib import Path
from import_gazetteer import convert

SOURCE_BLOB_SHA='f692f6a1311569612a2d3fbb3554e97ec0bfe64c'
APPROVED_SUBSET_SHA256='9bef07c58379fe977444a6cc0915346f033d6ba0899343cbc5f85eee2054d0d8'
SOURCE_URL='https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_populated_places.geojson'
LICENCE='Public Domain (Natural Earth)' 
ATTRIBUTION='Natural Earth 1:50m populated places (public domain); editorial region names, not survey-certified'
EXTRA_ALIASES={
  'Allahabad':['Prayagraj'],'Jullundur':['Jalandhar'],'Nasik':['Nashik'],
  'Sholapur':['Solapur'],'Vishakhapatnam':['Visakhapatnam'],
  'Puducherry':['Pondicherry'],'Kalaburagi':['Gulbarga'],
  'Bengaluru':['Bangalore'],'Bhubaneswar':['Bhubaneshwar'],
  'Kozhikode':['Calicut'], 'Thiruvananthapuram':['Trivandrum']
}
CORRECTED_SOURCE_REGIONS=['Ahmedabad','Rajkot','Surat','Vadodara','Bhubaneswar','Cuttack']

def prepare(source:Path,output:Path):
    rows=[];seen=set();names=set()
    for line in source.read_text(encoding='utf-8').splitlines():
        if not line.strip() or line.lstrip().startswith('#'):continue
        columns=line.split('|')
        if len(columns)!=7:raise ValueError('Expected seven pinned Natural Earth columns')
        sid,name,hindi,lon,lat,scale,region=columns
        if not sid.isdigit() or sid in seen or name in names:raise ValueError('Duplicate or invalid source identity')
        seen.add(sid);names.add(name)
        if not (hindi and int(scale) in range(0,6)):raise ValueError('Missing source Hindi or invalid scale rank')
        extra=EXTRA_ALIASES.get(name,[])
        aliases=[hindi,*extra] if hindi!=name else extra
        rows.append({'name':name,'region':region,'kind':'city','longitude':lon,'latitude':lat,'aliases':'|'.join(aliases)})
    if len(rows)!=71:raise ValueError(f'Unexpected source subset size: {len(rows)}; expected 71')
    if hashlib.sha256(source.read_bytes()).hexdigest()!=APPROVED_SUBSET_SHA256:
        raise ValueError('Pinned Natural Earth research subset SHA-256 changed; a new independent source review is required')
    with tempfile.TemporaryDirectory(prefix='atlas-naturalearth-') as temp:
        csvfile=Path(temp)/'cities.csv'
        with csvfile.open('w',encoding='utf-8',newline='') as f:
            writer=csv.DictWriter(f,fieldnames=['name','region','kind','longitude','latitude','aliases']);writer.writeheader();writer.writerows(rows)
        meta=convert(csvfile,output,source_url=SOURCE_URL,licence=LICENCE,attribution=ATTRIBUTION)
    manifest=output/'manifest.json'
    raw=json.loads(manifest.read_text(encoding='utf-8'))
    raw.update({
        'datasetScale':'1:50,000,000','sourceDataset':'Natural Earth 1:50m populated places',
        'pinnedGitBlobSha':SOURCE_BLOB_SHA,
        'inputSubsetSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'countryFilter':'Natural Earth ADM0NAME == India (not official territorial validation)',
        'historicalNamesNotice':'Natural Earth English names may be dated; Hindi and alternate names are source/editorial aliases, not a validated current-name registry',
        'regionReconciliation':{'approach':'Manual research labels; never used to construct administrative geometry',
                                'overriddenSourceAdm1Names':CORRECTED_SOURCE_REGIONS,
                                'warning':'Some source admin-1 records misassign Gujarat cities; resulting labels require independent review'},
        'geographicAccuracy':'Point positions approximate; NOT survey-verified, NOT address data or authoritative political boundaries'
    })
    manifest.write_text(json.dumps(raw,ensure_ascii=False,indent=2,sort_keys=True)+'\n',encoding='utf-8')
    (output/'SOURCE-AND-LICENCE.txt').write_text('Natural Earth 1:50m Populated Places — public domain.\n'+
        'Source: '+SOURCE_URL+'\nOriginal pinned Git blob: '+SOURCE_BLOB_SHA+'\n'+
        'Subset filtered to 71 India-tagged records. Hindi labels and point locations retained; editorial search aliases added.\n'+
        'Regional labels manually reconciled from known naming discrepancies; NOT independently survey-certified.\n'+
        'Copyright: Natural Earth data is public domain. https://www.naturalearthdata.com/about/terms-of-use/\n'+
        'No political boundary or address-precision claims. This subset is not exhaustive.\n',encoding='utf-8')
    return raw

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,default=Path(__file__).resolve().parents[1]/'source-data/natural-earth-50m-india-places.tsv')
    p.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[1]/'data/gazetteer')
    args=p.parse_args();print(json.dumps(prepare(args.source,args.output),ensure_ascii=False,indent=2))
