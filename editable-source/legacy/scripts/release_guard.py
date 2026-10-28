#!/usr/bin/env python3
"""Prevent premature PUBLIC PRODUCTION promotion of research-preview geography.

The manifest requires real, hash-matching evidence files and an affirmative human
approval. This is a workflow safeguard, NOT cryptographic certification by GoI.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
EVIDENCE=(
    ('source_shapefile_path','source_shapefile_sha256'),
    ('border_review_report_path','border_review_report_sha256'),
    ('load_test_evidence_path','load_test_evidence_sha256'),
    ('published_geometry_path','published_geometry_sha256'),
)

def _evidence_ok(root,filename,wanted_hash):
    if not isinstance(filename,str) or not filename.strip():return False,'missing file path'
    if not isinstance(wanted_hash,str) or not re.fullmatch(r'[0-9a-fA-F]{64}',wanted_hash):return False,'invalid SHA-256'
    base=root.resolve()
    target=(base/filename).resolve()
    if not target.is_relative_to(base):return False,'evidence path escapes project root'
    if not target.is_file():return False,'evidence file absent'
    found=hashlib.sha256(target.read_bytes()).hexdigest()
    return (found.lower()==wanted_hash.lower(),'OK' if found.lower()==wanted_hash.lower() else 'SHA-256 mismatch')

def check(target,root=ROOT):
    html=(root/'index.html').read_text(encoding='utf-8')
    js=(root/'app.js').read_text(encoding='utf-8')
    reg=json.loads((root/'data/source-register.json').read_text(encoding='utf-8'))
    warnings=[]
    if target=='preview':
        if 'noindex, nofollow' not in html: warnings.append('Research preview must be noindex')
        if 'Research preview' not in html: warnings.append('Research preview source warning missing')
        if 'PROVISIONAL GEOMETRY' not in js: warnings.append('Provisional exports must be watermarked')
        if reg.get('provisionalPreview',{}).get('certified') is not False:warnings.append('Provisional source certification flag must be false')
    else:
        approval_file=root/'data/production-approval.json'
        if not approval_file.is_file():
            warnings.append('Human-reviewed production-approval.json evidence is absent')
        else:
            try:
                a=json.loads(approval_file.read_text(encoding='utf-8'))
            except (ValueError, UnicodeError):
                a={};warnings.append('Malformed production approval JSON')
            for key in ('source_edition','source_licence','geometry_reviewed_by','geometry_review_date'):
                if not isinstance(a.get(key),str) or len(a[key].strip())<6:
                    warnings.append(f'Missing production evidence: {key}')
            for path_key,hash_key in EVIDENCE:
                ok,reason=_evidence_ok(root,a.get(path_key),a.get(hash_key))
                if not ok:warnings.append(f'Invalid production evidence {path_key}: {reason}')
            if a.get('source_verified') is not True or a.get('thousand_user_test_passed') is not True:
                warnings.append('Human verified source and recorded load-test pass are required')
            if a.get('human_release_approved') is not True:
                warnings.append('Human release approval required')
        if 'Vardhan-Systems' in js or 'Community research preview' in js:
            warnings.append('Provisional community geometry still active')
        if 'PROVISIONAL GEOMETRY' in js:
            warnings.append('Research watermarks still active')
        if reg.get('requiredPrimaryDataset',{}).get('status','').startswith('Not obtained'):
            warnings.append('Source register still reports official dataset missing')
        if 'Research preview' in html:
            warnings.append('The research-preview UI is still active')
    return warnings

def main():
    p=argparse.ArgumentParser();p.add_argument('--target',choices=['preview','production'],required=True);args=p.parse_args()
    failures=check(args.target)
    print(json.dumps({'target':args.target,'passed':not failures,'issues':failures},indent=2))
    return 1 if failures else 0
if __name__=='__main__':raise SystemExit(main())
