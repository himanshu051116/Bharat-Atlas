import {STATES,UTS,CHECKPOINTS,validateCollection,validateUserImport,inspectCollection,allBounds,featureBounds,labelCollection} from './geography.mjs';
import {mapStyle} from './style.mjs';
import {loadCommunity,importedSource} from './data.mjs';
import {PILOT_PLACES,PILOT_PROVENANCE,pilotFeatureCollection} from './places.mjs';
import {searchAtlas,normalizeQuery} from './search.mjs';
import {ATLAS_REGIONS,atlasRegionCatalogueSearch,atlasCatalogueSummary} from './region-catalog.mjs';
import {createAtlasShardSearch} from './search-shards.mjs';
import {parseAtlasCoordinates} from './coordinates.mjs';
import {loadTileManifest,registerSparseTileProtocol} from './tiles.mjs';
import {renderResearchSVG,exportFileName} from './export.mjs';
import {loadGazetteer,gazetteerFeatures} from './gazetteer.mjs';
import {loadHydrology} from './hydrology.mjs';
import {loadShorelines} from './shorelines.mjs';
import {loadLandcover} from './landcover.mjs';
import {renderPhysicalOnlySVG,PHYSICAL_ONLY_FILENAME} from './physical-only.mjs';
import {canRetryRenderer,createRendererDiagnosticRecord} from './renderer-health.mjs';
import {atlasParseViewParams} from './explorer-tools.mjs';
import {atlasInitToolkit} from './explorer-ui.mjs';
import {atlasInitComparison} from './compare-ui.mjs';
import {atlasLoadTransportPack,atlasRegisterTransportPack} from './transport-pack.mjs';
import {atlasMotionDuration,atlasJourneyStops,atlasZoomNarrative,atlasReducedMotion,atlasFallbackTarget} from './motion.mjs';
import {atlasNearbyPlaces,atlasMercatorScale,atlasScaleFromMetersPerPixel,atlasJourneyTrail} from './detail-math.mjs';
import {atlasInspectResearchTile,atlasTileZoomInventory} from './coverage-inspector.mjs';
const $=id=>document.getElementById(id);
let atlasToolkit=null;
let atlasComparison=null;
let fallbackObjectUrl=null;
let fallbackZoom=1;
let fallbackPan={x:0,y:0};
let fallbackPointer=null;
const fallbackPointers=new Map();
const motionPreference=window.matchMedia?.('(prefers-reduced-motion: reduce)')||{matches:false};
const atlasMotionOff=()=>atlasReducedMotion(motionPreference);
const journey={stops:[],index:-1,playing:false,timeout:null};
function journeyCancelClock(){if(journey.timeout!==null)clearTimeout(journey.timeout);journey.timeout=null;}
function journeyPause(){journeyCancelClock();journey.playing=false;journeySync();}
function journeySync(){
  const count=journey.stops.length,position=journey.index;
  const unavailable=app.source?.kind==='import';
  $('journey-play').disabled=!count||unavailable;
  $('journey-prev').disabled=!count||unavailable||position<=0;
  $('journey-next').disabled=!count||unavailable||position>=count-1;
  $('journey-play').textContent=journey.playing?'Pause journey':position>=count-1&&count?'Replay journey':'Play journey';
  $('journey-progress').textContent=count?`${Math.max(0,position+1)} / ${count} SOURCE PLACES`:'WAITING FOR SOURCE-VERIFIED PLACE DATA';
  $('journey-location').textContent=position>=0&&journey.stops[position]?journey.stops[position].name:'Discover source-labelled places';
  $('journey-source').textContent=position>=0&&journey.stops[position]?`${journey.stops[position].kind} · ${journey.stops[position].region} (research label) · Natural Earth selected locations, not official boundaries`:'A guided journey appears when local, source-labelled city points load.';
  $('journey-track').style.setProperty('--journey-progress',count?`${Math.max(0,position+1)/count*100}%`:'0%');
  $('journey-line-status').textContent=position>0?`${position} geographic connectors · straight lines, NOT routes`:'Journey lines represent geographic connections only, never routes.';
}
function updateJourneyTrail(){
  const trail=atlasJourneyTrail(journey.stops,journey.index);
  try{app.map?.getSource('atlas-journey-trail')?.setData(trail);}catch(_){/* map is changing styles */}
  const svg=document.querySelector('#map-overlay svg.fallback-map-svg');
  if(!svg)return;
  svg.querySelector('#atlas-journey-trail-fallback')?.remove();
  if(!trail.features.length)return;
  const projection=svg.getAttribute('data-atlas-projection')?.split(',').map(Number);
  if(!projection||projection.length!==6||!projection.every(Number.isFinite))return;
  const [west,north,x0,y0,sx,sy]=projection;
  const group=document.createElementNS('http://www.w3.org/2000/svg','g');group.id='atlas-journey-trail-fallback';
  group.setAttribute('pointer-events','none');
  for(const feature of trail.features){
    const path=document.createElementNS('http://www.w3.org/2000/svg','polyline');
    path.setAttribute('points',feature.geometry.coordinates.map(c=>`${x0+(c[0]-west)*sx},${y0+(north-c[1])*sy}`).join(' '));
    path.setAttribute('fill','none');path.setAttribute('stroke','#247d72');path.setAttribute('stroke-width','3');
    path.setAttribute('stroke-opacity','.85');path.setAttribute('stroke-dasharray','9 7');
    group.append(path);
  }
  svg.append(group);
}
function updateNearbyPlaces(){
  const node=$('nearby-places');if(!node)return;
  node.replaceChildren();
  const centre=app.selectedCoordinate||app.selectedPlace;
  $('nearby-origin').textContent=centre?`From ${centre.name} · approximate direct-line distances`: 'Select a city or enter coordinates to discover nearby source-listed places.';
  if(!centre){node.textContent='71 selected Natural Earth points are available once the local catalogue loads.';return;}
  if(!app.gazetteerPlaces.length){node.textContent='Source-backed place catalogue has not loaded.';return;}
  const neighbours=atlasNearbyPlaces(centre,app.gazetteerPlaces,{limit:6});
  if(!neighbours.length){node.textContent='No other indexed source places within the available catalogue.';return;}
  for(const p of neighbours){
    const button=document.createElement('button');button.type='button';button.className='nearby-place';
    const name=document.createElement('strong');name.textContent=p.name;
    const tag=document.createElement('small');tag.textContent=`${Math.round(p.km).toLocaleString()} km · ${p.direction} · ${p.region} (research label)`;
    button.append(name,tag);button.addEventListener('click',()=>selectPlace(app.gazetteerPlaces.find(x=>x.id===p.id)||p));node.append(button);
  }
}
function updateScaleGuide(){
  const bar=$('atlas-scale-bar'),label=$('atlas-scale-label');if(!bar||!label)return;
  try{
    let v=null;
    if(app.map){const center=app.map.getCenter();v=atlasMercatorScale(center.lat,app.map.getZoom());}
    else{
      const svg=document.querySelector('#map-overlay svg.fallback-map-svg'),box=svg?.viewBox?.baseVal;
      const data=svg?.getAttribute('data-atlas-projection')?.split(',').map(Number);
      if(svg&&box?.width&&data?.length===6&&data.every(Number.isFinite)&&svg.clientWidth>0){
        // Source SVG uses linear lon/lat projection, so use only a nominal
        // centre-latitude approximation and label as such.
        const lonDegreesPerPixel=box.width/(svg.clientWidth*Math.max(.001,Math.abs(data[4]))*fallbackZoom);
        const metresPerPixel=111320*Math.cos(22.6*Math.PI/180)*lonDegreesPerPixel;
        v=atlasScaleFromMetersPerPixel(metresPerPixel);
      }
    }
    if(!v){label.textContent='Scale unavailable in this renderer';bar.style.width='0px';return;}
    label.textContent=`≈ ${v.label}`;bar.style.width=`${Math.round(v.pixels)}px`;
  }catch(_){label.textContent='Scale unavailable';bar.style.width='0px';}
}
function journeyPrepare(){
  journeyPause();journey.stops=atlasJourneyStops(app.gazetteerPlaces,7);journey.index=-1;journeySync();updateNearbyPlaces();
}
function journeyGo(index){
  if(index<0||index>=journey.stops.length){journeyPause();return;}
  journey.index=index;selectPlace(journey.stops[index],{fromJourney:true});journeySync();updateJourneyTrail();
  journeyCancelClock();
  if(journey.playing){if(index+1<journey.stops.length){
    const speed=Number($('journey-speed').value)||1;
    journey.timeout=setTimeout(()=>journeyGo(index+1),atlasMotionOff()?1400:Math.round(3900/speed));
  }else journeyPause();}
}
function journeyToggle(){
  if(journey.playing){journeyPause();return;}
  if(!journey.stops.length||app.source?.kind==='import'){toast('Source-labelled locations cannot be toured in the current map mode.');return;}
  journey.playing=true;journeyGo(journey.index<0||journey.index>=journey.stops.length-1?0:journey.index);
}
function atlasMapMove(center,zoom){
  if(!app.map)return;
  let current=[79.5,22.6];try{const c=app.map.getCenter();current=[c.lng,c.lat]}catch(_){}
  const duration=atlasMotionDuration(current,center,{reduced:atlasMotionOff(),speed:Number($('journey-speed').value)||1});
  if(duration===0)app.map.jumpTo({center,zoom});
  else app.map.flyTo({center,zoom,duration,essential:false,curve:1.1,speed:1.15});
}
function updateDetailNarrative(zoom){
  const detail=atlasZoomNarrative(zoom,{hasTransport:!!app.transportCatalog,hasTiles:!!app.tileCatalog,hasPlaces:app.gazetteerPlaces.length>0});
  if($('zoom-story-title').textContent!==detail.title)$('zoom-story-title').textContent=detail.title;
  if($('zoom-story-desc').textContent!==detail.description)$('zoom-story-desc').textContent=detail.description;
  $('zoom-story-level').textContent=`ZOOM ${Number(zoom).toFixed(1)}`;
}
function updateLayerInventory(){
  const target=$('atlas-layer-inventory');if(!target)return;
  const inventory=[
    ['Political polygons',app.features?`${app.features.features.length} user/community polygons · NOT VERIFIED`:'No political geometry bundled or loaded'],
    ['Physical land',app.landcover?'Local source-checked historical GSHHG land mask':'Local physical data pending'],
    ['Water features',app.tileCatalog?`${app.tileCatalog.tileCount} sparse combined tiles · historical sources`:'No source-backed tile catalogue loaded'],
    ['Selected places',`${app.gazetteerPlaces.length} Natural Earth selected place points · not all settlements`],
    ['Current transport',app.transportCatalog?`${app.transportCatalog.tileCount} user-provided source-backed research tiles`:'No real nationwide roads or railway network bundled'],
    ['Official status','No boundary certification, routing certification or nationwide coverage claim']
  ];
  target.replaceChildren();
  for(const [title,description] of inventory){
    const box=document.createElement('div');const heading=document.createElement('strong');const detail=document.createElement('span');
    heading.textContent=title;detail.textContent=description;box.append(heading,detail);target.append(box);
  }
}
/** Explicit, catalogue-only diagnostic. No tile content or national coverage is inferred. */
function atlasRunCoverageInspection(){
  const lonText=$('coverage-inspector-lon').value.trim(),latText=$('coverage-inspector-lat').value.trim();
  const lon=Number(lonText),lat=Number(latText);
  const zoom=Number($('coverage-inspector-zoom').value);
  const node=$('coverage-inspector-result');node.replaceChildren();
  if(!lonText||!latText||!Number.isFinite(lon)||!Number.isFinite(lat)||lon < -180||lon > 180||lat < -90||lat > 90){
    node.textContent='Invalid WGS84 coordinate. Use longitude −180..180 and latitude −90..90.';return;
  }
  for(const [label,catalog] of [['Historical physical vector tiles',app.tileCatalog],['Optional modern research data',app.transportCatalog]]){
    const item=document.createElement('div');item.className='atlas-tile-cell';
    const title=document.createElement('strong');title.textContent=label;
    const detail=document.createElement('p');const result=atlasInspectResearchTile(catalog,lon,lat,zoom);
    if(result.status==='catalogue_unavailable')detail.textContent='No declared tile catalogue loaded. No local coverage can be confirmed.';
    else detail.textContent=result.available
      ?`SHA-256 tile ${result.path} · ${result.featureCounts?Object.entries(result.featureCounts).map(([layer,n])=>layer+': '+n+' decoded feature'+(n===1?'':'s')).join(' / '):result.layers.join(', ')+' globally declared layers'}${result.overscaled?' · OVERZOOMED from zoom '+result.zoom:''}. Counts describe the full tile cell, not features at this precise coordinate or official coverage.`
      :`No declared local tile at ${result.path}${result.overscaled?' · overscaled lookup':''}. No local detail is promised here.`;
    const sub=document.createElement('small');
    sub.textContent=catalog?`Catalogue zoom ${catalog.minzoom}–${catalog.maxzoom} · ${atlasTileZoomInventory(catalog).map(x=>`z${x.zoom}: ${x.occupiedTiles}`).join(' / ')} declared tile files`:'External CDN data are not inferred or inspected';
    item.append(title,detail,sub);node.append(item);
  }
  $('coverage-inspector-summary').textContent=`Inspected ${lon.toFixed(4)}°E, ${lat.toFixed(4)}°N at requested map zoom ${zoom} · source inventory only`;
}
function atlasInspectMapCenter(){
  let coordinates;
  try{if(app.map){const c=app.map.getCenter();coordinates={lon:c.lng,lat:c.lat}}}catch(_){}
  if(!coordinates)coordinates=app.selectedCoordinate||app.selectedPlace||{lon:79.5,lat:22.6};
  $('coverage-inspector-lon').value=Number(coordinates.lon).toFixed(5);
  $('coverage-inspector-lat').value=Number(coordinates.lat).toFixed(5);
  const zoom=app.map?.getZoom?.();
  if(Number.isFinite(zoom))$('coverage-inspector-zoom').value=String(Math.min(12,Math.max(3,Math.floor(zoom))));
  atlasRunCoverageInspection();
}
function focusFallbackCoordinate(lon,lat){
  const svg=document.querySelector('#map-overlay svg.fallback-map-svg');
  if(!svg||![lon,lat].every(Number.isFinite))return false;
  const data=svg.getAttribute('data-atlas-projection')?.split(',').map(Number);
  const box=svg.viewBox?.baseVal;
  if(!data||data.length!==6||data.some(x=>!Number.isFinite(x))||!box?.width||!box?.height)return false;
  const [west,north,x0,y0,sx,sy]=data;
  const x=x0+(lon-west)*sx,y=y0+(north-lat)*sy;
  if(x<0||y<0||x>box.width||y>box.height)return false;
  fallbackZoom=2.65;
  fallbackPan={x:-(x-box.width/2)*svg.clientWidth/box.width*fallbackZoom,y:-(y-box.height/2)*svg.clientHeight/box.height*fallbackZoom};
  svg.style.transition=atlasMotionOff()?'none':'transform 740ms cubic-bezier(.21,.64,.29,1)';
  applyFallbackCamera();return true;
}

