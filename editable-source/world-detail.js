/* Bharat Atlas additional geography, optional source-verified Natural Earth overlays.
 * No external tiles or browser geocoder. Never replaces Survey of India claim line.
 */
'use strict';
(()=>{
const $=id=>document.getElementById(id), NS='http://www.w3.org/2000/svg';
const geo=window.BharatWorldGeometry;
if(!geo)throw Error('World geometry module must load before optional geography');
const sections={countries:'world-fine-toggle',admin1:'world-admin1-toggle',cities:'world-cities-toggle',rivers:'world-waterways-toggle',lakes:'world-lakes-toggle',peaks:'world-peaks-toggle'};
const available=new Map(),visible=new Set(['rivers']), byCountry=new Map();
const bridge=()=>window.BharatWorldBridge;
const svgEl=(tag,attrs)=>{const el=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));return el};
const path=(coords,closed=false)=>{let d='',last=null;for(const p of coords){if(!Array.isArray(p)||p.length<2||!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>180.01||Math.abs(p[1])>90.01)return '';
 if(last && Math.abs(p[0]-last[0])>170){if(closed)return '';last=null;}
 d+=(last?'L':'M')+((p[0]+180)*4).toFixed(2)+' '+((90-p[1])*4).toFixed(2)+' ';last=p;}
 return d+(closed&&last?'Z':'')};
function geometryPath(g){if(!g||typeof g!=='object')return '';
 if(g.type==='LineString')return path(g.coordinates);
 if(g.type==='MultiLineString')return g.coordinates.map(c=>path(c)).join(' ');
 if(g.type==='Polygon')return g.coordinates.map(c=>path(c,true)).join(' ');
 if(g.type==='MultiPolygon')return g.coordinates.flatMap(c=>c.map(r=>path(r,true))).join(' ');
 return '';
}
function safeJson(t,maxBytes){if(new TextEncoder().encode(t).length>maxBytes)throw Error('Dataset exceeds configured size');return JSON.parse(t)}
// Reject overlarge map files while streaming, rather than after an unbounded res.text().
async function checkedRead(url,hash,maxBytes){
 const res=await fetch(url,{cache:'no-store'});if(!res.ok)throw Error('HTTP '+res.status);
 const length=Number(res.headers.get('content-length')||0);
 if(length>maxBytes)throw Error('Response too large');
 let bytes;
 if(res.body?.getReader){
  const reader=res.body.getReader(),chunks=[];let total=0;
  try{
   while(true){const {done,value}=await reader.read();if(done)break;
    total+=value.byteLength;if(total>maxBytes){await reader.cancel();throw Error('Response too large')}
    chunks.push(value);
   }
  }finally{reader.releaseLock()}
  bytes=new Uint8Array(total);let i=0;for(const chunk of chunks){bytes.set(chunk,i);i+=chunk.byteLength}
 }else{
  const buffer=await res.arrayBuffer();if(buffer.byteLength>maxBytes)throw Error('Response too large');
  bytes=new Uint8Array(buffer);
 }
 if(!globalThis.crypto?.subtle)throw Error('Secure-origin SHA-256 is required');
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
 if(digest!==hash)throw Error('Source checksum mismatch');
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
// The bounding-box utility is shared by rendering and province search. It never
// assumes that a multi-polygon's first island represents the whole feature.
function featureBounds(geometry){
 const out=[Infinity,Infinity,-Infinity,-Infinity];let points=0;
 function visit(value){
  if(!Array.isArray(value))return;
  if(value.length>=2&&typeof value[0]==='number'&&typeof value[1]==='number'){
   const [lon,lat]=value;
   if(!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lon)>180.01||Math.abs(lat)>90.01)throw Error('Invalid coordinate');
   out[0]=Math.min(out[0],lon);out[1]=Math.min(out[1],lat);
   out[2]=Math.max(out[2],lon);out[3]=Math.max(out[3],lat);
   if(++points>300000)throw Error('Excessive geometry complexity');return;
  }
  for(const inner of value)visit(inner);
 }
 visit(geometry?.coordinates);
 return points?out:null;
}
function overlapsView(box,v){return geo.boundsInView(box,v)}

