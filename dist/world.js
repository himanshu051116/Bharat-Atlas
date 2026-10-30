/* Bharat Atlas World Explorer – standalone SVG map, no WebGL or external CDN. */
'use strict';
(()=>{
const $=id=>document.getElementById(id);
const svg=$('world-svg'),grid=$('latlon-grid'),layer=$('country-layer'),labels=$('country-labels'),capitalsLayer=$('capital-markers'),detail=$('detail');
const width=1440,height=720,ns='http://www.w3.org/2000/svg';
const state={countries:[],byId:new Map(),selected:null,continent:'All',query:'',view:{x:0,y:0,w:width,h:height},grid:true,labels:true,capitalsEnabled:false,capitalsAvailable:false,capitalRecords:[],capitalByCountry:new Map(),measure:false,officialIndiaAvailable:false,officialIndiaBounds:null,points:[],drag:null,pointers:new Map(),pinch:null,animation:null};
const localNames={India:'भारत',China:'चीन',Japan:'जापान',Russia:'रूस',Brazil:'ब्राज़ील',France:'फ्रांस',Germany:'जर्मनी',Canada:'कनाडा',Australia:'ऑस्ट्रेलिया',Nepal:'नेपाल',Pakistan:'पाकिस्तान',Bangladesh:'बांग्लादेश',Sri_Lanka:'श्रीलंका',United_States_of_America:'संयुक्त राज्य अमेरिका',United_Kingdom:'यूनाइटेड किंगडम',Indonesia:'इंडोनेशिया',South_Africa:'दक्षिण अफ्रीका',Afghanistan:'अफ़ग़ानिस्तान',Egypt:'मिस्र',Spain:'स्पेन',Italy:'इटली',Iran:'ईरान',Turkey:'तुर्की',Saudi_Arabia:'सऊदी अरब'};
function displayHi(c){const k=c.name.replaceAll(' ','_');const named=localNames[k];if(named)return named;if(!c.iso2)return '';try{const n=new Intl.DisplayNames(['hi'],{type:'region'}).of(c.iso2);return n===c.iso2?'':n}catch(_){return ''}}
function norm(s){return String(s||'').normalize('NFKD').toLocaleLowerCase().replace(/[\u0300-\u036f]/g,'').trim()}
function el(tag,attrs={},txt){const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));if(txt!==undefined)n.textContent=txt;return n}
// SVG viewport transforms stay lightweight while moving. Recreate text, markers,
// distance ruler and optional geography only after gesture/animation settles.
const cameraPresentation=window.BharatCameraScheduler.create({
 idleMs:100,
 onMoving:()=>svg.classList.add('camera-moving'),
 onSettle:()=>{
  svg.classList.remove('camera-moving');
  updateLabels();renderCapitals();updateDistanceScale();
  window.dispatchEvent(new CustomEvent('bharat-world-camera',{detail:{view:state.view}}));
 }
});
function finishCamera(){cameraPresentation.flush()}
function setView(v){
 let w=Math.max(18,Math.min(width,v.w));let h=w/2;
 let x=Math.max(-15,Math.min(width-w+15,v.x)),y=Math.max(-10,Math.min(height-h+10,v.y));
 const old=state.view;
 if(Math.abs(x-old.x)<.0001&&Math.abs(y-old.y)<.0001&&Math.abs(w-old.w)<.0001)return;
 state.view={x,y,w,h};
 svg.setAttribute('viewBox',`${x.toFixed(3)} ${y.toFixed(3)} ${w.toFixed(3)} ${h.toFixed(3)}`);
 const zoomLabel=(width/w).toFixed(1)+'× ZOOM';
 if($('map-zoom-label').textContent!==zoomLabel)$('map-zoom-label').textContent=zoomLabel;
 cameraPresentation.defer();
}

function updateDistanceScale(){
 const node=$('world-distance-scale'),module=window.BharatWorldScale;
 if(!node||!module)return;
 const matrix=svg.getScreenCTM?.();
 const units=matrix?Math.hypot(matrix.a,matrix.b):0;
 const measure=module.estimate(state.view,units);
 if(!measure){node.textContent='Distance scale unavailable';return}
 node.replaceChildren();
 const text=document.createElement('strong');text.textContent='≈ '+measure.km.toLocaleString('en-IN')+' km';
 const bar=document.createElement('span');bar.className='scale-bar';bar.style.width=Math.min(124,measure.pixels).toFixed(1)+'px';
 const hint=document.createElement('small');hint.textContent='Approx. at '+Math.abs(measure.latitude).toFixed(1)+'° '+(measure.latitude<0?'S':'N')+' · not for navigation';
 node.append(text,bar,hint);
}
window.addEventListener('resize',()=>{updateDistanceScale();updateLabels();renderCapitals()});
// Always bound downloaded geography by decoded bytes, including when the
// server omits Content-Length. This prevents a failed/hostile static host from
// buffering arbitrarily large payloads before checksum or JSON validation.
async function readBoundedText(response,maxBytes){
 const declared=Number(response.headers.get('content-length')||0);
 if(declared>maxBytes)throw Error('Geography response too large');
 let bytes;
 if(response.body?.getReader){
  const reader=response.body.getReader(),chunks=[];let total=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;
   total+=value.byteLength;if(total>maxBytes){await reader.cancel();throw Error('Geography response too large')}
   chunks.push(value);
  }}finally{reader.releaseLock()}
  bytes=new Uint8Array(total);let cursor=0;
  for(const chunk of chunks){bytes.set(chunk,cursor);cursor+=chunk.byteLength}
 }else{
  const buf=await response.arrayBuffer();if(buf.byteLength>maxBytes)throw Error('Geography response too large');bytes=new Uint8Array(buf);
 }
 return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