const FALLBACK_ZOOM_MIN=1, FALLBACK_ZOOM_MAX=6;
function applyFallbackCamera(){
  const svg=document.querySelector('#map-overlay svg.fallback-map-svg');
  if(!svg)return;
  const viewport=svg.closest('.fallback-map-viewport');
  if(viewport){
    const limitX=Math.max(0,(fallbackZoom-1)*viewport.clientWidth*.52);
    const limitY=Math.max(0,(fallbackZoom-1)*viewport.clientHeight*.52);
    fallbackPan.x=Math.max(-limitX,Math.min(limitX,fallbackPan.x));
    fallbackPan.y=Math.max(-limitY,Math.min(limitY,fallbackPan.y));
  }
  svg.style.transform=`translate(${fallbackPan.x}px, ${fallbackPan.y}px) scale(${fallbackZoom})`;
  updateScaleGuide();
  svg.setAttribute('aria-label',`Interactive fallback map at ${Math.round(fallbackZoom*100)}% zoom; ${app.features?'provisional boundaries':app.officialClaim?'Survey of India sourced generalized national claim outline':'historical physical geography without political boundaries'}`);
}
function adjustFallbackZoom(factor,anchor={x:0,y:0}){
  const next=atlasFallbackTarget({currentZoom:fallbackZoom,newZoom:fallbackZoom*factor,pan:fallbackPan,anchor});
  fallbackZoom=next.zoom;fallbackPan=next.pan;applyFallbackCamera();updateDetailNarrative(3.1+Math.log2(fallbackZoom)*2.2);
}
function resetFallbackCamera(){fallbackZoom=1;fallbackPan={x:0,y:0};fallbackPointer=null;fallbackPointers.clear();applyFallbackCamera();updateDetailNarrative(3.1)}
function setupFallbackSVG(svg){
  svg.classList.add('fallback-map-svg');
  svg.setAttribute('tabindex','0');
  svg.setAttribute('aria-label',app.features?'Research map of provisional Indian administrative regions':app.officialClaim?'Physical map with Survey of India sourced generalized national claimed outline':'Research physical map without political boundaries');
  svg.querySelectorAll('path[data-region]').forEach(path=>{
    path.setAttribute('tabindex','0');path.setAttribute('role','button');
    path.setAttribute('aria-label',`Explore ${path.getAttribute('data-region')}`);
    path.addEventListener('click',()=>{if(!atlasToolkit?.measureEnabled())selectRegion(path.getAttribute('data-region'))});
    path.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();if(!atlasToolkit?.measureEnabled())selectRegion(path.getAttribute('data-region'))}
    });
  });
  svg.addEventListener('wheel',event=>{
    event.preventDefault();const viewport=svg.closest('.fallback-map-viewport');
    const bounds=(viewport||svg).getBoundingClientRect();
    // Anchor in stable viewport CSS pixels: the transformed SVG's own rectangle
    // grows and moves at each zoom, so using it makes wheel-focus drift.
    const anchor={x:event.clientX-bounds.left-bounds.width/2,y:event.clientY-bounds.top-bounds.height/2};
    svg.style.transition=atlasMotionOff()?'none':'transform 160ms ease-out';
    adjustFallbackZoom(event.deltaY<0?1.16:1/1.16,anchor);
  },{passive:false});
  let pinch=null;
  const pinchStats=()=>{
    const pts=[...fallbackPointers.values()];if(pts.length<2)return null;
    return {distance:Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y),cx:(pts[0].x+pts[1].x)/2,cy:(pts[0].y+pts[1].y)/2};
  };
  svg.addEventListener('pointerdown',event=>{
    svg.style.transition='none';
    fallbackPointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(fallbackPointers.size===1)fallbackPointer={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};
    if(fallbackPointers.size>=2){pinch=pinchStats();fallbackPointer=null;}
    if(fallbackPointers.size>=2)svg.setPointerCapture?.(event.pointerId);
  });
  svg.addEventListener('pointermove',event=>{
    if(!fallbackPointers.has(event.pointerId))return;
    const previous=fallbackPointers.get(event.pointerId);
    fallbackPointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(fallbackPointers.size>=2){
      const next=pinchStats();if(next&&pinch&&pinch.distance>0){
        const view=svg.closest('.fallback-map-viewport').getBoundingClientRect();
        adjustFallbackZoom(next.distance/pinch.distance,{x:next.cx-view.left-view.width/2,y:next.cy-view.top-view.height/2});
      }pinch=next;return;
    }
    if(!fallbackPointer||event.pointerId!==fallbackPointer.id)return;
    const dx=event.clientX-previous.x,dy=event.clientY-previous.y;
    if(Math.abs(event.clientX-fallbackPointer.x)+Math.abs(event.clientY-fallbackPointer.y)>3){fallbackPointer.moved=true;svg.setPointerCapture?.(event.pointerId);}
    if(fallbackZoom>1){fallbackPan.x+=dx;fallbackPan.y+=dy;applyFallbackCamera()}
  });
  const pointerEnd=event=>{
    if(fallbackPointer?.id===event.pointerId){
      if(fallbackPointer.moved)svg.addEventListener('click',e=>{e.preventDefault();e.stopPropagation()}, {once:true,capture:true});
      fallbackPointer=null;
    }
    fallbackPointers.delete(event.pointerId);
    pinch=fallbackPointers.size>=2?pinchStats():null;
  };
  svg.addEventListener('pointerup',pointerEnd);
  svg.addEventListener('pointercancel',pointerEnd);
  svg.addEventListener('click',event=>{
    if(!atlasToolkit?.measureEnabled())return;
    const data=svg.getAttribute('data-atlas-projection')?.split(',').map(Number);
    if(!data||data.length!==6||data.some(n=>!Number.isFinite(n)))return;
    const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
    const matrix=svg.getScreenCTM();if(!matrix)return;
    const mapped=point.matrixTransform(matrix.inverse());
    const [west,north,x0,y0,sx,sy]=data;
    if(sx<=0||sy<=0)return;
    const pair=[west+(mapped.x-x0)/sx,north-(mapped.y-y0)/sy];
    atlasToolkit.addPoint(pair);
  });
  svg.addEventListener('keydown',event=>{
    if(event.target!==svg)return;
    if(event.key==='+'||event.key==='='){event.preventDefault();adjustFallbackZoom(1.25)}
    if(event.key==='-'){event.preventDefault();adjustFallbackZoom(.8)}
    if(event.key==='0'){event.preventDefault();resetFallbackCamera()}
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
      event.preventDefault();const amount=event.shiftKey?80:38;const delta={ArrowLeft:[amount,0],ArrowRight:[-amount,0],ArrowUp:[0,amount],ArrowDown:[0,-amount]}[event.key];
      if(fallbackZoom>1){fallbackPan.x+=delta[0];fallbackPan.y+=delta[1];applyFallbackCamera()}
    }
  });
  applyFallbackCamera();atlasToolkit?.fallbackReady(svg);atlasComparison?.fallbackReady(svg);
  const selected=app.selectedPlace||app.selectedCoordinate;if(selected)focusFallbackCoordinate(selected.lon,selected.lat);
}
const app={map:null,rendererFailure:null,ready:false,features:null,audit:null,source:null,selected:'',selectedCatalogRegion:null,selectedPlace:null,selectedCoordinate:null,hovered:'',style:'terrain',styleEpoch:0,labels:true,places:true,rivers:true,hydrology:null,shores:true,shorelines:null,landcover:null,checks:false,officialClaim:null,soiStates:null,soiStateDetails:null,soiOutlineDetails:null,soiSelected:'',soiImportWorker:null,filter:'all',requestId:0,abort:null,toastTimer:null,tileCatalog:null,transportCatalog:null,gazetteerPlaces:[],gazetteerMeta:null,searchIndex:null,indexMatches:[],indexSearchEpoch:0,boundaryLoadFailed:false,rendererAttempts:0,lastRendererAttemptAt:0,rendererStatus:'not_tested',rendererReason:''};
function toast(msg){const el=$('toast');el.textContent=msg;el.hidden=false;clearTimeout(app.toastTimer);app.toastTimer=setTimeout(()=>{el.hidden=true},4100)}
function overlay(title,message,button=false){$('map-stage').classList.remove('fallback-active');const el=$('map-overlay');el.classList.remove('fallback-preview');el.hidden=false;el.replaceChildren();const icon=document.createElement('span');icon.className=button?'error-icon':'spinner';icon.textContent=button?'!':'';const b=document.createElement('strong');b.textContent=title;const p=document.createElement('p');p.textContent=message;el.append(icon,b,p);if(button){const retry=document.createElement('button');retry.textContent='Retry loading';retry.addEventListener('click',()=>fetchPreview());el.append(retry)}}
function rendererDiagnosticSnapshot(){
  let webgl2Probe='not_tested';
  try{
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext?.('webgl2',{failIfMajorPerformanceCaveat:true});
    webgl2Probe=gl?'context_created':'unavailable_or_rejected';
    gl?.getExtension('WEBGL_lose_context')?.loseContext?.();
  }catch(_){webgl2Probe='context_creation_failed'}
  let engineSupported=null;
  try{if(typeof window.maplibregl?.supported==='function')engineSupported=!!window.maplibregl.supported()}catch(_){engineSupported=false}
  return createRendererDiagnosticRecord({
    status:app.rendererStatus,reason:app.rendererReason,engineAvailable:!!window.maplibregl?.Map,
    engineVersion:window.maplibregl?.version,engineSupported,webgl2Probe,
    userAgent:navigator.userAgent,mapLoaded:!!app.ready&&!!app.map,politicalBordersLoaded:!!app.features,
    physicalLandLoaded:!!app.landcover,tileCatalogueLoaded:!!app.tileCatalog,
    attemptCount:app.rendererAttempts
  });
}
function exportRendererDiagnostics(){
  const data=rendererDiagnosticSnapshot();
  saveBlob(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'}),'bharat-atlas-renderer-diagnostics.json');
  toast('Local renderer diagnostic downloaded. Review it before sharing.');
}
function updateRendererStatus(status,reason=''){
  app.rendererStatus=status;app.rendererReason=String(reason).slice(0,250);
  const statusNode=$('renderer-status');
  if(statusNode)statusNode.textContent=status==='rendering'?'Interactive renderer initialized · hardware not certified':
    status==='fallback'?'SVG map available · interactive renderer unavailable':
    status==='trying'?'Checking interactive renderer…':'Map rendering not yet verified';
}
function retryRenderer(){
  const now=Date.now();
  if(!canRetryRenderer({now,lastAttemptAt:app.lastRendererAttemptAt,attempts:app.rendererAttempts})){
    toast('Please allow the previous map attempt to finish before retrying.');return false;
  }
  if(app.map){try{app.map.remove?.()}catch(e){console.warn('Previous map cleanup:',e)}app.map=null;}
  app.ready=false;$('map-stage').classList.remove('map-live');
  // A lost GPU context must not keep old map canvases or event listeners alive.
  $('map').replaceChildren();
  const result=initMap();
  if(result){
    overlay('Rechecking interactive map','Waiting for a new MapLibre canvas. SVG remains available if the renderer fails.');
    return true;
  }
  return false;
}
function rendererFallback(title,message){
  app.rendererFailure={title,message};
  overlay(title,message,false);
  $('map-stage').classList.remove('map-live');if(app.features||app.landcover)$('map-stage').classList.add('fallback-active');else $('map-stage').classList.remove('fallback-active');
  if(app.features||app.landcover){
    try{
      const output=app.features?renderResearchSVG(app.features,{selected:app.selected,source:app.source,labels:app.labels,physicalLines:app.rivers&&app.source?.kind!=='import'?app.hydrology:null,physicalShore:app.shores&&app.source?.kind!=='import'?app.shorelines:null,physicalLand:app.source?.kind!=='import'?app.landcover:null,physicalTheme:app.style==='physical'&&!!app.landcover&&app.source?.kind!=='import'}):renderPhysicalOnlySVG({land:app.landcover,hydrology:app.rivers?app.hydrology:null,shorelines:app.shores?app.shorelines:null,officialClaim:app.officialClaim});
      const svgDoc=new DOMParser().parseFromString(output,'image/svg+xml');
      if(svgDoc.querySelector('parsererror'))throw Error('Unable to parse generated research SVG');
      const graphic=document.importNode(svgDoc.documentElement,true);
      const viewport=document.createElement('div');viewport.className='fallback-map-viewport';
      viewport.append(graphic);
      $('map-overlay').classList.add('fallback-preview');$('map-overlay').append(viewport);
      // Preserve zoom and pan when changing labels; selecting another region focuses it.
      setupFallbackSVG(graphic);updateJourneyTrail();updateScaleGuide();
      const currentFocus=app.selectedCoordinate||app.selectedPlace;
      if(currentFocus)focusFallbackCoordinate(currentFocus.lon,currentFocus.lat);
      if(!app.features){
        $('map-source-status').textContent=app.officialClaim?'SOI-SOURCED NATIONAL CLAIM OUTLINE · GENERALIZED · NOT 2026 CERTIFIED':'PHYSICAL ONLY · NO POLITICAL BORDERS';
        $('attribution').textContent=app.officialClaim?'Claimed national outline: © Survey of India / Government of India · non-commercial use; physical: GSHHG 2.3.6':'Physical land/water: GSHHG 2.3.6 · LGPL-3.0-or-later · historical generalized data';
        if(!app.selectedCatalogRegion){
          $('focus-title').textContent='Physical geography available';
          $('focus-description').textContent=app.officialClaim?'State/UT divisions are not verified. Orange outline shows the source-labelled generalized Indian territorial claim, not de-facto control or a certified 2026 state/district map.':'State/UT boundaries are unavailable or rejected. This physical view includes neighbouring countries and shows NO political borders.';
        }
        $('download-svg').disabled=false;
      }
    }catch(e){console.warn('Static map fallback unavailable:',e)}
  }
  const link=document.createElement('a');
  link.href='./legacy/';link.textContent='Open accessible legacy SVG viewer ↗';
  link.className='legacy-link';$('map-overlay').append(link);
  const actions=document.createElement('div');actions.className='renderer-recovery-actions';
  const retry=document.createElement('button');retry.type='button';retry.textContent='Retry interactive map';
  retry.addEventListener('click',retryRenderer);
  const report=document.createElement('button');report.type='button';report.textContent='Download renderer report';
  report.className='renderer-report-button';report.addEventListener('click',exportRendererDiagnostics);
  actions.append(retry,report);$('map-overlay').append(actions);
  updateRendererStatus('fallback',title+': '+message);
}
function retireFailedRenderer(title,message,failed=app.map){
  // A failed renderer must not receive zoom, selection, or style commands under the SVG.
  // Retire stale style callbacks and delay MapLibre cleanup until the current event exits.
  if(failed&&app.map!==failed)return;
  ++app.styleEpoch;
  app.ready=false;app.map=null;
  rendererFallback(title,message);
  if(failed)queueMicrotask(()=>{try{failed.remove?.()}catch(error){console.warn('Failed renderer cleanup:',error)}});
}
function hideOverlay(){
  const mapRoot=$('map'),size=mapRoot.getBoundingClientRect();
  if(size.width<150||size.height<150){
    $('map-stage').classList.remove('map-live');
    overlay('Map still initializing','The geographic canvas is not correctly sized. The physical-reference image remains visible while the map recovers.');
    console.warn('Bharat Atlas: map container dimensions invalid',size.width,size.height);
    return;
  }
  $('map-overlay').hidden=true;
  $('map-stage').classList.remove('fallback-active');
  $('map-stage').classList.add('map-live');
  requestAnimationFrame(()=>{try{app.map?.resize?.()}catch(error){console.warn('Atlas map resize',error)}});
}
function changeSourceAttribution(){
  if(!app.source)return;
  $('attribution').textContent=`${app.source.title} · ${app.source.licence}`;
  $('attribution-link').hidden=app.source.kind==='import';
  if(app.source.kind!=='import'){$('attribution-link').href=app.source.url||'https://www.openstreetmap.org/copyright';$('attribution-link').textContent=app.source.attribution+' ↗';}
  $('dialog-source').textContent=`Active source: ${app.source.title}. Licence: ${app.source.licence}. Data has not been verified against Survey of India.`;
  $('map-source-status').textContent=app.source.kind==='import'?'UNVERIFIED IMPORT':'PROVISIONAL GEOMETRY · UNVERIFIED PLACES';
  if(app.tileCatalog){$('tile-attribution').textContent=app.source.kind==='import'?'Detail tiles disabled on imported geography':`Optional detail: ${app.tileCatalog.attribution} · ${app.tileCatalog.licence} · NOT VERIFIED`;}
}
function updateQAPanel(){
  const audit=app.audit;if(!audit)return;
  $('region-coverage-tag').textContent=`${audit.states+audit.uts} PROVISIONAL REGIONS · ${audit.states} STATES · ${audit.uts} UTs`;
  $('state-total').textContent=String(audit.states);$('ut-total').textContent=String(audit.uts);
  const problems=audit.points.filter(x=>!x.pass);
  $('qa-summary').textContent=problems.length?`${problems.length} of 4 geographic samples need review`:'4 of 4 samples matched (not certification)';
  const container=$('qa-list');container.replaceChildren();
  for(const p of audit.points){const row=document.createElement('div');row.className='qa-item';const n=document.createElement('span');n.textContent=p.title;const status=document.createElement('b');status.className=p.pass?'pass':'review';status.textContent=p.pass?'SAMPLE MATCH':'REVIEW';row.append(n,status);container.append(row)}
  $('download-qa').disabled=false; $('download-svg').disabled=false;
}
function activePilotCities(){
  // Prefer licensed source-backed records over a duplicate approximate pilot point.
  const sourceNames=new Set(app.gazetteerPlaces.map(p=>normalizeQuery(p.name)));
  return PILOT_PLACES.filter(p=>!sourceNames.has(normalizeQuery(p.name)));
}
function currentSearchResults(){
  const coordinate=parseAtlasCoordinates($('search-input').value);
  if(coordinate)return [{kind:'coordinate',name:coordinate.name,subtitle:'Go to coordinates · WGS84',entry:coordinate}];
  const base=searchAtlas($('search-input').value,app.features?.features||[],[...activePilotCities(),...app.gazetteerPlaces],{filter:app.filter,includePlaces:app.source?.kind!=='import'&&app.places});
  // Administrative NAME catalogue is independent of political polygon availability.
  // A listed state is not evidence of its mapped boundary or geographic extent.
  const allCatalogueMatches=atlasRegionCatalogueSearch($('search-input').value,app.filter,[]);
  const polygonsByName=new Map((app.features?.features||[]).map(f=>[normalizeQuery(f.properties.name),f]));
  // Hindi queries should find the same loaded polygon as an English query.
  for(const matched of allCatalogueMatches){
    const feature=polygonsByName.get(normalizeQuery(matched.name));
    if(feature&&!base.some(e=>e.kind==='region'&&normalizeQuery(e.name)===normalizeQuery(matched.name)))
      base.push({kind:'region',name:feature.properties.name,subtitle:feature.properties.kind,entry:feature,rank:matched.rank});
  }
  const fallbackRegions=allCatalogueMatches.filter(x=>!polygonsByName.has(normalizeQuery(x.name))).map(x=>{
    const sourced=soiPolygonForName(x.name);
    return sourced?{...x,subtitle:'Locally loaded SoI May 2026 polygon · verify official map edition'}:x;
  });
  if(!$('search-input').value.trim())return [...base,...fallbackRegions].sort((a,b)=>a.name.localeCompare(b.name));
  if(app.filter!=='all'||!app.places||app.source?.kind==='import')return [...base,...fallbackRegions].sort((a,b)=>(a.rank??0)-(b.rank??0)||a.name.localeCompare(b.name));
  base.push(...fallbackRegions);

  const known=new Set(base.map(e=>normalizeQuery(e.name)));
  for(const place of app.indexMatches){
    if(known.has(normalizeQuery(place.name)))continue;
    base.push({kind:'place',name:place.name,subtitle:`${place.kind} · ${place.region} · research index, not a verified address`,entry:place});
    known.add(normalizeQuery(place.name));if(base.length>=50)break;
  }
  return base;
}
function renderRegions(){
  const list=$('region-list');list.replaceChildren();list.setAttribute('aria-busy','false');
  const entries=currentSearchResults();const searching=!!$('search-input').value.trim();
  $('region-count').textContent=searching?`${entries.length} results`:`${entries.length} listed · ${app.features?.features.length||ATLAS_REGIONS.filter(x=>soiPolygonForName(x.name)).length} matched boundaries`; 
  if(!entries.length){const p=document.createElement('p');p.className='loading-regions';p.textContent='No matching place or region in the available catalogues';list.append(p);return}
  for(const entry of entries){
    const btn=document.createElement('button');btn.type='button';btn.className='region-option'+(entry.kind!=='region'?' place-result':'')+((app.selected===entry.name||(entry.kind==='region-catalog'&&app.selectedCatalogRegion?.name===entry.name)||(entry.kind==='place' && (entry.entry.id ? app.selectedPlace?.id===entry.entry.id : app.selectedPlace===entry.entry)))?' active':'');
    btn.setAttribute('role','option');btn.setAttribute('aria-selected',String(app.selected===entry.name||(entry.kind==='region-catalog'&&app.selectedCatalogRegion?.name===entry.name)||(entry.kind==='place' && (entry.entry.id ? app.selectedPlace?.id===entry.entry.id : app.selectedPlace===entry.entry))));
    const wrap=document.createElement('span'),name=document.createElement('span');name.textContent=entry.name;wrap.append(name);
    if(entry.kind!=='region'){const sub=document.createElement('small');sub.className='result-subtitle';sub.textContent=entry.subtitle;wrap.append(sub)}
    else {const translation=ATLAS_REGIONS.find(r=>normalizeQuery(r.name)===normalizeQuery(entry.name));
      if(translation){const sub=document.createElement('small');sub.className='result-subtitle';sub.textContent=translation.hindi+' · '+translation.kind;wrap.append(sub)}}
    const arrow=document.createElement('span');arrow.className='region-chevron';arrow.textContent=entry.kind!=='region'?'⌖':'↗';
    btn.append(wrap,arrow);btn.addEventListener('click',()=>entry.kind==='coordinate'?selectCoordinate(entry.entry):entry.kind==='place'?selectPlace(entry.entry):entry.kind==='region-catalog'?selectCatalogRegion(entry.entry):selectRegion(entry.name));list.append(btn);
  }
}
function normalizeSoIRegionName(value){
  const normalized=String(value||'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]/g,'');
  const names={orissa:'odisha',uttaranchal:'uttarakhand',nctofdelhi:'delhi',pondicherry:'puducherry',
    andamanandnicobar:'andamanandnicobarislands',jammuandkashmir:'jammuandkashmir',
    dadraandnagarhavelianddamananddiu:'dadraandnagarhavelianddamananddiu'};
  return names[normalized]||normalized;
}
function soiPolygonForName(name){
  const key=normalizeSoIRegionName(name);
  return app.soiStates?.features?.find(f=>{
    const raw=f.properties?.STATE||f.properties?.name||'';
    return !/^disputed/i.test(raw)&&normalizeSoIRegionName(raw)===key;
  })||null;
}

function selectCatalogRegion(record){
  if(!record)return;
  const polygon=app.features?.features.find(f=>normalizeQuery(f.properties.name)===normalizeQuery(record.name));
  if(polygon){selectRegion(polygon.properties.name);return;}
  journeyPause();app.selected='';app.selectedPlace=null;app.selectedCoordinate=null;app.selectedCatalogRegion=record;
  const officialPolygon=soiPolygonForName(record.name);
  app.soiSelected=officialPolygon?String(officialPolygon.properties?.STATE||''):'';
  renderRegions();updateFocus();updateNearbyPlaces();updateMapFilters();
  if(officialPolygon){
    if(app.map)app.map.fitBounds(featureBounds(officialPolygon),{padding:window.innerWidth<760?42:100,duration:atlasMotionOff()?0:280,maxZoom:10});
    toast(`${record.name}: boundary from locally loaded SoI May 2026 archive; verify map edition for critical use`);
  }else toast(`${record.name}: name/classification available; no vetted region polygon is loaded`);
  toggleMobile(false);
}
function updateFocus(){
  if(app.selectedCatalogRegion){
    const record=app.selectedCatalogRegion;
    $('focus-title').textContent=record.name+' · '+record.hindi;
    const sourced=soiPolygonForName(record.name);
    $('focus-description').textContent=sourced
      ?`${record.kind}. Showing the shape from the locally imported, SHA-256-matched May 2026 Survey of India State Boundary Shapefile. The dataset contains disputed internal-area records; this visualization is not an independent cartographic certification. Compare against the official 2026 political map for critical use.`
      :`${record.kind}. Name and classification are available, but no independently checked polygon is loaded for this region. No boundary or extent has been inferred. See the official reference map.`;
    $('clear-focus').hidden=false;return;
  }

  if(app.selectedCoordinate){const p=app.selectedCoordinate;$('focus-title').textContent=p.name;
    $('focus-description').textContent='Coordinate location · WGS84 decimal degrees. The marker shows the entered location, not a verified address or a determination of territorial control.';
    $('clear-focus').hidden=false;return}
  if(app.selectedPlace){const p=app.selectedPlace;$('focus-title').textContent=p.name;$('focus-description').textContent=(p.source==='gazetteer'||p.source==='indexed')?`${p.kind} · ${p.region} (research region label) · approximately ${p.lat.toFixed(3)}°N, ${p.lon.toFixed(3)}°E. Source: ${app.gazetteerMeta?.attribution||'user-provided'} (${app.gazetteerMeta?.licence||'unverified'}). State assignment and coordinates have not been survey-verified. Not an address or political-boundary source.`:`Pilot city centre · ${p.region} · approximately ${p.lat.toFixed(3)}°N, ${p.lon.toFixed(3)}°E. This demonstration location is not survey-verified; roads, addresses and routing are not provided.`;$('clear-focus').hidden=false;return}
  if(!app.selected){$('focus-title').textContent='Select a region to explore';$('focus-description').textContent='Search the list or choose a polygon directly on the map. Selection will animate to its geographic extent.';$('clear-focus').hidden=true;return}
  const f=app.features?.features.find(f=>f.properties.name===app.selected);
  $('focus-title').textContent=app.selected;$('focus-description').textContent=`${f?.properties.kind||'Region'} · Provisional boundary source. Zoom in to examine the outline; road and locality layers are not yet included.`;$('clear-focus').hidden=false;
}
function mapSource(id){return app.map?.getSource(id)}
function syncMapData(){
  if(!app.ready||!app.map)return;
  mapSource('regions')?.setData(app.features||{type:'FeatureCollection',features:[]});
  mapSource('official-india-claim')?.setData(app.officialClaim||{type:'FeatureCollection',features:[]});
  mapSource('soi-state-boundaries')?.setData(app.soiStates||{type:'FeatureCollection',features:[]});
  mapSource('land-mask')?.setData(app.source?.kind==='import'?{type:'FeatureCollection',features:[]}:app.landcover||{type:'FeatureCollection',features:[]});
  mapSource('labels')?.setData(app.features?labelCollection(app.features):{type:'FeatureCollection',features:[]});
  mapSource('gazetteer-places')?.setData(gazetteerFeatures(app.gazetteerPlaces));
  mapSource('pilot-places')?.setData(pilotFeatureCollection(activePilotCities()));
  const points=app.audit?.points||[];
  mapSource('checkpoints')?.setData({type:'FeatureCollection',features:points.map(p=>({type:'Feature',properties:{title:p.title,pass:p.pass},geometry:{type:'Point',coordinates:[p.lon,p.lat]}}))});
  updateMapFilters();updateJourneyTrail();
}
function updateMapFilters(){
  if(!app.ready)return;
  const pin=app.selectedCoordinate;
  mapSource('search-location')?.setData({type:'FeatureCollection',features:pin?[{type:'Feature',properties:{name:pin.name},geometry:{type:'Point',coordinates:[pin.lon,pin.lat]}}]:[]});
  if(app.map.getLayer('land-fill'))app.map.setLayoutProperty('land-fill','visibility',app.source?.kind==='import'?'none':'visible');
  if(app.map.getLayer('regions-selected'))app.map.setFilter('regions-selected',['==',['get','name'],app.selected||'@@NO_REGION@@']);
  if(app.map.getLayer('regions-hover'))app.map.setFilter('regions-hover',['==',['get','name'],app.hovered||'@@NO_REGION@@']);
  if(app.map.getLayer('soi-state-selected'))app.map.setFilter('soi-state-selected',['==',['get','STATE'],app.soiSelected||'@@NO_SOI_SELECTION@@']);
  if(app.map.getLayer('region-labels'))app.map.setLayoutProperty('region-labels','visibility',app.labels?'visible':'none');
  for(const id of ['pilot-city-dots','pilot-city-labels']){if(app.map.getLayer(id))app.map.setLayoutProperty(id,'visibility',app.places&&app.source?.kind!=='import'?'visible':'none')}
  if(app.map.getLayer('pilot-place-selected'))app.map.setFilter('pilot-place-selected',['==',['get','name'],app.selectedPlace?.source==='gazetteer'?'@@NO_PLACE@@':(app.selectedPlace?.name||'@@NO_PLACE@@')]);
  for(const id of ['gazetteer-dots','gazetteer-labels']){if(app.map.getLayer(id))app.map.setLayoutProperty(id,'visibility',app.places&&app.source?.kind!=='import'&&!app.tileCatalog?.layers?.includes('settlements')?'visible':'none')}
  if(app.map.getLayer('gazetteer-selected'))app.map.setFilter('gazetteer-selected',['==',['get','id'],app.selectedPlace?.source==='gazetteer'?app.selectedPlace.id:'@@NO_PLACE@@']);
  if(app.map.getLayer('qa-points'))app.map.setLayoutProperty('qa-points','visibility',app.checks?'visible':'none');
  for(const layer of ['local-roads','local-roads-centerline','local-rivers','local-coastlines','local-lakes','local-railways','local-settlements','local-settlements-labels']){
    if(app.map.getLayer(layer))app.map.setLayoutProperty(layer,'visibility',(app.source?.kind==='import'||(layer==='local-rivers'&&!app.rivers)||( (layer==='local-coastlines'||layer==='local-lakes')&&!app.shores)||((layer==='local-settlements'||layer==='local-settlements-labels')&&!app.places))?'none':'visible');
  }
}
function fitAll(animated=true){journeyPause();resetFallbackCamera();app.selected='';app.selectedCatalogRegion=null;app.selectedPlace=null;app.selectedCoordinate=null;app.hovered='';renderRegions();updateFocus();updateNearbyPlaces();updateMapFilters();if(!app.features&&!app.landcover)return;if(app.map){
  // Physical-only mode must remain navigable even when no political dataset exists.
  const b=app.features?allBounds(app.features):[[68,6],[99,38]];
  app.map.fitBounds(b,{padding:window.innerWidth<760?26:56,duration:animated&&!atlasMotionOff()?680:0,maxZoom:6});
 }else rendererFallback(app.rendererFailure?.title||'Static map viewer',app.rendererFailure?.message||'Interactive map rendering is unavailable.');}
function selectRegion(name){journeyPause();resetFallbackCamera();const f=app.features?.features.find(f=>f.properties.name===name);if(!f)return;
  app.selected=name;app.selectedCatalogRegion=null;app.selectedPlace=null;app.selectedCoordinate=null;renderRegions();updateFocus();updateNearbyPlaces();updateMapFilters();
  if(app.map){const b=featureBounds(f);app.map.fitBounds(b,{padding:window.innerWidth<760?52:110,duration:atlasMotionOff()?0:630,maxZoom:9});}
  else rendererFallback(app.rendererFailure?.title||'Static map viewer',app.rendererFailure?.message||'Interactive map rendering is unavailable.');
  const panel=$('left-panel');panel.classList.remove('open');$('mobile-menu').setAttribute('aria-expanded','false');
}
function selectPlace(p,{fromJourney=false}={}){
  if(!fromJourney)journeyPause();
  if(!p||app.source?.kind==='import')return;
  const hadNarrowFallback=!app.map&&!!app.selected;
  app.selectedPlace=p;app.selectedCatalogRegion=null;app.selected='';app.selectedCoordinate=null;app.hovered='';renderRegions();updateFocus();updateNearbyPlaces();updateMapFilters();
  if(hadNarrowFallback)rendererFallback(app.rendererFailure?.title||'Static map viewer',app.rendererFailure?.message||'SVG research preview');
  atlasMapMove([p.lon,p.lat],(p.source==='gazetteer'||p.source==='indexed')?8.2:7.7);
  if(!app.map)focusFallbackCoordinate(p.lon,p.lat);
  toggleMobile(false);
}
function selectCoordinate(p){
  journeyPause();if(!p)return;
  const hadNarrowFallback=!app.map&&!!app.selected;
  app.selectedCoordinate=p;app.selectedCatalogRegion=null;app.selected='';app.selectedPlace=null;app.hovered='';
  if(hadNarrowFallback)rendererFallback(app.rendererFailure?.title||'Static map viewer',app.rendererFailure?.message||'SVG research preview');
  renderRegions();updateFocus();updateNearbyPlaces();syncMapData();
  atlasMapMove([p.lon,p.lat],9);if(!app.map)focusFallbackCoordinate(p.lon,p.lat);toggleMobile(false);
}
function mapLoadComplete(){if(!app.map||app.rendererStatus==='fallback')return;app.ready=true;app.rendererFailure=null;syncMapData();applyStylePaint(app.style);updateStyleButtons();updateCoordinates();atlasToolkit?.mapReady();atlasComparison?.mapReady();if(app.features){
    // Recover the user's current selection after a lost graphics context.
    if(app.selected){const target=app.features.features.find(f=>f.properties.name===app.selected);
      if(target)app.map.fitBounds(featureBounds(target),{padding:window.innerWidth<760?52:110,duration:0,maxZoom:9});}
    else if(app.selectedPlace)app.map.flyTo({center:[app.selectedPlace.lon,app.selectedPlace.lat],zoom:app.selectedPlace.source==='gazetteer'?11:8.4,duration:0});
    else if(app.selectedCoordinate)app.map.flyTo({center:[app.selectedCoordinate.lon,app.selectedCoordinate.lat],zoom:9,duration:0});
    else fitAll(false);
    hideOverlay();updateRendererStatus('rendering');}

  else if(app.boundaryLoadFailed&&app.landcover){hideOverlay();updateRendererStatus('rendering','Physical-only GPU preview; no political boundaries loaded');}
  else overlay('Loading boundary data','Preparing the region geometry.');}

// Wheel/trackpad navigation stays anchored to the current map center.
// The built-in cursor-anchored scroll handler caused the map to drift north
// when users zoomed with the pointer above the panel center.
function installStableMapZoom(map){
  const canvasContainer=map.getCanvasContainer();
  let pendingDelta=0, frame=0;
  const handleWheel=event=>{
    event.preventDefault();
    event.stopPropagation();
    if(!app.ready||app.map!==map)return;
    const multiplier=event.deltaMode===1?16:event.deltaMode===2?canvasContainer.clientHeight:1;
    const delta=event.deltaY*multiplier;
    if(!Number.isFinite(delta)||Math.abs(delta)<.01)return;
    pendingDelta+=Math.max(-125,Math.min(125,delta));
    if(frame)return;
    frame=requestAnimationFrame(()=>{
      frame=0;
      if(!app.ready||app.map!==map){pendingDelta=0;return}
      const amount=Math.max(-210,Math.min(210,pendingDelta));
      pendingDelta=0;
      const zoom=Math.max(map.getMinZoom(),Math.min(map.getMaxZoom(),map.getZoom()-amount*.0019));
      if(Math.abs(zoom-map.getZoom())<.0001)return;
      if(journey.playing)journeyPause();
      map.jumpTo({zoom,center:map.getCenter()});
    });
  };
  canvasContainer.addEventListener('wheel',handleWheel,{passive:false});
  map.on('remove',()=>{
    if(frame)cancelAnimationFrame(frame);
    canvasContainer.removeEventListener('wheel',handleWheel);
  });
}
function zoomMapCentered(direction){
  if(!app.map){adjustFallbackZoom(direction>0?1.25:.8);return}
  journeyPause();
  const map=app.map, target=Math.max(map.getMinZoom(),Math.min(map.getMaxZoom(),map.getZoom()+direction));
  map.stop();
  map.easeTo({zoom:target,center:map.getCenter(),duration:atlasMotionOff()?0:145,essential:false});
}

function initMap(){
  if(!window.maplibregl?.Map){rendererFallback('Map engine unavailable','The MapLibre library could not load. Use the accessible SVG viewer instead.');return false}
  if(typeof window.maplibregl.supported==='function'&&!window.maplibregl.supported()){rendererFallback('WebGL unavailable','The browser cannot render this vector map. Use the SVG viewer instead.');return false}
  const attempt=++app.rendererAttempts;app.lastRendererAttemptAt=Date.now();
  updateRendererStatus('trying');
  try{
    app.map=new window.maplibregl.Map({container:'map',style:mapStyle(app.style,app.tileCatalog,app.transportCatalog),center:[79.5,22.6],zoom:3.25,minZoom:2,maxZoom:14,scrollZoom:false,fadeDuration:0,maxBounds:[[56,0],[105,45]],attributionControl:false,renderWorldCopies:false,dragRotate:false,pitchWithRotate:false});
    const mapInstance=app.map;
    installStableMapZoom(mapInstance);
    const canvas=app.map.getCanvas?.();
    canvas?.addEventListener?.('webglcontextlost', e=>{
      e.preventDefault?.();if(attempt!==app.rendererAttempts||app.map!==mapInstance)return;
      retireFailedRenderer('Map graphics interrupted','The browser lost its WebGL context. You can switch to the SVG viewer.',mapInstance);
    });
    canvas?.addEventListener?.('webglcontextrestored',()=>{
      if(attempt!==app.rendererAttempts||app.map!==mapInstance)return;
      // The browser may restore a context before MapLibre finishes rebuilding GPU state.
      // Keep the SVG visible until the user explicitly retries the renderer.
    });
    app.map.on('load',()=>{if(attempt!==app.rendererAttempts)return;mapLoadComplete()});
    app.map.on('click','soi-state-fill',e=>{
      if(atlasToolkit?.measureEnabled()||app.style!=='terrain')return;
      const original=String(e.features?.[0]?.properties?.STATE||'');
      if(!original)return;
      const name=normalizeSoIRegionName(original);
      const record=ATLAS_REGIONS.find(r=>normalizeSoIRegionName(r.name)===name);
      if(record)selectCatalogRegion(record);
      else toast('Survey of India feature: '+original+' · special internal-area record; check the official source notes.');
    });
    app.map.on('mousemove','soi-state-fill',e=>{
      if(app.style==='terrain'&&e.features?.length)app.map.getCanvas().style.cursor='pointer';
    });
    app.map.on('mouseleave','soi-state-fill',()=>{app.map.getCanvas().style.cursor=''});
    app.map.on('click','regions-fill',e=>{if(atlasToolkit?.measureEnabled())return;const n=e.features?.[0]?.properties?.name;if(n)selectRegion(n)});
    app.map.on('mousemove','regions-fill',e=>{const n=e.features?.[0]?.properties?.name||'';if(app.hovered!==n){app.hovered=n;updateMapFilters()}app.map.getCanvas().style.cursor=n?'pointer':''});
    app.map.on('mouseleave','regions-fill',()=>{app.hovered='';updateMapFilters();app.map.getCanvas().style.cursor=''});
    app.map.on('click','pilot-city-dots',e=>{if(atlasToolkit?.measureEnabled())return;if(!app.places||app.source?.kind==='import')return;const n=e.features?.[0]?.properties?.name;const p=activePilotCities().find(x=>x.name===n);if(p)selectPlace(p)});
    app.map.on('click','gazetteer-dots',e=>{if(atlasToolkit?.measureEnabled())return;if(!app.places||app.source?.kind==='import')return;const id=e.features?.[0]?.properties?.id;const p=app.gazetteerPlaces.find(v=>v.id===id);if(p)selectPlace(p)});
    app.map.on('click','local-settlements',e=>{
      if(atlasToolkit?.measureEnabled())return;if(!app.places||app.source?.kind==='import')return;
      const n=e.features?.[0]?.properties?.name;
      const candidates=app.gazetteerPlaces.filter(v=>v.name===n);
      if(!candidates.length)return;
      const pos=e.lngLat;
      const closest=candidates.reduce((a,b)=>Math.hypot(a.lat-pos.lat,a.lon-pos.lng)<=Math.hypot(b.lat-pos.lat,b.lon-pos.lng)?a:b);
      selectPlace(closest);
    });
    app.map.on('click',e=>{if(atlasToolkit?.measureEnabled())atlasToolkit.addPoint([e.lngLat.lng,e.lngLat.lat]);});
    app.map.on('moveend',()=>updateCoordinates());
    app.map.on('zoomend',()=>updateCoordinates());
    app.map.on('dragstart',()=>journeyPause());
    app.map.on('rotatestart',()=>journeyPause());
    app.map.on('error',e=>{if(attempt!==app.rendererAttempts||app.map!==mapInstance)return;const error=String(e?.error?.message||'Unknown map error');
      if(/tile|sha-256|integrity|protobuf|protocol/i.test(error)){
        $('tile-status').textContent='Map detail failed to load or verify · boundary-only content may remain available';
        console.warn('Optional map tile failed:',error);return;
      }
      if(/webgl|context lost|canvas|gpu|unsupported/i.test(error)){
        retireFailedRenderer('Map graphics unavailable',error,mapInstance);return;
      }
      console.warn('MapLibre rendering error:',error);
    });
    return true;
  }catch(e){try{app.map?.remove?.()}catch(_){}app.map=null;app.ready=false;rendererFallback('Unable to start the map',String(e.message));return false}
}
function updateCoordinates(){if(!app.map)return;const center=app.map.getCenter(),zoom=app.map.getZoom();updateDetailNarrative(zoom);updateScaleGuide();$('coordinate-view').textContent=`${Math.abs(center.lat).toFixed(2)}°${center.lat>=0?'N':'S'}  ·  ${Math.abs(center.lng).toFixed(2)}°${center.lng>=0?'E':'W'}  ·  Zoom ${zoom.toFixed(1)}`;$('detail-message').hidden=zoom<=6.5;}
function replaceDataset(fc,source){
  
  app.boundaryLoadFailed=false;$('boundary-retry-actions').hidden=true;
  journeyPause();app.features=fc;app.source=source;
  updateStyleButtons();app.selectedCatalogRegion=null;journeySync();updateLayerInventory();app.audit=inspectCollection(fc);app.selected='';app.selectedPlace=null;app.selectedCoordinate=null;app.hovered='';updateNearbyPlaces();app.filter='all';$('search-input').value='';$('region-heading').textContent='ALL REGIONS';document.querySelectorAll('[data-filter]').forEach(b=>{const sel=b.dataset.filter==='all';b.classList.toggle('active',sel);b.setAttribute('aria-pressed',String(sel))});
  renderRegions();updateQAPanel();updateFocus();changeSourceAttribution();syncMapData();
  if(source.kind==='import')setStyle('terrain');
  if(app.ready){fitAll(false);hideOverlay();}
  if(!app.map)rendererFallback(app.rendererFailure?.title||'Static map preview',app.rendererFailure?.message||'Interactive map rendering is unavailable. Boundaries remain provisional.');
  if(source.kind==='import')toast(`${fc.features.length} imported regions loaded · data remains unverified`);
  atlasToolkit?.dataUpdated();atlasComparison?.dataUpdated();
}
async function fetchPreview(){
  app.abort?.abort();app.abort=new AbortController();const id=++app.requestId;
  if(app.map&&!app.features&&!app.landcover)overlay('Loading boundary data','Checking locally stored geography, then pinned community data.');
  try{const {fc,source}=await loadCommunity({signal:app.abort.signal,allowRemoteFallback:false});if(id!==app.requestId)return;replaceDataset(fc,source)}
  catch(e){
    if(id!==app.requestId||e.name==='AbortError')return;
    // A network or integrity failure of OPTIONAL political geography is not a GPU failure.
    // Never destroy a healthy MapLibre canvas or discard a previously validated import.
    if(app.features){
      if(app.map&&app.ready)hideOverlay();
      toast('Boundary refresh unavailable · retaining previously loaded research geometry');
      return;
    }
    app.boundaryLoadFailed=true;$('boundary-retry-actions').hidden=false;
    app.style='physical';
    document.querySelectorAll('[data-style]').forEach(btn=>{const on=btn.dataset.style==='physical';btn.classList.toggle('active',on);btn.setAttribute('aria-pressed',String(on))});
    $('region-list').setAttribute('aria-busy','false');renderRegions();
    $('region-coverage-tag').textContent='REGION GEOMETRY UNAVAILABLE · PHYSICAL PREVIEW';
    $('map-source-status').textContent='PHYSICAL GEOGRAPHY ONLY · NO POLITICAL BORDERS';
    if(!app.map){
      rendererFallback('Political boundary data unavailable',app.landcover?'The historical physical map is available; no political borders are drawn.':`Political boundaries unavailable (${e.message}). Physical map will display when data loads.`);
    }else if(app.landcover){
      // Rebuild only the map style, keeping MapLibre and its camera alive.
      const epoch=++app.styleEpoch;
      app.ready=false;
      app.map.once('style.load',()=>{if(epoch!==app.styleEpoch)return;app.ready=true;syncMapData();hideOverlay();updateRendererStatus('rendering','Physical-only map; political boundaries unavailable');});
      try{app.map.setStyle(mapStyle('physical',app.tileCatalog,app.transportCatalog));}
      catch(styleError){app.ready=false;rendererFallback('Physical map style unavailable',String(styleError.message));}
    }else if(app.ready){
      // Local landcover may still be loading; do not claim a blank map is complete.
      overlay('Preparing physical geography','Political boundaries are unavailable. Loading source-backed land and water.');
    }
    toast('Political boundaries unavailable · preserving the map renderer');
  }
}
async function importFile(file){if(!file)return;
  try{
    if(file.size>12*1024*1024)throw new Error('GeoJSON is limited to 12 MB');
    const raw=JSON.parse(await file.text());
    const fc=validateUserImport(raw); // Strict screening must complete before mutating the active map.
    if(!fc.features.length)throw new Error('No valid regions');
    ++app.requestId;app.abort?.abort();
    replaceDataset(fc,importedSource(file.name));
  }catch(e){toast(`Import rejected: ${e.message}`)}
  finally{$('file-input').value=''}
}


async function restoreRememberedSoIBoundaries(){
  const cache=window.BharatAtlasLocalBoundaries;
  const status=$('soi-cache-status');
  if(!cache?.available()){status.textContent='Local saving is unavailable in this browser. You can still import archives for the current session.';return}
  try{
    const entries=await cache.load();
    if(app.soiImportWorker||app.soiStates||app.soiOutlineDetails)return;
    if(!entries.length)return;
    for(const entry of entries){
      if(entry.type==='states'){app.soiStates=entry.data;app.soiStateDetails=entry.details;app.soiSelected=''}
      if(entry.type==='outline'){app.officialClaim=entry.data;app.soiOutlineDetails=entry.details}
    }
    $('soi-remember').checked=true;
    updateStyleButtons();
    renderRegions();
    updateFocus();
    if(app.ready)syncMapData();
    if(app.soiStates){
      app.style='terrain';
      updateStyleButtons();
      applyStylePaint('terrain');
      $('region-coverage-tag').textContent=app.soiStates.features.length+' LOCAL CACHED SOI SOURCE POLYGONS · MAP EDITION REVIEW NEEDED';
      $('map-source-status').textContent='CACHED SOI SOURCE BOUNDARIES · PREVIOUSLY VERIFIED ARCHIVE · REVIEW NEEDED';
      $('soi-import-status').textContent='Restored converted state-boundary geometry saved on this device. The original SoI archive was SHA-256 checked when imported; the local cache was not revalidated against a new archive.';
    }else{
      $('soi-import-status').textContent='Restored a previously imported national outline from this device. State boundaries still require the ABDB archive.';
    }
    const notice=document.querySelector('.notice span:not(.notice-icon)');
    if(notice)notice.textContent='Locally stored Survey of India converted geometry from a previously SHA-256-checked import. This browser cache has not been independently verified against a newer map edition and is never uploaded.';
    status.textContent='Restored '+entries.map(e=>e.type).join(' and ')+' from this browser. Clear saved local boundaries to remove this copy.';
  }catch(error){
    console.warn('Local SoI cache restore skipped',error);
    status.textContent='Could not restore remembered boundaries. The live map remains usable; re-import the official archive if needed.';
  }
}
function rememberSoIBoundaries(data,details){
  const cache=window.BharatAtlasLocalBoundaries;
  if(!$('soi-remember').checked||!cache?.available())return;
  const status=$('soi-cache-status');
  status.textContent='Saving converted geometry in this browser. The original archive will not be stored…';
  // Schedule the storage clone separately from the first map render.
  setTimeout(()=>{
    cache.save(data,details).then(()=>{
      status.textContent='Saved locally on this device. The original archive was SHA-256 checked at import; you can clear this converted copy anytime.';
    }).catch(error=>{
      console.warn('Local boundary saving failed',error);
      status.textContent='Could not save converted boundaries (possibly browser storage quota). This session still has the imported map.';
    });
  },350);
}
async function clearRememberedSoIBoundaries(){
  const cache=window.BharatAtlasLocalBoundaries,status=$('soi-cache-status');
  if(!cache?.available()){status.textContent='Local boundary storage is not supported in this browser.';return}
  if(app.soiImportWorker){status.textContent='Cancel the running import before clearing local boundaries.';return}
  try{
    await cache.clear();
    $('soi-remember').checked=false;
    app.soiStates=null;app.soiStateDetails=null;app.soiSelected='';
    app.officialClaim=null;app.soiOutlineDetails=null;
    app.style='physical';
    if(app.ready)syncMapData();
    updateStyleButtons();applyStylePaint('physical');renderRegions();updateFocus();
    $('region-coverage-tag').textContent='ADMINISTRATIVE NAMES ONLY · NO VERIFIED REGIONAL GEOMETRY';
    $('map-source-status').textContent='PHYSICAL GEOGRAPHY · NO ADMINISTRATIVE BORDERS';
    $('soi-import-status').textContent='Saved boundary layers and the current loaded SoI layers cleared from this tab. You can import them again when needed.';
    status.textContent='Cleared saved local boundary data. Nothing was deleted from the original files on your device.';
  }catch(error){console.warn('Unable to clear SoI browser cache',error);status.textContent='Failed to clear local storage. Check browser site storage permissions.'}
}

function loadLocalSoIBoundary(file){
  const status=$('soi-import-status'),button=$('soi-import-btn');
  if(!file)return;
  if(!/\.(zip|rar)$/i.test(file.name)){status.textContent='Choose the official .rar or .zip archive';return}
  if(file.size>250*1024*1024){status.textContent='The archive exceeds the 250 MB browser limit';return}
  button.disabled=true;
  status.textContent='Opening official archive on this device; no upload to our servers…';
  let worker;
  const cancelButton=$('soi-cancel-btn');
  try{worker=new Worker('./vendor/soi-archive-worker.mjs',{type:'module'});}
  catch(error){button.disabled=false;status.textContent='The archive importer could not start in this browser. Try an up-to-date desktop browser.';console.warn('SoI worker unavailable',error);return;}
  app.soiImportWorker=worker;
  if(cancelButton){cancelButton.hidden=false;cancelButton.disabled=false;}
  const timeout=setTimeout(()=>{worker.terminate();if(app.soiImportWorker===worker)app.soiImportWorker=null;if(cancelButton)cancelButton.hidden=true;button.disabled=false;status.textContent='Import timed out. Check browser memory and retry with the official archive on a desktop.'},230000);
  const done=()=>{clearTimeout(timeout);worker.terminate();if(app.soiImportWorker===worker)app.soiImportWorker=null;button.disabled=false;if(cancelButton)cancelButton.hidden=true;$('soi-file-input').value=''};
  if(cancelButton)cancelButton.onclick=()=>{done();status.textContent='Import cancelled. No archive data was stored or uploaded.';};
  worker.onmessage=e=>{
    const info=e.data||{};
    if(info.type==='progress'){status.textContent=info.text;return}
    if(info.type==='error'){done();status.textContent='Archive not loaded: '+info.message;return}
    if(info.type!=='success')return;
    const {data,details}=info;
    rememberSoIBoundaries(data,details);
    if(details.type==='outline'){
      app.officialClaim=data;
      app.soiOutlineDetails=details;
      status.textContent='Survey of India February 2026 national outline installed ('+details.vertices.toLocaleString('en-IN')+' points). State/UT borders still require the ABDB RAR.';
    }else{
      app.soiStates=data;
      app.soiStateDetails=details;
      app.soiSelected='';
      renderRegions();updateFocus();
      status.textContent='Official archive SHA-256 verified; '+details.features+' polygons reprojected. Rendering state boundaries…';
    }
    if(app.ready)syncMapData();
    updateStyleButtons();
    if(details.type==='states'){
      setStyle('terrain');
      applyStylePaint('terrain');
      $('region-coverage-tag').textContent=details.features+' SOI-FORMAT OUTLINES · LOCAL IMPORT · REVIEW NEEDED';
      $('map-source-status').textContent='LOCAL SOI-FORMAT ADMINISTRATIVE SHAPES · SOURCE REVIEW PENDING';
    }else{
      $('map-source-status').textContent='SOI 2026 NATIONAL OUTLINE · 1:16M · STATES NOT INSTALLED';
    }
    if(app.rendererStatus==='fallback'&&app.landcover)rendererFallback('Static research viewer','Official outline imported locally; interactive renderer is unavailable.');
    const sourceNotice=document.querySelector('.notice span:not(.notice-icon)');
    if(sourceNotice)sourceNotice.textContent='Source: Survey of India, Government of India. The locally selected official '+(details.type==='states'?'May 2026 State Boundary archive':'February 2026 national outline ZIP')+' passed the pinned SHA-256 integrity check. Map content is displayed only in this browser session; no SoI data is uploaded. Independent comparison with the 13th edition 2026 political map is still advised.';
    if(details.type==='states'){
      let attempts=0;
      const finishRender=()=>{
        let rendered=0;
        try{if(app.map?.getLayer('soi-state-line'))rendered=app.map.queryRenderedFeatures({layers:['soi-state-line']}).length}catch(_){}
        if(rendered>0&&app.map?.isSourceLoaded('soi-state-boundaries')){
          status.textContent='Official SoI May 2026 archive hash verified · '+details.features+' state-area polygons installed · '+rendered+' boundary segments currently visible. Review against the 2026 political map for critical use.';
        }else if(++attempts<70){
          setTimeout(finishRender,400);
        }else{
          status.textContent='Official state polygons installed, but the renderer has not yet finished drawing them. Try zooming or reloading the physical view.';
        }
      };
      setTimeout(finishRender,400);
    }
    done();
  };
  worker.onerror=event=>{done();status.textContent='Browser archive reader failed. Use a ZIP containing the State Boundary .shp, .dbf, .prj and .shx files.';console.warn('Official archive reader error',event.message)};
  worker.postMessage({file});
}

function saveBlob(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function downloadSVG(){if(!app.features&&!app.landcover)return;try{
  if(!app.features){const file=renderPhysicalOnlySVG({land:app.landcover,hydrology:app.rivers?app.hydrology:null,shorelines:app.shores?app.shorelines:null,officialClaim:app.officialClaim});saveBlob(new Blob([file],{type:'image/svg+xml;charset=utf-8'}),PHYSICAL_ONLY_FILENAME);toast(app.officialClaim?'Source-labelled claimed outline exported · not a certified political map':'Historical physical map exported · NO political borders');return;}
  const whole=$('export-all').checked;const selected=whole?'':app.selected;if(!whole&&!selected)throw Error('Select a state or UT first, or export whole India');const file=renderResearchSVG(app.features,{selected,source:app.source,labels:app.labels,physicalLines:app.rivers&&app.source?.kind!=='import'?app.hydrology:null,physicalShore:app.shores&&app.source?.kind!=='import'?app.shorelines:null,physicalLand:app.source?.kind!=='import'?app.landcover:null,physicalTheme:app.style==='physical'&&!!app.landcover&&app.source?.kind!=='import'});saveBlob(new Blob([file],{type:'image/svg+xml;charset=utf-8'}),exportFileName(selected));toast('Research SVG prepared · boundary accuracy remains unverified')}catch(e){toast('SVG export failed: '+e.message)}}
function downloadQA(){if(!app.audit)return;const report={project:'Bharat Atlas',version:'0.37',pilotPlaces:PILOT_PROVENANCE,generatedAt:new Date().toISOString(),gazetteer:app.gazetteerMeta?{count:app.gazetteerPlaces.length,...app.gazetteerMeta}:null,source:app.source,officiallyVerified:false,screening:app.audit,scope:'Point checks and name coverage only. No claim of national boundary accuracy.',reference:'https://surveyofindia.gov.in/pages/political-map-of-india'};saveBlob(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),'bharat-atlas-v1-geographic-screening.json')}
function updateStyleButtons(){
  document.querySelectorAll('[data-style]').forEach(btn=>{
    const active=btn.dataset.style===app.style;
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-pressed',String(active));
    if(btn.dataset.style==='terrain'){
      btn.disabled=!(app.features||app.soiStates);
      btn.textContent=app.soiStates?'Survey of India states':app.features?'Imported regions':'Borders: import GeoJSON';
      btn.title=app.soiStates?'Hash-matched May 2026 SoI archive (local import); not an independently certified 2026 political map':app.features?'User-provided regional polygons — not official or verified':'Load the Survey of India archive locally or import licensed GeoJSON';
    }
  });
  const note=document.getElementById('atlas-style-note');
  if(note)note.textContent=app.soiStates
    ? 'Locally installed SoI-format State Boundary Shapefile; source identity and current political-map correspondence require review.'
    : app.features
    ? 'Regional boundaries shown only from your unverified imported GeoJSON; not an official map.'
    : 'Physical, muted and coastline styles work offline. Regional political borders require a licensed GeoJSON import.';
}
function applyStylePaint(style){
  const map=app.map;
  if(!map||!app.ready)return;
  const colors=style==='outline'
    ? ['#f7faf9','#fafcfa','#325c53',1.55,.94,.15]
    : style==='ink'
      ? ['#eef1f3','#dce4e0','#718c83',.8,.46,.20]
      : ['#edf5f6','#d3e3c9','#729f8b',.7,.17,.35];
  const [sea,land,shore,width,opacity,gridOpacity]=colors;
  const paints=[
    ['sea','background-color',sea],
    ['land-fill','fill-color',style==='terrain'?'#e0e8d8':land],
    ['land-edge','line-color',shore],
    ['land-edge','line-width',width],
    ['land-edge','line-opacity',opacity],
    ['graticule','line-opacity',gridOpacity],
    ['regions-fill','fill-opacity',app.features?(style==='physical'?0.07:style==='outline'?0.10:0.86):0],
    ['regions-border','line-opacity',app.features?(style==='physical'?0.36:style==='outline'?0.96:0.76):0],
    ['regions-border','line-color',style==='outline'?'#335f57':'#718a7f'],
    ['soi-state-line','line-opacity',style==='terrain'?0.92:0],
    ['soi-state-fill','fill-opacity',style==='terrain'?0.10:0],
    ['soi-state-selected','line-opacity',style==='terrain'?1:0]
  ];
  if(app.features){
    const palette=style==='outline'?['#fafcfb','#fafcfb','#fafcfb','#fafcfb','#fafcfb']
      :style==='ink'?['#e9ebe9','#dadfdf','#f0ece6','#e1e5e2','#e8ded8']:hues;
    paints.push(['regions-fill','fill-color',['match',['get','palette'],0,palette[0],1,palette[1],2,palette[2],3,palette[3],4,palette[4],palette[0]]]);
  }
  for(const [layer,property,value] of paints)if(map.getLayer(layer))map.setPaintProperty(layer,property,value);
}
function setStyle(style){
  if(!['terrain','physical','ink','outline'].includes(style))return;
  if(style==='terrain'&&!app.features&&!app.soiStates){
    toast('Administrative boundaries are not installed. Import a licensed GeoJSON file to enable this style.');
    document.getElementById('import-btn')?.focus();
    return;
  }
  if(!app.landcover&&style!=='terrain'){
    toast('The physical land source is still loading. Please try again.');
    return;
  }
  if(style===app.style)return;
  const before=app.style;
  app.style=style;
  updateStyleButtons();
  try{
    // Paint-only updates preserve sources, camera and zoom. Rebuilding the entire
    // MapLibre style for a color change caused avoidable reloads and stuttering.
    applyStylePaint(style);
    const label=document.getElementById('map-source-status');
    if(label)label.textContent=app.soiStates
      ? 'SOI-FORMAT STATE BOUNDARIES · LOCAL ONLY · REVIEW NEEDED'
      : app.features
      ? 'USER-IMPORTED REGIONS · NOT OFFICIAL GEOMETRY'
      : style==='outline'?'HISTORICAL COASTLINES · NOT POLITICAL BORDERS'
      : 'PHYSICAL GEOGRAPHY · NOT POLITICAL BORDERS';
  }catch(error){
    app.style=before;
    updateStyleButtons();
    console.warn('Atlas style paint update failed',error);
    toast('Map appearance could not be updated; previous style retained.');
    try{applyStylePaint(before)}catch(_){}
  }
}
function toggleMobile(force){const panel=$('left-panel'),open=typeof force==='boolean'?force:!panel.classList.contains('open');panel.classList.toggle('open',open);$('mobile-menu').setAttribute('aria-expanded',String(open));}
function wire(){
  const extras=$('atlas-extra-toggle');
  extras?.addEventListener('click',()=>{
    const advanced=document.body.classList.toggle('atlas-v1-advanced');
    extras.setAttribute('aria-expanded',String(advanced));
    extras.textContent=advanced?'Hide advanced tools':'More tools';
  });
  $('atlas-region-source')?.addEventListener('click',()=>$('source-dialog').showModal());
  $('atlas-quick-search')?.addEventListener('click',()=>{
    if(window.matchMedia?.('(max-width:860px)').matches)toggleMobile(true);
    $('search-input').focus();
  });
  $('atlas-quick-measure')?.addEventListener('click',()=>{
    document.body.classList.add('atlas-v1-advanced');
    if(extras){extras.setAttribute('aria-expanded','true');extras.textContent='Hide advanced tools'}
    document.querySelector('[data-tool-tab="measure"]')?.click();
    document.querySelector('.explorer-workspace')?.scrollIntoView({block:'start',behavior:atlasMotionOff()?'instant':'smooth'});
  });

  $('coverage-inspector-check').addEventListener('click',atlasRunCoverageInspection);
  $('coverage-inspector-map-center').addEventListener('click',atlasInspectMapCenter);
  $('download-renderer-report').addEventListener('click',exportRendererDiagnostics);
  $('retry-renderer').addEventListener('click',retryRenderer);
  $('retry-boundaries').addEventListener('click',()=>fetchPreview());
  $('mobile-menu').addEventListener('click',()=>toggleMobile());
  $('search-input').addEventListener('input',()=>{
    app.indexSearchEpoch++;app.indexMatches=[];renderRegions();
    const query=$('search-input').value,epoch=app.indexSearchEpoch;
    if(!app.searchIndex||normalizeQuery(query).length<2)return;
    app.searchIndex.search(query).then(records=>{
      if(epoch!==app.indexSearchEpoch||query!==$('search-input').value)return;
      app.indexMatches=records;renderRegions();
    }).catch(error=>console.warn('Optional source-backed search rejected:',String(error)));
  });
  $('search-input').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const result=currentSearchResults()[0];if(result){if(result.kind==='coordinate')selectCoordinate(result.entry);else if(result.kind==='place')selectPlace(result.entry);else if(result.kind==='region-catalog')selectCatalogRegion(result.entry);else selectRegion(result.name)}}});
  document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{app.filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(v=>{const on=v===b;v.classList.toggle('active',on);v.setAttribute('aria-pressed',String(on))});$('region-heading').textContent=app.filter==='all'?'ALL REGIONS':app.filter.toUpperCase();renderRegions()}));
  document.querySelectorAll('[data-style]').forEach(b=>b.addEventListener('click',()=>setStyle(b.dataset.style)));
  $('label-toggle').addEventListener('click',()=>{app.labels=!app.labels;$('label-toggle').setAttribute('aria-pressed',String(app.labels));updateMapFilters();if(!app.map&&(app.features||app.landcover))rendererFallback(app.rendererFailure?.title||'Static map viewer',app.rendererFailure?.message||'WebGL unavailable.');});
  $('rivers-toggle').addEventListener('click',()=>{
    app.rivers=!app.rivers;
    $('rivers-toggle').setAttribute('aria-pressed',String(app.rivers));
    updateMapFilters();
    if(!app.map&&(app.features||app.landcover))rendererFallback(app.rendererFailure?.title||'Static map viewer',app.rendererFailure?.message||'WebGL unavailable.');
  });
  $('shore-toggle').addEventListener('click',()=>{
    app.shores=!app.shores; $('shore-toggle').setAttribute('aria-pressed',String(app.shores));
    updateMapFilters();
    if(!app.map&&(app.features||app.landcover))rendererFallback(app.rendererFailure?.title||'Static map viewer',app.rendererFailure?.message||'WebGL unavailable.');
  });
  $('place-toggle').addEventListener('click',()=>{app.places=!app.places;app.selectedPlace=null;$('place-toggle').setAttribute('aria-pressed',String(app.places));renderRegions();updateFocus();updateMapFilters()});
  $('qa-toggle').addEventListener('click',()=>{app.checks=!app.checks;$('qa-toggle').setAttribute('aria-pressed',String(app.checks));updateMapFilters()});
  $('zoom-in').addEventListener('click',()=>zoomMapCentered(1));$('zoom-out').addEventListener('click',()=>zoomMapCentered(-1));
  for(const id of ['reset-map','reset-zoom','clear-focus'])$(id).addEventListener('click',()=>fitAll());
  $('import-btn').addEventListener('click',()=>$('file-input').click());$('file-input').addEventListener('change',()=>importFile($('file-input').files?.[0]));
  $('soi-import-btn').addEventListener('click',()=>$('soi-file-input').click());
  $('soi-file-input').addEventListener('change',()=>loadLocalSoIBoundary($('soi-file-input').files?.[0]));
  $('soi-clear-cache').addEventListener('click',clearRememberedSoIBoundaries);$('download-qa').addEventListener('click',downloadQA);$('download-svg').addEventListener('click',downloadSVG);
  $('my-location').addEventListener('click',()=>{
    if(!navigator.geolocation){toast('This browser does not provide geolocation');return;}
    toast('Requesting location permission from this device; nothing is uploaded.');
    navigator.geolocation.getCurrentPosition(position=>{
      const {longitude,latitude,accuracy}=position.coords;
      if(!atlasValidCoordinate([longitude,latitude])){toast('Your location is outside the current research map window');return;}
      selectCoordinate({name:'Device location (approximate)',lon:longitude,lat:latitude});
      toast(`Device location shown · browser accuracy estimate ±${Math.round(accuracy)} metres · not survey verified`);
    },error=>toast('Location not available: '+(error.code===1?'permission denied':'device location unavailable')),
    {enableHighAccuracy:false,timeout:12000,maximumAge:60000});
  });
  $('journey-play').addEventListener('click',journeyToggle);
  $('journey-clear').addEventListener('click',()=>{journeyPause();journey.index=-1;journeySync();updateJourneyTrail();});
  $('journey-prev').addEventListener('click',()=>{journeyPause();journeyGo(Math.max(0,journey.index-1));});
  $('journey-next').addEventListener('click',()=>{journeyPause();journeyGo(Math.min(journey.stops.length-1,journey.index+1));});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&journey.playing)journeyPause();});
  $('about-btn').addEventListener('click',()=>$('source-dialog').showModal());$('close-dialog').addEventListener('click',()=>$('source-dialog').close());$('dialog-ok').addEventListener('click',()=>$('source-dialog').close());
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('left-panel').classList.contains('open')){toggleMobile(false);$('mobile-menu').focus()}if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){e.preventDefault();toggleMobile(true);$('search-input').focus()}});
}
// The toolkit retains user selections and overlays in this tab; saved coordinates are
// browser-local only. It never sends personal records to the network.
atlasToolkit=atlasInitToolkit({getApp:()=>app,notify:toast,save:saveBlob,goToCoordinate:selectCoordinate,goToRegion:selectRegion,applyStyle:setStyle});
atlasComparison=atlasInitComparison({getApp:()=>app,save:saveBlob,notify:toast,motionOff:atlasMotionOff});
const atlasRequestedView=atlasParseViewParams(window.location.search);
if(atlasRequestedView.style && atlasRequestedView.style!=='physical'){
  app.style=atlasRequestedView.style;
  document.querySelectorAll('[data-style]').forEach(button=>{
    const on=button.dataset.style===app.style;button.classList.toggle('active',on);button.setAttribute('aria-pressed',String(on));
  });
}
function initializeSafePhysicalMode(){
  app.boundaryLoadFailed=true; app.style='physical';
  $('boundary-retry-actions').hidden=true;
  $('region-coverage-tag').textContent='PHYSICAL ONLY · FOR BORDERS SEE SURVEY OF INDIA';
  $('map-source-status').textContent='PHYSICAL REFERENCE · NOT INDIA BORDERS';
  $('region-list').setAttribute('aria-busy','false');
  updateStyleButtons();
  window.setTimeout(()=>{
    if(app.ready && app.landcover)return;
    if(!app.landcover)overlay('Physical map delayed','The static physical reference remains visible. Interactive geographic data is unavailable; this is not a political map.');
    else if(!app.ready && app.map)retireFailedRenderer('Renderer timeout','Switching to the static, self-hosted physical geography view.');
  },10000);
}
wire();$('state-total').textContent='28';$('ut-total').textContent='8';renderRegions();journeySync();updateDetailNarrative(3.1);updateLayerInventory();atlasRunCoverageInspection();initializeSafePhysicalMode();initMap();
setTimeout(restoreRememberedSoIBoundaries,1100);
// Local roads/rivers are optional; delayed/unreachable detail data must never block the base map.
loadTileManifest().then(catalog=>{
  if(!catalog){$('tile-status').textContent='No local road or river tiles included · boundary-only research atlas';return}
  // Tile *inventory* is useful even in the SVG-only viewer. Rendering and
  // catalogue availability are different states; never hide valid provenance
  // merely because MapLibre is not installed on this machine.
  app.tileCatalog=catalog;atlasRunCoverageInspection();updateLayerInventory();updateDetailNarrative(app.map?.getZoom?.()??3.1);atlasToolkit?.dataUpdated();
  if(!window.maplibregl?.addProtocol){
    $('tile-status').textContent=`${catalog.tileCount} source-checked tile files catalogued · interactive tile engine unavailable; SVG mode is still usable`;
    return;
  }
  try{registerSparseTileProtocol(window.maplibregl,catalog)}
  catch(e){$('tile-status').textContent='Tile catalogue loaded but its renderer protocol is unavailable';console.warn('Tile protocol:',e.message);return}
  $('tile-status').textContent=`OPTIONAL VECTOR DETAIL · ${catalog.layers.join(', ')} · ${catalog.tileCount} local tiles`;
  $('tile-attribution').textContent=`Optional detail: ${catalog.attribution} · ${catalog.licence} · NOT VERIFIED`;
  if(!app.map)return;
  const epoch=++app.styleEpoch;
  app.ready=false;
  app.map.once('style.load',()=>{if(epoch!==app.styleEpoch)return;app.ready=true;syncMapData();if(app.features||(app.boundaryLoadFailed&&app.landcover))hideOverlay()});
  try{app.map.setStyle(mapStyle(app.style,catalog,app.transportCatalog))}
  catch(e){app.tileCatalog=null;app.ready=true;syncMapData();$('tile-status').textContent='Detail tile style unavailable · using political boundaries';console.warn('Tile style:',e.message)}
}).catch(e=>{$('tile-status').textContent='Optional detail catalogue rejected · boundary-only map';console.warn('Tile catalogue:',e.message)});

