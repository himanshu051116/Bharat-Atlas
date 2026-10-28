#!/usr/bin/env python3
"""Produce an immutable archive of exactly the inspected dist/ research-preview files.

This does not deploy or grant production approval. The same bytes that pass
verify_preview() are the only bytes written to the ZIP.
"""
import argparse
import hashlib
import json
import zipfile
from pathlib import Path
from verify_preview import verify

def package_preview(directory,archive):
    directory=Path(directory)
    archive=Path(archive)
    evidence=verify(directory)
    manifest=json.loads((directory/'build-manifest.json').read_text(encoding='utf-8'))
    names=['build-manifest.json']+[a['path'] for a in manifest['assets']]
    archive.parent.mkdir(parents=True,exist_ok=True)
    if directory.resolve() in archive.resolve().parents:
        raise ValueError('Do not place the release archive within the published static directory')
    with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for name in sorted(names):
            # verify() has already verified all paths, file sizes, and hashes.
            data=(directory/name).read_bytes()
            info=zipfile.ZipInfo(name,date_time=(1980,1,1,0,0,0))
            info.compress_type=zipfile.ZIP_DEFLATED
            info.external_attr=0o100644<<16
            z.writestr(info,data,compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
    with zipfile.ZipFile(archive) as z:
        if z.testzip() is not None or set(z.namelist())!=set(names):
            archive.unlink(missing_ok=True)
            raise ValueError('Release archive verification failed')
    return {'version':evidence['version'],'fileCount':len(names),'archiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),
            'readyForPreviewUpload':True,'readyForProduction':False}

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--dist',default=str(Path(__file__).resolve().parents[1]/'dist'))
    p.add_argument('--output',required=True)
    args=p.parse_args()
    print(json.dumps(package_preview(args.dist,args.output),indent=2))
