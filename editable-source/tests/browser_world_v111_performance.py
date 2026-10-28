#!/usr/bin/env python3
"""Browser performance regression: isolated Chromium with simulated hashes only.
Tests actual bundled UI interactions, not hardware acceptance or FPS guarantees.
"""
import hashlib,json,shutil,os
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]/'dist'
SCRIPTS=['world-explore-search.js','world-scale.js','world-camera-scheduler.js','world.js','world-detail-geometry.js','world-place-search.js','world-detail.js']
html=(R/'world.html').read_text()
for name in SCRIPTS:
    html=html.replace(f'<script defer src="./{name}"></script>','')
html=html.replace('<link rel="stylesheet" href="./world.css"/>','')
paths=[str(p.relative_to(R)) for p in (R/'data/world').glob('*.json')]
paths+=['data/world-detail/manifest.json','data/world-detail/cities.geojson','data/world-detail/peaks.geojson','data/official-india/manifest.json','data/official-india/india-claim.geojson']
raw={path:(R/path).read_text(encoding='utf-8') for path in paths if (R/path).exists()}
sha={path:hashlib.sha256(text.encode('utf-8')).hexdigest() for path,text in raw.items()}
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
    for mode,w,h in [item for item in [('desktop',1280,800),('mobile',390,844)] if os.environ.get('ATLAS_BROWSER_MODE','both') in ('both',item[0])]:
        page=b.new_page(viewport={'width':w,'height':h},has_touch=(mode=='mobile'),reduced_motion='reduce')
        errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
        page.set_content(html)
        page.add_style_tag(content=(R/'world.css').read_text())
        page.evaluate('''data=>{
          window.fetch=async url=>{
           const path=String(url).replace(/^\\.\\//,'');
           return path in data.raw?new Response(data.raw[path],{status:200}):new Response('missing',{status:404});
          };
          Object.defineProperty(window.crypto,'subtle',{configurable:true,value:{digest:async(_,bytes)=>{
           const body=new TextDecoder().decode(bytes);
           const entry=Object.entries(data.raw).find(([key,value])=>value===body);
           const hash=data.sha[entry?.[0]]||'0'.repeat(64);
           return Uint8Array.from(hash.match(/../g).map(v=>parseInt(v,16))).buffer;
          }}});
        }''',{'raw':raw,'sha':sha})
        for script in SCRIPTS:page.add_script_tag(content=(R/script).read_text())
        page.wait_for_function('window.BharatWorldBridge?.countries().length>170',timeout=20000)
        page.wait_for_timeout(200)
        counts=page.evaluate('''()=>{
         const ids=['country-labels','capital-markers','world-distance-scale'];
         const counts=Object.fromEntries(ids.map(id=>[id,0]));
         for(const id of ids){const node=document.getElementById(id);
          const old=node.replaceChildren.bind(node);
          node.replaceChildren=(...args)=>{counts[id]++;return old(...args)};
         }
         window.__perfCounts=counts;
         const svg=document.getElementById('world-svg');
         const before=svg.getAttribute('viewBox');
         for(let i=0;i<100;i++)svg.dispatchEvent(new WheelEvent('wheel',{deltaY:-2,clientX:600,clientY:350,bubbles:true,cancelable:true}));
         return {before,after:svg.getAttribute('viewBox')};
        }''')
        page.wait_for_timeout(350)
        paint=page.evaluate('window.__perfCounts')
        assert counts['before']!=counts['after'],'wheel zoom did not update viewport'
        assert paint['country-labels']<=2,paint
        assert paint['capital-markers']<=2,paint
        assert paint['world-distance-scale']<=2,paint
        # Dragging updates viewport, and releasing pointer finalizes overlays.
        initial=page.locator('#world-svg').get_attribute('viewBox')
        bounds=page.locator('#world-svg').bounding_box()
        x=bounds['x']+bounds['width']*.55;y=bounds['y']+bounds['height']*.55
        page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+45,y+30,steps=10);page.mouse.up()
        page.wait_for_timeout(250)
        moved=page.locator('#world-svg').get_attribute('viewBox')
        assert moved!=initial,'drag navigation did not change viewport'
        assert not errors,errors
        output=f'/mnt/data/Bharat_Atlas_v1_11_{mode}.png'
        page.screenshot(path=output,full_page=False)
        print(json.dumps({'mode':mode,'wheelEvents':100,'overlayRebuilds':paint,'wheelUpdatesViewport':True,'dragUpdatesViewport':True,'pageErrors':errors,'screenshot':output}),flush=True)
        page.close()
    b.close()
