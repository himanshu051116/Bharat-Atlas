#!/usr/bin/env python3
"""Install an unmodified, pinned MapLibre UMD distribution from its npm tarball.

No silent CDN fallback is allowed by the strict real-renderer proof.
Usage:
  python scripts/vendor_maplibre.py --tarball /path/to/maplibre-gl-5.13.0.tgz
  python scripts/vendor_maplibre.py --fetch  # needs npm connectivity
"""
import argparse, base64, hashlib, hmac, json, re, shutil, subprocess, tarfile, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
VERSION='5.13.0'
FILES={'package/dist/maplibre-gl.js':'maplibre-gl.js',
       'package/dist/maplibre-gl.css':'maplibre-gl.css',
       'package/LICENSE.txt':'MAPLIBRE-LICENSE.txt'}

def verify_npm_integrity(source, integrity):
    """Verify tarball against dist.integrity obtained independently from npm registry.

    Never trust an archive's filename, embedded metadata or its own checksum.
    """
    if not isinstance(integrity, str) or not re.fullmatch(r'sha512-[A-Za-z0-9+/]{86}==', integrity):
        raise ValueError('Missing or malformed authoritative npm SHA-512 integrity')
    expected = base64.b64decode(integrity.removeprefix('sha512-'), validate=True)
    actual = hashlib.sha512(Path(source).read_bytes()).digest()
    if not hmac.compare_digest(actual, expected):
        raise ValueError('MapLibre npm SHA-512 integrity mismatch')
    return hashlib.sha256(Path(source).read_bytes()).hexdigest()


def install_tarball(source, dest=None, npm_integrity=None):
    if not npm_integrity:raise ValueError('npm SHA-512 integrity is required; obtain it independently from registry.npmjs.org')
    tar_sha256=verify_npm_integrity(source,npm_integrity)
    dest=Path(dest) if dest is not None else ROOT/'vendor'
    with tarfile.open(source,'r:gz') as archive:
        members={x.name:x for x in archive.getmembers()}
        if 'package/package.json' not in members:raise ValueError('Not an npm package tarball')
        package=json.loads(archive.extractfile(members['package/package.json']).read())
        if package.get('name')!='maplibre-gl' or package.get('version')!=VERSION:
            raise ValueError(f'Expected maplibre-gl exactly {VERSION}; got {package.get("name")} {package.get("version")}')
        files={}
        for src,dst in FILES.items():
            # MapLibre npm packages publish the licence at package/LICENSE.txt, not in dist/.
            # Accept an older dist/LICENSE.txt only as a compatibility fallback.
            actual=src if src in members and members[src].isfile() else ('package/dist/LICENSE.txt' if dst=='MAPLIBRE-LICENSE.txt' else src)
            if actual not in members or not members[actual].isfile():raise ValueError('Missing required MapLibre npm distribution: '+src)
            buf=archive.extractfile(members[actual]).read()
            if len(buf)<(200000 if dst.endswith('.js') else 4000):raise ValueError('Unexpected short vendor file: '+dst)
            files[dst]=buf
    if b'BSD' not in files['MAPLIBRE-LICENSE.txt'] and b'Redistribution' not in files['MAPLIBRE-LICENSE.txt']:
        raise ValueError('MapLibre licence notice missing')
    dest.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='atlas-vendor-',dir=dest.parent) as tmp:
        staged=Path(tmp)/'vendor';staged.mkdir()
        for name,data in files.items():(staged/name).write_bytes(data)
        (staged/'maplibre-provenance.json').write_text(json.dumps({
            'package':'maplibre-gl','version':VERSION,'npmTarball':Path(source).name,
            'npmIntegrity':npm_integrity,'tarballSha256':tar_sha256,
            'sha256':{n:hashlib.sha256(b).hexdigest() for n,b in sorted(files.items())},
            'officialSource':'https://www.npmjs.com/package/maplibre-gl/v/5.13.0',
            'licence':'BSD-3-Clause, see MAPLIBRE-LICENSE.txt'},indent=2)+'\n')
        # Stage next to the destination and restore previous installation if promotion fails.
        with tempfile.TemporaryDirectory(prefix='atlas-vendor-prev-', dir=dest.parent) as backdir:
            backup=Path(backdir)/'previous'
            if dest.exists():dest.rename(backup)
            try:shutil.copytree(staged,dest)
            except Exception:
                if dest.exists():shutil.rmtree(dest)
                if backup.exists():backup.rename(dest)
                raise
    return dest

def main():
    ap=argparse.ArgumentParser();group=ap.add_mutually_exclusive_group(required=True)
    group.add_argument('--tarball',type=Path);group.add_argument('--fetch',action='store_true')
    ap.add_argument('--npm-sha512',help='Trusted npm dist.integrity value (required with --tarball)')
    args=ap.parse_args()
    if args.fetch:
        with tempfile.TemporaryDirectory(prefix='atlas-npm-') as t:
            subprocess.run(['npm','pack',f'maplibre-gl@{VERSION}','--pack-destination',t,'--ignore-scripts'],check=True)
            path=Path(t)/f'maplibre-gl-{VERSION}.tgz'
            integrity=subprocess.run(['npm','view',f'maplibre-gl@{VERSION}','dist.integrity','--json'],check=True,capture_output=True,text=True,timeout=30).stdout.strip()
            integrity=json.loads(integrity)
            print('Installed:',install_tarball(path,npm_integrity=integrity));return
    print('Installed:',install_tarball(args.tarball,npm_integrity=args.npm_sha512))
if __name__=='__main__':main()
