#!/usr/bin/env python3
"""Machine-checked data & release evidence; never confer political-map certification."""
import argparse,hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def audit(root=ROOT):
 root=Path(root)
 geo=json.loads((root/'data/gazetteer/manifest.json').read_text()); city=root/'data/gazetteer/places.geojson'
 tiles=json.loads((root/'data/tiles/atlas-tiles.json').read_text());sources=tiles.get('sourceLayers') or {}
 assert hashlib.sha256(city.read_bytes()).hexdigest()==geo['sha256'],'City source changed'
 assert set(sources)==set(tiles['layers']),'Tile sources incomplete'
 for k,s in sources.items():
  assert s['officiallyVerified'] is False and s.get('attribution') and s.get('licence'),'Tile source verification misrepresented'
 official=root/'data/states.official-reviewed.geojson'
 # A filename alone is NEVER sufficient to establish authenticity, rights, or territorial agreement.
 output={'project':'Bharat Atlas','development':'v0.30','auditedData':'Research geography',
  'physicalMVT':{'tiles':tiles['tileCount'],'zoom':[tiles['minzoom'],tiles['maxzoom']],
    'sourceLayers':{k:{'sourceUrl':v['sourceUrl'],'licence':v['licence'],'sha256':v['sourceSha256'],'officiallyVerified':False} for k,v in sorted(sources.items())}},
  'settlementCoverage':{'source':'Natural Earth 1:50m public domain','selectedPoints':geo['count'],
    'comprehensiveNationalIndex':False,'addresses':False,'currentNamesIndependentlyVerified':False},
  'transport':{'roads': 'roads' in tiles['layers'],'railways':'railways' in tiles['layers'],
    'networkCoverageVerified':False},
  'politicalGeography':{'official2026Reference':'https://surveyofindia.gov.in/pages/political-map-of-india',
    'publisher':'Survey of India','edition':'English 13th edition, 2026',
    'redistributionPermissionConfirmed':False,'geometryComparedToOfficialReference':False,
    'northernTerritoryReview':{'Shaksgam':'unresolved','Gilgit-Baltistan':'unresolved','Aksai Chin':'unresolved'},
    'userSuppliedOfficialCandidatePresent':official.is_file(),
    'officiallyVerified':False},
  'realRenderer':{'unmockedEvidencePresent':False,'physicalAndroidTested':False,'physicalIOSTested':False},
  'coreV1Ready':False,'productionReleaseApproved':False}
 return output
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 a.output.parent.mkdir(parents=True,exist_ok=True)
 a.output.write_text(json.dumps(audit(),indent=2,ensure_ascii=False)+'\n')
 print('Recorded research-data source coverage — production gate remains closed')
