"""World reference city integrity and geographic sanity; not current-capital certification."""
from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parents[1]
def test_capitals_have_source_matches_and_filtered_geocoding_errors():
    d=R/'data/world'
    meta=json.loads((d/'capitals-manifest.json').read_text())
    raw=(d/'world-capital-references.json').read_bytes()
    src=json.loads(raw)
    regions={r['id']:r for r in json.loads((d/'world-boundaries.json').read_text())['features']}
    assert meta['sha256']==hashlib.sha256(raw).hexdigest()
    assert 120<=meta['count']==len(src['features'])<=200
    codes=set()
    for cap in src['features']:
        assert cap['countryId'] not in codes
        codes.add(cap['countryId'])
        region=regions[cap['countryId']]
        assert cap['country']==region['name']
        west,south,east,north=region['bbox']
        assert south-3<=cap['lat']<=north+3
        assert west-3<=cap['lon']<=east+3 or east-west>300
    assert {'Chile','Timor-Leste','Bulgaria'} <= set(meta['skipped'])
    assert (d/'capitals-license.txt').is_file()
