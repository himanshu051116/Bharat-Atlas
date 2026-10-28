#!/usr/bin/env python3
"""Build an optional, source-reviewed Bharat Atlas regional transport pack.

One explicit command: local GeoJSON + source rights metadata -> classified layers ->
independently decoded, SHA-256 indexed MVT pyramid. No network access, downloaded
boundaries, synthetic geography, overwrite, or production approval is implied.

Use the returned directory as data/transport-pack only after source-rights review.
"""
from __future__ import annotations
import argparse
import json
import os
import shutil
import tempfile
from pathlib import Path

from prepare_detailed_layers import prepare
from build_vector_tiles import make_pyramid
from mvt_audit import audit_archive


def build_pack(geojson, source_metadata, output, *, minzoom=4, maxzoom=8):
    """Fail closed and preserve any prior destination on errors."""
    output = Path(output)
    if output.exists() or output.is_symlink():
        raise ValueError('Output already exists; never overwrite an existing map pack')
    if not 0 <= minzoom <= maxzoom <= 12:
        raise ValueError('Expected tile zoom levels within 0..12')
    output.parent.mkdir(parents=True, exist_ok=True)
    sources = [Path(geojson).resolve(), Path(source_metadata).resolve()]
    resolved = output.resolve()
    if any(src == resolved or resolved in src.parents for src in sources):
        raise ValueError('Output cannot contain source datasets or rights records')
    temp = Path(tempfile.mkdtemp(prefix='.atlas-regional-pack-', dir=output.parent))
    try:
        classified = temp/'classified'
        record = prepare(geojson, source_metadata, classified)
        layers = {
            name: classified/f'{name}.geojson'
            for name, count in record['featureCounts'].items()
            if count
        }
        tiles = temp/'tiles'
        catalog = make_pyramid(layers, classified/'tile-source.json', tiles, minzoom, maxzoom)
        audit = audit_archive(tiles)
        if audit['tiles'] != catalog['tileCount'] or set(audit['layers']) != set(layers):
            raise ValueError('Decoded tile archive does not match qualified source layers')
        if set(catalog['tileLayerCounts']) != set(catalog['tileHashes']):
            raise ValueError('Incomplete per-tile feature inventory')
        if output.exists() or output.is_symlink():
            raise ValueError('Output appeared during build; refusing to replace it')
        os.rename(tiles, output)
        return {
            'format':'BharatAtlasRegionalPackBuild1',
            'researchOnly':True,
            'officiallyVerified':False,
            'sourceSha256':record['sourceSha256'],
            'sourceUrl':record['sourceUrl'],
            'coverageClaim':record['coverageClaim'],
            'featureCounts':record['featureCounts'],
            'tileCount':catalog['tileCount'],
            'decodedFeatureOccurrences':audit['decodedFeatureOccurrences'],
            'tileLayerCountsPresent':True,
            'layers':catalog['layers'],
            'installation':'Copy the resulting folder to data/transport-pack only after reviewing its source rights; rebuild the site.',
            'notice':'This pack is not nationwide coverage, official boundaries or certified navigation data.'
        }
    finally:
        shutil.rmtree(temp, ignore_errors=True)


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--geojson',required=True,type=Path)
    ap.add_argument('--source-metadata',required=True,type=Path)
    ap.add_argument('--output',required=True,type=Path)
    ap.add_argument('--minzoom',type=int,default=4)
    ap.add_argument('--maxzoom',type=int,default=8)
    args=ap.parse_args()
    print(json.dumps(build_pack(args.geojson,args.source_metadata,args.output,minzoom=args.minzoom,maxzoom=args.maxzoom),indent=2))

if __name__=='__main__': main()