// Optional separately licensed modern research transport package. Source-specific
// limits and SHA-256 verification are enforced by the shared sparse-tile handler.
// No implied navigation graph, authoritative coverage or map certification.
Promise.resolve(null).then(catalog=>{
  if(!catalog){$('transport-status').textContent='Modern transport research tiles: not supplied';return;}
  app.transportCatalog=catalog;atlasRunCoverageInspection();updateLayerInventory();updateDetailNarrative(app.map?.getZoom?.()??3.1);atlasToolkit?.dataUpdated();
  if(!window.maplibregl?.addProtocol){
    $('transport-status').textContent=`Research transport catalogue found: ${catalog.tileCount} tiles · interactive tile engine unavailable`;
    return;
  }
  try{atlasRegisterTransportPack(window.maplibregl,catalog)}
  catch(e){$('transport-status').textContent='Research transport data present; renderer protocol unavailable: '+String(e.message);return;}
  $('transport-status').textContent=`SESSION RESEARCH TRANSPORT · ${catalog.tileCount} source-backed tiles · ${catalog.layers.join(', ')} · not a routing service`;
  if(!app.map)return;
  const epoch=++app.styleEpoch;app.ready=false;
  app.map.once('style.load',()=>{if(epoch!==app.styleEpoch)return;app.ready=true;syncMapData();if(app.features||(app.boundaryLoadFailed&&app.landcover))hideOverlay()});
  try{app.map.setStyle(mapStyle(app.style,app.tileCatalog,catalog))}
  catch(e){app.transportCatalog=null;app.ready=true;syncMapData();$('transport-status').textContent='Research transport layer unavailable: '+String(e.message)}
}).catch(e=>{$('transport-status').textContent='Transport research manifest rejected: '+String(e.message)});

