"""Local visual QA, using the exact generated assets with file-backed simulated HTTP responses.
The SHA digest in this isolated about:blank test is replaced by a known SHA from the build-time verified manifest;
this does NOT constitute a real browser cryptographic or physical-GPU acceptance test.
"""
import json,shutil,re
from pathlib import Path
from playwright.sync_api import sync_playwright
r=Path(__file__).resolve().parents[1];d=r/'dist'
html=(d/'world.html').read_text().replace('<link rel="stylesheet" href="./world.css"/>','').replace('<script defer src="./world.js"></script>','')
world=json.loads((d/'data/world/world-boundaries.json').read_text())
claim=json.loads((d/'data/official-india/india-claim.geojson').read_text())
manifest=json.loads((d/'data/official-india/manifest.json').read_text())
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for label,viewport in [('desktop',{'width':1440,'height':900}),('mobile',{'width':390,'height':844})]:
  page=b.new_page(viewport=viewport,has_touch=label=='mobile')
  page.set_content(html);page.add_style_tag(content=(d/'world.css').read_text())
  page.evaluate('''a=>{
    window.fetch=async url=>{
      const u=String(url);const v=u.includes('world-boundaries')?a.world:u.includes('official-india/manifest.json')?a.manifest:u.includes('india-claim.geojson')?a.claim:null;
      if(!v)return new Response('Not found',{status:404});
      return new Response(JSON.stringify(v),{status:200,headers:{'Content-Type':'application/json'}})
    };
    Object.defineProperty(window.crypto,'subtle',{configurable:true,value:{digest:async()=>Uint8Array.from(a.sha.match(/../g),x=>parseInt(x,16)).buffer}});
  }''',{'world':world,'claim':claim,'manifest':manifest,'sha':manifest['outlineSha256']})
  page.add_script_tag(content=(d/'world.js').read_text())
  page.locator('#country-list .country-item').first.wait_for(timeout=20000)
  page.locator('#india-claims-toggle').wait_for(state='visible')
  page.wait_for_timeout(1100)
  # reset scroll, no location selected, show complete world
  page.evaluate('window.scrollTo(0,0)')
  page.screenshot(path=str(r/f'Bharat_Atlas_World_Overview_{label}.png'),full_page=label=='mobile')
  print(label,'official source overlay enabled:',not page.locator('#india-claims-toggle').is_disabled(),'status:',page.locator('#india-claim-status').inner_text()[:90])
  page.close()
 b.close()
