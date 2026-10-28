#!/usr/bin/env python3
"""Build a separately installable, source-derived transport research MVT pack.

Does NOT fetch GIS data, confer rights, merge into an authoritative map or deploy.
Source dataset and signed-by-human licensing metadata are prerequisites.
The output is created as a new directory, never overwrites existing geography.
"""
from __future__ import annotations
import argparse, hashlib, json, os, shutil, sys, tempfile
from pathlib import Path
from prepare_detailed_layers import prepare
from build_vector_tiles import make_pyramid

def make_pack(geojson:Path,metadata:Path,output:Path,minzoom=4,maxzoom=8):
    geojson,metadata,output=map(Path,(geojson,metadata,output))
    if output.exists() or output.is_symlink():raise ValueError('Pack output must be a new, nonexistent directory')
    if output.resolve() in (geojson.resolve(),metadata.resolve()):raise ValueError('Output cannot be input')
    if not 3<=minzoom<=maxzoom<=10:raise ValueError('Pack zoom range must be 3..10; 10+ requires carefully bounded extracts')
    output.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='bharat-source-pack-',dir=output.parent) as temporary:
        stage=Path(temporary)/'pack';stage.mkdir()
        source=stage/'prepared'
        report=prepare(geojson,metadata,source)
        inputs={kind:source/f'{kind}.geojson' for kind,num in report['featureCounts'].items() if num}
        # Preserves the historical physical tile set as a separate, unchanged source.
        manifest=make_pyramid(inputs,source/'tile-source.json',stage/'tiles',minzoom,maxzoom)
        summary={
            'format':'BharatAtlasTransportResearchPack1','officiallyVerified':False,
            'dataSource':report['sourceUrl'],'sourceSha256':report['sourceSha256'],
            'sourceSnapshot':report['snapshotDate'],'rightsBasis':report['licence'],
            'attribution':report['attribution'],'coverageClaim':report['coverageClaim'],
            'featureCounts':report['featureCounts'],'tileCount':manifest['tileCount'],
            'tileManifestSha256':hashlib.sha256((stage/'tiles/atlas-tiles.json').read_bytes()).hexdigest(),
            'note':'Research-only transport data, no routing graph, no legal/official geography verification. Human licensing review is a declaration, not automated permission.'
        }
        (stage/'pack-status.json').write_text(json.dumps(summary,indent=2,sort_keys=True)+'\n',encoding='utf-8')
        (stage/'INSTALLATION.txt').write_text(
           'Install only after independently verifying data licence and source integrity.\n'
           'Copy the CONTENTS of the tiles/ folder into a new source-folder data/transport-pack/ \n'
           'in the Bharat Atlas FULL SOURCE project; do not replace data/tiles/.\n'
           'Then run scripts/build.py. Production release remains blocked.\n'
           'Do not mistake a successful import for India-wide coverage or road routing.\n',encoding='utf-8')
        if output.exists() or output.is_symlink():raise ValueError('Output path appeared while preparing pack')
        os.rename(stage,output)
    return summary

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--geojson',type=Path,required=True)
    parser.add_argument('--metadata',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--minzoom',type=int,default=4)
    parser.add_argument('--maxzoom',type=int,default=8)
    a=parser.parse_args()
    print(json.dumps(make_pack(a.geojson,a.metadata,a.output,a.minzoom,a.maxzoom),indent=2))

if __name__=='__main__':main()