function dataGroup(layer){if(layer==='cities'||layer==='peaks')return $('world-city-layer');if(layer==='admin1')return $('world-admin1-layer');if(layer==='countries')return $('world-fine-boundary-layer');return $('world-physical-layer')}
function validFeature(f,layer){if(f?.type!=='Feature'||!f.geometry||!f.properties)return false;
 const p=f.properties;
 if(layer==='admin1'&&(p.countryIso3==='IND'||String(p.countryName||'').toLowerCase()==='india'))return false;
 return true;
}
function renderPoints(){const g=$('world-city-layer');g.replaceChildren();const view=bridge()?.view();if(!view)return;
 const scale=1440/view.w;let shown=0;const labelBoxes=[];let labels=0;
 const screenRect=$('world-svg').getBoundingClientRect();
 const screenWidth=Math.max(300,screenRect.width||840),screenHeight=Math.max(150,screenRect.height||420);
 for(const layer of ['cities','peaks']){
  if(!visible.has(layer))continue;
  const obj=available.get(layer);if(!obj)continue;
  const max=(layer==='cities'?(scale<1.8?70:scale<4?240:600):(scale<3?0:160));
  if(!max)continue;
  const items=geo.queryPointIndex(obj._pointIndex||(obj._pointIndex=geo.buildPointIndex(obj.features)),view,max);
  for(const f of items){if(shown>=max)break;
   const co=f.geometry.coordinates;if(!Array.isArray(co)||co.length<2||!Number.isFinite(co[0])||!Number.isFinite(co[1]))continue;
   const x=(co[0]+180)*4,y=(90-co[1])*4;
   if(!geo.pointInView(co,view,4))continue;
   const p=f.properties,marker=svgEl('circle',{cx:x.toFixed(2),cy:y.toFixed(2),r:Math.max(.65,Math.min(3.1,2.1/Math.sqrt(scale))).toFixed(2),class:layer==='cities'?'detail-city':'detail-peak',role:layer==='cities'?'button':'img','aria-label':String(p.name||'Unnamed geographical feature')});
   if(layer==='cities'){
    marker.setAttribute('tabindex','0');const select=()=>{if(p.countryIso3)bridge()?.chooseIso(p.countryIso3,false);bridge()?.focusPoint(co[0],co[1]);$('world-detail-status').textContent=`Selected ${p.name} · Natural Earth source-listed city, not address-level verification.`};
    marker.addEventListener('click',e=>{e.stopPropagation();select()});marker.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select()}});
   }
   const title=svgEl('title',{});title.textContent=p.name||'Unnamed';marker.append(title);g.append(marker);shown++;
   if(layer==='cities'&&scale>=2.2&&labels<32&&p.name){
    // Approximate text rectangles in normalized viewport pixels to avoid severe overlap.
    const actualWidth=screenWidth,actualHeight=screenHeight;
    const pixel=geo.viewportPixel(co,view,actualWidth,actualHeight);if(!pixel)continue;
    const {x:px,y:py}=pixel;
    const text=String(p.name).slice(0,31);
    const width=Math.min(178,text.length*6.5+9);
    const box=[px+7,py-17,px+7+width,py+2];
    const overlaps=labelBoxes.some(b=>!(box[2]+5<b[0]||box[0]>b[2]+5||box[3]+3<b[1]||box[1]>b[3]+3));
    if(!overlaps&&box[0]>=0&&box[2]<actualWidth&&box[1]>0&&box[3]<actualHeight){
     labelBoxes.push(box);labels++;
     const label=svgEl('text',{x:(x+6*view.w/actualWidth).toFixed(2),y:(y-3*view.h/actualHeight).toFixed(2),
        class:'detail-place-label','aria-hidden':'true'});
     // SVG viewBox scales its own CSS lengths: divide to keep type at ~11 screen pixels.
     label.style.fontSize=(11*view.w/actualWidth)+'px';label.style.strokeWidth=(2.4*view.w/actualWidth)+'px';
     label.textContent=text;g.append(label);
    }
   }
  }
 }
}
let lastPaintView=null;
function renderPolygons(){
 lastPaintView=bridge()?.view()||null;
 for(const layer of ['countries','admin1','rivers','lakes']){
  const group=dataGroup(layer);
  // World historical river path is held in this group, and is not discarded when optional rivers are absent.
  if(layer==='rivers')continue;
  if(layer==='lakes')continue;
  group.replaceChildren();
  if(!visible.has(layer)||!available.has(layer))continue;
  const zoom=1440/(bridge()?.view()?.w||1440),country=bridge()?.selectedCountry();
  if(layer==='admin1'&&(!country||zoom<1.8||country.iso3==='IND'))continue;
  if(layer==='countries'&&zoom<1.5)continue;
  const data=available.get(layer);
  const currentView=bridge()?.view();let output=0;
  const indexed=geo.queryBoundsIndex(data._boundsIndex||(data._boundsIndex=geo.buildBoundsIndex(data.features)),
   currentView,500,layer==='admin1'?f=>f.properties.countryIso3===country.iso3:()=>true);
  for(const f of indexed){
   if(layer==='admin1'&&f.properties.countryIso3!==country.iso3)continue;
   if(layer==='countries'&&f.properties.countryIso3==='IND')continue; // always use separate SOI claim geometry
   if(!overlapsView(f._bounds,currentView))continue;
   const d=f._cachedPath||(f._cachedPath=geometryPath(f.geometry));if(!d)continue;
   group.append(svgEl('path',{d,'fill-rule':'evenodd','aria-label':String(f.properties.name||'Geographic boundary')}));
   if(++output>=500)break;
  }
 }
 const g=$('world-physical-layer');
 // Optional lakes/rivers are separate subgroups, so switching layers never removes the historical river layer.
 for(const layer of ['lakes','rivers']){
  const id='world-'+layer+'-enhanced',old=$(id)||svgEl('g',{id});if(!old.parentNode)g.append(old);
  old.replaceChildren();if(!visible.has(layer)||!available.has(layer))continue;
  const data=available.get(layer),limit=layer==='lakes'?650:1800;
  const features=geo.queryBoundsIndex(data._boundsIndex||(data._boundsIndex=geo.buildBoundsIndex(data.features)),bridge()?.view(),limit);
  const d=geo.visibleFeaturePaths(features,bridge()?.view(),limit,geometryPath).join(' ');
  if(d)old.append(svgEl('path',{d,stroke:layer==='lakes'?'#6ea9b8':'#65a4b0','stroke-width':layer==='lakes'?'.85':'.9','fill':'none','vector-effect':'non-scaling-stroke'}));
 }
}
let scheduled=false;
function repaint(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;renderPolygons();renderPoints();lastPointPaintView=bridge()?.view()||null;});}
function setToggle(layer,on){const button=$(sections[layer]);if(!button||button.disabled)return;on?visible.add(layer):visible.delete(layer);button.setAttribute('aria-pressed',String(on));
 if(layer==='rivers'){$('world-historical-rivers').style.display=on?'':'none'}
 repaint();}
