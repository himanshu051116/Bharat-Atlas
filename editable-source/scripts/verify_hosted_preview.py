#!/usr/bin/env python3
"""Compare an HTTPS hosted research preview byte-for-byte with an approved local dist/.

No deployment occurs. Build-manifest.json must match locally, and each public
asset returned by the host must agree with the local SHA-256 record. Files used
only as hosting configuration are not expected to be HTTP-served.
"""
import argparse
import hashlib
import json
import urllib.parse
import urllib.request
from pathlib import Path
from verify_preview import verify

HOST_CONFIG = {'vercel.json', '_headers'}

def digest(data):
    return hashlib.sha256(data).hexdigest()

def _get(url, limit):
    req=urllib.request.Request(url,headers={'Accept-Encoding':'identity','User-Agent':'BharatAtlasReleaseVerifier/1.0'})
    with urllib.request.urlopen(req,timeout=14) as response:
        if urllib.parse.urlparse(response.geturl()).netloc != urllib.parse.urlparse(url).netloc:
            raise ValueError('Redirect to another host is not allowed during release verification')
        data=response.read(limit+1)
        if len(data)>limit:
            raise ValueError('Hosted asset exceeds approved size')
        return data

def verify_hosted(local_dist,base_url,getter=_get):
    local_dist=Path(local_dist)
    verified=verify(local_dist)
    parsed=urllib.parse.urlparse(base_url)
    if parsed.scheme!='https' or not parsed.netloc or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError('A clean HTTPS preview URL is required')
    if parsed.path not in ('','/'):
        raise ValueError('Pass the preview site root URL, not a nested path')
    root=base_url.rstrip('/')+'/'
    manifest_bytes=(local_dist/'build-manifest.json').read_bytes()
    if getter(root+'build-manifest.json',len(manifest_bytes)+1024)!=manifest_bytes:
        raise ValueError('Hosted build-manifest.json differs from tested local artifact')
    manifest=json.loads(manifest_bytes)
    count=0;size=0
    for item in manifest['assets']:
        name=item['path']
        if name in HOST_CONFIG:
            continue
        if (not isinstance(name,str) or not name or name.startswith('/') or
            any(x in ('.','..') for x in name.split('/')) or '\\' in name):
            raise ValueError('Unsafe asset path in release manifest')
        remote=getter(root+urllib.parse.quote(name,safe='/'),item['bytes'])
        if digest(remote)!=item['sha256'] or len(remote)!=item['bytes']:
            raise ValueError(f'Hosted file mismatches tested build: {name}')
        count+=1;size+=len(remote)
    return {'version':verified['version'],'verifiedPublicAssets':count,'verifiedBytes':size,
            'remoteMatchesLocalArtifact':True,'skippedHostingConfig':sorted(HOST_CONFIG),
            'officialGeometryVerified':False,'productionReady':False}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description='Verify that public research preview exactly matches approved local dist/ assets')
    parser.add_argument('url',help='HTTPS root URL of the deployed research preview')
    parser.add_argument('--dist',default=str(Path(__file__).resolve().parents[1]/'dist'))
    args=parser.parse_args()
    print(json.dumps(verify_hosted(args.dist,args.url),indent=2))
