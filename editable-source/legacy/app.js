'use strict';
/* Bharat Atlas — source-aware geographic research preview.
   No dataset is marked certified solely because simple checks pass. */
const LOCAL_URL='./data/states.provisional.geojson';
const SOURCE_URL='https://cdn.jsdelivr.net/gh/Vardhan-Systems/vardhan-maps@2c829a3543171810a4b28162ea736fb76dfdef40/src/data/generated/states.low.json';
const FALLBACK_URL='https://raw.githubusercontent.com/Vardhan-Systems/vardhan-maps/2c829a3543171810a4b28162ea736fb76dfdef40/src/data/generated/states.low.json';
const SOI_URL='https://surveyofindia.gov.in/pages/political-map-of-india';
const STATES=['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];
const UTS=['Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'];
const ALIAS={'Orissa':'Odisha','Uttaranchal':'Uttarakhand','Andaman and Nicobar':'Andaman and Nicobar Islands','Jammu & Kashmir':'Jammu and Kashmir','Pondicherry':'Puducherry','NCT of Delhi':'Delhi'};
const CHECKPOINTS=[{title:'Gilgit included in Ladakh',lon:74.3,lat:35.92,expected:'Ladakh'},{title:'Muzaffarabad in J&K',lon:73.47,lat:34.37,expected:'Jammu and Kashmir'},{title:'Aksai Chin in Ladakh',lon:79.1,lat:35.0,expected:'Ladakh'},{title:'Shaksgam sample in Ladakh',lon:76.41987,lat:36.11126,expected:'Ladakh'}];
const LABELS={'Jammu and Kashmir':[75.05,33.8],'Ladakh':[77.8,34.4],'Himachal Pradesh':[77.23,31.9],'Punjab':[75.4,31],'Haryana':[76.7,29.25],'Rajasthan':[73.9,26.6],'Uttar Pradesh':[80.8,26.7],'Madhya Pradesh':[78.5,23.7],'Maharashtra':[76.6,19.4],'Gujarat':[71.9,22.5],'Chhattisgarh':[82,21.3],'Odisha':[84.5,20.1],'Bihar':[85.55,25.75],'West Bengal':[88.1,23.5],'Jharkhand':[85.5,23.7],'Karnataka':[76,15.3],'Kerala':[76.3,10.4],'Tamil Nadu':[78.1,11.5],'Telangana':[79.1,17.5],'Andhra Pradesh':[80.7,15.2],'Assam':[92.8,26.1],'Arunachal Pradesh':[94.8,28.0],'Nagaland':[94.4,26.0],'Manipur':[93.9,24.8],'Meghalaya':[91.3,25.5],'Tripura':[91.9,23.8],'Mizoram':[92.8,23.1],'Sikkim':[88.5,27.5],'Uttarakhand':[79.1,30]};
const EL=id=>document.getElementById(id);
let requestVersion=0;
let collection=null,sourceTitle='Community research preview',chosen='',theme='political',showLabels=true,showChecks=false,qaResults=[],datasetMeta={},view={x:0,y:0,w:1000,h:800},bounds=null,drag=null,dragMoved=false,toastTimer=null,certified=false;
const NS='http://www.w3.org/2000/svg';
const escapeAttr=s=>String(s).replace(/[<>&"']/g,'');
const canonical=s=>ALIAS[String(s||'').trim()]||String(s||'').trim();
const label=f=>canonical(f?.properties?.name||f?.properties?.NAME_1||f?.properties?.st_nm||f?.properties?.STATE||f?.properties?.STNAME||'');
function notify(msg){const n=EL('toast');n.textContent=msg;n.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.hidden=true,4200)}
function eachCoordinate(a,callback){
 if(!Array.isArray(a))throw Error('Invalid coordinate array');
 if(typeof a[0]==='number'){
   if(a.length<2||!Number.isFinite(a[0])||!Number.isFinite(a[1]))throw Error('Invalid coordinate pair');
   callback(a[0],a[1]);return;
 }
 for(const v of a)eachCoordinate(v,callback);
}
function twiceRingArea(ring){let sum=0;for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i];sum+=a[0]*b[1]-b[0]*a[1]}return sum}

