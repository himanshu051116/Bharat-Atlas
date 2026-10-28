#!/usr/bin/env python3
"""Generate the standalone physical-only SVG from bundled, source-validated geography.
No political boundaries are used. Node is needed only for generation, not for viewing.
"""
import json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
output=ROOT/'docs/V23_PHYSICAL_ONLY_ATLAS.svg'
code="""
import fs from 'node:fs';
import {renderPhysicalOnlySVG} from './src/physical-only.mjs';
const load=(name)=>JSON.parse(fs.readFileSync(name,'utf8'));
const svg=renderPhysicalOnlySVG({land:load('data/landcover/land.geojson'),hydrology:load('data/hydrography/rivers.geojson'),shorelines:{coastlines:load('data/shorelines/coastlines.geojson'),lakes:load('data/shorelines/lakes.geojson')}});
fs.writeFileSync('docs/V23_PHYSICAL_ONLY_ATLAS.svg',svg);
"""
result=subprocess.run(['node','--input-type=module','-e',code],cwd=ROOT,capture_output=True,text=True)
if result.returncode:raise RuntimeError(result.stderr)
assert output.is_file() and output.stat().st_size>50_000
print(f'Wrote {output} ({output.stat().st_size} bytes)')
