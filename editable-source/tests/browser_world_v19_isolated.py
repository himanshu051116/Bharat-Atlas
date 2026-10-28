#!/usr/bin/env python3
"""SVG v1.9 browser interactions in isolated Chromium; SHA-256 simulated in browser only.
All asset hashes are separately verified using scripts/verify_preview.py.
"""
from __future__ import annotations
import hashlib,json,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]/'dist'
SCRIPTS=['world-explore-search.js','world-scale.js','world-camera-scheduler.js','world.js','world-detail-geometry.js','world-place-search.js','world-detail.js']
html=(R/'world.html').read_text()
for name in SCRIPTS:html=html.replace(f'<script defer src="./{name}"></script>','')
html=html.replace('<link rel="stylesheet" href="./world.css"/>','')
paths=[str(p.relative_to(R)) for p in (R/'data/world').glob('*.json')]
paths+=['data/world-detail/manifest.json','data/world-detail/cities.geojson','data/official-india/manifest.json','data/official-india/india-claim.geojson']
raw={path:(R/path).read_text(encoding='utf8') for path in paths if (R/path).exists()}
sha={p:hashlib.sha256(v.encode()).hexdigest() for p,v in raw.items()}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
 for mode,w,h in [('desktop',1280,800),('mobile',390,844)]:
  page=browser.new_page(viewport={'width':w,'height':h},has_touch=mode=='mobile',reduced_motion='reduce')
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html)
  page.add_style_tag(content=(R/'world.css').read_text())
  page.evaluate('''data=>{
    window.fetch=async url=>{
      const path=String(url).replace(/^\.\//,'');
      return path in data.raw?new Response(data.raw[path],{status:200}):new Response('Not found',{status:404});
    };
    Object.defineProperty(window.crypto,'subtle',{configurable:true,value:{digest:async(_,bytes)=>{
      const content=new TextDecoder().decode(bytes);
      const found=Object.entries(data.raw).find(([path,value])=>value===content);
      const hash=data.hash[found?.[0]]||'0'.repeat(64);
      return Uint8Array.from(hash.match(/../g).map(v=>parseInt(v,16))).buffer;
    }}});
  }''',{'raw':raw,'hash':sha})
  for script in SCRIPTS:page.add_script_tag(content=(R/script).read_text())
  page.wait_for_function("window.BharatWorldBridge?.countries().length>170",timeout=22000)
  page.wait_for_function("document.querySelector('#capitals-toggle')?.disabled===false",timeout=22000)
  page.wait_for_function("document.querySelector('#world-cities-toggle')?.disabled===false",timeout=22000)
  assert page.locator('#world-distance-scale').inner_text().startswith('≈ '),page.locator('#world-distance-scale').inner_text()
  query='#mobile-country-search' if mode=='mobile' else '#country-search';results='#world-source-results-mobile' if mode=='mobile' else '#world-source-results-desktop'
  page.locator(query).fill('Canada')
  page.wait_for_function("id=>Array.from(document.querySelectorAll(id+' button')).some(b=>b.textContent.includes('Canada')&&b.textContent.includes('Country'))",arg=results,timeout=9000)
  page.locator(results+' button').first.click()
  assert 'Canada' in page.locator('#detail').inner_text()
  page.locator(query).fill('Ottawa')
  page.wait_for_function("id=>document.querySelector(id+' button')?.textContent.includes('Ottawa')",arg=results,timeout=9000)
  page.locator(query).press('ArrowDown');page.locator(query).press('Enter')
  assert 'Ottawa' in page.locator('#coordinate-status').inner_text()
  page.locator(query).fill('Amaravati')
  page.wait_for_function("id=>document.querySelector(id+' button')?.textContent.includes('Amaravati')",arg=results,timeout=9000)
  page.locator(results+' button').first.click()
  assert page.locator('#world-feature-inspector').is_visible()
  assert 'Amaravati' in page.locator('#world-feature-inspector').inner_text()
  assert 'COORDINATES' in page.locator('#world-feature-inspector').inner_text()
  assert not errors,errors
  output=f'/mnt/data/Bharat_Atlas_v1_9_{mode}.png';page.screenshot(path=output,full_page=False)
  print(json.dumps({'mode':mode,'search':'PASS','inspector':'PASS','scale':page.locator('#world-distance-scale').inner_text().split('\n')[0], 'browser':'isolated simulated crypto','errors':errors,'screenshot':output}))
  page.close()
 browser.close()
