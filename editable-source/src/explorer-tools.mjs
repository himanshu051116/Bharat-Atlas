/* Bharat Atlas research toolkit v0.31.
 * Locally calculated exploratory quantities and source-labelled overlays.
 * Not a survey, official boundary, address geocoder or road-routing engine.
 */
export const ATLAS_EARTH_RADIUS_KM=6371.0088;
export function atlasValidCoordinate(pair){return Array.isArray(pair)&&pair.length===2&&pair.every(n=>typeof n==='number'&&Number.isFinite(n))&&pair[0]>=60&&pair[0]<=102&&pair[1]>=3&&pair[1]<=41;}
export function atlasParseCoordinateInput(value){
  const parts=String(value).trim().split(/[,\s]+/);
  if(parts.length!==2||parts.some(v=>v===''||!/^[-+]?\d+(?:\.\d+)?$/.test(v)))throw Error('Enter longitude, latitude in decimal degrees, e.g. 77.41, 23.26');
  const point=parts.map(Number);
  if(!atlasValidCoordinate(point))throw Error('Coordinate is outside the supported India research window (60–102°E, 3–41°N)');
  return point;
}
export function atlasHaversineKm(a,b){
 if(!atlasValidCoordinate(a)||!atlasValidCoordinate(b))throw Error('Invalid WGS84 research coordinate');
 const radians=Math.PI/180,phi1=a[1]*radians,phi2=b[1]*radians;
 const dPhi=(b[1]-a[1])*radians,dLam=(b[0]-a[0])*radians;
 const s=Math.sin(dPhi/2)**2+Math.cos(phi1)*Math.cos(phi2)*Math.sin(dLam/2)**2;
 return 2*ATLAS_EARTH_RADIUS_KM*Math.asin(Math.min(1,Math.sqrt(s)));
}
export function atlasMeasurePath(points,mode='distance'){
 if(!['distance','area'].includes(mode)||!Array.isArray(points)||points.length>80||points.some(p=>!atlasValidCoordinate(p)))throw Error('Invalid measurement');
 let km=0;
 for(let i=1;i<points.length;i++)km+=atlasHaversineKm(points[i-1],points[i]);
 let km2=null;
 if(mode==='area'&&points.length>=3){
   // Chamberlain-Duquette spherical polygon approximation; suitable for exploratory estimates only.
   // Longitude is bounded to a 42-degree research window, preventing antimeridian crossings.
   const rad=Math.PI/180;
   let total=0;
   for(let i=0;i<points.length;i++){
     const a=points[i],b=points[(i+1)%points.length];
     total+=(b[0]-a[0])*rad*(2+Math.sin(a[1]*rad)+Math.sin(b[1]*rad));
   }
   km2=Math.abs(total)*ATLAS_EARTH_RADIUS_KM**2/2;
   km+=atlasHaversineKm(points.at(-1),points[0]);
 }
 return {mode,pointCount:points.length,km,km2,method:'Spherical approximation, not survey-grade; direct segments, not road routing'};
}
export function atlasMeasurementGeoJSON(points,mode){
 if(!Array.isArray(points)||points.some(p=>!atlasValidCoordinate(p))||!['distance','area'].includes(mode))throw Error('Invalid measurement geometry');
 const features=[];
 if(points.length>=(mode==='distance'?2:3)){
   features.push({type:'Feature',properties:{kind:'user-measurement',method:'approximate geodesic',officiallyVerified:false},geometry:{type:mode==='area'?'Polygon':'LineString',coordinates:mode==='area'?[points.concat([points[0]])]:points}});
 }
 for(const [index,p] of points.entries())features.push({type:'Feature',properties:{kind:'vertex',index:index+1},geometry:{type:'Point',coordinates:p}});
 return {type:'FeatureCollection',features};
}
function atlasLineKind(properties){
 const kind=String(properties.kind||properties.class||'').toLowerCase();
 if(properties.railway||/rail|train/.test(kind))return 'railway';
 if(properties.waterway||/river|stream|canal|water/.test(kind))return 'waterway';
 if(properties.highway||/road|highway|street|path/.test(kind))return 'road';
 if(/settlement|city|town|village|station|place/.test(kind)||properties.place)return 'settlement';
 return null;
}
export function atlasValidateResearchOverlay(input,metadata){
 const meta={title:String(metadata?.title||'').trim(),sourceUrl:String(metadata?.sourceUrl||'').trim(),licence:String(metadata?.licence||'').trim(),attribution:String(metadata?.attribution||'').trim()};
 if(!meta.title||meta.title.length>100||!/^https:\/\//i.test(meta.sourceUrl)||meta.sourceUrl.length>700||!meta.licence||meta.licence.length>120||!meta.attribution||meta.attribution.length>200)throw Error('Provide source title, HTTPS source URL, licence and attribution before importing');
 if(input?.type!=='FeatureCollection'||!Array.isArray(input.features)||!input.features.length||input.features.length>5000)throw Error('Expected GeoJSON FeatureCollection with 1–5,000 line or point features');
 if(input.crs&&!/4326|CRS84/i.test(JSON.stringify(input.crs)))throw Error('Reproject input to WGS84 longitude/latitude');
 let vertices=0;const counts={road:0,railway:0,waterway:0,settlement:0};
 const features=input.features.map((feature,index)=>{
   const geom=feature?.geometry,props=feature?.properties||{},type=geom?.type;
   if(feature?.type!=='Feature'||!['Point','LineString','MultiLineString'].includes(type))throw Error(`Feature ${index+1}: only Point/LineString/MultiLineString supported`);
   const kind=atlasLineKind(props);
   if(!kind)throw Error(`Feature ${index+1}: supply kind, highway, railway, waterway or place classification`);
   if(kind==='settlement'&&type!=='Point'||kind!=='settlement'&&type==='Point')throw Error(`Feature ${index+1}: class and geometry type do not match`);
   const lists=type==='Point'?[[geom.coordinates]]:type==='LineString'?[geom.coordinates]:geom.coordinates;
   if(!Array.isArray(lists)||!lists.length||lists.length>500)throw Error(`Feature ${index+1}: invalid coordinates`);
   for(const list of lists){
     if(!Array.isArray(list)||list.length<(type==='Point'?1:2))throw Error(`Feature ${index+1}: invalid geometry`);
     for(const point of list){if(!atlasValidCoordinate(point))throw Error(`Feature ${index+1}: coordinate outside India research window`);if(++vertices>80000)throw Error('Overlay has more than 80,000 vertices');}
   }
   counts[kind]++;
   const name=String(props.name||'').trim().slice(0,100);
   return {type:'Feature',properties:{kind,name,source:meta.title,officiallyVerified:false},geometry:{type,coordinates:geom.coordinates}};
 });
 return {collection:{type:'FeatureCollection',features},metadata:{...meta,officiallyVerified:false,scope:'Research visualization only, NOT independently verified for map accuracy, rights or completeness'},counts,vertices};
}
export function atlasMakeBookmark({name,lon,lat,kind='coordinate'}){
 const pair=[lon,lat];if(!atlasValidCoordinate(pair)||!['coordinate','city'].includes(kind))throw Error('Bookmark location invalid');
 const label=String(name||'').trim().slice(0,100);if(!label)throw Error('Bookmark label required');
 return {name:label,lon,lat,kind};
}
export function atlasCleanBookmarks(value){
 if(!Array.isArray(value))return [];
 const clean=[];
 for(const item of value.slice(0,100))try{const b=atlasMakeBookmark(item);if(!clean.some(p=>p.lon===b.lon&&p.lat===b.lat))clean.push(b);}catch(_){/* Reject invalid saved records */}
 return clean.slice(0,40);
}
export function atlasParseViewParams(search){
 const p=new URLSearchParams(String(search||'').slice(0,700));const out={};
 const style=p.get('theme');if(['terrain','physical','ink','outline'].includes(style))out.style=style;
 const region=p.get('region');if(region&&region.length<=100&&/^[\p{L} .&()-]+$/u.test(region))out.region=region;
 if(p.has('lon')||p.has('lat')){
  const lon=Number(p.get('lon')),lat=Number(p.get('lat'));
  if(p.get('lon')!==null&&p.get('lat')!==null&&atlasValidCoordinate([lon,lat]))out.coordinate=[lon,lat];
 }
 return out;
}
export function atlasViewURL(base,{style,region,coordinate,officiallyVerified=false}={}){
 const url=new URL(base);url.search='';url.hash='';
 if(['terrain','physical','ink','outline'].includes(style))url.searchParams.set('theme',style);
 if(!officiallyVerified&&region&&region.length<=100)url.searchParams.set('region',region);
 if(coordinate&&atlasValidCoordinate(coordinate)){
  url.searchParams.delete('region');url.searchParams.set('lon',String(Number(coordinate[0].toFixed(5))));url.searchParams.set('lat',String(Number(coordinate[1].toFixed(5))));
 }
 return url.href;
}
