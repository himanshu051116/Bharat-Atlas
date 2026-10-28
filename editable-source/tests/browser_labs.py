"""Atlas Labs browser regression: actual GSHHG/Natural Earth data and SVG renderer.
Network fetch and SHA API are injected because local network navigation is restricted;
geometry, DOM, interactions, output are not mocked. No WebGL involved.
"""
import hashlib,json,re,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
html=(R/'dist/atlas-labs.html').read_text()
html=re.sub(r'<link rel="stylesheet" href="./atlas-labs.css">','',html)
html=re.sub(r'<script type="module" src="./atlas-labs.mjs"></script>','',html)
subsets={}
for prefix,name in [('landcover','land.geojson'),('gazetteer','places.geojson'),('hydrography','rivers.geojson'),('shorelines','coastlines.geojson'),('shorelines','lakes.geojson')]:
    p=R/'dist/data'/prefix/name
    raw=p.read_bytes()
    subsets[f'./data/{prefix}/{name}']={'raw':raw.decode('utf-8'),'digest':hashlib.sha256(raw).hexdigest()}
for prefix in ('landcover','gazetteer','hydrography','shorelines'):
    p=R/'dist/data'/prefix/'manifest.json'
    subsets[f'./data/{prefix}/manifest.json']={'json':json.loads(p.read_text())}
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True)
    errors=[];page.on('pageerror',lambda ex:errors.append(str(ex)))
    page.set_content(html,wait_until='domcontentloaded')
    page.add_style_tag(content=(R/'dist/atlas-labs.css').read_text())
    page.evaluate('''(data)=>{
      window.__labsResources=data;
      window.fetch=async function(path){const v=data[String(path)];if(!v)return {ok:false,status:404};
        return {ok:true,status:200,json:async()=>v.json,arrayBuffer:async()=>new TextEncoder().encode(v.raw).buffer};};
      Object.defineProperty(window.crypto,'subtle',{configurable:true,value:{digest:async(alg,buffer)=>{
        const raw=new TextDecoder().decode(buffer);
        const item=Object.values(data).find(x=>x.raw===raw);
        if(!item)throw Error('No matching test data for digest');
        return Uint8Array.from(item.digest.match(/../g),h=>parseInt(h,16)).buffer;
      }}});
    }''',subsets)
    # Script runs as a true ES module with exports; page is about:blank and fetch is stubbed.
    page.add_script_tag(type='module',content=(R/'dist/atlas-labs.mjs').read_text())
    page.locator('#lab-map svg').wait_for(timeout=30000)
    assert '71 sampled Natural Earth' in page.locator('#lab-message').inner_text() or '71 sampled Natural Earth' in page.locator('#lab-message').inner_text()
    assert page.locator('#lab-map svg path').count()>60
    page.screenshot(path=str(R/'docs/V25_ATLAS_LABS_DESKTOP.png'),full_page=False)
    with page.expect_download() as download: page.locator('#studio-export').click()
    content=download.value.path().read_text()
    assert 'NO POLITICAL BOUNDARIES' in content
    page.locator('[data-lab-tab="learn"]').click()
    page.locator('#question-text').wait_for()
    assert 'state or a union territory' in page.locator('#question-text').inner_text()
    page.locator('input[data-quiz-answer][value="State"]').check()
    page.locator('#quiz-next').click()
    assert 'Question 2 of 10' in page.locator('#question-counter').inner_text()
    assert page.locator('#worksheet-preview svg').count()==1
    with page.expect_download() as worksheet:page.locator('#worksheet-download').click()
    assert worksheet.value.suggested_filename.endswith('.svg')
    page.locator('[data-lab-tab="observatory"]').click()
    assert page.locator('.sample-row').count()>0
    assert 'NOT population' in page.locator('#sample-summary').inner_text()
    assert 'great-circle distance' in page.locator('#distance-result').inner_text()
    page.locator('[data-lab-tab="history"]').click()
    assert 'No independently sourced time series' in page.locator('#history-result').inner_text()
    page.locator('[data-lab-tab="stories"]').click()
    assert page.locator('#story-map svg').count()==1
    page.locator('#story-next').click()
    assert '2/3' in page.locator('#story-title').inner_text()
    assert not errors,errors
    phone=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
    phone.set_content(html,wait_until='domcontentloaded');phone.add_style_tag(content=(R/'dist/atlas-labs.css').read_text())
    phone.evaluate('''(data)=>{
        window.fetch=async path=>{const v=data[String(path)];if(!v)return {ok:false,status:404};return {ok:true,status:200,json:async()=>v.json,arrayBuffer:async()=>new TextEncoder().encode(v.raw).buffer};};
        Object.defineProperty(window.crypto,'subtle',{configurable:true,value:{digest:async(_,buffer)=>{const raw=new TextDecoder().decode(buffer);const v=Object.values(data).find(x=>x.raw===raw);if(!v)throw Error('Missing mock digest');return Uint8Array.from(v.digest.match(/../g),x=>parseInt(x,16)).buffer;}}});
    }''',subsets)
    phone.add_script_tag(type='module',content=(R/'dist/atlas-labs.mjs').read_text())
    phone.locator('#lab-map svg').wait_for(timeout=30000)
    phone.locator('[data-lab-tab=\"learn\"]').click()
    phone.locator('#worksheet-preview svg').wait_for(timeout=10000)
    phone.screenshot(path=str(R/'docs/V25_ATLAS_LABS_MOBILE_LAYOUT.png'))
    browser.close()
print('Atlas Labs real SVG desktop interactions + mobile layout passed (source network/crypto mocked only)')
