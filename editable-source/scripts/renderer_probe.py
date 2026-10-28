#!/usr/bin/env python3
"""Read-only local renderer capability diagnostic. No network requests or deployment.
A successful WebGL context check is NOT evidence that MapLibre itself rendered a map.
"""
import json,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
report={
  'probe':'Bharat Atlas v0.13 local-only',
  'vendorMapLibreAvailable': all((ROOT/'vendor'/x).is_file() for x in ('maplibre-gl.js','maplibre-gl.css','MAPLIBRE-LICENSE.txt')),
  'actualMapLibreMapRendered': False,
  'browserExecutable': shutil.which('chromium') is not None,
  'webgl1Available':None, 'webgl2Available':None
}
if report['browserExecutable']:
 try:
  with sync_playwright() as pw:
   browser=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl'])
   page=browser.new_page()
   page.set_content('<!doctype html><html><body><canvas id="probe"></canvas></body></html>')
   supported=page.evaluate("""()=>{const c=document.querySelector('#probe');let v2=false,v1=false;
     try{v2=!!c.getContext('webgl2')}catch{};try{v1=!!c.getContext('webgl')}catch{};
     return {webgl1Available:v1,webgl2Available:v2}}""")
   report.update(supported)
   browser.close()
 except Exception as e:
  report['browserError']=str(e)[:250]
report['interpretation']='Only browser capability is probed. Actual MapLibre requires licensed local bundle, valid geographic data and real WebGL rendering.'
print(json.dumps(report,indent=2))
