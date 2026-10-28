/* Bharat Atlas v0.32 – source-aware geographic context.
 * Calculations are approximate WGS84/spherical research aids, never roads,
 * authoritative survey distances or state/sovereignty determinations.
 */
const DEG=Math.PI/180;
const EARTH_KM=6371.0088;
export function atlasValidLonLat(lon,lat){return Number.isFinite(lon)&&Number.isFinite(lat)&&lon>=-180&&lon<=180&&lat>=-90&&lat<=90;}
export function atlasGreatCircleKm(a,b){
 if(!a||!b||!atlasValidLonLat(a.lon,a.lat)||!atlasValidLonLat(b.lon,b.lat))throw Error('Valid longitude and latitude required');
 const dlat=(b.lat-a.lat)*DEG,dlon=(b.lon-a.lon)*DEG;
 const hav=Math.min(1,Math.max(0,Math.sin(dlat/2)**2+Math.cos(a.lat*DEG)*Math.cos(b.lat*DEG)*Math.sin(dlon/2)**2));
 return 2*EARTH_KM*Math.atan2(Math.sqrt(hav),Math.sqrt(1-hav));
}
export function atlasBearing(a,b){
 if(!a||!b||!atlasValidLonLat(a.lon,a.lat)||!atlasValidLonLat(b.lon,b.lat))throw Error('Invalid bearing coordinates');
 if(atlasGreatCircleKm(a,b)<0.000001)return null;
 const dl=(b.lon-a.lon)*DEG;
 const y=Math.sin(dl)*Math.cos(b.lat*DEG);
 const x=Math.cos(a.lat*DEG)*Math.sin(b.lat*DEG)-Math.sin(a.lat*DEG)*Math.cos(b.lat*DEG)*Math.cos(dl);
 return (Math.atan2(y,x)/DEG+360)%360;
}
export function atlasCompass(bearing){return bearing===null?'same location':['N','NE','E','SE','S','SW','W','NW'][Math.round(bearing/45)%8];}
export function atlasNearbyPlaces(centre,places,{limit=5,minKm=0.25}={}){
 if(!centre||!atlasValidLonLat(centre.lon,centre.lat)||!Array.isArray(places)||!Number.isInteger(limit)||limit<1||limit>20)throw Error('Invalid nearby search');
 const rows=[];const ids=new Set();
 for(const p of places){
  if(!p||typeof p.name!=='string'||!p.name.trim()||!atlasValidLonLat(p.lon,p.lat))continue;
  const id=String(p.id||`${p.name}:${p.lon}:${p.lat}`);
  if(ids.has(id))continue;ids.add(id);
  const km=atlasGreatCircleKm(centre,p);
  if(km<=minKm)continue;
  const bearing=atlasBearing(centre,p);
  rows.push({id,name:p.name,lon:p.lon,lat:p.lat,kind:p.kind||'place',region:p.region||'Not survey verified',source:p.source||'unverified',km,bearing,direction:atlasCompass(bearing)});
 }
 return rows.sort((a,b)=>a.km-b.km||a.name.localeCompare(b.name)||a.id.localeCompare(b.id)).slice(0,limit);
}
export function atlasScaleFromMetersPerPixel(metresPerPixel,{targetPx=95}={}){
 if(!Number.isFinite(metresPerPixel)||metresPerPixel<=0||!Number.isFinite(targetPx)||targetPx<=0)throw Error('Invalid map scale');
 const desired=metresPerPixel*targetPx;
 const power=10**Math.floor(Math.log10(desired));
 const unit=[1,2,5,10].filter(n=>n*power<=desired).at(-1)||1;
 const metres=power*unit;
 return {metres,pixels:metres/metresPerPixel,label:metres>=1000?`${Number((metres/1000).toFixed(3))} km`:`${Number(metres.toFixed(2))} m`};
}
export function atlasMercatorScale(latitude,zoom){
 if(!Number.isFinite(latitude)||Math.abs(latitude)>85.05||!Number.isFinite(zoom)||zoom<0||zoom>23)throw Error('Invalid map centre or zoom');
 const metresPerPixel=(2*Math.PI*6378137*Math.cos(latitude*DEG))/(512*2**zoom);
 return atlasScaleFromMetersPerPixel(metresPerPixel);
}
export function atlasGreatCircleSegment(a,b,{steps=28}={}){
 if(!a||!b||!atlasValidLonLat(a.lon,a.lat)||!atlasValidLonLat(b.lon,b.lat)||!Number.isInteger(steps)||steps<1||steps>200)throw Error('Invalid journey segment');
 const point=p=>{const lat=p.lat*DEG,lon=p.lon*DEG;return [Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)];};
 const A=point(a),B=point(b),dot=Math.max(-1,Math.min(1,A.reduce((s,x,i)=>s+x*B[i],0)));
 const theta=Math.acos(dot),sin=Math.sin(theta),coords=[];
 for(let i=0;i<=steps;i++){
  const t=i/steps,k0=sin>1e-8?Math.sin((1-t)*theta)/sin:(1-t),k1=sin>1e-8?Math.sin(t*theta)/sin:t;
  const v=A.map((x,j)=>x*k0+B[j]*k1),length=Math.hypot(...v);
  // Antipodal points cannot define a unique shortest spherical path.
  if(length<1e-10)throw Error('Ambiguous antipodal path');
  coords.push([Math.atan2(v[1],v[0])/DEG,Math.asin(Math.max(-1,Math.min(1,v[2]/length)))/DEG]);
 }
 return coords;
}
export function atlasJourneyTrail(stops,currentIndex){
 if(!Array.isArray(stops)||!Number.isInteger(currentIndex))throw Error('Invalid journey progress');
 const features=[];
 for(let i=1;i<=Math.min(currentIndex,stops.length-1);i++){
  const a=stops[i-1],b=stops[i];
  features.push({type:'Feature',properties:{sequence:i,kind:'great-circle-research-line',description:'Approximate direct-line geographic connector; not a road, flight or travel route'},geometry:{type:'LineString',coordinates:atlasGreatCircleSegment(a,b)}});
 }
 return {type:'FeatureCollection',features};
}
