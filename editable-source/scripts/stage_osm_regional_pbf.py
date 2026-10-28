#!/usr/bin/env python3
"""Offline PBF -> reviewed, bounded GeoJSON staging using explicitly installed osmium-tool.

Regional PBF only; never downloads/scrapes a tile service. Requires a pinned
source SHA and licence review. Raw nationwide India (approx 1.6 GB) must be
partitioned into smaller regional extracts using an external production pipeline.
"""
from __future__ import annotations
import argparse,hashlib,json,shutil,subprocess,tempfile
from pathlib import Path
MAX_PBF_BYTES=300_000_000
MAX_JSON_BYTES=30_000_000

def stage(pbf,source_metadata,output):
 pbf,source_metadata,output=map(Path,(pbf,source_metadata,output))
 if output.exists() or output.is_symlink():raise ValueError('Never overwrite a staged geographic extract')
 if not pbf.is_file() or pbf.suffix!='.pbf' or pbf.stat().st_size>MAX_PBF_BYTES:raise ValueError('Supply a local regional .osm.pbf no larger than 300MB')
 m=json.loads(source_metadata.read_text(encoding='utf-8'))
 sha=hashlib.sha256(pbf.read_bytes()).hexdigest()
 if m.get('sourceSha256')!=sha or m.get('officiallyVerified') is not False or m.get('redistributionReview')!='approved_for_research_preview' or not m.get('sourceUrl','').startswith('https://') or not m.get('licence') or not m.get('attribution'):
  raise ValueError('Reviewed source metadata and matching SHA-256 required')
 utility=shutil.which('osmium')
 if not utility:raise RuntimeError('Install osmium-tool on your GIS workstation; cannot stage real OSM PBF in this environment')
 output.parent.mkdir(parents=True,exist_ok=True)
 with tempfile.TemporaryDirectory(dir=output.parent,prefix='.atlas-pbf-') as td:
  td=Path(td);filtered=td/'filtered.osm.pbf';out=td/'regional.geojson'
  subprocess.run([utility,'tags-filter',str(pbf),'w/highway','w/railway','w/waterway','n/place','n/amenity','n/shop','n/tourism','n/historic','-o',str(filtered)],check=True,timeout=900,capture_output=True)
  subprocess.run([utility,'export',str(filtered),'-o',str(out),'-f','geojson'],check=True,timeout=900,capture_output=True)
  if not out.is_file() or out.stat().st_size>MAX_JSON_BYTES:raise ValueError('Regional output exceeds 30MB; split the input and review smaller extracts')
  content=out.read_bytes();fc=json.loads(content)
  if fc.get('type')!='FeatureCollection' or not isinstance(fc.get('features'),list):raise ValueError('Invalid osmium GeoJSON conversion')
  # stage only conversion output; the separately reviewed metadata must be rehashed
  # against the GeoJSON bytes before prepare_detailed_layers receives it.
  output.write_bytes(content)
 return {'conversionSha256':hashlib.sha256(content).hexdigest(),'sizeBytes':len(content),'featureCount':len(fc['features']),'officiallyVerified':False,'next':'Review the GeoJSON, then prepare metadata referencing this conversion SHA-256 and run build_regional_pack.py'}
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--pbf',required=True,type=Path);p.add_argument('--source-metadata',required=True,type=Path);p.add_argument('--output',required=True,type=Path)
 a=p.parse_args();print(json.dumps(stage(a.pbf,a.source_metadata,a.output),indent=2))
