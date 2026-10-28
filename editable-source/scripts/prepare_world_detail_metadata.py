#!/usr/bin/env python3
"""Create a locally SHA-pinned provenance file for downloaded Natural Earth layers.
Explicit --confirm-reviewed is required; this does not certify historical borders.
"""
from pathlib import Path
import argparse,hashlib,json
from import_world_natural_earth import component_hashes
LAYERS=['countries','admin1','cities','rivers','lakes','peaks']
# These are publisher catalogue pages, not machine-verified raw download URLs.
CATALOGUE={
 'countries':'https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries/',
 'admin1':'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/',
 'cities':'https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-populated-places/',
 'rivers':'https://www.naturalearthdata.com/downloads/50m-physical-vectors/',
 'lakes':'https://www.naturalearthdata.com/downloads/50m-physical-vectors/',
 'peaks':'https://www.naturalearthdata.com/downloads/10m-physical-vectors/'
}
def prepare(inputs,out,version,confirm):
    if not confirm:raise ValueError('You must confirm you reviewed each data source and Natural Earth licence')
    if not inputs:raise ValueError('Supply at least one Natural Earth layer')
    manifest={'reviewed':True,'publisher':'Natural Earth','licence':'Public domain',
        'note':'Natural Earth is generalized and largely de-facto mapping; this does not certify borders. India admin-1 is excluded.',
        'sources':{}}
    for layer,source in inputs.items():
        path=Path(source)
        if not path.is_file() or path.is_symlink() or path.stat().st_size>160000000:raise ValueError('Missing/unsafe data file '+str(path))
        manifest['sources'][layer]={'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'url':CATALOGUE[layer],
             'version':version,'licence':'Public domain','localFile':path.name,
             'components':component_hashes(path)}
    out=Path(out);out.write_text(json.dumps(manifest,indent=2)+'\n')
    return manifest
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for layer in LAYERS:p.add_argument('--'+layer)
    p.add_argument('--output',default='world-detail-provenance.json')
    p.add_argument('--version',default='Natural Earth downloaded reference (check edition)')
    p.add_argument('--confirm-reviewed',action='store_true')
    a=p.parse_args();inputs={k:getattr(a,k) for k in LAYERS if getattr(a,k)}
    print(json.dumps(prepare(inputs,a.output,a.version,a.confirm_reviewed)['sources'],indent=2))
