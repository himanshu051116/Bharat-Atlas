#!/usr/bin/env python3
"""Explicit opt-in to bundle a *licensed provisional* 36-region GeoJSON locally.

Requires valid region identities AND independent offline GEOS topology screening.
Never fetches or certifies boundaries; never replaces an existing source silently.
"""
import argparse, hashlib, json, os, sys, tempfile
from pathlib import Path
R = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(R/'legacy'/'scripts'))
from validate_geojson import STATES, UTS, name
sys.path.insert(0, str(R/'scripts'))
from geometry_audit import audit


def prepare(src, source_url, licence, attribution):
    src = Path(src)
    if not src.is_file() or src.stat().st_size > 4_000_000:
        raise ValueError('Missing or unusually large source')
    if not source_url.startswith('https://'):
        raise ValueError('Provide a verifiable HTTPS source URL')
    if not licence.strip() or licence.strip().lower() in {'unknown', 'none', 'unspecified'}:
        raise ValueError('A redistribution licence is required')
    if not attribution.strip():
        raise ValueError('Data attribution is required')
    target=R/'data'/'states.provisional.geojson'
    metadata=R/'data'/'preview-provenance.json'
    if target.exists() or metadata.exists():
        raise FileExistsError('A provisional dataset already exists; never overwrite it silently')
    body=src.read_bytes()
    data=json.loads(body)
    if data.get('type')!='FeatureCollection' or len(data.get('features',[]))!=36:
        raise ValueError('Require 36 top-level administrative features')
    names=[name(f) for f in data['features']]
    if set(names)!=STATES|UTS or len(set(names))!=36:
        raise ValueError('Incorrect or duplicated region identities')
    report=audit(src, require_complete=True)
    if report['invalidGeometry'] or report['overlapsKm2'] or report['duplicateRegions'] or report['unexpectedRegions']:
        raise ValueError('Independent GIS topology audit failed: no source was installed')
    digest=hashlib.sha256(body).hexdigest()
    record={
        'kind':'provisional-community-or-licensed-research', 'sha256':digest,
        'bytes':len(body), 'sourceUrl':source_url, 'licence':licence,
        'attribution':attribution, 'officiallyVerified':False,
        'allFourSamplePointsPass':all(row['matches'] for row in report['sampleLocations']),
        'knownLimitation':'Not compared against Survey of India 2026; northern boundary samples may fail.'
    }
    # Prepare both files privately first; do not let validation failures alter existing map data.
    with tempfile.TemporaryDirectory(dir=R/'data',prefix='.atlas-stage-') as tmp:
        staged=Path(tmp)
        (staged/target.name).write_bytes(body)
        (staged/metadata.name).write_text(json.dumps(record,indent=2)+'\n')
        created=[]
        try:
            for original,final in ((staged/target.name,target),(staged/metadata.name,metadata)):
                os.link(original,final)  # exclusive destination, no race-based overwrite
                created.append(final)
        except Exception:
            for item in created:item.unlink(missing_ok=True)
            raise
    return record


if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('source',type=Path)
    p.add_argument('--source-url',required=True)
    p.add_argument('--licence',required=True)
    p.add_argument('--attribution',required=True)
    args=p.parse_args()
    try:print(json.dumps(prepare(args.source,args.source_url,args.licence,args.attribution),indent=2))
    except Exception as exc:raise SystemExit('Cannot prepare source: '+str(exc))