const ease=t=>1-Math.pow(1-t,3);
function animateView(next,duration=650){if(state.animation){cancelAnimationFrame(state.animation);state.animation=null}const start={...state.view};let prefers=false;try{prefers=matchMedia('(prefers-reduced-motion: reduce)').matches}catch(_){}
 if(prefers||duration<=0){setView(next);finishCamera();return}let t0=null;function step(t){if(t0===null)t0=t;const f=ease(Math.min(1,(t-t0)/duration));setView({x:start.x+(next.x-start.x)*f,y:start.y+(next.y-start.y)*f,w:start.w+(next.w-start.w)*f});if(f<1)state.animation=requestAnimationFrame(step);else{state.animation=null;finishCamera()}}state.animation=requestAnimationFrame(step)}
function gotoExtent(bbox,padding=48){const [west,south,east,north]=bbox;if(![west,south,east,north].every(Number.isFinite))return;
 const x0=(west+180)*4,y0=(90-north)*4,x1=(east+180)*4,y1=(90-south)*4;const w=Math.max(18,x1-x0+padding),h=Math.max(18,y1-y0+padding);
 const ww=Math.min(width,Math.max(w,2*h));animateView({x:(x0+x1)/2-ww/2,y:(y0+y1)/2-ww/4,w:ww})}
function overview(){animateView({x:0,y:0,w:width},700);setActiveView('world')}
function setActiveView(key){for(const v of ['world','asia','india']){const b=$('view-'+v);b.classList.toggle('active',v===key);b.setAttribute('aria-pressed',String(v===key))}}
function gotoIndia(){gotoExtent(state.officialIndiaBounds||[67,5,101,38],70);setActiveView('india')}
function gotoAsia(){gotoExtent([28,-10,180,81],75);setActiveView('asia')}
function zoom(factor,anchor,duration=145){const v=state.view;const newW=Math.max(18,Math.min(width,v.w*factor));const a=anchor||{x:v.x+v.w/2,y:v.y+v.h/2};const rx=(a.x-v.x)/v.w,ry=(a.y-v.y)/v.h;const next={x:a.x-rx*newW,y:a.y-ry*(newW/2),w:newW};
 if(duration===0){if(state.animation){cancelAnimationFrame(state.animation);state.animation=null}setView(next)}
 else animateView(next,duration)}
function coordsFromPoint(clientX,clientY){try{const p=svg.createSVGPoint();p.x=clientX;p.y=clientY;const out=p.matrixTransform(svg.getScreenCTM().inverse());return{x:out.x,y:out.y}}catch(_){const r=svg.getBoundingClientRect(),v=state.view;return{x:v.x+(clientX-r.left)/r.width*v.w,y:v.y+(clientY-r.top)/r.height*v.h}}}
function focusCountry(c,padding=70){const box=(c.name==='India'&&state.officialIndiaBounds)?state.officialIndiaBounds:c.bbox;
 // Dateline-split or overseas geometries cannot be focused with one huge bbox.
 if(box[2]-box[0]>180){const lon=Math.min(180,Math.max(-180,c.lon)),lat=c.lat;gotoExtent([Math.max(-180,lon-11),Math.max(-80,lat-10),Math.min(180,lon+11),Math.min(85,lat+10)],70)}
 else gotoExtent(box,padding)}
