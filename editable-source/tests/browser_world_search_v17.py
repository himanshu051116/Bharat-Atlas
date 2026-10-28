#!/usr/bin/env python3
"""Isolated SVG/world search behavior; actual full-map GPU/device QA still pending."""
from pathlib import Path
import hashlib,shutil,json
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]/'dist'
html=(R/'world.html').read_text()
for tag in ('world-camera-scheduler.js','world.js','world-detail-geometry.js','world-place-search.js','world-detail.js'):
 html=html.replace(f'<script defer src="./{tag}"></script>','')
html=html.replace('<link rel="stylesheet" href="./world.css"/>','')
raw={key:(R/key).read_text(encoding='utf8') for key in ('data/world/world-boundaries.json','data/world-detail/manifest.json','data/world-detail/cities.geojson','data/world/capitals-manifest.json','data/world/world-capital-references.json')}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for mode,w,h in [('desktop',1152,768),('mobile',390,780)]:
  page=browser.new_page(viewport={'width':w,'height':h},has_touch=mode=='mobile')
  errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
  page.set_content(html)
  page.add_style_tag(content=(R/'world.css').read_text())
  page.evaluate('''obj=>{
   window.fetch=async uri=>{
    const name=String(uri).replace(/^\\.\\//,'');
    return name in obj.raw?new Response(obj.raw[name],{status:200}):new Response('Not found',{status:404});
   };
   Object.defineProperty(window.crypto,'subtle',{configurable:true,value:{digest:async(_,bytes)=>{
    const txt=new TextDecoder().decode(bytes);
    const k=Object.keys(obj.raw).find(k=>obj.raw[k]===txt),hex=obj.hash[k]||'0'.repeat(64);
    return Uint8Array.from(hex.match(/../g).map(x=>parseInt(x,16))).buffer;
   }}});
  }''',{'raw':raw,'hash':{k:hashlib.sha256(v.encode()).hexdigest() for k,v in raw.items()}})
  for js in ('world-camera-scheduler.js','world.js','world-detail-geometry.js','world-place-search.js','world-detail.js'):
   page.add_script_tag(content=(R/js).read_text())
  page.wait_for_function("document.querySelector('#world-cities-toggle')?.disabled===false",timeout=15000)
  source='#mobile-country-search' if mode=='mobile' else '#country-search'
  target='#world-source-results-mobile' if mode=='mobile' else '#world-source-results-desktop'
  page.locator(source).fill('Amaravati')
  page.wait_for_function("id=>document.querySelector(id+' button')?.textContent.includes('Amaravati')",arg=target,timeout=15000)
  assert page.locator(target+' button').first.is_visible()
  page.locator(target+' button').first.click(timeout=3000)
  assert 'Amaravati' in page.locator('#world-detail-status').text_content()
  assert page.locator(target+' button').count()==0
  # Search an existing capital: focus the city coordinate rather than country's bbox.
  page.wait_for_function("document.querySelector('#capitals-toggle')?.disabled===false",timeout=8000)
  page.locator(source).fill('Ottawa')
  page.locator(source).press('Enter')
  page.wait_for_function("window.BharatWorldBridge.view().w<300",timeout=8000)
  assert 'Ottawa' in page.locator('#coordinate-status').text_content()
  page.screenshot(path='/mnt/data/Bharat_Atlas_v17_'+mode+'_preview.png',full_page=False)
  assert not errs,errs
  print(mode,'visible source search: PASS (isolated Chromium with simulated digest)')
  page.close()
 browser.close()
