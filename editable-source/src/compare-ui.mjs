import {atlasComparePlaces,atlasComparisonBounds} from './compare.mjs';
/* Local-only UI. All user-facing strings are inserted via textContent.
 * The report never invents transportation links or government-endorsed boundaries.
 */
export function atlasInitComparison({getApp,save,notify,motionOff}){
 const find=id=>document.getElementById(id),from=find('compare-from'),to=find('compare-to'),message=find('compare-message');
 if(!from||!to||!message)return {dataUpdated(){},mapReady(){},fallbackReady(){}};
 let points=new Map(),last=null;
 const empty={type:'FeatureCollection',features:[]};
 function clearSVG(svg){svg?.querySelector('#atlas-comparison-svg')?.remove()}
 function drawSVG(svg){
  clearSVG(svg);if(!svg||!last)return;
  const projection=svg.getAttribute('data-atlas-projection')?.split(',').map(Number);
  if(!projection||projection.length!==6||projection.some(v=>!Number.isFinite(v)))return;
  const [west,north,x0,y0,sx,sy]=projection;
  const ns='http://www.w3.org/2000/svg',g=document.createElementNS(ns,'g');g.setAttribute('id','atlas-comparison-svg');g.setAttribute('pointer-events','none');
  const xy=pair=>[x0+(pair[0]-west)*sx,y0+(north-pair[1])*sy];
  const path=document.createElementNS(ns,'polyline');path.setAttribute('points',last.geometry.features[0].geometry.coordinates.map(c=>xy(c).join(',')).join(' '));
  path.setAttribute('fill','none');path.setAttribute('stroke','#b35435');path.setAttribute('stroke-width','4');path.setAttribute('stroke-opacity','.9');path.setAttribute('stroke-dasharray','8 5');g.append(path);
  last.endpoints.forEach((p,i)=>{const [x,y]=xy([p.lon,p.lat]);const point=document.createElementNS(ns,'circle');point.setAttribute('cx',x);point.setAttribute('cy',y);point.setAttribute('r','7');point.setAttribute('fill',i?'#176c63':'#b35435');point.setAttribute('stroke','white');point.setAttribute('stroke-width','2');g.append(point)});
  svg.append(g);
 }
 function updateGeometry(){
  const app=getApp();try{app.map?.getSource('atlas-comparison')?.setData(last?.geometry||empty)}catch(_){/* style not ready */}
  drawSVG(document.querySelector('#map-overlay svg.fallback-map-svg'));
 }
 function update(){
  const a=points.get(from.value),b=points.get(to.value);last=null;
  if(!a||!b){message.textContent='Choose two source-listed places to compare their straight-line geography.';}
  else{
   try{last=atlasComparePlaces(a,b);message.textContent=`≈ ${Math.round(last.distanceKm).toLocaleString()} km · ${last.bearingCompass} from ${a.name} to ${b.name} · midpoint ${last.midpoint.lat.toFixed(3)}°N, ${last.midpoint.lon.toFixed(3)}°E · direct line, NOT a travel route`;}
   catch(e){message.textContent=String(e.message)}
  }
  find('compare-focus').disabled=!last;find('compare-download').disabled=!last;
  updateGeometry();return last;
 }
 function newOptions(sel,entries,previous){
  sel.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Choose a listed location';sel.append(placeholder);
  for(const [id,p] of entries){const o=document.createElement('option');o.value=id;o.textContent=`${p.name} · ${p.region||'region not verified'} · ${p.kind||'place'}`;sel.append(o)}
  sel.value=points.has(previous)?previous:'';
 }
 function dataUpdated(){
  const app=getApp();const previousA=from.value,previousB=to.value;points=new Map();
  if(app.source?.kind==='import'){message.textContent='Comparison is disabled for uploaded political polygons. Use only the separate source-labelled point catalogue.';}
  else{
   const candidates=[...(app.gazetteerPlaces||[])];
   // Do not double count pilot locations when a source-labelled location is already available.
   for(const p of candidates){if(!p||!Number.isFinite(p.lon)||!Number.isFinite(p.lat)||typeof p.name!=='string')continue;
    const key=String(p.id||`${p.name}:${p.lon}:${p.lat}`);if(!points.has(key))points.set(key,p);}
  }
  const sorted=[...points.entries()].sort((a,b)=>a[1].name.localeCompare(b[1].name));
  newOptions(from,sorted,previousA);newOptions(to,sorted,previousB);from.disabled=!sorted.length;to.disabled=!sorted.length;
  find('compare-available').textContent=`${sorted.length} source-backed locations available · Natural Earth selected cities only`;
  update();
 }
 from.addEventListener('change',update);to.addEventListener('change',update);
 find('compare-swap').addEventListener('click',()=>{const a=from.value;from.value=to.value;to.value=a;update()});
 find('compare-clear').addEventListener('click',()=>{from.value='';to.value='';update()});
 find('compare-focus').addEventListener('click',()=>{
  if(!last)return;const app=getApp();
  if(app.map&&app.ready){try{app.map.fitBounds(atlasComparisonBounds(last),{padding:window.innerWidth<760?40:95,maxZoom:9,duration:motionOff()?0:1000});}
   catch(e){notify('Unable to focus comparison: '+e.message)}}
  else notify('The comparison line is drawn on the SVG research map; zoom controls remain available.');
 });
 find('compare-download').addEventListener('click',()=>{
  if(!last)return;save(new Blob([JSON.stringify({...last,generatedAt:new Date().toISOString()},null,2)+'\n'],{type:'application/json'}),'bharat-atlas-place-comparison.json');
 });
 dataUpdated();
 return {dataUpdated,mapReady:updateGeometry,fallbackReady:drawSVG};
}