function countryInView(c){const b=c.bbox;return(b[2]+180)*4>=state.view.x&&(b[0]+180)*4<=state.view.x+state.view.w&&(90-b[1])*4>=state.view.y&&(90-b[3])*4<=state.view.y+state.view.h}
function updateLabels(){
 labels.replaceChildren();if(!state.labels)return;
 const w=state.view.w;
 let candidates=w>680?state.countries.filter(c=>['United States of America','Canada','Brazil','Russia','China','India','Australia','South Africa','Argentina','France','Japan','Greenland','Egypt','Saudi Arabia','Indonesia'].includes(c.name)):
 state.countries.filter(countryInView);
 // Give the selected country priority, then the largest geographic features.
 candidates=candidates.filter(c=>countryInView(c)&&c.areaKm2> (w>680?220000:2000)).sort((a,b)=>(b.id===state.selected?1:0)-(a.id===state.selected?1:0)||b.areaKm2-a.areaKm2);
 const limit=w<180?55:w<680?38:16,used=[];
 const ctm=svg.getScreenCTM?.(),scale=ctm?Math.hypot(ctm.a,ctm.b):Math.max(1,svg.getBoundingClientRect().width/w);
 const rect=svg.getBoundingClientRect(),fontPx=12.5;
 let shown=0;
 for(const c of candidates){
  if(shown>=limit)break;
  const x=(c.lon+180)*4,y=(90-c.lat)*4;
  const px=ctm?ctm.a*x+ctm.c*y+ctm.e-rect.left:(x-state.view.x)/w*rect.width;
  const py=ctm?ctm.b*x+ctm.d*y+ctm.f-rect.top:(y-state.view.y)/state.view.h*rect.height;
  const title=c.name.length>24?c.name.slice(0,21)+'…':c.name;
  const textWidth=Math.min(165,title.length*6.65+7);
  const box=[px-textWidth/2,py-13,px+textWidth/2,py+4];
  if(box[0]<4||box[2]>rect.width-4||box[1]<4||box[3]>rect.height-4)continue;
  const collision=used.some(b=>!(box[2]+8<b[0]||box[0]>b[2]+8||box[3]+5<b[1]||box[1]>b[3]+5));
  if(collision&&c.id!==state.selected)continue;
  used.push(box);
  const label=el('text',{x:x.toFixed(2),y:y.toFixed(2),'text-anchor':'middle'},title);
  label.style.fontSize=(fontPx/Math.max(.1,scale))+'px';
  label.style.strokeWidth=(2.6/Math.max(.1,scale))+'px';
  labels.append(label);shown++;
 }
}
function renderGrid(){
 grid.replaceChildren();if(!state.grid)return;
 for(let lon=-150;lon<=180;lon+=30){grid.append(el('path',{class:'grid-line',d:`M${(lon+180)*4} 0V720`}))}
 for(let lat=-60;lat<=60;lat+=30){grid.append(el('path',{class:'grid-line'+(lat===0?' equator':''),d:`M0 ${(90-lat)*4}H1440`}))}
 const major=[{lat:66.56,text:'ARCTIC CIRCLE'},{lat:23.44,text:'TROPIC OF CANCER'},{lat:0,text:'EQUATOR'},{lat:-23.44,text:'TROPIC OF CAPRICORN'},{lat:-66.56,text:'ANTARCTIC CIRCLE'}];
 for(const item of major){const y=(90-item.lat)*4;grid.append(el('path',{class:'reference-parallel',d:`M0 ${y.toFixed(2)}H1440`}));grid.append(el('text',{class:'graticule-label',x:12,y:(y-5).toFixed(2)},item.text))}
 grid.append(el('text',{class:'graticule-label',x:725,y:16},'PRIME MERIDIAN 0°'));
}
function capitalFor(c){return state.capitalByCountry.get(c.id)||null}
function renderCapitals(){
 if(!capitalsLayer)return;capitalsLayer.replaceChildren();
 if(!state.capitalsAvailable||!state.capitalsEnabled)return;
 const w=state.view.w,rad=Math.max(.65,Math.min(4.5,w/1440*3.5));
 let labelsShown=0;
 for(const c of state.countries){
  const cap=capitalFor(c);if(!cap||!countryInView(c))continue;
  if(state.continent!=='All'&&c.continent!==state.continent)continue;
  const x=(cap.lon+180)*4,y=(90-cap.lat)*4;
  if(x<state.view.x-12||x>state.view.x+state.view.w+12||y<state.view.y-12||y>state.view.y+state.view.h+12)continue;
  const marker=el('circle',{class:'capital-dot'+(c.id===state.selected?' active':''),cx:x.toFixed(2),cy:y.toFixed(2),r:rad.toFixed(2),'aria-label':cap.name+', reference capital for '+c.name,role:'button',tabindex:0});
  const select=()=>{choose(c,false);$('coordinate-status').textContent=cap.name+' · '+coord(cap.lat,true)+' · '+coord(cap.lon,false)};
  marker.addEventListener('click',e=>{e.stopPropagation();if(Date.now()>(state.suppressClickUntil||0))select()});
  marker.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select()}});
  marker.style.pointerEvents='all';capitalsLayer.append(marker);
  const showLabel=c.id===state.selected||((w<700&&c.areaKm2>150000&&labelsShown<28)||(w<190&&labelsShown<48));
  if(showLabel){const text=el('text',{class:'capital-text',x:(x+rad+2).toFixed(2),y:(y-rad-1).toFixed(2)},cap.name);text.style.fontSize=Math.max(.8,Math.min(11,w/1440*10+1.2))+'px';capitalsLayer.append(text);labelsShown++}
 }
}
function countryList(){const q=norm(state.query);let c=state.countries.filter(x=>(state.continent==='All'||state.continent===x.continent)&&(!q||[x.name,x.iso3,x.iso2,x.hi,capitalFor(x)?.name].some(t=>norm(t).includes(q))));c.sort((a,b)=>a.name.localeCompare(b.name));$('country-count').textContent=`${c.length} / ${state.countries.length}`;const list=$('country-list');list.replaceChildren();if(!c.length){const p=document.createElement('p');p.className='country-empty';p.textContent='No matching country in this overview. A city, capital or geographic feature may still appear in the suggestions above.';list.append(p);return}for(const co of c){const b=document.createElement('button');b.className='country-item'+(co.id===state.selected?' active':'');b.type='button';b.setAttribute('role','option');b.setAttribute('aria-selected',String(co.id===state.selected));const left=document.createElement('span'),nm=document.createElement('span'),sub=document.createElement('span'),arrow=document.createElement('span');nm.textContent=co.name;sub.className='meta';sub.textContent=co.continent+(capitalFor(co)?' · '+capitalFor(co).name:'');arrow.className='arrow';arrow.textContent='↗';left.append(nm,sub);b.append(left,arrow);b.addEventListener('click',()=>choose(co,true));list.append(b)}}
function setCountryFilter(){for(const c of state.countries){const p=$('path-'+c.id);if(!p)continue;p.classList.toggle('dim',state.continent!=='All'&&c.continent!==state.continent);p.classList.toggle('active',state.selected===c.id)}renderCapitals()}
function n(k){return Math.round(k).toLocaleString('en-IN')}
function coord(n,lat){return `${Math.abs(n).toFixed(2)}°${lat?(n>=0?'N':'S'):(n>=0?'E':'W')}`}
function greatCircle(a,b){const r=Math.PI/180;const lat1=a.lat*r,lat2=b.lat*r,dLat=(b.lat-a.lat)*r,dLon=(b.lon-a.lon)*r;const v=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;return 6371*2*Math.atan2(Math.sqrt(v),Math.sqrt(Math.max(0,1-v)))}
function selectionDetails(c){if(!c)return;const d=$('detail');d.replaceChildren();const ic=document.createElement('div');ic.className='detail-icon';ic.textContent='◎';const body=document.createElement('div');const tag=document.createElement('span');tag.className='overline';tag.textContent='COUNTRY / GENERALIZED MAP FEATURE';const h=document.createElement('h3');h.textContent=c.name+(c.hi&&c.hi!==c.name?` · ${c.hi}`:'');const p=document.createElement('p');p.textContent=c.name==='India'?(state.officialIndiaAvailable&&$('official-india-layer').style.display!=='none'?'The ochre outline is derived from an operator-supplied Survey of India generalized national claim dataset. Territorial claims do not establish administrative control; exact comparison against the 2026 official political map remains pending.':'The legacy Natural Earth world map does not represent or certify India’s full official territorial claims. Import the Survey of India outline for a source-backed overlay.'):'Generalized Natural Earth overview. Political or sovereignty conclusions must use current authoritative sources.';
 const g=document.createElement('div');g.className='detail-grid';for(const [label,v] of [['CONTINENT',c.continent],['SOURCE CODE',c.iso3==='-99'?'Not assigned':c.iso3],['APPROX. AREA',c.name==='India'&&state.officialIndiaAvailable?'Not certified here':(c.areaKm2?n(c.areaKm2)+' km²':'Not estimated')],['REFERENCE POINT',coord(c.lat,true)+', '+coord(c.lon,false)],['REFERENCE CAPITAL',capitalFor(c)?capitalFor(c).name+' (legacy source)':'Not included in reference data']]){const box=document.createElement('div'),lab=document.createElement('span'),val=document.createElement('strong');lab.textContent=label;val.textContent=v;box.append(lab,val);g.append(box)}const actions=document.createElement('div');actions.className='detail-actions';const focus=document.createElement('button');focus.type='button';focus.textContent='Focus on map';focus.addEventListener('click',()=>focusCountry(c,62));const compare=document.createElement('button');compare.type='button';compare.textContent='Compare distance';compare.addEventListener('click',()=>toggleMeasure(true,c));actions.append(focus,compare);if(c.name==='India'){const a=document.createElement('a');a.href='./index.html';a.textContent='Open India atlas ↗';a.style.cssText='font-size:11px;align-self:center;font-weight:750;color:#1b6347;text-decoration:underline';actions.append(a)}body.append(tag,h,p,g,actions);
 const related=state.countries.filter(x=>x.id!==c.id&&x.continent===c.continent).map(x=>({country:x,km:greatCircle(c,x)})).sort((a,b)=>a.km-b.km).slice(0,3);
 if(related.length){const group=document.createElement('div');group.className='world-related';const heading=document.createElement('strong');heading.textContent='Explore nearby reference points';const note=document.createElement('small');note.textContent='Nearest by representative points, NOT shared borders or travel distance.';group.append(heading,note);const buttons=document.createElement('div');for(const item of related){const b=document.createElement('button');b.type='button';b.textContent=item.country.name+' · '+n(item.km)+' km';b.addEventListener('click',()=>choose(item.country,true));buttons.append(b)}group.append(buttons);body.append(group)}
 d.append(ic,body);updateShareLink(c)}
