#!/usr/bin/env python3
"""Actual localhost Chromium run; uses Web Crypto SHA-256 with no mocked fetch/digests.
Checks India/World legacy assets and new unified search/scale/detail interactions.
Does NOT certify official boundaries, hardware GPU, or current world geography.
"""
from __future__ import annotations
import functools,threading,shutil,json
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT/'dist')))
thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
  for mode,w,h in [('desktop',1280,800),('mobile',390,844)]:
   context=browser.new_context(viewport={'width':w,'height':h},has_touch=mode=='mobile',reduced_motion='reduce')
   page=context.new_page();errs=[]
   page.on('pageerror',lambda err:errs.append(str(err)))
   page.goto(f'http://127.0.0.1:{server.server_port}/world.html',wait_until='domcontentloaded',timeout=30000)
   page.wait_for_function("window.BharatWorldBridge?.countries().length>170",timeout=18000)
   page.wait_for_function("document.querySelector('#capitals-toggle')?.disabled === false",timeout=18000)
   page.wait_for_function("document.querySelector('#world-cities-toggle')?.disabled === false",timeout=18000)
   assert page.locator('#world-distance-scale').inner_text().startswith('≈ '),page.locator('#world-distance-scale').inner_text()
   query='#mobile-country-search' if mode=='mobile' else '#country-search'
   suggestions='#world-source-results-mobile' if mode=='mobile' else '#world-source-results-desktop'
   page.locator(query).fill('Canada')
   page.wait_for_function("id=>Array.from(document.querySelectorAll(id+' button')).some(b=>b.textContent.includes('Canada')&&b.textContent.includes('Country'))",arg=suggestions,timeout=8000)
   page.locator(suggestions+' button').first.click()
   assert 'Canada' in page.locator('#detail').inner_text()
   page.locator(query).fill('Ottawa')
   page.wait_for_function("id=>document.querySelector(id+' button')?.textContent.includes('Ottawa')",arg=suggestions,timeout=8000)
   page.locator(query).press('ArrowDown')
   page.locator(query).press('Enter')
   assert 'Ottawa' in page.locator('#coordinate-status').inner_text()
   page.locator(query).fill('Amaravati')
   page.wait_for_function("id=>document.querySelector(id+' button')?.textContent.includes('Amaravati')",arg=suggestions,timeout=8000)
   page.locator(suggestions+' button').first.click()
   assert page.locator('#world-feature-inspector').is_visible()
   assert 'Amaravati' in page.locator('#world-feature-inspector').inner_text()
   assert 'COORDINATES' in page.locator('#world-feature-inspector').inner_text()
   assert not errs,errs
   outfile=f'/mnt/data/Bharat_Atlas_v1_8_{mode}.png'
   page.screenshot(path=outfile,full_page=False)
   print(json.dumps({'mode':mode,'source':'real localhost with native browser SHA-256','scale':page.locator('#world-distance-scale').inner_text().split('\n')[0], 'featuresInspector':'PASS','unifiedSearch':'PASS','errors':errs,'screenshot':outfile}))
   context.close()
  browser.close()
finally:
 server.shutdown();server.server_close()
