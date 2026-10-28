#!/usr/bin/env python3
"""Isolated Chromium capital UI checks. Browser hashing adapter is simulated here because
Chromium blocks navigation and isolated documents have no secure-origin SubtleCrypto.
The full SHA-256 verification runs independently in the build.py source check.
"""
from pathlib import Path
import json,shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]/'dist'
HTML=(ROOT/'world.html').read_text().replace('<link rel="stylesheet" href="./world.css"/>','').replace('<script defer src="./world.js"></script>','')
CSS=(ROOT/'world.css').read_text();JS=(ROOT/'world-camera-scheduler.js','world.js').read_text()
DATA={
 'boundary':json.loads((ROOT/'data/world/world-boundaries.json').read_text()),
 'manifest':json.loads((ROOT/'data/world/capitals-manifest.json').read_text()),
 'capital':json.loads((ROOT/'data/world/world-capital-references.json').read_text()),
 'raw':(ROOT/'data/world/world-capital-references.json').read_text(),
 'claimMeta':json.loads((ROOT/'data/official-india/manifest.json').read_text()),
 'claimRaw':(ROOT/'data/official-india/india-claim.geojson').read_text(),
}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for label,w,h in [('desktop',1440,900),('mobile',390,844)]:
  page=browser.new_page(viewport={'width':w,'height':h},has_touch=label=='mobile')
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(HTML);page.add_style_tag(content=CSS)
  page.evaluate('''bundle => {
   const original = bundle.raw;
   const expected = bundle.manifest.sha256;
   const claimExpected = bundle.claimMeta.outlineSha256;
   // Simulated digest adapter, limited to exact known fixture bytes (NOT security proof).
   Object.defineProperty(window.crypto,'subtle',{configurable:true,value:{digest:async (_algo,buffer)=>{
     const actual = new TextDecoder().decode(buffer);
     const hex = actual===original?expected:actual===bundle.claimRaw?claimExpected:'0'.repeat(64);
     return Uint8Array.from(hex.match(/.{2}/g).map(s=>parseInt(s,16))).buffer;
   }}});
   window.fetch=async url=>{
     let data = url.includes('world-boundaries.json')?bundle.boundary:url.includes('capitals-manifest.json')?bundle.manifest:url.includes('world-capital-references.json')?bundle.capital:url.includes('official-india/manifest.json')?bundle.claimMeta:url.includes('official-india/india-claim.geojson')?bundle.claimRaw:null;
     if(data===null)return new Response('Not found',{status:404});
     return new Response(url.includes('world-capital-references.json')?original:url.includes('india-claim.geojson')?bundle.claimRaw:JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
   };
  }''',DATA)
  page.add_script_tag(content=JS)
  page.wait_for_function("document.querySelector('#capital-status')?.textContent?.includes('163 capital reference')",timeout=10000)
  assert page.locator('#capitals-count').inner_text()=='163'
  assert page.locator('#capitals-toggle').is_enabled()
  assert page.locator('.capital-dot').count()==0
  page.locator('#capitals-toggle').click()
  page.wait_for_function("document.querySelector('#india-claims-toggle') && !document.querySelector('#india-claims-toggle').disabled", timeout=15000)
  assert page.locator('.capital-dot').count()>120
  page.screenshot(path=str(ROOT/f'World_Capitals_Overview_{label}.png'),full_page=False),page.locator('.capital-dot').count()
  if label=='mobile':
   page.locator('#mobile-country-search').fill('Tokyo')
   page.locator('#mobile-country-search').press('Enter')
   assert 'Japan' in page.locator('#detail h3').inner_text()
  page.locator('#country-search').fill('New Delhi')
  assert page.locator('.country-item').count()==1
  assert 'India' in page.locator('.country-item').first.inner_text()
  page.locator('.country-item').first.click()
  assert 'New Delhi' in page.locator('#detail').inner_text()
  page.locator('#country-search').fill('Chile')
  page.locator('.country-item').first.click()
  assert 'Not included in reference data' in page.locator('#detail').inner_text()
  page.locator('#view-world').click()
  page.wait_for_timeout(740)
  page.locator('#capitals-toggle').click()
  assert page.locator('.capital-dot').count()==0
  page.locator('#country-search').fill('Fiji')
  page.locator('.country-item').first.click()
  page.wait_for_timeout(750)
  assert page.locator('#map-zoom-label').inner_text()!='1.0× ZOOM'
  page.screenshot(path=str(ROOT/f'World_Capitals_{label}.png'),full_page=False)
  assert not errors,errors
  print(label, '163 capitals; toggle; search; omission; dateline focus: pass (simulated digest adapter)')
  page.close()
 browser.close()