function updateShareLink(c){
 const field=$('atlas-share-link');
 try{const url=new URL(location.href);url.searchParams.set('country',c.name);url.hash='world-map';field.value=url.href}catch(_){field.value='World atlas: '+c.name}
}
function markCoordinate(lat,lon){
 const target=$('user-point');target.replaceChildren();const x=(lon+180)*4,y=(90-lat)*4;
 target.append(el('circle',{class:'coordinate-halo',cx:x,cy:y,r:10}));target.append(el('circle',{class:'coordinate-pin',cx:x,cy:y,r:4}));
 const label=el('text',{class:'coordinate-label',x:x+12,y:y-9},coord(lat,true)+' · '+coord(lon,false));target.append(label);
 gotoExtent([Math.max(-180,lon-8),Math.max(-90,lat-8),Math.min(180,lon+8),Math.min(90,lat+8)],90);
 $('world-point-status').textContent='Pinned '+coord(lat,true)+' · '+coord(lon,false)+'. This is a coordinate marker, not a searched address.';
}
function choose(c,focus=false){state.selected=c.id;window.dispatchEvent(new CustomEvent("bharat-world-country",{detail:{iso3:c.iso3,name:c.name}}));setCountryFilter();countryList();selectionDetails(c);if(focus)focusCountry(c,70);if(state.measure){state.points.push(c);if(state.points.length>2)state.points=[c];updateMeasure()}}
function toggleMeasure(active,c){state.measure=active;state.points=c?[c]:[];$('distance-toggle').setAttribute('aria-pressed',String(active));$('distance-toggle').classList.toggle('active',active);$('measure-panel').hidden=!active;updateMeasure()}
function updateMeasure(){if(!state.measure)return;const p=state.points;if(p.length===0)$('measure-result').textContent='Select two countries on the map or in the list';else if(p.length===1)$('measure-result').textContent=`From ${p[0].name} — choose destination`;else $('measure-result').textContent=`${p[0].name} ↔ ${p[1].name}: approximately ${n(greatCircle(p[0],p[1]))} km`;const old=$('compare-link');if(old)old.remove();if(p.length===2){const link=el('path',{id:'compare-link',d:`M${(p[0].lon+180)*4} ${(90-p[0].lat)*4} L${(p[1].lon+180)*4} ${(90-p[1].lat)*4}`,stroke:'#b76d23','stroke-dasharray':'6 4','stroke-width':'2.5',fill:'none','vector-effect':'non-scaling-stroke'});$('selection-overlay').append(link)}}
async function loadCapitalReferences(){
 const status=$('capital-status');
 try{
  const manifestResp=await fetch('./data/world/capitals-manifest.json',{cache:'no-store'});
  if(!manifestResp.ok)throw Error('Reference metadata is missing');
  const meta=await manifestResp.json();
  if(meta.schema!=='bharat-world-capital-manifest-v1'||meta.sourceLicense!=='MIT'||meta.sourceVersion!=='0.1.2'||meta.file!=='world-capital-references.json'||!/^[0-9a-f]{64}$/.test(meta.sha256||'')||meta.count>200||meta.count<120)throw Error('Reference metadata is invalid');
  const response=await fetch('./data/world/world-capital-references.json',{cache:'no-store'});
  if(!response.ok)throw Error('Capital reference dataset unavailable');
  if(Number(response.headers.get('content-length')||0)>80000)throw Error('Reference dataset exceeds size limit');
  const raw=await readBoundedText(response,80000);
  if(!globalThis.crypto?.subtle)throw Error('SHA-256 verification unavailable');
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw))),v=>v.toString(16).padStart(2,'0')).join('');
  if(digest!==meta.sha256)throw Error('Reference data checksum mismatch');
  const parsed=JSON.parse(raw);
  if(parsed.schema!=='bharat-world-capital-references-v1'||!Array.isArray(parsed.features)||parsed.features.length!==meta.count)throw Error('Reference data count mismatch');
  const seen=new Set();const joined=[];
  for(const cap of parsed.features){
   const country=state.byId.get(cap.countryId);
   if(!country||!cap.country||country.name!==cap.country||!cap.name||cap.name.length>120||seen.has(cap.countryId)||!Number.isFinite(cap.lat)||!Number.isFinite(cap.lon)||Math.abs(cap.lat)>90||Math.abs(cap.lon)>180)throw Error('Invalid capital source record');
   seen.add(cap.countryId);joined.push(cap);
  }
  state.capitalRecords=joined;state.capitalByCountry=new Map(joined.map(v=>[v.countryId,v]));state.capitalsAvailable=true;
  state.capitalsEnabled=false;
  $('capitals-toggle').disabled=false;$('capitals-count').textContent=String(joined.length);
  status.textContent=joined.length+' capital reference points available. Optional historical countryinfo dataset (MIT); coordinates and current capital status not independently certified. Toggle Capitals to view.';
  countryList();selectionDetails(state.byId.get(state.selected));
 }catch(err){status.classList.add('failed');status.textContent='Reference capitals unavailable: '+err.message+'. Country geography remains usable.'}
}
function chooseFromSearch(){
 const query=norm(state.query);
 const result=state.countries.filter(c=>(state.continent==='All'||c.continent===state.continent)&&
  [c.name,c.hi,c.iso3,c.iso2,capitalFor(c)?.name].some(s=>norm(s).includes(query)));
 if(result.length){
  // A searched reference capital is a point, not the country's bounding box.
  const capitalCountry=result.find(c=>norm(capitalFor(c)?.name)===query);
  if(capitalCountry){
   choose(capitalCountry,false);
   const cap=capitalFor(capitalCountry);
   window.BharatWorldBridge?.focusPoint(cap.lon,cap.lat);
   $('coordinate-status').textContent=cap.name+' · reference-capital location (historical catalogue)';
  }else choose(result[0],true);
 }else window.BharatWorldDetail?.focusMatchingCity(state.query);
}
async function load(){try{const res=await fetch('./data/world/world-boundaries.json',{cache:'no-cache'});if(!res.ok)throw new Error('HTTP '+res.status);const data=JSON.parse(await readBoundedText(res,2000000));if(data.schema!=='bharat-world-generalized-v1'||!Array.isArray(data.features)||data.features.length<170)throw new Error('Invalid world atlas file');state.countries=data.features.map(c=>({...c,hi:displayHi(c)}));for(const c of state.countries){state.byId.set(c.id,c);const p=el('path',{d:c.path,id:'path-'+c.id,class:'country','fill-rule':'evenodd','data-continent':c.continent,'aria-label':c.name});if(c.name==='India'){p.style.opacity='0';p.style.pointerEvents='none';}p.addEventListener('click',()=>{if(Date.now()<(state.suppressClickUntil||0))return;choose(c,false)});p.addEventListener('dblclick',e=>{e.preventDefault();choose(c,true)});p.addEventListener('pointermove',e=>{if(state.drag?.moved||state.pointers.size>1)return;const tip=$('floating-tip');tip.textContent=c.name+' · '+c.continent;tip.hidden=false;const rect=$('map-wrap').getBoundingClientRect();tip.style.left=Math.min(rect.width-185,Math.max(8,e.clientX-rect.left+12))+'px';tip.style.top=Math.max(10,e.clientY-rect.top-34)+'px'});p.addEventListener('pointerleave',()=>{$('floating-tip').hidden=true});layer.append(p)}renderGrid();countryList();updateLabels();
 $('world-feature-count').textContent=String(state.countries.length);
 $('world-continent-count').textContent=String(new Set(state.countries.map(c=>c.continent)).size);
 $('map-mode-label').textContent=`${state.countries.length} GENERALIZED COUNTRY / TERRITORY FEATURES · NOT POLITICAL CERTIFICATION`;const india=state.countries.find(c=>c.name==='India');if(india){choose(india,false);setView({x:0,y:0,w:width});finishCamera();setActiveView('world')}
 const wanted=new URLSearchParams(location.search).get('country');if(wanted){const match=state.countries.find(c=>norm(c.name)===norm(wanted));if(match)choose(match,true)}
 }catch(err){$('country-list').textContent='World boundary dataset unavailable: '+err.message;$('map-mode-label').textContent='WORLD DATA UNAVAILABLE';$('detail').textContent='Open this page through a local HTTP server, not by double-clicking world.html.'}}