function verifyGeo(raw){
  if(raw?.type!=='FeatureCollection'||!Array.isArray(raw.features)||!raw.features.length)throw Error('Expected a GeoJSON FeatureCollection');
  if(raw.features.length>2500)throw Error('Too many features for the state-level viewer');
  let total=0;const names=new Set();
  for(const f of raw.features){
    if(!['Polygon','MultiPolygon'].includes(f?.geometry?.type))throw Error('Only polygon boundaries are supported');
    const name=label(f);if(!name)throw Error('Missing state/UT name');
    if(names.has(name))throw Error(`Duplicate region name: ${name}. Dissolve multipart features first.`);
    names.add(name);let n=0;
    const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
    if(!polys.length)throw Error(`No polygon in ${name}`);
    for(const poly of polys){if(!Array.isArray(poly)||!poly.length)throw Error(`Empty polygon in ${name}`);for(const ring of poly){
      if(!Array.isArray(ring)||ring.length<4)throw Error(`Ring too short in ${name}`);
      const a=ring[0],z=ring[ring.length-1];if(!Array.isArray(a)||!Array.isArray(z)||a.length<2||z.length<2||a[0]!==z[0]||a[1]!==z[1])throw Error(`Unclosed boundary ring in ${name}`);
      for(const pt of ring)if(!Array.isArray(pt)||pt.length<2||!Number.isFinite(pt[0])||!Number.isFinite(pt[1]))throw Error(`Invalid coordinate in ${name}`);
      if(Math.abs(twiceRingArea(ring))<1e-15)throw Error(`Degenerate zero-area polygon ring in ${name}`);
    }}
    eachCoordinate(f.geometry.coordinates,(x,y)=>{n++;total++;if(!Number.isFinite(x)||!Number.isFinite(y)||x<60||x>102||y<3||y>41)throw Error('Coordinates outside the supported India envelope')});
    if(n<4||total>350000)throw Error('Invalid or excessively detailed geometry');
  }
  return raw;
}
function inRing(x,y,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside}
function geoContains(feature,x,y){const g=feature.geometry;const polys=g.type==='Polygon'?[g.coordinates]:g.coordinates;return polys.some(poly=>poly.length&&inRing(x,y,poly[0])&&!poly.slice(1).some(h=>inRing(x,y,h)))}
function regionAt(lon,lat){return (collection?.features||[]).filter(f=>geoContains(f,lon,lat)).map(label)}
function mercY(lat){const phi=Math.max(-85,Math.min(85,lat))*Math.PI/180;return Math.log(Math.tan(Math.PI/4+phi/2))*180/Math.PI}
function fitProjection(features){let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const f of features)eachCoordinate(f.geometry.coordinates,(lon,lat)=>{minX=Math.min(minX,lon);maxX=Math.max(maxX,lon);let y=mercY(lat);minY=Math.min(minY,y);maxY=Math.max(maxY,y)});if(!(maxX>minX)||!(maxY>minY))throw Error('Cannot display degenerate dataset');
const scale=Math.min(860/(maxX-minX),695/(maxY-minY));
if(!Number.isFinite(scale)||scale<=0)throw Error('Cannot display geographic bounds');
const contentW=(maxX-minX)*scale,contentH=(maxY-minY)*scale;return {minX,maxX,minY,maxY,scale,ox:(1000-contentW)/2,oy:(800-contentH)/2};}
function project(lon,lat){return [bounds.ox+(lon-bounds.minX)*bounds.scale,bounds.oy+(bounds.maxY-mercY(lat))*bounds.scale]}
function pointsOfFeature(f){const g=f.geometry;return g.type==='Polygon'?[g.coordinates]:g.coordinates}
function featurePath(f){return pointsOfFeature(f).map(poly=>poly.map(ring=>ring.map((pt,i)=>{const [x,y]=project(pt[0],pt[1]);return `${i?'L':'M'}${x.toFixed(2)},${y.toFixed(2)}`}).join(' ')+' Z').join(' ')).join(' ')}
function geoBounds(f){let mnX=Infinity,mnY=Infinity,mxX=-Infinity,mxY=-Infinity;eachCoordinate(f.geometry.coordinates,(x,y)=>{const v=project(x,y);mnX=Math.min(v[0],mnX);mnY=Math.min(v[1],mnY);mxX=Math.max(v[0],mxX);mxY=Math.max(v[1],mxY)});return {x:mnX,y:mnY,w:mxX-mnX,h:mxY-mnY}}
function createSvg(tag,attrs={},text=''){const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));if(text)e.textContent=text;return e}
function setView(){const minW=170,maxW=1300;view.w=Math.max(minW,Math.min(maxW,view.w));view.h=view.w*.8;view.x=Math.max(-150,Math.min(1150-view.w,view.x));view.y=Math.max(-120,Math.min(920-view.h,view.y));EL('map').setAttribute('viewBox',`${view.x.toFixed(2)} ${view.y.toFixed(2)} ${view.w.toFixed(2)} ${view.h.toFixed(2)}`)}
function updateSelection(){for(const e of EL('map').querySelectorAll('.shape'))e.classList.toggle('selected',e.dataset.name===chosen);for(const b of EL('region-list').querySelectorAll('button'))b.classList.toggle('active',b.dataset.name===chosen)}
function renderMap(){if(!collection)return;const svg=EL('map');svg.replaceChildren();svg.append(createSvg('title',{},'Political map of India — provisional geometry'),createSvg('rect',{x:-500,y:-500,width:2000,height:2000,class:'water'}));const grid=createSvg('g');for(let lon=65;lon<=100;lon+=5){const [x]=project(lon,20);grid.append(createSvg('path',{d:`M ${x} -100 L ${x} 900`,class:'map-graticule'}))}for(let lat=5;lat<=40;lat+=5){const [,y]=project(80,lat);grid.append(createSvg('path',{d:`M -100 ${y} L 1100 ${y}`,class:'map-graticule'}))}svg.append(grid);
collection.features.forEach((f,i)=>{const n=label(f),path=createSvg('path',{d:featurePath(f),class:'shape',fill:theme==='outline'?'#fbfdfb':(i%5===0?'#d4e9dc':i%5===1?'#bfddcd':i%5===2?'#e5efe2':i%5===3?'#d5e4d0':'#e2eadc'),'fill-rule':'evenodd','data-name':n,tabindex:0,role:'button','aria-label':`Explore ${n}`});const t=createSvg('title',{},n);path.append(t);path.addEventListener('click',()=>{if(!dragMoved)selectRegion(n)});path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectRegion(n)}});path.addEventListener('pointermove',e=>showTip(e,n));path.addEventListener('pointerleave',()=>EL('tooltip').hidden=true);svg.append(path)});
if(showLabels){const group=createSvg('g');for(const [n,pos] of Object.entries(LABELS)){const match=collection.features.find(f=>label(f)===n);if(!match||!geoContains(match,...pos))continue;const [x,y]=project(...pos);const txt=n==='Jammu and Kashmir'?'Jammu & Kashmir':n;const short=txt.length>16?txt.replace(' Pradesh',' Pr.').replace('Madhya','M.').replace('Uttara','U.'):txt;group.append(createSvg('text',{x:x.toFixed(2),y:y.toFixed(2),class:'map-label','font-size':n.length>13?8.1:9.3,'text-anchor':'middle'},short))}svg.append(group)}renderCheckpoints(svg);updateSelection();setView()}
function renderCheckpoints(svg){
  EL('map-note').hidden=!showChecks;
  if(!showChecks||!collection)return;
  const group=createSvg('g',{'aria-label':'Approximate geographic screening checkpoints'});
  for(const check of CHECKPOINTS){const [x,y]=project(check.lon,check.lat);const pass=regionAt(check.lon,check.lat).join('|')===check.expected;
    const g=createSvg('g',{class:'checkpoint','data-pass':String(pass)});
    g.append(createSvg('circle',{cx:x.toFixed(2),cy:y.toFixed(2),r:7}));
    const labelName=check.title.replace(' included in Ladakh','').replace(' sample in Ladakh','').replace(' in J&K','').replace(' in Ladakh','');
    g.append(createSvg('text',{x:(x+12).toFixed(2),y:(y-11).toFixed(2)},labelName));
    group.append(g);
  }
  svg.append(group);
}
function renderRegions(){const list=EL('region-list'),q=EL('search').value.trim().toLowerCase();list.replaceChildren();const names=(collection?.features||[]).map(label).filter((n,i,a)=>a.indexOf(n)===i).filter(n=>n.toLowerCase().includes(q)).sort((a,b)=>a.localeCompare(b));EL('region-count').textContent=`${names.length} / 36`;if(!names.length){const p=document.createElement('p');p.className='muted';p.textContent=collection?'No matching regions.':'Map data not available yet.';list.append(p)}for(const n of names){const b=document.createElement('button');b.type='button';b.className='region-btn'+(chosen===n?' active':'');b.dataset.name=n;const title=document.createElement('span');title.textContent=n;const code=document.createElement('span');code.className='region-meta';code.textContent=STATES.includes(n)?'STATE':UTS.includes(n)?'UT':'CHECK';b.append(title,code);b.onclick=()=>selectRegion(n);list.append(b)}}
function selectRegion(n){chosen=n;const f=collection?.features.find(f=>label(f)===n);if(!f)return;const box=geoBounds(f);view.w=Math.max(170,Math.min(1000,Math.max(box.w*1.75,box.h*1.75/.8)));view.h=view.w*.8;view.x=box.x+box.w/2-view.w/2;view.y=box.y+box.h/2-view.h/2;setView();updateSelection();renderRegions();EL('selected-name').textContent=n;const kind=STATES.includes(n)?'Indian state':UTS.includes(n)?'Union territory':'Region requiring verification';EL('selection-kind').textContent=kind.toUpperCase();EL('selected-description').textContent='Boundary rendering uses the currently selected provisional dataset. Official boundary verification is pending.';EL('selection').textContent=`Viewing ${n} · ${kind}`;EL('clear-selection').hidden=false;EL('tooltip').hidden=true;const wasMenuOpen=EL('tool-panel').classList.contains('open');EL('tool-panel').classList.remove('open');EL('menu-btn').setAttribute('aria-expanded','false');if(wasMenuOpen)EL('map').focus()}
function reset(){chosen='';view={x:0,y:0,w:1000,h:800};setView();updateSelection();renderRegions();EL('selected-name').textContent='An atlas built on clarity.';EL('selected-description').textContent="Explore India's states and union territories by selecting a region directly on the map or using the left-hand list.";EL('selection-kind').textContent='MAP STUDIO';EL('selection').textContent='Choose a region to explore its outline.';EL('clear-selection').hidden=true}
function zoom(factor,cx=view.x+view.w/2,cy=view.y+view.h/2){const w=view.w*factor,h=w*.8;view.x=cx-(cx-view.x)*factor;view.y=cy-(cy-view.y)*factor;view.w=w;view.h=h;setView()}
function mapPoint(clientX,clientY){
  const svg=EL('map'),matrix=svg.getScreenCTM();
  if(!matrix)throw Error('Map transform unavailable');
  const point=svg.createSVGPoint();point.x=clientX;point.y=clientY;
  const p=point.matrixTransform(matrix.inverse());return {x:p.x,y:p.y};
}
const activePointers=new Map();let pinch=null;
function distanceAndMid(){const a=[...activePointers.values()];const x=(a[0].x+a[1].x)/2,y=(a[0].y+a[1].y)/2;return {x,y,distance:Math.max(5,Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y))}}
function pointerDown(e){
  if(!collection||e.button!==0)return;
  activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});EL('map').setPointerCapture(e.pointerId);
  if(activePointers.size===1){drag={pid:e.pointerId,x:e.clientX,y:e.clientY,vx:view.x,vy:view.y};dragMoved=false;pinch=null}
  else if(activePointers.size===2){pinch=distanceAndMid();drag=null;dragMoved=true;EL('map').classList.add('dragging')}
}
function pointerMove(e){
  if(!activePointers.has(e.pointerId))return;
  activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(activePointers.size>=2){
    if(!pinch){pinch=distanceAndMid();return}
    const next=distanceAndMid(),anchor=mapPoint(pinch.x,pinch.y);
    zoom(pinch.distance/next.distance,anchor.x,anchor.y);
    const after=mapPoint(next.x,next.y);view.x+=anchor.x-after.x;view.y+=anchor.y-after.y;setView();
    pinch=next;dragMoved=true;return;
  }
  if(!drag||drag.pid!==e.pointerId)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(Math.hypot(dx,dy)>5){dragMoved=true;EL('map').classList.add('dragging')}
  if(!dragMoved)return;
  const origin=mapPoint(drag.x,drag.y),current=mapPoint(e.clientX,e.clientY);
  view.x+=origin.x-current.x;view.y+=origin.y-current.y;setView();
  drag.x=e.clientX;drag.y=e.clientY;
}
function pointerEnd(e){
  activePointers.delete(e.pointerId);pinch=null;drag=null;
  if(activePointers.size===1){const [pid,point]=activePointers.entries().next().value;
    drag={pid,x:point.x,y:point.y,vx:view.x,vy:view.y};
  }else if(!activePointers.size){EL('map').classList.remove('dragging');setTimeout(()=>dragMoved=false,0)}
}
function showTip(e,n){if(drag)return;const tip=EL('tooltip'),r=EL('map-wrap').getBoundingClientRect();tip.textContent=n;tip.hidden=false;tip.style.left=Math.min(Math.max(12,e.clientX-r.left+14),r.width-145)+'px';tip.style.top=Math.min(Math.max(8,e.clientY-r.top+12),r.height-35)+'px'}
function audit(){const fs=collection.features,names=fs.map(label),set=new Set(names);EL('states-stat').textContent=STATES.filter(n=>set.has(n)).length;EL('uts-stat').textContent=UTS.filter(n=>set.has(n)).length;EL('coverage').innerHTML='';EL('coverage').classList.add('ready');EL('coverage').append(Object.assign(document.createElement('span'),{className:'mini-dot'}),document.createTextNode(`${set.size} geographic regions loaded`));const tests=[{title:'36 unique state/UT names (not a coverage test)',pass:STATES.every(n=>set.has(n))&&UTS.every(n=>set.has(n))&&set.size===36&&fs.length===36,found:`${set.size} names / ${fs.length} features`},...CHECKPOINTS.map(t=>{const act=regionAt(t.lon,t.lat);return {title:t.title,pass:act.length===1&&act[0]===t.expected,found:act.join(', ')||'Not covered'}})];const out=EL('audit');out.replaceChildren();for(const t of tests){const row=document.createElement('div');row.className='audit-row';const dot=document.createElement('span');dot.className='audit-dot '+(t.pass?'pass':'fail');const msg=document.createElement('span');msg.textContent=`${t.title}: ${t.pass?'Pass':'Review'} (${t.found})`;row.append(dot,msg);out.append(row)}qaResults=tests;const flagged=tests.filter(t=>!t.pass).length;const coverage=EL('coverage');coverage.classList.toggle('has-flags',flagged>0);coverage.lastChild.textContent=`${set.size} regions · ${flagged} QA flag${flagged===1?'':'s'}`;EL('download-audit').disabled=false;return tests}
function enableExports(v){for(const id of ['export-svg','export-png','export-8k'])EL(id).disabled=!v}
function loadDataset(raw,source,sourceKind='community'){
 // Validate everything needed by the renderer before changing the active session.
 const candidate=verifyGeo(raw),nextBounds=fitProjection(candidate.features);
 collection=candidate;bounds=nextBounds;sourceTitle=source;
 datasetMeta={source,sourceKind,licence:sourceKind==='community'?'ODbL 1.0 — © OpenStreetMap contributors':'Unknown — supplied by the importer',loadedAt:new Date().toISOString(),geographyStatus:'unverified; review required'};
 const attr=EL('active-attribution'),attrLink=EL('attribution-link');
 attr.textContent=sourceKind==='community'?'© OpenStreetMap contributors (ODbL 1.0) · Community preview':'User-imported geographic data · Licence and provenance unknown';
 attrLink.hidden=sourceKind!=='community';
 EL('preview-copy').textContent=sourceKind==='community'?
  'The map data is community-derived and has not been verified against the 2026 Survey of India edition.':
  'A locally imported map is displayed. Its accuracy and redistribution licence have not been verified.';
 EL('source-paragraph').textContent=sourceKind==='community'?
  'This demonstration uses a community-sourced approximation, not the Survey of India 2026 boundaries. The map may omit portions of claimed territory that are administered by Pakistan or China.':
  'This session uses a GeoJSON imported from your device. The atlas has not established its creator, reuse licence, accuracy or conformity with the Survey of India political map. No file was uploaded to our server.';
 certified=false;view={x:0,y:0,w:1000,h:800};chosen='';EL('map-empty').hidden=true;EL('dataset-title').textContent=source;EL('dataset-explainer').textContent=sourceKind==='community'?'ODbL community geometry, not government-verified.':'Imported file: source, licence and official accuracy have not been established.';EL('search').value='';renderMap();renderRegions();reset();const tests=audit();enableExports(true);notify(`${collection.features.length} regions loaded · ${tests.filter(t=>!t.pass).length} quality flags`)}
