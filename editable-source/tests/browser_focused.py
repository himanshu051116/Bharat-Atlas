from pathlib import Path
import ast,json,re,shutil
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]; t=(R/'tests/browser_preview.py').read_text()
ns={}
for node in ast.parse(t).body:
 if isinstance(node,ast.Assign) and len(node.targets)==1 and isinstance(node.targets[0],ast.Name) and node.targets[0].id in ('STATES','UTS','STUB'):
  ns[node.targets[0].id]=ast.literal_eval(node.value)
states=ns['STATES']+ns['UTS']
def square(x,y):return [[[x,y],[x+.55,y],[x+.55,y+.55],[x,y+.55],[x,y]]]
fixture={'type':'FeatureCollection','features':[{'type':'Feature','properties':{'name':name},'geometry':{'type':'Polygon','coordinates':square(68+(i%9)*3,7+(i//9)*6)}} for i,name in enumerate(states)]}
html=(R/'dist/index.html').read_text()
html=re.sub(r'<script[^>]*src="[^"]+"[^>]*></script>','',html)
html=re.sub(r'<link[^>]*rel="stylesheet"[^>]*>','',html)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 for name,w,h,missing in [('desktop',1500,920,False),('mobile',390,844,True)]:
  page=b.new_page(viewport={'width':w,'height':h},has_touch=name=='mobile')
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html)
  page.add_style_tag(content=(R/'dist/styles.css').read_text())
  page.add_style_tag(content=(R/'dist/atlas-focus.css').read_text())
  page.evaluate('(fixture)=>window.__fixture=fixture',fixture)
  if missing:page.evaluate('window.__missingBorders=true')
  page.add_script_tag(content=ns['STUB'])
  if missing:page.evaluate('delete window.maplibregl')
  page.add_script_tag(content=(R/'dist/app.bundle.js').read_text())
  page.locator('.region-option').first.wait_for(timeout=12000)
  assert page.locator('.region-option').count()==36
  assert not page.locator('.journey-bar').is_visible()
  assert page.locator('.map-stage').is_visible()
  if name=='desktop':
   assert not page.locator('.right-panel').is_visible()
   page.locator('#search-input').fill('मध्य प्रदेश')
   assert page.locator('.region-option').count()==1
   page.locator('.region-option').first.click()
   assert 'Madhya Pradesh' in page.locator('#focus-title').inner_text()
  else:
   page.locator('#mobile-menu').click()
   page.locator('#search-input').fill('लद्दाख')
   assert page.locator('.region-option').count()==1
   page.locator('.region-option').first.click()
   assert 'no independently validated polygon' in page.locator('#focus-description').inner_text()
   assert page.locator('#map-overlay svg path[data-region]').count()==0
  page.screenshot(path=str(R/f'Bharat_Atlas_Focused_{name}.png'),full_page=False)
  page.locator('#atlas-quick-measure').click()
  assert page.locator('.journey-bar').is_visible()
  assert page.locator('.right-panel').is_visible()
  assert page.locator('[data-tool-panel="measure"]').is_visible()
  page.locator('#atlas-extra-toggle').click()
  assert not page.locator('.journey-bar').is_visible()
  page.locator('#atlas-extra-toggle').click()
  assert page.locator('.journey-bar').is_visible()
  assert page.locator('#atlas-extra-toggle').get_attribute('aria-expanded')=='true'
  page.locator('#atlas-extra-toggle').click()
  assert not page.locator('.journey-bar').is_visible()
  assert not errors,errors
  print('PASS focused',name,'independent bilingual catalogue / advanced toggle / layout', 'no geometry' if missing else 'synthetic fixture')
  page.close()
 b.close()