function onWorldQuery(value){state.query=value;$('country-search').value=value;$('mobile-country-search').value=value;countryList()}
for(const id of ['country-search','mobile-country-search']){
 const input=$(id);
 input.addEventListener('input',e=>onWorldQuery(e.target.value));
 input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();chooseFromSearch()}});
}
$('continent-select').addEventListener('change',e=>{state.continent=e.target.value;countryList();setCountryFilter();if(state.continent!=='All'){const matches=state.countries.filter(c=>c.continent===state.continent);if(matches.length){const bbox=[Math.min(...matches.map(c=>c.bbox[0])),Math.min(...matches.map(c=>c.bbox[1])),Math.max(...matches.map(c=>c.bbox[2])),Math.max(...matches.map(c=>c.bbox[3]))];gotoExtent(bbox,50)}}else overview()});
$('world-coordinates-form').addEventListener('submit',e=>{e.preventDefault();const lat=Number($('go-lat').value),lon=Number($('go-lon').value);
 if(!$('go-lat').value||!$('go-lon').value||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180){$('world-point-status').textContent='Enter latitude −90 to 90 and longitude −180 to 180.';return}
 markCoordinate(lat,lon);
});
$('atlas-share-copy').addEventListener('click',async()=>{
 const field=$('atlas-share-link');const msg=$('atlas-share-status');
 try{if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');await navigator.clipboard.writeText(field.value);msg.textContent='Country link copied.'}
 catch(_){field.focus();field.select();msg.textContent='Select and copy this link manually.'}
});
$('grid-toggle').addEventListener('click',()=>{state.grid=!state.grid;$('grid-toggle').setAttribute('aria-pressed',String(state.grid));renderGrid()});$('labels-toggle').addEventListener('click',()=>{state.labels=!state.labels;$('labels-toggle').setAttribute('aria-pressed',String(state.labels));updateLabels()});$('distance-toggle').addEventListener('click',()=>toggleMeasure(!state.measure));$('clear-distance').addEventListener('click',()=>toggleMeasure(true));
$('zoom-plus').addEventListener('click',()=>zoom(.65));$('zoom-minus').addEventListener('click',()=>zoom(1.5));$('zoom-reset').addEventListener('click',overview);$('world-home').addEventListener('click',overview);$('view-world').addEventListener('click',overview);$('view-asia').addEventListener('click',gotoAsia);$('view-india').addEventListener('click',gotoIndia);
// Trackpad wheel and mouse wheel use direct anchored zoom. Repeated events must
// never restart an easing animation: that was the main zoom oscillation bug.
// Keep world wheel zoom anchored to the visual center, not the cursor.
// Collapse high-frequency trackpad events into one SVG viewBox update per frame.
let worldWheelDelta=0,worldWheelFrame=0;
svg.addEventListener('wheel',e=>{
 e.preventDefault();e.stopPropagation();
 const normalized=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?140:1);
 if(!Number.isFinite(normalized)||Math.abs(normalized)<.01)return;
 worldWheelDelta+=Math.max(-130,Math.min(130,normalized));
 if(worldWheelFrame)return;
 worldWheelFrame=requestAnimationFrame(()=>{
  worldWheelFrame=0;
  const delta=Math.max(-210,Math.min(210,worldWheelDelta));
  worldWheelDelta=0;
  zoom(Math.exp(delta*.0015),null,0);
 });
},{passive:false});
svg.addEventListener('pointerdown',e=>{if(e.button!==0&&e.pointerType==='mouse')return;if(state.animation){cancelAnimationFrame(state.animation);state.animation=null}state.pointers.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY});if(state.pointers.size===1){state.drag={id:e.pointerId,x:e.clientX,y:e.clientY,old:{...state.view},moved:false};svg.classList.add('dragging')}else{state.drag=null;const pp=[...state.pointers.values()];const midX=(pp[0].clientX+pp[1].clientX)/2,midY=(pp[0].clientY+pp[1].clientY)/2;
 const rect=svg.getBoundingClientRect();
 state.pinch={dist:Math.hypot(pp[1].clientX-pp[0].clientX,pp[1].clientY-pp[0].clientY)||1,
  view:{...state.view},anchor:coordsFromPoint(midX,midY),
  rect:{left:rect.left,top:rect.top,width:Math.max(1,rect.width),height:Math.max(1,rect.height)}}}try{svg.setPointerCapture(e.pointerId)}catch(_){}});
