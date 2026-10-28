#!/usr/bin/env python3
"""Rebuild physical MVT with genuinely sourced Natural Earth settlement points.

Fail closed on source digests/rights; never fill in fictional roads or railway data.
This tool does not download anything or certify Survey of India boundaries.
"""
from __future__ import annotations
import argparse, hashlib, json, sys
from pathlib import Path
from tempfile import TemporaryDirectory
from build_vector_tiles import make_pyramid
ROOT=Path(__file__).resolve().parents[1]

def digest(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def source_layer(meta,url,sha,licence,attribution):
    if meta.get('officiallyVerified') is not False:raise ValueError('Only unverified research sources accepted')
    if not url.startswith('https://') or not licence or not attribution:raise ValueError('Missing valid source credentials')
    return {'sourceUrl':url,'sourceSha256':sha,'licence':licence,'attribution':attribution,
            'officiallyVerified':False}

def make_multisource(root=ROOT,out=None,min_zoom=3,max_zoom=8):
    root=Path(root);out=Path(out or root/'data/tiles')
    rivers=root/'data/hydrography/rivers.geojson';hydro=json.loads((rivers.parent/'manifest.json').read_text())
    if digest(rivers)!=hydro['sha256'] or hydro.get('riverNamesVerified') is not False or hydro.get('licence')!='LGPL-3.0-or-later':
        raise ValueError('Historical hydrology source was modified or rights changed')
    shore=root/'data/shorelines';sm=json.loads((shore/'manifest.json').read_text())
    places=root/'data/gazetteer/places.geojson';pm=json.loads((places.parent/'manifest.json').read_text())
    if (digest(places)!=pm['sha256'] or pm['count']!=71 or pm.get('officiallyVerified') is not False
        or 'Public Domain' not in pm['licence'] or not pm['sourceUrl'].startswith('https://')):
        raise ValueError('Natural Earth gazetteer identity or rights mismatch')
    gaz=json.loads(places.read_text())
    if gaz.get('type')!='FeatureCollection' or len(gaz.get('features',[]))!=71 or len({f['properties']['id'] for f in gaz['features']})!=71:
        raise ValueError('Expected 71 unique source-backed named settlement points')
    inputs={'rivers':rivers,'settlements':places}
    sources={'rivers':source_layer(hydro,hydro['sourceUrl'],hydro['sha256'],hydro['licence'],hydro['attribution']),
      'settlements':source_layer(pm,pm['sourceUrl'],pm['sha256'],pm['licence'],pm['attribution'])}
    for name in ('coastlines','lakes'):
        path=shore/f'{name}.geojson';m=sm['layers'][name]
        if digest(path)!=m['sha256'] or sm.get('namesVerified') is not False or sm['licence']!='LGPL-3.0-or-later':
            raise ValueError('Historical shorelines source has changed')
        inputs[name]=path
        sources[name]=source_layer(sm,sm['sourceUrl'],m['sha256'],sm['licence'],sm['attribution'])
    with TemporaryDirectory(prefix='atlas-multi-meta-') as tmp:
        metadata=Path(tmp)/'tile-source.json'
        metadata.write_text(json.dumps({'officiallyVerified':False,
          'licence':'LGPL-3.0-or-later (GSHHG) + Public Domain (Natural Earth)',
          'attribution':hydro['attribution']+'; Natural Earth 1:50m populated places (public domain)',
          'sourceUrl':hydro['sourceUrl'],
          'description':'Historical generalized rivers/shorelines with 71 Natural Earth selected city points. No roads, railways or official borders.',
          'sourceLayers':sources},indent=2)+'\n')
        manifest=make_pyramid(inputs,metadata,out,min_zoom,max_zoom)
    if manifest.get('sourceLayers')!=sources:raise ValueError('Per-layer source provenance was not preserved')
    if not set(['rivers','coastlines','lakes','settlements']).issubset(manifest['layers']):
        raise ValueError('Multisource tiles did not contain expected layers')
    return manifest

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path)
    options=parser.parse_args();report=make_multisource(out=options.output)
    print(f"Built {report['tileCount']} independent-decoded tiles; {report['layers']}; {report['featureOccurrences'].get('settlements')} settlement tile occurrences")