for(const [layer,id] of Object.entries(sections)){$(id).addEventListener('click',()=>setToggle(layer,!visible.has(layer)))}
// Search installed, source-labelled cities, provinces, peaks and waterways.
// The value is supplied by the active input: hidden desktop/mobile fields cannot
// silently override the user's latest query.
const SEARCHABLE=['cities','admin1','peaks','rivers','lakes'];
function focusSourceFeature(layer,f){
 const props=f.properties||{},country=props.countryIso3;
 if(country&&['cities','admin1','peaks'].includes(layer))bridge()?.chooseIso(country,false);
 if(layer==='admin1'){
  visible.add(layer);$(sections[layer]).setAttribute('aria-pressed','true');
 }
 if(f.geometry.type==='Point'){
  const co=f.geometry.coordinates;bridge()?.focusPoint(co[0],co[1]);
 }else if(f._bounds && f._bounds[2]-f._bounds[0]<180){
  bridge()?.focusBounds(f._bounds);
 }
 if(layer!=='cities'){
  const toggle=$(sections[layer]);if(toggle&&!toggle.disabled){visible.add(layer);toggle.setAttribute('aria-pressed','true');}
 }
 repaint();
 showFeatureInspector(layer,f);
 if(f.geometry?.type==='Point'){const [lon,lat]=f.geometry.coordinates;$('coordinate-status').textContent=String(props.name||'Feature')+' · '+lat.toFixed(3)+'° latitude · '+lon.toFixed(3)+'° longitude'}
 $('world-detail-status').textContent='Focused '+String(props.name||'source feature')+' · '+layer+' · generalized Natural Earth reference, not a certified political or navigation boundary.';
}
const placeSearch=window.BharatWorldPlaceSearch;
if(!placeSearch)throw Error('World place-search module must load first');
function matchFeature(query){return placeSearch.matches(available,query,10)}
function showFeatureInspector(layer,f){
 const root=$('world-feature-inspector');if(!root)return;
 const p=f.properties||{},label=String(p.name||'Unnamed feature').slice(0,150),box=f._bounds;
 root.replaceChildren();root.hidden=false;
 const over=document.createElement('span');over.className='overline';over.textContent='SOURCE-LABELLED GEOGRAPHIC FEATURE';
 const h=document.createElement('h3');h.textContent=label;
 const meta=document.createElement('div');meta.className='feature-meta';
 const facts=[['TYPE',({'admin1':'State / province','peaks':'Elevation reference point','cities':'Populated place','rivers':'River / watercourse','lakes':'Lake','countries':'Country'})[layer]||layer],
  ['COUNTRY',p.countryName||p.countryIso3||'Not assigned']];
 if(f.geometry?.type==='Point'){
  const co=f.geometry.coordinates;
  facts.push(['COORDINATES',co[1].toFixed(3)+'° latitude, '+co[0].toFixed(3)+'° longitude']);
 }else if(box)facts.push(['EXTENT',box.map(v=>v.toFixed(2)+'°').join(' · ')]);
 for(const [key,val] of facts){const item=document.createElement('span');item.textContent=key+': '+String(val);meta.append(item)}
 const note=document.createElement('p');note.textContent='Natural Earth reference geography, if installed. Generalized data for learning, not navigation, boundary adjudication or administrative certification.';
 root.append(over,h,meta,note);
}
const unified=window.BharatWorldExploreSearch;
let renderedCandidates=[],searchCatalog=null,catalogGeneration=-1,sourceGeneration=0,catalogCapitals=-1,catalogCountries=-1;
function searchCandidates(query){
 const b=bridge();
 if(unified&&b?.countries){
  const countries=b.countries(),capitals=b.capitalCount?.()||0;
  if(!searchCatalog||catalogGeneration!==sourceGeneration||catalogCapitals!==capitals||catalogCountries!==countries.length){
   searchCatalog=unified.createCatalog(countries,b.capitalForCountry,available);
   catalogGeneration=sourceGeneration;catalogCapitals=capitals;catalogCountries=countries.length;
  }
  return searchCatalog.search(query,12);
 }
 return matchFeature(query).map(x=>({type:x.layer,name:x.name,country:x.country,ref:x.f,countryIso3:x.f.properties?.countryIso3||''}));
}
function actOnCandidate(item){
 if(item.type==='country'){
  if(item.ref?.id)bridge()?.chooseCountryId(item.ref.id,true);
  else if(item.countryIso3)bridge()?.chooseIso(item.countryIso3,true);
 }else if(item.type==='capital'){
  if(item.ref?.id)bridge()?.chooseCountryId(item.ref.id,false);
  bridge()?.focusPoint(item.lon,item.lat);
  $('coordinate-status').textContent=item.name+' · historical capital reference';
 }else{
  focusSourceFeature(item.type,item.ref);showFeatureInspector(item.type,item.ref);
 }
 $('country-search').value=item.name;$('mobile-country-search').value=item.name;
 for(const id of ['world-source-results-desktop','world-source-results-mobile'])$(id).replaceChildren();
}
function showSourceMatches(id,query){
 const target=$(id);target.replaceChildren();renderedCandidates=searchCandidates(query);
 for(let idx=0;idx<renderedCandidates.length;idx++){
  const item=renderedCandidates[idx],button=document.createElement('button');button.type='button';
  button.setAttribute('role','option');button.setAttribute('aria-selected','false');
  const detail=item.type==='country'?'Country':item.type==='capital'?'Reference capital':({'admin1':'State / province','cities':'City','peaks':'Mountain point','rivers':'Watercourse','lakes':'Lake'})[item.type]||item.type;
  button.textContent=item.name+' · '+detail+(item.country?' · '+item.country:'');
  button.setAttribute('aria-label','View '+item.name+' · '+detail+(item.country?' · '+item.country:''));
  button.addEventListener('click',()=>actOnCandidate(item));target.append(button);
 }
}
let searchTimer=null;
for(const [id,resultId,otherId] of [
 ['country-search','world-source-results-desktop','world-source-results-mobile'],
 ['mobile-country-search','world-source-results-mobile','world-source-results-desktop']
]){
 const inp=$(id),target=$(resultId);
 inp.addEventListener('input',e=>{
  clearTimeout(searchTimer);$(otherId).replaceChildren();
  const query=e.target.value;
  if(query.trim().length<2){target.replaceChildren();renderedCandidates=[];return}
  searchTimer=setTimeout(()=>showSourceMatches(resultId,query),90);
 });
 // Capturing intercept is deliberate: it runs before the older country-only Enter handler.
 inp.addEventListener('keydown',e=>{
  if(e.key==='Escape'){clearTimeout(searchTimer);target.replaceChildren();renderedCandidates=[];return}
  if(!['ArrowDown','ArrowUp','Enter'].includes(e.key))return;
  const buttons=Array.from(target.querySelectorAll('button'));
  if(!buttons.length)return;
  const current=buttons.findIndex(b=>b.getAttribute('aria-selected')==='true');
  if(e.key==='Enter'){
   const index=current<0?0:current;
   if(renderedCandidates[index]){e.preventDefault();e.stopImmediatePropagation();actOnCandidate(renderedCandidates[index])}
  }else{
   const next=e.key==='ArrowDown'?(current+1)%buttons.length:(current<=0?buttons.length-1:current-1);
   buttons.forEach((b,i)=>b.setAttribute('aria-selected',String(i===next)));
   buttons[next].scrollIntoView({block:'nearest'});
   e.preventDefault();e.stopImmediatePropagation();
  }
 },true);
}
window.BharatWorldDetail={
 focusMatchingCity(query){
  const match=matchFeature(query)[0];if(!match)return false;
  focusSourceFeature(match.layer,match.f);return true;
 },
 // Read-only client-side research index; no invented dataset coverage.
 installedCounts(){return Object.fromEntries([...available.entries()].filter(([layer])=>SEARCHABLE.includes(layer)).map(([layer,data])=>[layer,data.features.length]));}
};
window.addEventListener('bharat-world-country',repaint);
let cameraFrame=null,lastPolygonBucket=-1,lastPointPaintView=null;
window.addEventListener('bharat-world-camera',()=>{
 if(cameraFrame!==null)return;
 cameraFrame=requestAnimationFrame(()=>{
  cameraFrame=null;
  const current=bridge()?.view();
  const pointUpdate=!lastPointPaintView||!current||
   Math.abs(current.w-lastPointPaintView.w)>lastPointPaintView.w*.09||
   Math.abs(current.x-lastPointPaintView.x)>lastPointPaintView.w*.07||
   Math.abs(current.y-lastPointPaintView.y)>lastPointPaintView.w*.05;
  if(pointUpdate){renderPoints();lastPointPaintView=current}
  const zoom=1440/(current?.w||1440);
  const bucket=zoom>=1.8?2:zoom>=1.5?1:0;
  // Cull detailed polygons and rivers against the moving viewport. Throttle to
  // one frame so camera animation cannot start multiple expensive draws.
  const v=bridge()?.view();
  const shouldUpdate=bucket!==lastPolygonBucket||!lastPaintView||!v||
   Math.abs(v.w-lastPaintView.w)>lastPaintView.w*.15||
   Math.abs(v.x-lastPaintView.x)>lastPaintView.w*.10||
   Math.abs(v.y-lastPaintView.y)>lastPaintView.w*.05;
  if(shouldUpdate){lastPolygonBucket=bucket;renderPolygons();}
 });
});
// A visitor-facing inventory: it reports installed features, not theoretical dataset capability.
function refreshCoverage(){
 const grid=$('world-coverage-grid');if(!grid)return;
 grid.replaceChildren();
 const descriptions=[
  ['Countries','countries','Imported country detail (separate from world overview)'],
  ['States & provinces','admin1','Only non-India generalized admin-1 polygons'],
  ['Cities','cities','Selected cities; not a worldwide address gazetteer'],
  ['Named rivers','rivers','Imported Natural Earth watercourse lines'],
  ['Lakes','lakes','Imported Natural Earth inland-water polygons'],
  ['Mountains','peaks','Source-listed elevation points']
 ];
 for(const [label,key,description] of descriptions){
  const count=available.get(key)?.features?.length||0;
  const card=document.createElement('div');card.className='source-coverage-card';
  const strong=document.createElement('strong');strong.textContent=label;
  const value=document.createElement('span');value.textContent=count?count.toLocaleString()+' source features':'Not installed';
  value.className=count?'coverage-available':'coverage-missing';
  const note=document.createElement('small');note.textContent=description;
  card.append(strong,value,note);grid.append(card);
 }
}
refreshCoverage();
async function loadHydrography(){
 try{
  const metaResp=await fetch('./data/world/hydrography-manifest.json',{cache:'no-store'});if(!metaResp.ok)throw Error('World hydrography manifest unavailable');
  const m=await metaResp.json();if(m.schema!=='bharat-world-hydrography-manifest-v1'||m.licence!=='LGPL-3.0-or-later'||m.named!==false||m.current!==false||m.bytes>2000000||!/^[a-f0-9]{64}$/.test(m.sha256||''))throw Error('Historical hydrography manifest rejected');
  const v=await checkedRead('./data/world/world-hydrography.json',m.sha256,2000000);
  if(v.schema!=='bharat-world-historical-hydrography-v1'||v.current!==false||v.named!==false||v.lines!==m.worldLines||v.svgPath.length>1900000)throw Error('Historical hydrography invalid');
  const historic=svgEl('path',{id:'world-historical-rivers',d:v.svgPath,'aria-label':'Historical unlabelled world waterways, GSHHG/WDBII'});
  $('world-physical-layer').append(historic);$('world-waterways-toggle').disabled=false;
  available.set('historical-rivers',v);
  $('world-detail-status').textContent=`${v.lines.toLocaleString()} historical unlabelled world watercourse segments available. Modern named rivers and administrative detail need additional Natural Earth inputs.`;
 }catch(e){$('world-detail-status').textContent='Historical world waterways unavailable: '+e.message+'. Countries remain accessible.';}
}
async function loadHistoricalPhysical(){
 try{
  const mr=await fetch('./data/world/shoreline-manifest.json',{cache:'no-store'});
  if(mr.status===404)return;
  if(!mr.ok)throw Error('Physical shoreline manifest HTTP '+mr.status);
  const meta=await mr.json();
  if(meta.schema!=='bharat-world-shoreline-manifest-v1'||meta.licence!=='LGPL-3.0-or-later'||
     meta.current!==false||meta.politicalAuthority!==false||meta.bytes>3000000||
     !/^[a-f0-9]{64}$/.test(meta.sha256||''))throw Error('Physical shoreline source rejected');
  const geo=await checkedRead('./data/world/world-shorelines.json',meta.sha256,3000000);
  if(geo.schema!=='bharat-world-historical-shorelines-v1'||geo.current!==false||
     geo.politicalAuthority!==false||geo.licence!=='LGPL-3.0-or-later'||
     geo.coastSegments!==meta.coastSegments||geo.inlandWaterParts!==meta.inlandWaterParts||
     typeof geo.coastPath!=='string'||typeof geo.lakePath!=='string'||
     geo.coastPath.length+geo.lakePath.length>2900000)throw Error('Physical shoreline geometry rejected');
  const group=$('world-physical-layer');
  const shore=svgEl('path',{id:'world-coastlines',d:geo.coastPath,
    'aria-label':'Generalized historical coastlines, not country borders'});
  const lake=svgEl('path',{id:'world-inland-water',d:geo.lakePath,
    'aria-label':'Generalized historical inland water polygons'});
  group.prepend(lake,shore);
  for(const [id,shape] of [['world-coastline-toggle',shore],['world-inland-water-toggle',lake]]){
   const button=$(id);button.disabled=false;
   button.addEventListener('click',()=>{
    const on=button.getAttribute('aria-pressed')!=='true';
    button.setAttribute('aria-pressed',String(on));shape.style.display=on?'':'none';
   });
  }
  available.set('historical-shorelines',geo);
  $('world-physical-provenance').textContent=`${geo.coastSegments.toLocaleString()} generalized shore segments and ${geo.inlandWaterParts.toLocaleString()} inland water shapes · historical GSHHG/WDBII 2.3.6 · LGPL-3.0-or-later · not legal borders or current hydrography.`;
 }catch(err){$('world-detail-status').textContent+=' Physical shorelines unavailable: '+err.message+'.';}
}
async function loadDetailPack(){
 const mResp=await fetch('./data/world-detail/manifest.json',{cache:'no-store'});
 if(mResp.status===404)return; if(!mResp.ok)throw Error('Detail manifest HTTP '+mResp.status);
 const manifest=await mResp.json();
 if(manifest.schema!=='bharat-world-detail-manifest-v1'||manifest.publisher!=='Natural Earth'||manifest.licence!=='Public domain'||manifest.approvedForBundle!==true||manifest.officialPoliticalAuthority!==false||manifest.indiaAdministrativePolygonsCertified!==false)throw Error('Geography-source review failed');
 let installed=[];
 for(const [layer,m] of Object.entries(manifest.layers||{})){
  if(!sections[layer]||!m||!Number.isSafeInteger(m.count)||m.count<1||m.count>20000||!Number.isSafeInteger(m.bytes)||m.bytes>12000000||!/^[a-f0-9]{64}$/.test(m.sha256||'')||m.licence!=='Public domain'||!m.sourceUrl?.startsWith('https://'))throw Error('Invalid declared layer '+layer);
  const data=await checkedRead('./data/world-detail/'+layer+'.geojson',m.sha256,Math.min(12000000,m.bytes+1));
  if(data.type!=='FeatureCollection'||!Array.isArray(data.features)||data.features.length!==m.count||!data.features.every(f=>validFeature(f,layer)))throw Error('Unverified geometry '+layer);
  // Validate real coordinate values and bounds before making a source layer available.
  for(const f of data.features){f._bounds=featureBounds(f.geometry);if(!f._bounds)throw Error('Empty geographic feature in '+layer)}
  available.set(layer,data);sourceGeneration++;$(sections[layer]).disabled=false;refreshCoverage();
  installed.push(layer+': '+data.features.length.toLocaleString());
 }
 if(installed.length){$('world-detail-status').textContent='Installed public-domain Natural Earth detail: '+installed.join(' · ')+'. Admin-1 is a generalized/de-facto reference, not official boundary certification.';repaint();}
}
(async()=>{await loadHydrography();await loadHistoricalPhysical();try{await loadDetailPack()}catch(err){$('world-detail-status').textContent+=' Higher-detail pack rejected: '+err.message;}})();
})();
