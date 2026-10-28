"""Additional world/India visitor usability smoke checks (isolated Chromium, simulated India renderer).
The tests use the bundled source data; physical device and certified border tests remain separate.
"""
import json,re,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
D=R/'dist'
def clean_html(name):
 text=(D/name).read_text()
 text=re.sub(r'<link rel="stylesheet" href="[^"]+"\s*/>', '',text)
 return re.sub(r'<script[^>]*src="[^"]+"[^>]*></script>','',text)
world_data=json.loads((D/'data/world/world-boundaries.json').read_text())
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for label,viewport in [('desktop',{'width':1440,'height':900}),('mobile',{'width':390,'height':844})]:
  page=browser.new_page(viewport=viewport,has_touch=label=='mobile')
  errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  page.set_content(clean_html('world.html'))
  page.add_style_tag(content=(D/'world.css').read_text())
  page.evaluate('data=>window.fetch=async()=>new Response(JSON.stringify(data),{status:200,headers:{"Content-Type":"application/json"}})',world_data)
  page.add_script_tag(content=(D/'world-camera-scheduler.js','world.js').read_text())
  page.locator('.country-item').first.wait_for(timeout=10000)
  assert page.locator('#world-feature-count').inner_text()=='177'
  assert page.locator('.graticule-label').count()>=6
  page.locator('.coordinate-explore summary').click()
  page.locator('#go-lat').fill('28.6139')
  page.locator('#go-lon').fill('77.2090')
  page.locator('#world-coordinates-form button').click()
  assert page.locator('circle.coordinate-pin').count()==1
  assert '28.61°N' in page.locator('#world-point-status').inner_text()
  page.locator('#country-search').fill('Japan')
  page.locator('.country-item').first.click()
  assert 'Japan' in page.locator('#atlas-share-link').input_value()
  assert page.locator('.world-related button').count()==3
  page.locator('.world-related button').first.click()
  assert 'Japan' not in page.locator('#detail h3').inner_text()
  assert not errors,errors
  page.screenshot(path=str(R/f'Bharat_World_Enhanced_{label}.png'))
  print(label, 'world geography guides, coordinate jump, related countries, share links passed')
  page.close()
 # Check India static progressive enhancement; app bundle is tested separately by browser_preview.py
 india=browser.new_page(viewport={'width':1280,'height':800})
 india.set_content(clean_html('index.html'))
 india.add_style_tag(content=(D/'atlas-focus.css').read_text())
 india.add_script_tag(content=(D/'atlas-visitor.js').read_text())
 india.locator('[data-atlas-search="Madhya Pradesh"]').click()
 assert india.locator('#search-input').input_value()=='Madhya Pradesh'
 assert india.locator('.atlas-map-guide-grid>div').count()==4
 india.close();browser.close()
 print('India quick-state searches and map explanation panel passed')
