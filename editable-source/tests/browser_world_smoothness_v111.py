#!/usr/bin/env python3
"""Isolated Chromium map-interaction stress test. No hardware/GPU certification.
Compares repetitive map DOM work against the v1.10 source, with identical fixture data.
"""
from pathlib import Path
import hashlib,json,shutil
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]/'dist'
SCRIPTS=['world-explore-search.js','world-scale.js','world.js','world-detail-geometry.js','world-place-search.js','world-detail.js']
html=(R/'world.html').read_text()
for n in SCRIPTS:html=html.replace(f'<script defer src="./{n}"></script>','')
html=html.replace('<link rel="stylesheet" href="./world.css"/>','')
files=[str(p.relative_to(R)) for p in (R/'data/world').glob('*.json')]
files += ['data/world-detail/manifest.json','data/world-detail/cities.geojson','data/world-detail/peaks.geojson','data/official-india/manifest.json','data/official-india/india-claim.geojson']
raw={p:(R/p).read_text() for p in files if (R/p).exists()}
sha={p:hashlib.sha256(s.encode()).hexdigest() for p,s in raw.items()}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage','--disable-features=Translate'])
 for mode,w,h in [('desktop',1280,800),('mobile',390,844)]:
  page=browser.new_page(viewport={'width':w,'height':h},has_touch=mode=='mobile',reduced_motion='reduce')
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html);page.add_style_tag(content=(R/'world.css').read_text())
  page.evaluate('''data=>{
   window.fetch=async url=>{const path=String(url).replace(/^\\.\\//,'');return path in data.raw?new Response(data.raw[path],{status:200}):new Response('Not found',{status:404})};
   Object.defineProperty(window.crypto,'subtle',{configurable:true,value:{digest:async(_,bytes)=>{
    const content=new TextDecoder().decode(bytes),match=Object.entries(data.raw).find(([p,v])=>v===content),hash=data.sha[match?.[0]]||'0'.repeat(64);
    return Uint8Array.from(hash.match(/../g).map(v=>parseInt(v,16))).buffer;
   }}});
  }''',{'raw':raw,'sha':sha})
  for name in SCRIPTS:page.add_script_tag(content=(R/name).read_text())
  page.wait_for_function('window.BharatWorldBridge?.countries().length===177',timeout=18000)
  page.wait_for_function("document.querySelector('#capitals-toggle')?.disabled===false",timeout=18000)
  # Settle initial async geographic layers and render at a zoom where places are visible.
  page.evaluate("window.BharatWorldBridge.focusPoint(37,-1)")
  page.wait_for_timeout(600)
  results=page.evaluate('''async()=>{
   const svg=document.querySelector('#world-svg'),box=svg.getBoundingClientRect();
   let cameraEvents=0,labelMutations=0,capMutations=0;
   const count=new MutationObserver(a=>labelMutations+=a.length),cap=new MutationObserver(a=>capMutations+=a.length);
   count.observe(document.querySelector('#country-labels'),{childList:true,subtree:true});
   cap.observe(document.querySelector('#capital-markers'),{childList:true,subtree:true});
   const listener=()=>cameraEvents++;window.addEventListener('bharat-world-camera',listener);
   const cx=box.left+box.width*.50,cy=box.top+box.height*.52;
   const make=(type,x,y)=>new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:24,pointerType:'touch',isPrimary:true,button:0,clientX:x,clientY:y});
   const before=svg.getAttribute('viewBox');
   svg.dispatchEvent(make('pointerdown',cx,cy));
   const started=performance.now();
   for(let i=0;i<96;i++)svg.dispatchEvent(make('pointermove',cx+i*1.4,cy+i*.5));
   const dispatchTimeMs=performance.now()-started;
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   svg.dispatchEvent(make('pointerup',cx+95*1.4,cy+95*.5));
   await new Promise(r=>setTimeout(r,320));
   const after=svg.getAttribute('viewBox');
   window.removeEventListener('bharat-world-camera',listener);count.disconnect();cap.disconnect();
   return {before,after,cameraEvents,labelMutations,capMutations,dispatchTimeMs:Number(dispatchTimeMs.toFixed(1)),mapChanged:before!==after};
  }''')
  assert results['mapChanged'],results
  assert results['cameraEvents']<=3,results
  assert results['labelMutations']<110,results
  assert results['capMutations']<400,results
  assert not errors,errors
  gestures=page.evaluate('''async()=>{
   const svg=document.querySelector('#world-svg'),r=svg.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
   const emit=(t,id,x,y)=>svg.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',isPrimary:id===31,button:0,clientX:x,clientY:y}));
   const raf=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   emit('pointerdown',31,cx-40,cy);emit('pointerdown',32,cx+40,cy);
   const initial=window.BharatWorldBridge.view();
   emit('pointermove',32,cx+85,cy);await raf();
   const pinched=window.BharatWorldBridge.view();
   emit('pointerup',32,cx+85,cy);emit('pointermove',31,cx-25,cy);await raf();
   const lifted=window.BharatWorldBridge.view();emit('pointerup',31,cx-25,cy);
   for(let i=0;i<40;i++)svg.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:8,clientX:cx,clientY:cy}));
   await raf();const wheeled=window.BharatWorldBridge.view();
   await new Promise(resolve=>setTimeout(resolve,200));
   return {initialW:initial.w,pinchedW:pinched.w,liftPan:Math.abs(lifted.x-pinched.x),wheelW:wheeled.w,zoomChanged:Math.abs(wheeled.w-pinched.w)>1};
  }''')
  assert gestures['pinchedW']<gestures['initialW']-2,gestures
  assert 0<gestures['liftPan']<30,gestures
  assert gestures['zoomChanged'],gestures
  assert not errors,errors
  q='#mobile-country-search' if mode=='mobile' else '#country-search'
  page.locator(q).fill('Nairobi')
  page.wait_for_timeout(160)
  assert page.locator('#country-list').count()==1
  page.screenshot(path=f'/mnt/data/Bharat_Atlas_v1_11_{mode}.png',full_page=False)
  print(json.dumps({'mode':mode,**results,'gestures':gestures,'errors':errors,'browser':'isolated Chromium with simulated hash verification'}))
  page.close()
 browser.close()