// Real but historical river traces: independently source-labelled, SHA-256 checked.
// This is a physical-geography overlay, not a source of national/state borders.
loadHydrology().then(result=>{
  if(!result)return;
  app.hydrology=result.fc;
  $('hydrology-attribution').textContent='Historic rivers: GSHHG/WDBII 2.3.6 · LGPL-3.0-or-later · unlabelled and generalized';
  if(!app.map&&(app.features||app.landcover))rendererFallback(app.rendererFailure?.title||'Static map viewer',app.rendererFailure?.message||'WebGL unavailable.');
}).catch(e=>{console.warn('Optional historical hydrology rejected:',e.message)});

// Independently checked GSHHG physical shorelines. Never interpret these lines as international borders.
loadShorelines().then(result=>{
  if(!result)return; app.shorelines=result;
  $('shore-attribution').textContent='Coasts and lakes: GSHHG 2.3.6 · LGPL-3.0-or-later · generalized, not administrative boundaries';
  if(!app.map&&(app.features||app.landcover))rendererFallback(app.rendererFailure?.title||'Static map viewer',app.rendererFailure?.message||'WebGL unavailable.');
}).catch(e=>{console.warn('Optional physical shorelines rejected:',e.message)});

// Source-derived GSHHG physical land/water; never a political or official boundary source.
loadLandcover().then(result=>{
  if(!result)return;app.landcover=result.fc;updateLayerInventory();atlasToolkit?.dataUpdated();
  document.querySelector('[data-style="physical"]').disabled=false;
  $('land-attribution').textContent='Land/water: GSHHG 2.3.6 · LGPL-3.0-or-later · physical generalized mask, NOT territorial boundaries';
  $('download-svg').disabled=false; // Valid physical data is exportable even with no political regions.
  if(!app.features&&app.boundaryLoadFailed){
    app.style='physical';
    document.querySelectorAll('[data-style]').forEach(btn=>{const on=btn.dataset.style==='physical';btn.classList.toggle('active',on);btn.setAttribute('aria-pressed',String(on))});
    if(app.map){
      if(app.ready){
        const epoch=++app.styleEpoch;app.ready=false;
        app.map.once('style.load',()=>{if(epoch!==app.styleEpoch)return;app.ready=true;syncMapData();hideOverlay();updateRendererStatus('rendering','Physical-only map; political boundaries unavailable');});
        try{app.map.setStyle(mapStyle('physical',app.tileCatalog,app.transportCatalog));}
        catch(error){app.ready=false;rendererFallback('Physical map style unavailable',String(error.message));}
      }else syncMapData(); // Initial map load or another style transition will render this source.
    }else rendererFallback('Political boundary data unavailable','Historical physical geography is available without political borders.');
  }else{
    syncMapData();
    if(!app.map)rendererFallback(app.rendererFailure?.title||'Static map viewer',app.rendererFailure?.message||'WebGL unavailable.');
  }
}).catch(e=>console.warn('Optional physical land mask rejected:',e.message));

