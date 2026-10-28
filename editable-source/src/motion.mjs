/* Motion and zoom language for Bharat Atlas. Pure, deterministic functions.
 * Does not imply survey accuracy or national dataset completeness. */
export function atlasReducedMotion(media = null) {
  try { return Boolean(media?.matches); } catch (_) { return false; }
}
export function atlasMotionDuration(current, target, {reduced=false, speed=1}={}) {
  if(reduced) return 0;
  const a=Array.isArray(current)?current:[79.5,22.6];
  const b=Array.isArray(target)?target:a;
  if(![...a,...b].every(Number.isFinite)) return 580;
  const dx=(a[0]-b[0])*Math.cos(((a[1]+b[1])/2)*Math.PI/180),dy=a[1]-b[1];
  const dist=Math.hypot(dx,dy);
  const rate=Math.min(1.75,Math.max(.6,Number(speed)||1));
  return Math.round(Math.min(1450,Math.max(360,390+dist*28))/rate);
}
export function atlasZoomNarrative(zoom,{hasTransport=false,hasTiles=false,hasPlaces=false}={}) {
  if(!Number.isFinite(zoom))return {title:'Map overview',description:'Zoom level not available'};
  if(zoom<4.5)return {title:'Regional overview',description:'Generalized physical geography. Boundaries are not certified.'};
  if(zoom<6.5)return {title:'Landscape & cities',description:hasPlaces?'Selected, source-labelled populated places appear as you zoom.':'City-level coverage is not yet loaded.'};
  if(zoom<9)return {title:'Closer geography',description:hasTiles?'Source-backed generalized waterways, shorelines and city points where tiles exist.':'No verified local detail tiles at this scale.'};
  return {title:'Close inspection',description:hasTransport?'Modern transport research features only where supplied; not a navigable street map.':'National roads, addresses and detailed locality coverage are not bundled.'};
}
function validPlace(p){return p&&typeof p.name==='string'&&p.name.trim()&&Number.isFinite(p.lon)&&Number.isFinite(p.lat)&&p.lon>=60&&p.lon<=102&&p.lat>=3&&p.lat<=41;}
export function atlasJourneyStops(places,limit=7) {
  if(!Array.isArray(places)||!Number.isInteger(limit)||limit<1||limit>15)throw Error('Invalid journey source or stop count');
  const seen=new Set();
  const entries=places.filter(validPlace).filter(p=>{
    const key=`${p.name.toLowerCase().trim()}|${p.lon.toFixed(4)}|${p.lat.toFixed(4)}`;
    if(seen.has(key))return false;seen.add(key);return true;
  }).slice().sort((a,b)=>a.lat-b.lat||a.lon-b.lon||a.name.localeCompare(b.name));
  if(!entries.length)return [];
  // Farthest-point sampling shows varied geography; every stop is an actual source point.
  const selected=[entries[0]];
  const sqdist=(p,q)=>((p.lon-q.lon)*.88)**2+(p.lat-q.lat)**2;
  while(selected.length<Math.min(limit,entries.length)){
    let best=null,bestDistance=-1;
    for(const p of entries){if(selected.includes(p))continue;
      const nearest=Math.min(...selected.map(q=>sqdist(p,q)));
      if(nearest>bestDistance+1e-10){best=p;bestDistance=nearest;}
    }
    if(!best)break;selected.push(best);
  }
  return selected.map(p=>({id:String(p.id||p.name),name:p.name,region:String(p.region||'Unverified assignment'),lat:p.lat,lon:p.lon,kind:String(p.kind||'place'),source:String(p.source||'gazetteer')}));
}
export function atlasClampZoom(value){return Math.min(6,Math.max(1,value));}
export function atlasFallbackTarget({currentZoom=1,newZoom=1,pan={x:0,y:0},anchor={x:0,y:0}}={}){
  const z=atlasClampZoom(newZoom),old=atlasClampZoom(currentZoom);
  if(!Number.isFinite(anchor.x)||!Number.isFinite(anchor.y))throw Error('Invalid map zoom anchor');
  if(z===1)return {zoom:1,pan:{x:0,y:0}};
  const ratio=z/old;
  // Transforms use the SVG's center as origin. Anchor coordinates are in viewport pixels relative to that center.
  return {zoom:z,pan:{x:anchor.x-(anchor.x-(Number(pan.x)||0))*ratio,y:anchor.y-(anchor.y-(Number(pan.y)||0))*ratio}};
}