// Coalesce high-frequency mouse/touch events into at most one camera write per frame.
let pendingGestureView=null,gestureFrame=null,lastCursorPoint=null,cursorFrame=null;
function enqueueGesture(view){
 pendingGestureView=view;
 if(gestureFrame!==null)return;
 gestureFrame=requestAnimationFrame(()=>{
  gestureFrame=null;
  if(pendingGestureView){const next=pendingGestureView;pendingGestureView=null;setView(next)}
 });
}
function flushGesture(){
 if(gestureFrame!==null){cancelAnimationFrame(gestureFrame);gestureFrame=null}
 if(pendingGestureView){const next=pendingGestureView;pendingGestureView=null;setView(next)}
 finishCamera();
}
svg.addEventListener('pointermove',e=>{
 if(!state.pointers.has(e.pointerId)){
  lastCursorPoint={x:e.clientX,y:e.clientY};
  if(cursorFrame===null)cursorFrame=requestAnimationFrame(()=>{
   cursorFrame=null;if(!lastCursorPoint)return;
   const p=coordsFromPoint(lastCursorPoint.x,lastCursorPoint.y);
   const lon=Math.max(-180,Math.min(180,p.x/4-180)),lat=Math.max(-90,Math.min(90,90-p.y/4));
   $('coordinate-status').textContent=coord(lat,true)+' · '+coord(lon,false);
  });
  return;
 }
 state.pointers.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY});
 if(state.pointers.size===2&&state.pinch){
  const pp=[...state.pointers.values()];
  const now=Math.hypot(pp[0].clientX-pp[1].clientX,pp[0].clientY-pp[1].clientY)||1;
  const w=state.pinch.view.w*state.pinch.dist/now;
  const mx=(pp[0].clientX+pp[1].clientX)/2,my=(pp[0].clientY+pp[1].clientY)/2;
  const rect=state.pinch.rect;
  const rx=(mx-rect.left)/rect.width,ry=(my-rect.top)/rect.height;
  enqueueGesture({x:state.pinch.anchor.x-rx*w,y:state.pinch.anchor.y-ry*w/2,w});return;
 }
 if(!state.drag||state.drag.id!==e.pointerId)return;
 const dx=e.clientX-state.drag.x,dy=e.clientY-state.drag.y;
 if(Math.hypot(dx,dy)>5)state.drag.moved=true;
 if(state.drag.moved){
  if(state.animation){cancelAnimationFrame(state.animation);state.animation=null}
  const rect=svg.getBoundingClientRect();
  enqueueGesture({x:state.drag.old.x-dx/Math.max(1,rect.width)*state.drag.old.w,
   y:state.drag.old.y-dy/Math.max(1,rect.height)*state.drag.old.h,w:state.drag.old.w});
 }
});
function stopPointer(e){
 flushGesture();
 state.pointers.delete(e.pointerId);
 if(state.pointers.size<2)state.pinch=null;
 if(state.pointers.size===0){
  if(state.drag?.moved)state.suppressClickUntil=Date.now()+300;
  state.drag=null;svg.classList.remove('dragging');
 }
 try{svg.releasePointerCapture(e.pointerId)}catch(_){}
}
svg.addEventListener('pointerup',stopPointer);svg.addEventListener('pointercancel',stopPointer);
svg.addEventListener('keydown',e=>{const v=state.view,step=v.w*.09;let next;if(e.key==='ArrowLeft')next={x:v.x-step,y:v.y,w:v.w};else if(e.key==='ArrowRight')next={x:v.x+step,y:v.y,w:v.w};else if(e.key==='ArrowUp')next={x:v.x,y:v.y-step,w:v.w};else if(e.key==='ArrowDown')next={x:v.x,y:v.y+step,w:v.w};else if(e.key==='+'||e.key==='=')zoom(.75);else if(e.key==='-')zoom(1.25);else if(e.key==='Home')overview();else return;if(next)animateView(next,160);e.preventDefault()});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){e.preventDefault();$('country-search').focus()}});

