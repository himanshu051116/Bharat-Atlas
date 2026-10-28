/* Source-labelled Atlas Toolkit: all user data is session-local, except opt-in
 * browser-local bookmarks. No network requests or telemetry are made here. */
export function atlasInitToolkit({getApp,notify,save,goToCoordinate,goToRegion,applyStyle}){
 const node=id=>document.getElementById(id);
 const state={mode:'distance',active:false,points:[],overlay:null,bookmarks:[],pendingView:atlasParseViewParams(window.location.search),restored:false,styleRestored:false,route:null};
 try{state.bookmarks=atlasCleanBookmarks(JSON.parse(localStorage.getItem('bharat-atlas:bookmarks:1')||'[]'));}catch(_){state.bookmarks=[];}
 const status=node('toolkit-status');
 const say=message=>{status.textContent=message;};
 function persist(){try{localStorage.setItem('bharat-atlas:bookmarks:1',JSON.stringify(state.bookmarks));return true;}catch(_){return false;}}
 function coordLine(p){return `${p[0].toFixed(5)}°E, ${p[1].toFixed(5)}°N`;}
 function updateMeasure(){
  const value=atlasMeasurePath(state.points,state.mode);
  node('measure-points').textContent=state.points.length?state.points.map((p,i)=>`${i+1}. ${coordLine(p)}`).join('  ·  '):'No points yet. Click the GPU map or enter longitude, latitude.';
  const enough=state.mode==='distance'?value.pointCount>=2:value.pointCount>=3;
  node('measure-value').textContent=!enough?state.mode==='distance'?'Add at least 2 points for distance':'Add at least 3 points for area':
    state.mode==='area'?`Approx. ${value.km2.toLocaleString(undefined,{maximumFractionDigits:2})} km² · perimeter ${value.km.toFixed(2)} km`:`Approx. ${value.km.toFixed(2)} km direct-line distance`;
  node('measure-mode').textContent=state.active?'Click-to-add active · map clicks record coordinates':'Click-to-add off · manual input available';
  node('measure-mode-toggle').textContent=state.active?'Stop map measuring':'Start map measuring';
  node('measure-mode-toggle').setAttribute('aria-pressed',String(state.active));
  node('measure-download').disabled=!enough;
  draw();
 }
 function atlasDrawFallback(){
  const svg=document.querySelector('#map-overlay svg.fallback-map-svg');if(!svg)return;
  svg.querySelector('#atlas-fallback-measure')?.remove();
  const attr=svg.getAttribute('data-atlas-projection');if(!attr)return;
  const v=attr.split(',').map(Number);if(v.length!==6||v.some(n=>!Number.isFinite(n)))return;
  const [west,north,x0,y0,sx,sy]=v;
  const coords=state.points.map(p=>[x0+(p[0]-west)*sx,y0+(north-p[1])*sy]);
  const ns='http://www.w3.org/2000/svg',group=document.createElementNS(ns,'g');
  group.id='atlas-fallback-measure';group.setAttribute('pointer-events','none');
  if(coords.length>=2){
    const line=document.createElementNS(ns,coords.length>=3&&state.mode==='area'?'polygon':'polyline');
    line.setAttribute('points',coords.map(p=>p.join(',')).join(' '));line.setAttribute('stroke','#ba6625');line.setAttribute('stroke-width','5');
    line.setAttribute('fill',coords.length>=3&&state.mode==='area'?'#edb65544':'none');
    group.append(line);
  }
  for(const p of coords){const dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',p[0]);dot.setAttribute('cy',p[1]);dot.setAttribute('r','7');dot.setAttribute('stroke','#fff');dot.setAttribute('stroke-width','2');dot.setAttribute('fill','#b9672d');group.append(dot)}
  // Offline accessible research overlay drawing (bounded for SVG performance).
  // No source is silently presented as official geography.
  const research=state.overlay?.collection?.features||[];
  let drawnPoints=0;
  for(const feature of research.slice(0,1000)){
   if(drawnPoints>12000)break;
   const kind=feature.properties?.kind;
   const colour=kind==='waterway'?'#2389b0':kind==='railway'?'#775f8e':kind==='road'?'#ce9657':'#775f8e';
   if(feature.geometry.type==='Point'){
    const p=feature.geometry.coordinates,dot=document.createElementNS(ns,'circle');
    dot.setAttribute('cx',x0+(p[0]-west)*sx);dot.setAttribute('cy',y0+(north-p[1])*sy);
    dot.setAttribute('r','4');dot.setAttribute('fill',colour);dot.setAttribute('stroke','white');dot.setAttribute('stroke-width','1.2');group.append(dot);drawnPoints++;continue;
   }
   const lines=feature.geometry.type==='LineString'?[feature.geometry.coordinates]:feature.geometry.coordinates;
   for(const line of lines){
    if(drawnPoints+line.length>12000)break;
    const path=document.createElementNS(ns,'polyline');
    path.setAttribute('points',line.map(p=>[x0+(p[0]-west)*sx,y0+(north-p[1])*sy].join(',')).join(' '));
    path.setAttribute('stroke',colour);path.setAttribute('stroke-width','2.4');path.setAttribute('stroke-opacity','.86');path.setAttribute('fill','none');group.append(path);drawnPoints+=line.length;
   }
  }
  const route=state.route?.geometry?.features?.[0]?.geometry?.coordinates;
  if(route?.length){
   const path=document.createElementNS(ns,'polyline');
   path.setAttribute('points',route.map(p=>[x0+(p[0]-west)*sx,y0+(north-p[1])*sy].join(',')).join(' '));
   path.setAttribute('fill','none');path.setAttribute('stroke','#1c7cc3');path.setAttribute('stroke-width','5');path.setAttribute('stroke-linejoin','round');group.append(path);
  }
  svg.append(group);
 }
 function draw(){
  atlasDrawFallback();
  const map=getApp().map;
  if(!map||!getApp().ready)return;
  try{map.getSource('atlas-measure')?.setData(atlasMeasurementGeoJSON(state.points,state.mode));
    map.getSource('atlas-user-overlay')?.setData(state.overlay?.collection||{type:'FeatureCollection',features:[]});
    map.getSource('atlas-route')?.setData(state.route?.geometry||{type:'FeatureCollection',features:[]});
  }catch(e){console.warn('Toolkit layer update failed:',String(e.message));}
 }
 function addPoint(pair){
  if(!atlasValidCoordinate(pair)){say('Coordinates must be within 60–102°E and 3–41°N');return;}
  if(state.points.length>=80){say('Measurement limit: 80 points');return;}
  state.points.push(pair);updateMeasure();
 }
 function renderBookmarks(){
  const list=node('saved-places');list.replaceChildren();
  if(!state.bookmarks.length){list.textContent='Nothing saved yet. Select a city/coordinate to save it locally.';return;}
  state.bookmarks.forEach((b,index)=>{
   const row=document.createElement('div');row.className='tool-saved-row';
   const open=document.createElement('button');open.type='button';open.textContent=`${b.name} · ${b.lat.toFixed(3)}°N`;
   open.addEventListener('click',()=>goToCoordinate({name:b.name,lon:b.lon,lat:b.lat}));
   const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.setAttribute('aria-label',`Remove ${b.name}`);
   remove.addEventListener('click',()=>{state.bookmarks.splice(index,1);persist();renderBookmarks()});
   row.append(open,remove);list.append(row);
  });
 }
 function renderCoverage(){
  const app=getApp(),catalog=app.tileCatalog, list=node('coverage-facts');list.replaceChildren();
  const readiness=atlasReadiness(app);
  const data=[
   ['Boundary status',app.features?`${app.features.features.length} community/import polygons · NOT OFFICIAL`:'No state/UT polygons available; physical-only map'],
   ['Historic physical source',app.landcover?'GSHHG land/water loaded':'Not loaded'],
   ['Settlement search',`${app.gazetteerPlaces.length} source-labelled selected place points · not an address geocoder`],
   ['Static vector tiles',catalog?`${catalog.tileCount} sparse zoom 3–8 tiles · ${catalog.layers.join(', ')}`:'Not loaded'],
   ['Modern transport research tiles',app.transportCatalog?`${app.transportCatalog.tileCount} research tiles (${app.transportCatalog.layers.join(', ')}) · not certified`:'No locally reviewed transport pack installed'],
   ['National road routing','Unavailable · no certified routable road network'],
   ['Current rail/water names','Unavailable · source acquisition pending'],
   ['2026 political boundaries','Not independently verified against Survey of India'],
   ['Transport import',state.overlay?`${state.overlay.collection.features.length} session-local features · NOT certified`:'No user research overlay loaded']
  ];
  for(const [label,value] of data){const row=document.createElement('div');row.className='tool-coverage-row';const strong=document.createElement('strong');strong.textContent=label;const span=document.createElement('span');span.textContent=value;row.append(strong,span);list.append(row);}
  const title=document.createElement('h4');title.className='atlas-readiness-title';title.textContent='End-to-end delivery readiness';list.append(title);
  for(const item of readiness.items){
    const box=document.createElement('div');box.className='atlas-readiness-item';
    const top=document.createElement('div');top.className='atlas-readiness-top';
    const heading=document.createElement('strong');heading.textContent=item.title;
    const tag=document.createElement('span');tag.className='atlas-readiness-tag '+item.state;tag.textContent=item.state==='research_available'?'RESEARCH ONLY':item.state==='blocked'?'BLOCKED':'MISSING';
    top.append(heading,tag);
    const detail=document.createElement('p');detail.textContent=item.reason;
    const next=document.createElement('small');next.textContent='Next: '+item.next;
    box.append(top,detail,next);list.append(box);
  }
  for(const [label,inventory] of [['Historical physical tiles',readiness.coverageZoom],['Optional transport tiles',readiness.transportZoom]]){
    if(!inventory.length)continue;
    const row=document.createElement('p');row.className='atlas-zoom-inventory';
    row.textContent=`${label}: `+inventory.map(x=>`z${x.zoom}: ${x.occupiedTiles}`).join(' · ')+' occupied XYZ cells (not full coverage)';list.append(row);
  }

 }
 function applySavedView(){
   const app=getApp(),wanted=state.pendingView;
   if(!state.styleRestored&&wanted.style){
     if(wanted.style!=='physical'||app.landcover){
       state.styleRestored=true;
       if(app.style!==wanted.style)applyStyle(wanted.style);
     }
   }
   if(state.restored)return;
   if(wanted.coordinate){
     state.restored=true;
     goToCoordinate({name:'Shared research coordinates',lon:wanted.coordinate[0],lat:wanted.coordinate[1]});
   }else if(wanted.region&&app.features){
     const f=app.features.features.find(v=>v.properties.name===wanted.region);
     if(f){state.restored=true;goToRegion(wanted.region);}
   }else if(!wanted.region){state.restored=true;}
 }
 function showTab(tab){
   for(const button of document.querySelectorAll('[data-tool-tab]')){
    const selected=button.dataset.toolTab===tab;button.classList.toggle('active',selected);button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
   }
   for(const section of document.querySelectorAll('[data-tool-panel]'))section.hidden=section.dataset.toolPanel!==tab;
 }
 node('measure-mode-toggle').addEventListener('click',()=>{state.active=!state.active;updateMeasure();if(state.active)notify('Click the interactive WebGL map to add measurement points, or use manual coordinates below.');});
 node('measure-type').addEventListener('change',e=>{state.mode=e.target.value==='area'?'area':'distance';updateMeasure()});
 node('measure-point-add').addEventListener('click',()=>{try{addPoint(atlasParseCoordinateInput(node('measure-point-input').value));node('measure-point-input').value='';}catch(e){say(e.message)}});
 node('measure-point-input').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();node('measure-point-add').click()}});
 node('measure-undo').addEventListener('click',()=>{state.points.pop();updateMeasure()});
 node('measure-clear').addEventListener('click',()=>{state.active=false;state.points=[];updateMeasure()});
 node('measure-download').addEventListener('click',()=>{const measurement=atlasMeasurePath(state.points,state.mode);save(new Blob([JSON.stringify({type:'ResearchMeasurement',measurement,geometry:atlasMeasurementGeoJSON(state.points,state.mode),disclaimer:'Approximate; not navigation, official survey or legal boundary evidence'},null,2)],{type:'application/json'}),'bharat-atlas-measurement.json')});
 node('save-place').addEventListener('click',()=>{
  const app=getApp(),p=app.selectedCoordinate||app.selectedPlace;
  if(!p){say('Choose a source-backed city or enter coordinates in search before bookmarking.');showTab('saved');return;}
  try{const bookmark=atlasMakeBookmark({name:p.name,lon:p.lon,lat:p.lat,kind:p.source==='gazetteer'?'city':'coordinate'});
   state.bookmarks=atlasCleanBookmarks([bookmark,...state.bookmarks]);const ok=persist();renderBookmarks();showTab('saved');say(ok?'Saved only in this browser.':'Saved for this session only; browser storage unavailable.');}
  catch(e){say(e.message)}
 });
 node('saved-export').addEventListener('click',()=>save(new Blob([JSON.stringify({format:'BharatAtlasBookmarks1',entries:state.bookmarks,coordinatesWGS84:true},null,2)],{type:'application/json'}),'bharat-atlas-saved-places.json'));
 node('saved-clear').addEventListener('click',()=>{state.bookmarks=[];persist();renderBookmarks();say('Browser-local bookmarks cleared.');});
 node('copy-research-link').addEventListener('click',async()=>{
  const app=getApp();const p=app.selectedCoordinate||app.selectedPlace;
  const url=atlasViewURL(window.location.href,{style:app.style,region:app.source?.kind==='import'?undefined:app.selected,coordinate:p?[p.lon,p.lat]:undefined});
  try{await navigator.clipboard.writeText(url);say('Research view URL copied. It contains a location only, never imported source data.');}
  catch(_){node('share-url-output').value=url;node('share-url-output').hidden=false;node('share-url-output').select();say('Select and copy the research URL shown below.');}
 });
 node('coverage-report-download').addEventListener('click',()=>{
  const report=atlasReadiness(getApp());
  save(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),'bharat-atlas-local-readiness.json');
  say('Downloaded data-readiness report. Review it before sharing; no telemetry was sent.');
 });
 node('research-overlay-import').addEventListener('click',()=>node('research-overlay-file').click());
 node('research-overlay-file').addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';if(!file)return;
  try{
   if(file.size>6*1024*1024)throw Error('Overlay limited to 6 MB. Use the offline GIS import pipeline for larger files.');
   const sourceUrl=node('overlay-source-url').value,licence=node('overlay-licence').value,attribution=node('overlay-attribution').value;
   const parsed=atlasValidateResearchOverlay(JSON.parse(await file.text()),{title:file.name,sourceUrl,licence,attribution});
   state.overlay=parsed;state.route=null;node('route-value').textContent='No route calculated yet.';draw();renderCoverage();node('research-overlay-summary').textContent=`Loaded in browser memory: ${parsed.collection.features.length} features (${Object.entries(parsed.counts).map(([k,v])=>`${v} ${k}`).join(', ')}). NOT authoritative, certified or automatically redistributable. SVG fallback is limited to 1,000 features / 12,000 vertices for responsiveness.`;
   say('Overlay loaded for this browser session. No upload to a server.');
  }catch(error){say('Overlay rejected: '+error.message)}
 });
 node('research-overlay-clear').addEventListener('click',()=>{state.overlay=null;state.route=null;node('route-value').textContent='No route calculated yet.';draw();renderCoverage();node('research-overlay-summary').textContent='No local data overlay loaded.';say('Session-only overlay cleared.')});
 node('route-calculate').addEventListener('click',()=>{
  try{
   if(!state.overlay)throw Error('Import a source-labelled road GeoJSON overlay first');
   const start=atlasParseCoordinateInput(node('route-start').value),end=atlasParseCoordinateInput(node('route-end').value);
   const graph=atlasRoadGraph(state.overlay.collection);
   const result=atlasResearchRoute(graph,start,end);
   state.route=result;draw();
   node('route-value').textContent=`Research graph path: ${result.km.toFixed(2)} km along supplied road vertices. Start/end vertex offsets ${result.snapStartKm.toFixed(2)} km / ${result.snapEndKm.toFixed(2)} km. NOT certified for travel.`;
   say('Local source-derived research route calculated. No road-safety or legal verification.');
  }catch(error){state.route=null;draw();node('route-value').textContent=error.message;say('Route unavailable: '+error.message);}
 });
 node('route-export').addEventListener('click',()=>{
  if(!state.route){say('Calculate a research route before exporting.');return;}
  save(new Blob([JSON.stringify({type:'BharatAtlasResearchRoute1',...state.route},null,2)],{type:'application/json'}),'bharat-atlas-research-route.json');
 });
 node('research-overlay-export').addEventListener('click',()=>{if(!state.overlay){say('Import a research overlay first.');return;}
  save(new Blob([JSON.stringify({type:'BharatAtlasResearchOverlay1',...state.overlay},null,2)],{type:'application/json'}),'bharat-atlas-research-overlay.json');});
 for(const button of document.querySelectorAll('[data-tool-tab]'))button.addEventListener('click',()=>showTab(button.dataset.toolTab));
 showTab('measure');updateMeasure();renderBookmarks();renderCoverage();
 return {
  measureEnabled:()=>state.active,
  addPoint,
  mapReady:()=>{draw();applySavedView();renderCoverage()},
  dataUpdated:()=>{renderCoverage();applySavedView()},
  overlay:()=>state.overlay,
  fallbackReady:()=>atlasDrawFallback(),
  measurement:()=>atlasMeasurementGeoJSON(state.points,state.mode),
  activeBookmarkCount:()=>state.bookmarks.length
 };
}
