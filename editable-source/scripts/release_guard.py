#!/usr/bin/env python3
"""Research preview integrity gate. No production approval for provisional geography."""
import argparse
import sys
from pathlib import Path
from verify_preview import verify as verify_preview
ROOT=Path(__file__).resolve().parents[1]

def verify(target):
    if target=='production':
        return False,[
            'BLOCKED: focused v1 contains no certified 2026 India political boundary vectors or verified redistribution rights',
            'BLOCKED: genuine MapLibre/WebGL verification and independent device acceptance not demonstrated',
            'BLOCKED: no full cross-browser, accessibility, mobile-device or performance acceptance evidence',
            'BLOCKED: official district datasets and certified political-map exports unavailable; existing SVG exports are research-only',
        ]
    try:
        result=verify_preview(ROOT/'dist')
        return True,[f"Full modular v{result['version']} preview verified: {result['modules']} modules / {result['assetsVerified']} assets. NOT official or production-ready."]
    except Exception as e:
        return False,[f'Preview integrity check failed: {e}']

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--target',choices=['preview','production'],required=True)
    args=parser.parse_args()
    ok,notes=verify(args.target)
    for item in notes:print(item)
    sys.exit(0 if ok else 1)
