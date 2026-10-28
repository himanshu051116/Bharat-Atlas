#!/usr/bin/env python3
"""Acquire Natural Earth research layers and build a source-verified optional world pack.

Works on a connected Windows/Linux machine or using already downloaded ZIPs.
Only allowlisted publisher-hosted HTTPS resources. No India admin-1 claims are imported.
No server calls on import. Does not change the national outline or publish a website.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
import tempfile
import urllib.request
import zipfile
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from import_world_natural_earth import import_world, component_hashes

# Exact publisher S3 paths; keys are the application's layer names.
LAYERS = {
    'cities': ('50m_cultural', 'ne_50m_populated_places'),
    'rivers': ('50m_physical', 'ne_50m_rivers_lake_centerlines'),
    'lakes': ('50m_physical', 'ne_50m_lakes'),
    'peaks': ('50m_physical', 'ne_50m_geography_regions_elevation_points'),
    'countries': ('50m_cultural', 'ne_50m_admin_0_countries'),
    'admin1': ('10m_cultural', 'ne_10m_admin_1_states_provinces'),
}
MAX_ARCHIVE = 35 * 1024 * 1024
MAX_UNPACKED = 150 * 1024 * 1024


def publisher_url(layer: str) -> str:
    directory, stem = LAYERS[layer]
    return f'https://naturalearth.s3.amazonaws.com/{directory}/{stem}.zip'


def safe_zip(zf: zipfile.ZipFile, stem: str):
    names = zf.namelist()
    if not names or len(names)>45:
        raise ValueError('Unexpected Natural Earth archive contents')
    members = {}
    total = 0
    for info in zf.infolist():
        name = info.filename
        file_mode=(info.external_attr >> 16) & 0o170000
        if (name.startswith('/') or '\\' in name or '/' in name or '..' in name or
            info.is_dir() or name.startswith('.') or info.file_size > MAX_UNPACKED or
            file_mode == 0o120000 or info.flag_bits & 1):
            raise ValueError('Unsafe or nested archive content')
        total += info.file_size
        if total > MAX_UNPACKED: raise ValueError('Archive extraction size limit exceeded')
        if name.startswith(stem+'.'):
            members[name] = info
    required={stem+ext for ext in ('.shp','.shx','.dbf','.prj')}
    if not required.issubset(members):
        raise ValueError('Natural Earth archive missing complete Shapefile components')
    return members


def download_one(layer: str, destination: Path, opener=urllib.request.urlopen):
    """Stream response with exact bound and reject redirects off the trusted host."""
    url = publisher_url(layer)
    destination.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={'User-Agent':'BharatAtlasResearch/1.5', 'Accept':'application/zip'})
    tmp = destination.with_suffix('.part')
    try:
        with opener(req, timeout=45) as response, tmp.open('wb') as out:
            from urllib.parse import urlsplit
            final = response.geturl()
            if urlsplit(final).scheme!='https' or urlsplit(final).hostname!='naturalearth.s3.amazonaws.com':
                raise ValueError('Untrusted redirect during source acquisition')
            declared = response.headers.get('Content-Length')
            if declared and int(declared)>MAX_ARCHIVE:raise ValueError('Source archive too large')
            total=0
            while True:
                block=response.read(1024*1024)
                if not block:break
                total+=len(block)
                if total>MAX_ARCHIVE:raise ValueError('Source archive exceeds download limit')
                out.write(block)
        if not zipfile.is_zipfile(tmp):raise ValueError('Downloaded file is not ZIP')
        os.replace(tmp,destination)
    finally:
        tmp.unlink(missing_ok=True)


def install(selected: list[str], archive_dir: Path, output: Path, *, download=False, replace=False, opener=urllib.request.urlopen):
    selected=list(dict.fromkeys(selected))
    if not selected or any(k not in LAYERS for k in selected):raise ValueError('Unsupported or empty layer selection')
    if output.exists() and any(output.iterdir()) and not replace:
        raise ValueError('Output exists: use --replace to merge source-verified layers')
    archive_dir.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='atlas-ne-') as d:
        work=Path(d)
        inputs={};sources={};archive_records={}
        for layer in selected:
            stem=LAYERS[layer][1]
            archive=archive_dir/(stem+'.zip')
            if not archive.is_file():
                if not download:raise FileNotFoundError(f'Missing {archive.name}; use --download on a connected computer or place ZIP in --archive-dir')
                download_one(layer,archive,opener=opener)
            if archive.is_symlink() or archive.stat().st_size>MAX_ARCHIVE:raise ValueError('Unsafe or oversized ZIP')
            rawhash=hashlib.sha256(archive.read_bytes()).hexdigest()
            extract=work/layer;extract.mkdir()
            with zipfile.ZipFile(archive) as zf:
                members=safe_zip(zf,stem)
                # Refuse oversized/unsafe members before integrity testing decompresses them.
                if zf.testzip() is not None:raise ValueError('Corrupt ZIP for '+layer)
                for name,info in members.items():
                    if name.lower().endswith(('.shp','.shx','.dbf','.prj','.cpg')):
                        with zf.open(info) as inp,(extract/name).open('wb') as dest:
                            shutil.copyfileobj(inp,dest,1024*1024)
                version='Natural Earth '+LAYERS[layer][0]+'; publisher version not asserted'
                for name in zf.namelist():
                    if name.lower().endswith('.version.txt'):
                        version_text=zf.read(name).decode('utf-8',errors='replace').strip()
                        if 0<len(version_text)<80:version='Natural Earth '+version_text
                        break
            source=extract/(stem+'.shp')
            inputs[layer]=source
            sources[layer]={'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
                            'url':publisher_url(layer),'version':version,'licence':'Public domain',
                            'components':component_hashes(source)}
            archive_records[layer]={'url':publisher_url(layer),'archiveSha256':rawhash,
                                    'archiveBytes':archive.stat().st_size,'shapefileSha256':sources[layer]['sha256'],
                                    'componentSha256':sources[layer]['components']}
        provenance=work/'provenance.json'
        provenance.write_text(json.dumps({'reviewed':True,'publisher':'Natural Earth','licence':'Public domain','sources':sources}),encoding='utf8')
        manifest=import_world(inputs,provenance,output,replace)
    report={'status':'installed research geography; not officially certified',
            'retrievedOrReviewedOn':date.today().isoformat(),
            'sourceNotice':'Natural Earth public domain. India admin-1 is intentionally excluded. Survey of India outline remains separate.',
            'inputArchives':archive_records,'installedLayers':{k:v['count'] for k,v in manifest['layers'].items()},
            'outputManifestSha256':hashlib.sha256((output/'manifest.json').read_bytes()).hexdigest()}
    # Keep acquisition manifest OUTSIDE the validated data pack. Never overwrites existing archives.
    (archive_dir/'bharat-atlas-acquisition-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    return report


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--download',action='store_true',help='Download missing Natural Earth ZIPs from pinned publisher S3 URLs')
    parser.add_argument('--replace',action='store_true',help='Merge reviewed imported layers with existing pack')
    parser.add_argument('--archive-dir',type=Path,default=ROOT/'downloads'/'natural-earth')
    parser.add_argument('--output',type=Path,default=ROOT/'data'/'world-detail')
    parser.add_argument('--layers',nargs='+',choices=list(LAYERS),default=['cities','rivers','lakes','peaks','admin1','countries'])
    args=parser.parse_args()
    print(json.dumps(install(args.layers,args.archive_dir,args.output,download=args.download,replace=args.replace),indent=2))
if __name__=='__main__':main()