// Independently sourced India claim outline; the older Natural Earth world polygons
// must never be described as the Government of India's authoritative boundaries.
async function loadOfficialIndiaOverlay(){
 const status=$('india-claim-status');
 try{
  const resp=await fetch('./data/official-india/manifest.json',{cache:'no-store'});
  if(resp.status===404)return;
  if(!resp.ok)throw Error('Claim manifest HTTP '+resp.status);
  const meta=await resp.json();
  if(meta.schema!=='bharat-atlas-soi-claim-outline-v1'||meta.claimOnly!==true||
     meta.politicalMap2026GeometryMatched!==false||meta.commercialRedistributionAllowed!==false||
     meta.sourceUrl!=='https://surveyofindia.gov.in/documents/Outline_of_India.zip'||
     !/^[0-9a-f]{64}$/.test(meta.outlineSha256||''))throw Error('Claim manifest failed review');
  const vector=await fetch('./data/official-india/india-claim.geojson',{cache:'no-store'});
  if(!vector.ok)throw Error('Claim geometry HTTP '+vector.status);
  if(Number(vector.headers.get('content-length')||0)>12000000)throw Error('Claim data oversized');
  const raw=await readBoundedText(vector,12000000);
  const bytes=new TextEncoder().encode(raw);
  if(bytes.byteLength>12000000)throw Error('Claim data oversized');
  if(!crypto?.subtle)throw Error('Secure browser context required for hash verification');
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
  if(digest!==meta.outlineSha256)throw Error('Claim geometry SHA-256 mismatch');
  const fc=JSON.parse(raw);if(fc.type!=='FeatureCollection'||fc.features?.length!==1)throw Error('Invalid claim geometry');
  const geom=fc.features[0].geometry;
  if(!['Polygon','MultiPolygon'].includes(geom?.type))throw Error('Polygon required');
  const polygons=geom.type==='Polygon'?[geom.coordinates]:geom.coordinates;
  let count=0;const parts=[];
  for(const poly of polygons){
   for(const ring of poly){
    if(!Array.isArray(ring)||ring.length<4)throw Error('Invalid ring');
    let path='';for(let i=0;i<ring.length;i++){
     const point=ring[i];const lon=point?.[0],lat=point?.[1];
     if(!Number.isFinite(lon)||!Number.isFinite(lat)||lon<60||lon>102||lat<3||lat>42)throw Error('Coordinate outside India envelope');
     count++;if(count>200000)throw Error('Excessively detailed claim overlay');
     path+=(i===0?'M':'L')+((lon+180)*4).toFixed(3)+' '+((90-lat)*4).toFixed(3);
    }
    if(ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])throw Error('Unclosed polygon ring');
    parts.push(path+'Z');
   }
  }
  const claimLayer=$('official-india-layer');
  const claimPath=el('path',{d:parts.join(' '),'fill-rule':'evenodd',role:'button',tabindex:0,'aria-label':'India claimed national outline, generalized Survey of India source'});
  // In disputed areas the legacy world features below may belong to another
  // country's polygon. Selecting the visible claim must always select India.
  const selectClaim=()=>{const india=state.countries.find(c=>c.name==='India');if(india)choose(india,false)};
  claimPath.addEventListener('click',event=>{event.stopPropagation();selectClaim()});
  claimPath.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectClaim()}});
  claimLayer.replaceChildren(claimPath);
  state.officialIndiaAvailable=true;
  if(Array.isArray(meta.bounds)&&meta.bounds.length===4&&meta.bounds.every(Number.isFinite)&&meta.bounds[0]<meta.bounds[2]&&meta.bounds[1]<meta.bounds[3])state.officialIndiaBounds=meta.bounds;
  $('india-claims-toggle').disabled=false;
  $('india-claims-toggle').setAttribute('aria-pressed','true');
  // Avoid an incompatible duplicate Indian international border from Natural Earth.
  const generalizedIndia=state.countries.find(c=>c.name==='India');
  if(generalizedIndia){const old=$('path-'+generalizedIndia.id);if(old){old.style.fill='transparent';old.style.stroke='none'}}
  status.textContent='India claimed national outline: Survey of India source-declared 1:16m vector. NOT a verified match to the 2026 political edition; does not show de-facto control or state-level assignments. © Survey of India / Government of India, non-commercial use only.';
  $('map-mode-label').textContent+=' · INDIA CLAIM OUTLINE: SOURCE-DECLARED';
  if(state.selected!==null)selectionDetails(state.byId.get(state.selected));
 }catch(err){status.textContent='Official India claim outline unavailable or rejected: '+err.message+'. The world map still uses generalized Natural Earth geometry, not an India-claims reference.';console.warn('Claim overlay unavailable:',err.message)}
}