async function fetchPreview(){const thisRequest=++requestVersion;const empty=EL('map-empty');empty.hidden=false;EL('empty-heading').textContent='Loading India map';EL('empty-description').textContent='Loading provisional research geometry (local source preferred).';EL('retry').hidden=true;enableExports(false);let errs=[];for(const u of [LOCAL_URL,SOURCE_URL,FALLBACK_URL]){try{const r=await fetch(u,{cache:'force-cache',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(`HTTP ${r.status}`);const body=await r.json();if(thisRequest!==requestVersion)return;loadDataset(body,u===LOCAL_URL?'Self-hosted ODbL community preview':'Community preview · Vardhan Maps');return}catch(e){errs.push(e.message)}}if(thisRequest!==requestVersion)return;EL('empty-heading').textContent='Unable to load map data';EL('empty-description').textContent='This preview needs map data. Check your connection, retry or import a local GeoJSON from the map tools.';EL('retry').hidden=false;EL('download-audit').disabled=true;EL('dataset-title').textContent='Dataset not available';EL('dataset-explainer').textContent='Load a local GeoJSON or retry the community preview.';EL('region-list').textContent='Map data not available.';console.warn('Map data load failed:',errs.join(' / '))}
function mapSvg(){
 if(!collection)throw Error('No map loaded');
 const copy=EL('map').cloneNode(true);
 const scope=EL('export-scope').value;
 // Export the whole political map or preserve the actual pan/zoom viewport.
 copy.setAttribute('width','1000');copy.setAttribute('height','800');
 copy.setAttribute('viewBox',scope==='view'?`${view.x} ${view.y} ${view.w} ${view.h}`:'0 0 1000 800');
 copy.setAttribute('xmlns',NS);
 for(const r of copy.querySelectorAll('.water'))r.setAttribute('fill','#eaf4f5');
 for(const g of copy.querySelectorAll('.map-graticule')){g.setAttribute('fill','none');g.setAttribute('stroke','#dbe8e6');g.setAttribute('stroke-width','.65');g.setAttribute('opacity','.5')}
 // Export should not depend on stylesheet classes or user-interface state.
 for(const p of copy.querySelectorAll('.shape')){
   p.removeAttribute('tabindex');p.removeAttribute('role');p.removeAttribute('aria-label');
   const n=p.getAttribute('data-name');p.setAttribute('stroke','#ffffff');p.setAttribute('stroke-width',n===chosen?'2.5':'1.25');p.setAttribute('fill',n===chosen?'#62b28e':p.getAttribute('fill'));
 }
 for(const t of copy.querySelectorAll('.map-label')){
   t.setAttribute('fill','#26483d');t.setAttribute('font-family','Arial,sans-serif');t.setAttribute('font-weight','bold');t.setAttribute('stroke','#f8faf8');t.setAttribute('stroke-width','3.4');t.setAttribute('paint-order','stroke');
 }
 // The research QA markers are intentionally excluded from user exports.
 for(const g of copy.querySelectorAll('.checkpoint'))g.remove();
 // A visible inset is laid over the selected export viewport at any zoom.
 const vb=copy.getAttribute('viewBox').split(/\s+/).map(Number),[x,y,w,h]=vb;
 const footerH=h*.066;
 copy.append(createSvg('rect',{x,y:y+h-footerH,width:w,height:footerH,fill:'#ffffff','fill-opacity':'.95'}));
 copy.append(createSvg('text',{x:x+w*.015,y:y+h-footerH*.56,'font-size':Math.max(3.2,h*.018),fill:'#25483a','font-family':'Arial,sans-serif','font-weight':'bold'},'BHARAT ATLAS · RESEARCH PREVIEW'));
 copy.append(createSvg('text',{x:x+w*.015,y:y+h-footerH*.22,'font-size':Math.max(2.6,h*.0125),fill:'#4e7468','font-family':'Arial,sans-serif'},'PROVISIONAL GEOMETRY — Unverified against Survey of India 2026 · '+(datasetMeta.sourceKind==='community'?'© OpenStreetMap contributors (ODbL 1.0)':'User-imported data (licence unknown)')));
 return new XMLSerializer().serializeToString(copy);
}
function saveBlob(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.hidden=true;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),5000)}
function exportSVG(){try{saveBlob(new Blob([mapSvg()],{type:'image/svg+xml;charset=utf-8'}),'bharat-atlas-research.svg');notify('SVG exported with provisional-data notice')}catch(e){notify(e.message)}}
let pngBusy=false;
async function exportPNG(w){
 if(!collection||pngBusy)return;
 const label=w===7680?'8K':'4K';let url=null;
 if(w===7680 && navigator.deviceMemory && navigator.deviceMemory<4){notify('8K may exceed this device memory. Use SVG for lossless detail.');return;}
 try{
   pngBusy=true;
   for(const id of ['export-png','export-8k'])EL(id).disabled=true;
   notify(`Rendering ${label} map…`);
   const svg=mapSvg();
   url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
   const img=new Image();
   await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('SVG image load failed'));img.src=url});
   const canvas=document.createElement('canvas');canvas.width=w;canvas.height=Math.floor(w*.8);
   const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas unavailable; export SVG instead');
   ctx.fillStyle='#eaf4f5';ctx.fillRect(0,0,canvas.width,canvas.height);
   ctx.drawImage(img,0,0,canvas.width,canvas.height);
   const blob=await new Promise(res=>canvas.toBlob(res,'image/png'));
   if(!blob)throw Error('PNG render failed; export SVG instead');
   saveBlob(blob,`bharat-atlas-research-${label}.png`);
   notify(`${label} PNG exported with research-data notice`);
 }catch(e){notify(`${label} export failed: ${e.message}. Try SVG.`)}
 finally{
   if(url)URL.revokeObjectURL(url);
   pngBusy=false;
   enableExports(!!collection);
 }
}
function dialog(){const d=EL('info-dialog');if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','')}
function setup(){EL('search').addEventListener('input',renderRegions);EL('search').addEventListener('keydown',e=>{if(e.key==='Enter'){const first=EL('region-list').querySelector('button');if(first)first.click()}});window.addEventListener('keydown',e=>{
 if(e.key==='Escape'){
   const panel=EL('tool-panel');
   if(panel.classList.contains('open')){panel.classList.remove('open');EL('menu-btn').setAttribute('aria-expanded','false');EL('menu-btn').focus()}
   return;
 }
 if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){
   e.preventDefault();EL('search').focus()
 }
});EL('menu-btn').onclick=()=>{const o=EL('tool-panel').classList.toggle('open');EL('menu-btn').setAttribute('aria-expanded',String(o))};EL('style-political').onclick=()=>changeStyle('political');EL('style-outline').onclick=()=>changeStyle('outline');EL('show-checks').onclick=()=>{showChecks=!showChecks;EL('show-checks').setAttribute('aria-pressed',String(showChecks));renderMap()};EL('download-audit').onclick=()=>{const report={project:'Bharat Atlas v0.7',generatedAt:new Date().toISOString(),source:datasetMeta,officiallyVerified:false,checks:qaResults,disclaimer:'Sample checks are not government certification; compare to official Survey of India geometry.'};saveBlob(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),'bharat-atlas-qa-report.json')};EL('labels').onclick=()=>{showLabels=!showLabels;EL('labels').setAttribute('aria-pressed',String(showLabels));EL('labels').querySelector('span').textContent=showLabels?'Labels on':'Labels off';renderMap()};EL('zoom-in').onclick=()=>zoom(.78);EL('zoom-out').onclick=()=>zoom(1.28);EL('reset').onclick=reset;EL('clear-selection').onclick=reset;EL('map').addEventListener('wheel',e=>{if(!collection)return;e.preventDefault();const p=mapPoint(e.clientX,e.clientY);zoom(e.deltaY<0?.84:1.16,p.x,p.y)},{passive:false});EL('map').addEventListener('pointerdown',pointerDown);EL('map').addEventListener('pointermove',pointerMove);for(const ev of ['pointerup','pointercancel','lostpointercapture'])EL('map').addEventListener(ev,pointerEnd);EL('map').addEventListener('keydown',e=>{if(e.target!==EL('map'))return;if(e.key==='+'||e.key==='='){e.preventDefault();zoom(.8)}else if(e.key==='-'){e.preventDefault();zoom(1.25)}else if(e.key==='0'){e.preventDefault();reset()}else if(e.key.startsWith('Arrow')){e.preventDefault();const amount=view.w*.08;if(e.key==='ArrowLeft')view.x-=amount;if(e.key==='ArrowRight')view.x+=amount;if(e.key==='ArrowUp')view.y-=amount;if(e.key==='ArrowDown')view.y+=amount;setView()}});EL('export-svg').onclick=exportSVG;EL('export-png').onclick=()=>exportPNG(3840);EL('export-8k').onclick=()=>exportPNG(7680);EL('import-btn').onclick=()=>EL('upload').click();EL('upload').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>12*1024*1024)throw Error('Maximum import size is 12 MB');const raw=JSON.parse(await file.text());verifyGeo(raw);fitProjection(raw.features);requestVersion++;loadDataset(raw,`Imported: ${file.name}`,'import')}catch(err){notify(`Import failed: ${err.message}`)}finally{e.target.value=''}};EL('retry').onclick=fetchPreview;EL('about-source').onclick=dialog;EL('audit-help').onclick=dialog;EL('close-dialog').onclick=()=>EL('info-dialog').close();EL('dialog-done').onclick=()=>EL('info-dialog').close();fetchPreview()}
function changeStyle(t){theme=t;EL('style-political').classList.toggle('active',t==='political');EL('style-outline').classList.toggle('active',t==='outline');EL('style-political').setAttribute('aria-pressed',String(t==='political'));EL('style-outline').setAttribute('aria-pressed',String(t==='outline'));renderMap()}
setup();
