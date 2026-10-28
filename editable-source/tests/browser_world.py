#!/usr/bin/env python3
"""Real Chromium SVG world explorer smoke tests (not MapLibre GPU certification)."""
from pathlib import Path
import subprocess, time, shutil, json
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
# Use an isolated browser document because this environment blocks Chromium localhost navigation.
# Inject the exact built source and replace only fetch() with the bundled JSON fixture.
HTML=(R/'dist/world.html').read_text().replace('<link rel="stylesheet" href="./world.css"/>','').replace('<script defer src="./world.js"></script>','')
CSS=(R/'dist/world.css').read_text()
JS=(R/'dist/world.js').read_text()
DATA=json.loads((R/'dist/data/world/world-boundaries.json').read_text())
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for label,w,h in [('desktop',1440,900),('mobile',390,844)]:
  page=browser.new_page(viewport={'width':w,'height':h},has_touch=label=='mobile')
  errors=[];page.on('pageerror',lambda exc:errors.append(str(exc)))
  page.set_content(HTML)
  page.add_style_tag(content=CSS)
  page.evaluate('data=>window.fetch=async()=>new Response(JSON.stringify(data),{status:200,headers:{"Content-Type":"application/json"}})',DATA)
  page.add_script_tag(content=JS)
  page.locator('path.country').first.wait_for(timeout=10000)
  assert page.locator('path.country').count()==177,page.locator('path.country').count()
  assert '177' in page.locator('#country-count').inner_text()
  assert 'India' in page.locator('#detail').inner_text()
  page.locator('#country-search').fill('जापान')
  assert page.locator('.country-item').count()==1,page.locator('.country-item').all_inner_texts()[:10]
  page.locator('.country-item').first.click()
  assert 'Japan' in page.locator('#detail h3').inner_text()
  before=page.locator('#world-svg').get_attribute('viewBox')
  page.locator('#zoom-plus').click()
  page.wait_for_timeout(350)
  after=page.locator('#world-svg').get_attribute('viewBox')
  assert before!=after,(before,after)
  page.locator('#distance-toggle').click()
  page.locator('#country-search').fill('India')
  page.locator('.country-item').first.click()
  page.locator('#country-search').fill('China')
  page.locator('.country-item').first.click()
  assert 'km' in page.locator('#measure-result').inner_text()
  page.locator('#view-world').click()
  page.wait_for_timeout(760)
  assert '1.0× ZOOM' in page.locator('#map-zoom-label').inner_text()
  page.screenshot(path=str(R/f'World_Atlas_{label}.png'),full_page=False)
  assert not errors,errors
  print(label,'177 polygons; Hindi search; selection; zoom; distance; reset; no JS errors')
  page.close()
 browser.close()