$('india-claims-toggle').addEventListener('click',()=>{
  if(!state.officialIndiaAvailable)return;
  const path=$('official-india-layer');
  const enabled=path.style.display==='none';
  path.style.display=enabled?'':'none';
  $('india-claims-toggle').setAttribute('aria-pressed',String(enabled));
  const india=state.countries.find(c=>c.name==='India');const old=india?$('path-'+india.id):null;
  if(old){old.style.fill=enabled?'transparent':'';old.style.stroke=enabled?'none':'';}
  $('india-claim-status').textContent=enabled
   ? 'India claim outline visible: Survey of India source-declared 1:16m generalized geometry; 2026 political map comparison and administrative control unverified.'
   : 'India political geometry is not installed. See the Survey of India official political map.';
  if(state.selected!==null)selectionDetails(state.byId.get(state.selected));
});
$('capitals-toggle').addEventListener('click',()=>{if(!state.capitalsAvailable)return;state.capitalsEnabled=!state.capitalsEnabled;$('capitals-toggle').setAttribute('aria-pressed',String(state.capitalsEnabled));renderCapitals()});
window.BharatWorldBridge={
 view:()=>({...state.view}),
 selectedCountry:()=>state.byId.get(state.selected)||null,
 countries:()=>state.countries.slice(),
 chooseCountryId:(id,focus=false)=>{const c=state.byId.get(id);if(c)choose(c,focus);return Boolean(c)},
 capitalForCountry:c=>capitalFor(c),
 capitalCount:()=>state.capitalRecords.length,
 findCountry:iso=>state.countries.find(c=>c.iso3===iso)||null,
 chooseIso:(iso,focus=false)=>{const c=state.countries.find(v=>v.iso3===iso);if(c)choose(c,focus);return Boolean(c)},
 focusPoint:(lon,lat)=>{const west=Math.max(-180,lon-5),east=Math.min(180,lon+5);gotoExtent([west,Math.max(-85,lat-5),east,Math.min(85,lat+5)],75)},
 focusBounds:(bounds)=>{if(Array.isArray(bounds)&&bounds.length===4&&bounds.every(Number.isFinite))gotoExtent(bounds,56)}
};
renderGrid();requestAnimationFrame(updateDistanceScale);load().then(async()=>{await loadCapitalReferences()});
// Optional same-origin research-shell cache, never a requirement for viewing the map.
if('serviceWorker' in navigator&&(location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname))){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./offline-shell.js').catch(()=>{}));
}
})();