// Optional gazetteer is independent of political boundaries. Missing/bad data never blocks core mapping.
loadGazetteer().then(result=>{
  if(!result){$('gazetteer-status').textContent='No source-labelled settlement dataset bundled · 25 pilot city samples only';return;}
  app.gazetteerPlaces=result.places;app.gazetteerMeta=result.metadata;journeyPrepare();updateNearbyPlaces();updateLayerInventory();atlasToolkit?.dataUpdated();atlasComparison?.dataUpdated();
  $('gazetteer-status').textContent=`${result.places.length.toLocaleString()} source-backed city locations · ${result.metadata.licence} · NOT SURVEY-VERIFIED`;
  $('gazetteer-attribution').textContent=`Place data: ${result.metadata.attribution} · ${result.metadata.licence} · ${result.places.length} entries`;
  renderRegions();
  if(app.ready)syncMapData();
}).catch(e=>{$('gazetteer-status').textContent='Optional place data rejected; pilot cities still available';console.warn('Place catalogue:',e.message)});

// Offline cache registration is scoped to same-origin, public research assets.
// This does NOT make external political geometry or MapLibre CDN available offline.
if('serviceWorker' in navigator&&(location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname))){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./offline-shell.js').catch(e=>console.warn('Optional offline shell unavailable:',String(e.message))));
}

