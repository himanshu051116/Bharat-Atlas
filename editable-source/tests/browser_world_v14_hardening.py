"""World v1.4 hardening proof: source-isolated admin-1 search, viewport culling,
and bounded streaming rejection. All province geometry below is SYNTHETIC TEST DATA.
"""
from pathlib import Path
import hashlib,json,shutil
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]/'dist'
html=(R/'world.html').read_text().replace('<link rel="stylesheet" href="./world.css"/>','').replace('<script defer src="./world.js"></script>','').replace('<script defer src="./world-detail.js"></script>','').replace('<script defer src="./world-detail-geometry.js"></script>','')
css=(R/'world.css').read_text();js=(R/'world-camera-scheduler.js','world.js').read_text();details=(R/'world-detail.js').read_text()
paths=['data/world/world-boundaries.json','data/world/hydrography-manifest.json','data/world/world-hydrography.json','data/world/shoreline-manifest.json','data/world/world-shorelines.json','data/world/capitals-manifest.json','data/world/world-capital-references.json','data/official-india/manifest.json','data/official-india/india-claim.geojson','data/world-detail/cities.geojson']
raw={p:(R/p).read_text(encoding='utf8') for p in paths}
province={"type":"FeatureCollection","features":[
 {"type":"Feature","properties":{"name":"Test California","countryIso3":"USA","countryName":"United States of America"},"geometry":{"type":"Polygon","coordinates":[[[-124,33],[-114,33],[-114,42],[-124,42],[-124,33]]]}},
 {"type":"Feature","properties":{"name":"Test Ontario","countryIso3":"CAN","countryName":"Canada"},"geometry":{"type":"Polygon","coordinates":[[[-90,42],[-79,42],[-79,51],[-90,51],[-90,42]]]}}
]}
raw['data/world-detail/admin1.geojson']=json.dumps(province,separators=(',',':'))
cmeta=json.loads((R/'data/world-detail/manifest.json').read_text())['layers']['cities']
raw['data/world-detail/manifest.json']=json.dumps({"schema":"bharat-world-detail-manifest-v1","publisher":"Natural Earth","licence":"Public domain","approvedForBundle":True,"officialPoliticalAuthority":False,"indiaAdministrativePolygonsCertified":False,"layers":{"cities":cmeta,"admin1":{"count":2,"bytes":len(raw['data/world-detail/admin1.geojson'].encode()),"sha256":hashlib.sha256(raw['data/world-detail/admin1.geojson'].encode()).hexdigest(),"licence":"Public domain","sourceUrl":"https://www.naturalearthdata.com/","sourceVersion":"synthetic-browser-test"}}})
hashes={name:hashlib.sha256(value.encode()).hexdigest() for name,value in raw.items()}
with sync_playwright() as browser_tools:
 browser=browser_tools.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for mode,w,h in [('desktop',1320,780),('mobile',390,844)]:
  page=browser.new_page(viewport={'width':w,'height':h},has_touch=mode=='mobile')
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html);page.add_style_tag(content=css)
  page.evaluate(r'''payload=>{
   const dict=payload.raw;
   Object.defineProperty(window.crypto,'subtle',{configurable:true,value:{digest:async(_,array)=>{
    const data=new TextDecoder().decode(array);
    const entry=Object.entries(dict).find(([k,v])=>v===data);
    const hash=entry?payload.hashes[entry[0]]:'0'.repeat(64);
    return Uint8Array.from(hash.match(/../g).map(c=>parseInt(c,16))).buffer;
   }}});
   window.fetch=async url=>{const key=String(url).replace(/^\.\//,'');return key in dict?new Response(dict[key],{status:200}):new Response('Not found',{status:404})};
  }''',{'raw':raw,'hashes':hashes})
  page.add_script_tag(content=js);page.add_script_tag(content=(R/'world-detail-geometry.js').read_text());page.add_script_tag(content=details)
  page.wait_for_function("document.querySelector('#world-admin1-toggle').disabled===false",timeout=15000)
  page.locator('#world-detail-controls > summary').click()
  page.locator('#world-admin1-toggle').click()
  # Intentionally search a synthetic province, not a claim about the real map.
  inp=page.locator('#mobile-country-search' if mode=='mobile' else '#country-search')
  inp.fill('Test California')
  page.wait_for_function("Array.from(document.querySelectorAll('#world-city-results button')).some(b=>b.textContent.includes('Test California'))",timeout=8000)
  page.locator('#world-city-results button').filter(has_text='Test California').click()
  page.wait_for_function("window.BharatWorldBridge.view().w<400",timeout=8000)
  page.wait_for_function("document.querySelectorAll('#world-admin1-layer path').length>=1",timeout=8000)
  assert 'Test California' in page.locator('#world-detail-status').text_content()
  assert page.locator('#world-admin1-layer path').count()==1, 'Off-screen Canadian province should be culled'
  # Move viewport to unrelated continent. Offscreen admin1 polygons should be absent.
  page.evaluate("window.BharatWorldBridge.focusPoint(110,-20)")
  page.wait_for_timeout(1100)
  assert page.locator('#world-admin1-layer path').count()==0
  assert not errors,errors
  print(mode,'province search/selection, viewport culling, camera updates: PASS')
  page.close()
 # Malformed unbounded response with NO Content-Length must be stopped in-stream.
 bad=browser.new_page(viewport={'width':1200,'height':800})
 bad.set_content(html);bad.add_style_tag(content=css)
 bad.evaluate(r'''payload=>{
  const dict=payload.raw;
  Object.defineProperty(window.crypto,'subtle',{configurable:true,value:{digest:async(_,bytes)=>{
   const data=new TextDecoder().decode(bytes);const item=Object.entries(dict).find(([k,v])=>v===data);
   const hash=item?payload.hashes[item[0]]:'0'.repeat(64);
   return Uint8Array.from(hash.match(/../g).map(c=>parseInt(c,16))).buffer;
  }}});
  window.fetch=async url=>{
   const key=String(url).replace(/^\.\//,'');
   if(key==='data/world-detail/admin1.geojson')return new Response(new ReadableStream({start(c){
    c.enqueue(new TextEncoder().encode('x'.repeat(256)));c.enqueue(new TextEncoder().encode('x'.repeat(256)));c.close();
   }}),{status:200});
   return key in dict?new Response(dict[key],{status:200}):new Response('Not found',{status:404});
  };
 }''',{'raw':raw,'hashes':hashes})
 bad.add_script_tag(content=js);bad.add_script_tag(content=(R/'world-detail-geometry.js').read_text());bad.add_script_tag(content=details)
 bad.wait_for_function("document.querySelector('#world-detail-status').textContent.includes('Response too large')",timeout=15000)
 assert bad.locator('#world-admin1-toggle').is_disabled()
 print('unknown-length oversized geography response: BLOCKED')
 bad.close()
 browser.close()
