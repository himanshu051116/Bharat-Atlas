#!/usr/bin/env python3
"""Simulated source-backed overlay browser check; synthetic polygon, NOT India territory."""
import json, hashlib, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
html=(R/'dist/world.html').read_text().replace('<link rel="stylesheet" href="./world.css"/>','').replace('<script defer src="./world.js"></script>','')
css=(R/'dist/world.css').read_text(); js=(R/'dist/world.js').read_text()
world=json.loads((R/'dist/data/world/world-boundaries.json').read_text())
geo={'type':'FeatureCollection','features':[{'type':'Feature','properties':{'source':'synthetic fixture'},'geometry':{'type':'Polygon','coordinates':[[[68,6],[98,6],[98,38],[68,38],[68,6]]]}}]}
raw=json.dumps(geo,separators=(',',':'))+'\n';sha=hashlib.sha256(raw.encode()).digest()
manifest={'schema':'bharat-atlas-soi-claim-outline-v1','claimOnly':True,'politicalMap2026GeometryMatched':False,'commercialRedistributionAllowed':False,'sourceUrl':'https://surveyofindia.gov.in/documents/Outline_of_India.zip','outlineSha256':sha.hex()}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page();page.set_content(html);page.add_style_tag(content=css)
 page.evaluate('''({world,manifest,raw,sha})=>{
  // Mock only secure-context digest availability, unavailable in about:blank sandbox.
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:{subtle:{digest:async()=>new Uint8Array(sha).buffer}}});
  globalThis.fetch=async(url)=>{
   const s=String(url);if(s.includes('official-india/manifest'))return new Response(JSON.stringify(manifest),{status:200});
   if(s.includes('official-india/india-claim'))return new Response(raw,{status:200});
   if(s.includes('world-boundaries'))return new Response(JSON.stringify(world),{status:200});
   return new Response('Not found',{status:404});
  };
 }''',dict(world=world,manifest=manifest,raw=raw,sha=list(sha)))
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_script_tag(content=js)
 page.locator('#official-india-layer path').wait_for(timeout=15000)
 assert page.locator('#official-india-layer path').count()==1
 assert page.evaluate("document.querySelector('#path-'+[...document.querySelectorAll('path.country')].find(e=>e.getAttribute('aria-label')==='India').id.slice(5)).style.fill")=='transparent'
 assert 'source-declared' in page.locator('#india-claim-status').inner_text().lower()
 page.locator('#india-claims-toggle').click()
 assert page.locator('#official-india-layer').evaluate('(e)=>e.style.display')=='none'
 page.locator('#india-claims-toggle').click()
 assert page.locator('#official-india-layer').evaluate('(e)=>e.style.display')!='none'
 assert not errors,errors
 print('Synthetic boundary overlay displayed and Natural Earth India feature suppressed; NOT an official boundary validation.')
 browser.close()
