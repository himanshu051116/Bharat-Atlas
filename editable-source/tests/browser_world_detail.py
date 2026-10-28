#!/usr/bin/env python3
"""UI smoke proof with isolated Chromium and deterministic, checksum-matched local data.
NOTE: SubtleCrypto is simulated only in this about:blank test. Build validates real SHA independently.
"""
from pathlib import Path
import hashlib,json,shutil
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]/'dist'
HTML=(R/'world.html').read_text().replace('<link rel="stylesheet" href="./world.css"/>','').replace('<script defer src="./world.js"></script>','').replace('<script defer src="./world-detail.js"></script>','').replace('<script defer src="./world-detail-geometry.js"></script>','').replace('<script defer src="./world-place-search.js"></script>','')
CSS=(R/'world.css').read_text();JS=(R/'world-camera-scheduler.js','world.js').read_text();DETAIL=(R/'world-detail.js').read_text()
files=['data/world/world-boundaries.json','data/world/hydrography-manifest.json','data/world/world-hydrography.json','data/world/shoreline-manifest.json','data/world/world-shorelines.json','data/world/capitals-manifest.json','data/world/world-capital-references.json','data/official-india/manifest.json','data/official-india/india-claim.geojson','data/world-detail/manifest.json','data/world-detail/cities.geojson']
raw={p:(R/p).read_text(encoding='utf8') for p in files}
hashes={hashlib.sha256(s.encode()).hexdigest():s for s in raw.values()}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for mode,w,h in [('desktop',1366,800),('mobile',390,844)]:
  page=browser.new_page(viewport={'width':w,'height':h},has_touch=mode=='mobile')
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(HTML);page.add_style_tag(content=CSS)
  page.evaluate('''bundle=>{
   const dict=bundle.raw;
   Object.defineProperty(window.crypto,'subtle',{configurable:true,value:{digest:async(_,array)=>{
    const txt=new TextDecoder().decode(array);
    const entry=Object.entries(dict).find(([k,v])=>v===txt);
    const hash=entry?bundle.hashes[entry[0]]:'0'.repeat(64);
    return Uint8Array.from(hash.match(/../g).map(x=>parseInt(x,16))).buffer;
   }}});
   window.fetch=async url=>{const name=String(url).slice(2);return name in dict?new Response(dict[name],{status:200}):new Response('Not Found',{status:404})};
  }''',{'raw':raw,'hashes':{k:hashlib.sha256(v.encode()).hexdigest() for k,v in raw.items()}})
  page.add_script_tag(content=JS);page.add_script_tag(content=(R/'world-detail-geometry.js').read_text());page.add_script_tag(content=(R/'world-place-search.js').read_text());page.add_script_tag(content=DETAIL)
  page.wait_for_function("document.querySelector('#world-waterways-toggle')?.disabled===false",timeout=15000)
  page.wait_for_function("document.querySelector('#world-cities-toggle')?.disabled===false",timeout=15000)
  assert page.locator('#world-detail-status').text_content().find('71')>=0
  assert page.locator('#world-coverage-grid').locator('.source-coverage-card').count()==6
  assert '71 source features' in page.locator('#world-coverage-grid').text_content()
  assert 'Not installed' in page.locator('#world-coverage-grid').text_content()
  assert page.locator('#world-physical-layer path').count()>=3
  page.wait_for_function("document.querySelector('#world-coastline-toggle')?.disabled===false",timeout=12000)
  assert len(page.locator('#world-coastlines').get_attribute('d'))>100000
  assert len(page.locator('#world-inland-water').get_attribute('d'))>10000
  assert '1,150' in page.locator('#world-physical-provenance').text_content()
  if mode=='desktop':page.screenshot(path='/mnt/data/Bharat_Atlas_v1_3_World_Overview.png',full_page=False)
  page.locator('#world-detail-controls > summary').click()
  page.locator('#world-waterways-toggle').click()
  assert page.locator('#world-historical-rivers').evaluate('(el)=>el.style.display')=='none'
  page.locator('#world-waterways-toggle').click()
  assert page.locator('#world-historical-rivers').evaluate('(el)=>el.style.display')!='none'
  page.locator('#world-cities-toggle').click()
  page.wait_for_function("document.querySelectorAll('.detail-city').length>0",timeout=10000)
  q=page.locator('#mobile-country-search' if mode=='mobile' else '#country-search')
  q.fill('Amaravati')
  result_id='#world-source-results-mobile' if mode=='mobile' else '#world-source-results-desktop'
  page.wait_for_function('''id=>Array.from(document.querySelectorAll(id+' button')).some(b=>b.textContent.includes('Amaravati'))''',arg=result_id,timeout=8000)
  assert page.locator(result_id+' button').first.is_visible()
  q.press('Enter')
  assert 'Amaravati' in page.locator('#world-detail-status').text_content()
  page.wait_for_function("window.BharatWorldBridge.view().w<655",timeout=12000)
  page.wait_for_function("document.querySelectorAll('#world-city-layer text.detail-place-label').length>0",timeout=12000)
  page.wait_for_timeout(500)
  page.screenshot(path='/mnt/data/Bharat_Atlas_World_Detail_'+mode+'.png',full_page=False)
  page.wait_for_function("id=>Array.from(document.querySelectorAll(id+' button')).some(x=>x.textContent.includes('Amaravati'))",arg=result_id,timeout=5000)
  page.locator(result_id+' button').first.click()
  assert 'Amaravati' in page.locator('#world-detail-status').text_content()
  page.wait_for_timeout(500)
  page.screenshot(path='/mnt/data/Bharat_Atlas_World_Detail_'+mode+'.png',full_page=False)
  page.locator('#view-world').click()
  page.wait_for_timeout(700)
  assert not errors,errors
  print(mode,'historical hydro, cities, source search, toggles: PASS (simulated digest)')
  page.close()
 browser.close()
