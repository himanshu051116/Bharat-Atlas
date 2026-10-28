#!/usr/bin/env python3
"""Integrated synthetic admin-1 fixture; never bundled as geographic data.
Use isolated Chromium only, with independent static-file digest verification.
"""
import hashlib, json, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]/'dist'
scripts=['world-explore-search.js','world-scale.js','world-camera-scheduler.js','world.js','world-detail-geometry.js','world-place-search.js','world-detail.js']
html=(R/'world.html').read_text().replace('<link rel="stylesheet" href="./world.css"/>','')
for name in scripts:html=html.replace(f'<script defer src="./{name}"></script>','')
raw={str(p.relative_to(R)):(p.read_text(encoding='utf8')) for p in (R/'data/world').glob('*.json')}
raw.update({name:(R/name).read_text(encoding='utf8') for name in ['data/world-detail/manifest.json','data/world-detail/cities.geojson','data/official-india/manifest.json','data/official-india/india-claim.geojson']})
features=[]
for name,iso,box in [('Synthetic Province North','CAN',[-110,55,-102,62]),('Synthetic Province South','USA',[-110,26,-102,33])]:
 west,south,east,north=box
 features.append({'type':'Feature','properties':{'name':name,'countryIso3':iso,'countryName':'Synthetic test only'},'geometry':{'type':'Polygon','coordinates':[[[west,south],[east,south],[east,north],[west,north],[west,south]]]}})
new=json.dumps({'type':'FeatureCollection','features':features},separators=(',',':'))
raw['data/world-detail/admin1.geojson']=new
meta=json.loads(raw['data/world-detail/manifest.json']);meta['layers']['admin1']={'count':2,'bytes':len(new.encode()),'sha256':hashlib.sha256(new.encode()).hexdigest(),'licence':'Public domain','sourceUrl':'https://www.naturalearthdata.com','sourceVersion':'synthetic browser-only fixture'}
raw['data/world-detail/manifest.json']=json.dumps(meta)
hashes={k:hashlib.sha256(v.encode()).hexdigest() for k,v in raw.items()}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
 for mode,w,h in [('desktop',1280,820),('mobile',390,844)]:
  page=browser.new_page(viewport={'width':w,'height':h},has_touch=(mode=='mobile'),reduced_motion='reduce')
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html);page.add_style_tag(content=(R/'world.css').read_text())
  page.evaluate('''data=>{
    window.fetch=async url=>{
      const path=String(url).replace(/^\\.\\//,'');
      return path in data.raw ? new Response(data.raw[path],{status:200}):new Response('Missing',{status:404});
    };
    Object.defineProperty(window.crypto,'subtle',{configurable:true,value:{digest:async(_,bytes)=>{
      const text=new TextDecoder().decode(bytes);
      const path=Object.keys(data.raw).find(k=>data.raw[k]===text);
      const hex=data.hashes[path]||'0'.repeat(64);
      return Uint8Array.from(hex.match(/../g).map(v=>parseInt(v,16))).buffer;
    }}});
  }''',{'raw':raw,'hashes':hashes})
  for name in scripts:page.add_script_tag(content=(R/name).read_text(encoding='utf8'))
  page.wait_for_function("window.BharatWorldBridge?.countries().length>170",timeout=20000)
  page.wait_for_function("window.BharatWorldDetail?.installedCounts().admin1===2",timeout=15000)
  q='#mobile-country-search' if mode=='mobile' else '#country-search'
  results='#world-source-results-mobile' if mode=='mobile' else '#world-source-results-desktop'
  page.locator(q).fill('Synthetic Province North')
  page.wait_for_function("id=>document.querySelector(id+' button')?.textContent.includes('Synthetic Province North')",arg=results,timeout=9000)
  page.locator(results+' button').first.click()
  assert 'Synthetic Province North' in page.locator('#world-feature-inspector').inner_text()
  assert page.locator('#world-admin1-toggle').get_attribute('aria-pressed')=='true'
  page.wait_for_function("document.querySelectorAll('#world-admin1-layer path').length===1",timeout=14000)
  assert not errors,errors
  print(json.dumps({'mode':mode,'admin1BrowserFixture':'PASS','visibleProvincePaths':page.locator('#world-admin1-layer path').count(),'errors':errors}))
  page.close()
 browser.close()