// Integrity-checked, on-demand, user-supplied name index; neither address geocoding
// nor nationwide completeness is implied. Never query public Nominatim on keystrokes.
createAtlasShardSearch().then(index=>{
  if(!index)return;
  app.searchIndex=index;
  if(normalizeQuery($('search-input').value).length>=2){
    const query=$('search-input').value,epoch=++app.indexSearchEpoch;
    index.search(query).then(records=>{if(epoch===app.indexSearchEpoch&&query===$('search-input').value){app.indexMatches=records;renderRegions();}}).catch(console.warn);
  }
}).catch(error=>console.warn('Optional search index unavailable:',String(error)));

// Claimed national outline from a separately installed SoI-sourced generalised file.
// No state assignment or de-facto administrative control is inferred from it.
async function loadOfficialIndiaClaim(){
  try{
    const response=await fetch('./data/official-india/manifest.json',{cache:'no-cache'});
    if(response.status===404)return;
    if(!response.ok)throw Error('Claim outline metadata HTTP '+response.status);
    const meta=JSON.parse(await readBoundedText(response,20000));
    if(meta.schema!=='bharat-atlas-soi-claim-outline-v1'||meta.claimOnly!==true||
       meta.commercialRedistributionAllowed!==false||meta.politicalMap2026GeometryMatched!==false||
       meta.sourceUrl!=='https://surveyofindia.gov.in/documents/Outline_of_India.zip')throw Error('Claim outline provenance rejected');
    const textResponse=await fetch('./data/official-india/india-claim.geojson',{cache:'no-cache'});
    if(!textResponse.ok)throw Error('Claim outline data HTTP '+textResponse.status);
    const raw=await readBoundedText(textResponse,12000000);
    await verifyBoundaryDigest(raw,meta.outlineSha256);
    const fc=JSON.parse(raw);
    if(fc?.type!=='FeatureCollection'||fc.features?.length!==1||
       !['Polygon','MultiPolygon'].includes(fc.features[0].geometry?.type))throw Error('Invalid national outline feature structure');
    app.officialClaim=fc;
    if(app.ready)syncMapData();
    if(app.rendererStatus==='fallback'&&app.landcover)rendererFallback(app.rendererFailure?.title||'Static map viewer',app.rendererFailure?.message||'SVG research preview');
    $('map-source-status').textContent='SOI-SOURCED CLAIM OUTLINE · 1:16M · UNREVIEWED';
    $('map-source-status').title='Indian claim extent only; not an assertion of effective control; independent 2026 map comparison pending';
  }catch(e){console.warn('Official claim outline not enabled:',e.message);}
}
// Certified political data is NOT bundled; never auto-load an old cached claim outline.
