#!/usr/bin/env python3
"""Isolated UI integration: named world features use SYNTHETIC fixtures; never ship them."""
from pathlib import Path
import hashlib,json,shutil
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]/'dist'
html=(R/'world.html').read_text().replace('<link rel="stylesheet" href="./world.css"/>','').replace('<script defer src="./world.js"></script>','').replace('<script defer src="./world-detail.js"></script>','').replace('<script defer src="./world-detail-geometry.js"></script>','')
css=(R/'world.css').read_text();js=(R/'world-camera-scheduler.js','world.js').read_text();details=(R/'world-detail.js').read_text()
paths=['data/world/world-boundaries.json','data/world/hydrography-manifest.json','data/world/world-hydrography.json','data/world/shoreline-manifest.json','data/world/world-shorelines.json','data/world/capitals-manifest.json','data/world/world-capital-references.json','data/official-india/manifest.json','data/official-india/india-claim.geojson','data/world-detail/cities.geojson']
raw={p:(R/p).read_text(encoding='utf8') for p in paths}
fixtures={
'rivers':{'type':'LineString','coordinates':[[-70,40],[-72,43]],'name':'Test River One'},
'lakes':{'type':'Polygon','coordinates':[[[-76,40],[-74,40],[-74,42],[-76,42],[-76,40]]],'name':'Test Lake One'},
'peaks':{'type':'Point','coordinates':[-78,41],'name':'Test Peak One'}
}
meta=json.loads((R/'data/world-detail/manifest.json').read_text())
for name,v in fixtures.items():
 feature={'type':'Feature','properties':{'name':v['name'],'countryIso3':'USA','countryName':'United States','rank':'1'},'geometry':{'type':v['type'],'coordinates':v['coordinates']}}
 data=json.dumps({'type':'FeatureCollection','features':[feature]},separators=(',',':'))
 key='data/world-detail/'+name+'.geojson';raw[key]=data
 meta['layers'][name]={'count':1,'sha256':hashlib.sha256(data.encode()).hexdigest(),'bytes':len(data.encode()),'licence':'Public domain','sourceUrl':'https://www.naturalearthdata.com','sourceVersion':'synthetic test only'}
raw['data/world-detail/manifest.json']=json.dumps(meta)
hashes={k:hashlib.sha256(v.encode()).hexdigest() for k,v in raw.items()}
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for mode,w,h in [('desktop',1280,760),('mobile',390,844)]:
  page=browser.new_page(viewport={'width':w,'height':h},has_touch=(mode=='mobile'))
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html);page.add_style_tag(content=css)
  page.evaluate('''payload=>{
   Object.defineProperty(window.crypto,'subtle',{configurable:true,value:{digest:async(_,data)=>{
     const txt=new TextDecoder().decode(data);const key=Object.keys(payload.raw).find(k=>payload.raw[k]===txt);
     const hex=key?payload.hashes[key]:'0'.repeat(64);
     return Uint8Array.from(hex.match(/../g).map(c=>parseInt(c,16))).buffer;
   }}});
   window.fetch=async url=>{const key=String(url).replace(/^\\.\\//,'');return key in payload.raw?new Response(payload.raw[key],{status:200}):new Response('Not found',{status:404})};
  }''',{'raw':raw,'hashes':hashes})
  page.add_script_tag(content=js);page.add_script_tag(content=(R/'world-detail-geometry.js').read_text());page.add_script_tag(content=details)
  page.wait_for_function("window.BharatWorldDetail && window.BharatWorldDetail.installedCounts().rivers===1",timeout=20000)
  page.locator('#world-detail-controls > summary').click()
  field=page.locator('#mobile-country-search' if mode=='mobile' else '#country-search')
  for name,layer in [('Test River One','rivers'),('Test Lake One','lakes'),('Test Peak One','peaks')]:
   field.fill(name)
   page.wait_for_function("name=>Array.from(document.querySelectorAll('#world-city-results button')).some(b=>b.textContent.includes(name))",arg=name,timeout=15000)
   page.locator('#world-city-results button').filter(has_text=name).click()
   assert name in page.locator('#world-detail-status').text_content()
   assert page.locator('#world-'+layer+'-toggle').get_attribute('aria-pressed')=='true'
  assert not errors,errors
  print(mode,'named lakes/rivers/peaks search and map focus: PASS (synthetic data; simulated digest)',flush=True)
  page.close()
 browser.close()
