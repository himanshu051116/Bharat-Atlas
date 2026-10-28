/* Bharat Atlas v1.11 — deterministic local application bundle. */
(()=>{

/* src/geography.mjs */
/* Bharat Atlas v0.8 · pure geographic-data validation utilities.
 * Never equate schema/spot-check success with official boundary verification.
 */
const STATES = Object.freeze(['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal']);
const UTS = Object.freeze(['Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry']);
const REGIONS = Object.freeze([...STATES, ...UTS]);
const set = new Set(REGIONS);
const aliases = {'Orissa':'Odisha','Uttaranchal':'Uttarakhand','Andaman and Nicobar':'Andaman and Nicobar Islands','Pondicherry':'Puducherry','NCT of Delhi':'Delhi','Jammu & Kashmir':'Jammu and Kashmir'};
const CHECKPOINTS = Object.freeze([
  {title:'Gilgit sample',lon:74.3,lat:35.92,expected:'Ladakh'},
  {title:'Muzaffarabad sample',lon:73.47,lat:34.37,expected:'Jammu and Kashmir'},
  {title:'Aksai Chin sample',lon:79.1,lat:35.0,expected:'Ladakh'},
  {title:'Shaksgam sample',lon:76.41987,lat:36.11126,expected:'Ladakh'}
]);
const canonical = n => aliases[String(n??'').trim()] ?? String(n??'').trim();
const rawName = f => f?.properties?.name ?? f?.properties?.NAME_1 ?? f?.properties?.st_nm ?? f?.properties?.STNAME ?? f?.properties?.STATE;
const area2 = ring => ring.slice(1).reduce((a,p,i)=>a+(ring[i][0]*p[1]-p[0]*ring[i][1]),0);
// Lightweight browser guard, not a replacement for full GEOS/shapely topology audit.
// Only small rings are exhaustively checked: large rings must still pass offline GIS QA.
function cross(a,b,c){return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
function segmentsIntersect(a,b,c,d){
 const eq=(u,v)=>u[0]===v[0]&&u[1]===v[1];
 if(eq(a,c)||eq(a,d)||eq(b,c)||eq(b,d))return true;
 const o1=cross(a,b,c),o2=cross(a,b,d),o3=cross(c,d,a),o4=cross(c,d,b);
 const eps=1e-10;
 const on=(u,v,w)=>Math.min(u[0],v[0])-eps<=w[0]&&w[0]<=Math.max(u[0],v[0])+eps&&Math.min(u[1],v[1])-eps<=w[1]&&w[1]<=Math.max(u[1],v[1])+eps;
 if(Math.abs(o1)<eps&&on(a,b,c)||Math.abs(o2)<eps&&on(a,b,d)||Math.abs(o3)<eps&&on(c,d,a)||Math.abs(o4)<eps&&on(c,d,b))return true;
 return (o1>0)!==(o2>0)&&(o3>0)!==(o4>0);
}
function ringSelfIntersects(ring){
 const n=ring.length-1;
 if(n>512)return false; // Geometry above this must undergo the offline GEOS validation gate.
 for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
   if(j===i+1||(i===0&&j===n-1))continue; // Adjacent segments meet legitimately.
   if(segmentsIntersect(ring[i],ring[i+1],ring[j],ring[j+1]))return true;
 }
 return false;
}
function fail(message){throw new Error(message)}
function validateRing(ring,name,counter){
  if(!Array.isArray(ring)||ring.length<4)fail(`${name}: invalid polygon ring`);
  if(ring.length>120000)fail(`${name}: polygon too detailed for this preview`);
  const start=ring[0],end=ring.at(-1);
  if(!Array.isArray(start)||!Array.isArray(end)||start.length<2||end.length<2||start[0]!==end[0]||start[1]!==end[1])fail(`${name}: unclosed polygon ring`);
  for(const pt of ring){
    if(!Array.isArray(pt)||pt.length<2||!Number.isFinite(pt[0])||!Number.isFinite(pt[1])||pt[0]<60||pt[0]>102||pt[1]<3||pt[1]>41)fail(`${name}: invalid longitude or latitude`);
    counter.n++;if(counter.n>400000)fail('Dataset exceeds geometry safety limit');
  }
  for(let i=1;i<ring.length;i++)if(ring[i][0]===ring[i-1][0]&&ring[i][1]===ring[i-1][1])fail(`${name}: duplicate consecutive polygon vertices`);
  if(Math.abs(area2(ring))<1e-10)fail(`${name}: zero-area polygon ring`);
  if(ringSelfIntersects(ring))fail(`${name}: self-intersecting polygon ring`);
}
function validateCollection(raw,{requireComplete=false}={}){
  if(raw?.type!=='FeatureCollection'||!Array.isArray(raw.features)||!raw.features.length||raw.features.length>36)fail('Expected 1–36 state/UT polygons in a GeoJSON FeatureCollection');
  if(raw.crs && !/CRS84|4326/i.test(JSON.stringify(raw.crs)))fail('Projected GeoJSON is not supported. Reproject to WGS84 longitude/latitude.');
  const seen=new Set(),counter={n:0};
  const features=raw.features.map((f,i)=>{
    const name=canonical(rawName(f));
    if(!set.has(name))fail(`Unknown state/UT: ${name||'(missing name)'}`);
    if(seen.has(name))fail(`Duplicate region: ${name}`);
    seen.add(name);
    const geom=f.geometry;
    if(!geom||!['Polygon','MultiPolygon'].includes(geom.type))fail(`${name}: Polygon or MultiPolygon expected`);
    const polys=geom.type==='Polygon'?[geom.coordinates]:geom.coordinates;
    if(!Array.isArray(polys)||!polys.length)fail(`${name}: no polygon data`);
    for(const poly of polys){
      if(!Array.isArray(poly)||!poly.length)fail(`${name}: empty polygon`);
      for(const ring of poly)validateRing(ring,name,counter);
      // A hole entirely outside the shell is invalid, not merely a visual artefact.
      for(const hole of poly.slice(1))if(!containsRing(hole[0][0],hole[0][1],poly[0]))fail(`${name}: polygon hole lies outside its shell`);
    }
    return {type:'Feature',id:REGIONS.indexOf(name)+1,properties:{name,kind:UTS.includes(name)?'Union territory':'State',palette:i%5},geometry:geom};
  });
  if(requireComplete && seen.size!==36)fail(`Incomplete atlas: ${36-seen.size} regions missing`);
  return {type:'FeatureCollection',features};
}
function containsRing(lon,lat,ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];if((a[1]>lat)!==(b[1]>lat)&&lon<(b[0]-a[0])*(lat-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
function contains(feature,lon,lat){
  const g=feature.geometry,polys=g.type==='Polygon'?[g.coordinates]:g.coordinates;
  return polys.some(p=>p?.length&&containsRing(lon,lat,p[0])&&!p.slice(1).some(h=>containsRing(lon,lat,h)));
}
// Strict browser import screening: deliberately fail closed on pathological complexity.
// This is a safety gate, not a geodetic or official-border validation. Data exceeding
// the work budget must be independently reviewed with the offline GEOS importer.
function strictBounds(a){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const p of a){minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);}
  return [minX,minY,maxX,maxY];
}
function areaBoundsOverlap(a,b){return Math.min(a[2],b[2])-Math.max(a[0],b[0])>1e-10&&Math.min(a[3],b[3])-Math.max(a[1],b[1])>1e-10;}
function strictSegments(ring){
  return ring.slice(0,-1).map((p,i)=>{const q=ring[i+1];return {p,q,bb:[Math.min(p[0],q[0]),Math.min(p[1],q[1]),Math.max(p[0],q[0]),Math.max(p[1],q[1])],i};});
}
function strictCross(a,b){
  // Strict crossing means interiors of both segments cross, not merely share a vertex
  // or a common administrative boundary. Collinear overlap is screened by interior samples.
  const eps=1e-12;
  const u=cross(a.p,a.q,b.p),v=cross(a.p,a.q,b.q);
  const w=cross(b.p,b.q,a.p),z=cross(b.p,b.q,a.q);
  return ((u>eps&&v < -eps)||(u < -eps&&v>eps)) && ((w>eps&&z < -eps)||(w < -eps&&z>eps));
}
function strictRingCheck(ring,label){
  const n=ring.length-1;
  if(n>25000)fail(`${label}: complex ring requires offline GIS validation`);
  const segments=strictSegments(ring),box=strictBounds(ring);
  const cols=Math.min(80,Math.max(8,Math.floor(Math.sqrt(n)/2)));
  const sx=Math.max((box[2]-box[0])/cols,1e-9),sy=Math.max((box[3]-box[1])/cols,1e-9);
  const cells=new Map();let insertions=0,checks=0;
  for(const seg of segments){
    const ix0=Math.floor((seg.bb[0]-box[0])/sx),ix1=Math.floor((seg.bb[2]-box[0])/sx);
    const iy0=Math.floor((seg.bb[1]-box[1])/sy),iy1=Math.floor((seg.bb[3]-box[1])/sy);
    if((ix1-ix0+1)*(iy1-iy0+1)>10000)fail(`${label}: ring requires offline GIS validation`);
    const nearby=new Set();
    for(let x=ix0;x<=ix1;x++)for(let y=iy0;y<=iy1;y++){
      const key=x+':'+y,arr=cells.get(key);if(arr)for(const other of arr)nearby.add(other);
    }
    for(const other of nearby){
      if(other.i===seg.i-1||(seg.i===n-1&&other.i===0))continue;
      if(!areaBoundsOverlapInclusive(seg.bb,other.bb))continue;
      if(++checks>1500000)fail(`${label}: ring intersection audit exceeds safe browser budget`);
      if(segmentsIntersect(seg.p,seg.q,other.p,other.q))fail(`${label}: self-intersecting polygon ring`);
    }
    for(let x=ix0;x<=ix1;x++)for(let y=iy0;y<=iy1;y++){
      const key=x+':'+y;if(!cells.has(key))cells.set(key,[]);
      cells.get(key).push(seg);
      if(++insertions>800000)fail(`${label}: ring intersection index exceeds safe browser budget`);
    }
  }
}
function areaBoundsOverlapInclusive(a,b){return a[0]<=b[2]+1e-12&&b[0]<=a[2]+1e-12&&a[1]<=b[3]+1e-12&&b[1]<=a[3]+1e-12;}
function ringsOf(f){const g=f.geometry;return (g.type==='Polygon'?[g.coordinates]:g.coordinates).flat();}
function shellOf(f){const g=f.geometry;return (g.type==='Polygon'?[g.coordinates]:g.coordinates).map(p=>p[0]);}
function interiorCandidates(f){
  const found=[];
  for(const shell of shellOf(f)){
    const b=strictBounds(shell),mid=[(b[0]+b[2])/2,(b[1]+b[3])/2];
    const add=point=>{if(contains(f,...point))found.push(point);};
    add(mid);
    const stride=Math.max(1,Math.floor((shell.length-1)/16));
    for(let i=0;i<shell.length-1;i+=stride){
      const edge=[(shell[i][0]+shell[i+1][0])/2,(shell[i][1]+shell[i+1][1])/2];
      for(const ratio of [0.03,0.20,0.5])add([edge[0]*(1-ratio)+mid[0]*ratio,edge[1]*(1-ratio)+mid[1]*ratio]);
    }
  }
  return found;
}
function onePolygon(f,poly){return {...f,geometry:{type:'Polygon',coordinates:poly}};}
function partsOverlap(a,b,work){
  const pa=onePolygon(a.feature,a.poly),pb=onePolygon(b.feature,b.poly);
  const sa=strictBounds(a.poly[0]),sb=strictBounds(b.poly[0]);
  if(!areaBoundsOverlap(sa,sb))return false;
  if(interiorCandidates(pa).some(p=>contains(pb,...p))||interiorCandidates(pb).some(p=>contains(pa,...p)))return true;
  for(const ra of a.poly)for(const rb of b.poly){
    if(!areaBoundsOverlap(strictBounds(ra),strictBounds(rb)))continue;
    if(crossingBetweenRings(ra,rb,work))return true;
  }
  return false;
}
function crossingBetweenRings(a,b,work){
  const x=strictSegments(a),y=strictSegments(b);
  if(x.length*y.length>1800000)fail('Complex region intersections require offline GIS validation');
  for(const s of x)for(const t of y){
    if(!areaBoundsOverlapInclusive(s.bb,t.bb))continue;
    if(++work.n>1500000)fail('Complex region intersections require offline GIS validation');
    if(strictCross(s,t))return true;
  }
  return false;
}
/** A stricter, bounded, untrusted-upload gate. Does NOT certify boundary accuracy. */
function validateUserImport(raw){
  // First ensure that no public data or application state has been mutated.
  const fc=validateCollection(raw);
  let vertices=0;
  for(const f of fc.features){
    for(const ring of ringsOf(f)){
      vertices+=ring.length;
      if(vertices>35000)fail('Complex geographic upload requires offline GIS validation before browser import');
      strictRingCheck(ring,f.properties.name);
    }
    // A hole must be contained by its shell across the entire perimeter, not just at one vertex.
    const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
    for(const p of polys){
      for(let h=1;h<p.length;h++){
        if(crossingBetweenRings(p[0],p[h],{n:0}))fail(`${f.properties.name}: polygon hole crosses its shell`);
        for(let k=1;k<h;k++){
          if(crossingBetweenRings(p[k],p[h],{n:0}) ||
            JSON.stringify(p[k])===JSON.stringify(p[h]) ||
            containsRing(p[k][0][0],p[k][0][1],p[h]) ||
            containsRing(p[h][0][0],p[h][0][1],p[k]))fail(`${f.properties.name}: polygon holes overlap`);
        }
      }
    }
    for(let i=0;i<polys.length;i++)for(let j=i+1;j<polys.length;j++){
      if(partsOverlap({feature:f,poly:polys[i]},{feature:f,poly:polys[j]},{n:0}))
        fail(`${f.properties.name}: overlapping multipart polygons`);
    }
  }
  const boxes=fc.features.map(f=>strictBounds(shellOf(f).flat()));
  for(let i=0;i<fc.features.length;i++)for(let j=i+1;j<fc.features.length;j++){
    if(!areaBoundsOverlap(boxes[i],boxes[j]))continue;
    const a=fc.features[i],b=fc.features[j];
    const msg=`Overlapping regions: ${a.properties.name} and ${b.properties.name}; validate with offline GIS before import`;
    if(interiorCandidates(a).some(p=>contains(b,...p))||interiorCandidates(b).some(p=>contains(a,...p)))fail(msg);
    const work={n:0};
    for(const ra of ringsOf(a))for(const rb of ringsOf(b)){
      if(!areaBoundsOverlap(strictBounds(ra),strictBounds(rb)))continue;
      if(crossingBetweenRings(ra,rb,work))fail(msg);
    }
  }
  return fc;
}

function inspectCollection(fc){
  const names=new Set(fc.features.map(f=>f.properties.name));
  const points=CHECKPOINTS.map(p=>{
    const actual=fc.features.filter(f=>contains(f,p.lon,p.lat)).map(f=>f.properties.name);
    return {...p,actual,pass:actual.length===1&&actual[0]===p.expected};
  });
  return {count:fc.features.length,states:STATES.filter(x=>names.has(x)).length,uts:UTS.filter(x=>names.has(x)).length,
    missing:REGIONS.filter(x=>!names.has(x)),points,passesAllSamples:points.every(x=>x.pass),officiallyVerified:false};
}
function eachPoint(c,visit){if(typeof c?.[0]==='number'){visit(c);return;}for(const p of c??[])eachPoint(p,visit)}
function featureBounds(feature){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  eachPoint(feature.geometry.coordinates,p=>{minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1])});
  return [[minX,minY],[maxX,maxY]];
}
function allBounds(fc){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const f of fc.features){const [[x1,y1],[x2,y2]]=featureBounds(f);minX=Math.min(minX,x1);minY=Math.min(minY,y1);maxX=Math.max(maxX,x2);maxY=Math.max(maxY,y2)}
  return [[minX,minY],[maxX,maxY]];
}
function ringCentroid(ring){let x=0,y=0,A=0;for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i],c=a[0]*b[1]-b[0]*a[1];A+=c;x+=(a[0]+b[0])*c;y+=(a[1]+b[1])*c;}return Math.abs(A)>1e-12?[x/(3*A),y/(3*A)]:ring[0]}
function labelPoint(f){
  const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
  let p=polys[0],max=-Infinity;
  for(const candidate of polys){const a=Math.abs(area2(candidate[0]));if(a>max){p=candidate;max=a}}
  const centroid=ringCentroid(p[0]);if(contains(f,...centroid))return centroid;
  const ring=p[0];const [[minX,minY],[maxX,maxY]]=featureBounds(f),guess=[(minX+maxX)/2,(minY+maxY)/2];
  if(contains(f,...guess))return guess;
  for(let i=0;i<ring.length-1;i++){const mid=[(ring[i][0]+centroid[0])/2,(ring[i][1]+centroid[1])/2];if(contains(f,...mid))return mid;}
  return ring[0];
}
function labelCollection(fc){return {type:'FeatureCollection',features:fc.features.map(f=>({type:'Feature',properties:{name:f.properties.name,kind:f.properties.kind},geometry:{type:'Point',coordinates:labelPoint(f)}}))};}
function graticule(){const fs=[];for(let lon=65;lon<=100;lon+=5)fs.push({type:'Feature',geometry:{type:'LineString',coordinates:[[lon,3],[lon,41]]},properties:{}});for(let lat=5;lat<=40;lat+=5)fs.push({type:'Feature',geometry:{type:'LineString',coordinates:[[60,lat],[102,lat]]},properties:{}});return {type:'FeatureCollection',features:fs};}

/* src/gazetteer.mjs */
/* Optional, source-labelled geographic point catalogue. Never used as a legal boundary source. */


const GAZETTEER_FORMAT='BharatAtlasGazetteer1';
const GAZETTEER_TYPES=Object.freeze(['city','town','village','landmark','station']);
const validRegions=new Set(REGIONS);
const safeLabel=s=>typeof s==='string' && s.length>0 && s.length<=120 && s.trim()===s && !/[\x00-\x1f\x7f]/.test(s);
function validateGazetteer(fc,{maxEntries=10000}={}){
  if(fc?.type!=='FeatureCollection'||!Array.isArray(fc.features)||fc.features.length<1||fc.features.length>maxEntries)
    throw Error(`Place catalogue must contain 1–${maxEntries} points`);
  const seen=new Set();
  const places=fc.features.map((f,i)=>{
    const props=f?.properties||{},coordinate=f?.geometry?.coordinates;
    const id=props.id,name=props.name,region=canonical(props.region),kind=props.kind;
    if(f?.type!=='Feature'||f?.geometry?.type!=='Point'||!Array.isArray(coordinate)||coordinate.length!==2)
      throw Error(`Place ${i+1}: WGS84 Point required`);
    const [lon,lat]=coordinate;
    if(!Number.isFinite(lon)||!Number.isFinite(lat)||lon<60||lon>102||lat<3||lat>41)
      throw Error(`Place ${i+1}: coordinates outside Indian atlas study envelope`);
    if(!safeLabel(id)||!/^[a-zA-Z0-9_-]{1,70}$/.test(id)||seen.has(id))throw Error(`Place ${i+1}: missing or duplicate ID`);
    if(!safeLabel(name)||!validRegions.has(region)||!GAZETTEER_TYPES.includes(kind))throw Error(`Place ${i+1}: bad name, region or category`);
    const aliases=props.aliases??[];
    if(!Array.isArray(aliases)||aliases.length>6||aliases.some(a=>!safeLabel(a)))throw Error(`Place ${i+1}: invalid alternate names`);
    seen.add(id);
    return Object.freeze({id,name,region,kind,aliases:Object.freeze([...aliases]),lon,lat,source:'gazetteer'});
  });
  return Object.freeze(places);
}
function validateGazetteerManifest(manifest){
  if(manifest?.format!==GAZETTEER_FORMAT||manifest.officiallyVerified!==false||
    !Number.isInteger(manifest.count)||manifest.count<1||manifest.count>10000||
    !/^[a-f0-9]{64}$/.test(manifest.sha256||'')||
    !/^https:\/\//.test(manifest.sourceUrl||'')||!safeLabel(manifest.licence)||!safeLabel(manifest.attribution))
    throw Error('Invalid optional place-catalogue provenance');
  return Object.freeze({format:GAZETTEER_FORMAT,count:manifest.count,sha256:manifest.sha256,
    sourceUrl:manifest.sourceUrl,licence:manifest.licence,attribution:manifest.attribution,officiallyVerified:false});
}
function gazetteerFeatures(places){return {type:'FeatureCollection',features:places.map(p=>({type:'Feature',properties:{id:p.id,name:p.name,region:p.region,kind:p.kind},geometry:{type:'Point',coordinates:[p.lon,p.lat]}}))};}
async function loadGazetteer({fetcher=fetch,base='./data/gazetteer/',timeout=3500}={}){
  // Abort together across manifest and data; success does not imply geographic authority.
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const response=await fetcher(base+'manifest.json',{signal:controller.signal,cache:'no-cache'});
    if(response.status===404)return null;
    if(!response.ok)throw Error(`Place provenance HTTP ${response.status}`);
    const mtext=await readBoundedText(response,16000);
    const metadata=validateGazetteerManifest(JSON.parse(mtext));
    const geores=await fetcher(base+'places.geojson',{signal:controller.signal,cache:'no-cache'});
    if(!geores.ok)throw Error(`Place data HTTP ${geores.status}`);
    const text=await readBoundedText(geores,4_000_000);
    await verifyBoundaryDigest(text,metadata.sha256);
    const places=validateGazetteer(JSON.parse(text));
    if(places.length!==metadata.count)throw Error('Place catalogue count does not match provenance');
    return {places,metadata};
  }finally{clearTimeout(timer)}
}

/* src/hydrology.mjs */
/* Source-labelled, hash-verified historical hydrology for the accessible SVG mode.
 * The same derived WDBII segments are also available as static MVT tiles.
 * Geographic accuracy is NOT verified by Survey of India.
 */
const HYDRO_LIMIT_BYTES=900000;
const expectedFields=['format','licence','attribution','sourceUrl','sha256','featureCount'];
function validateHydrology(fc,{maxFeatures=2400,maxVertices=35000}={}){
  if(fc?.type!=='FeatureCollection'||!Array.isArray(fc.features)||fc.features.length<1||fc.features.length>maxFeatures)throw Error('Invalid river collection');
  let vertices=0;
  for(const f of fc.features){
    const c=f.geometry?.coordinates;
    if(f.type!=='Feature'||f.geometry?.type!=='LineString'||!Array.isArray(c)||c.length<2)throw Error('River geometry must contain a line');
    vertices+=c.length;if(vertices>maxVertices)throw Error('River dataset exceeds complexity budget');
    for(const xy of c)if(!Array.isArray(xy)||xy.length!==2||!xy.every(Number.isFinite)||xy[0]<68||xy[0]>99||xy[1]<6||xy[1]>38)throw Error('River coordinate outside declared study area');
  }
  return fc;
}
function validateHydrologyManifest(m){
  if(!m||m.format!=='BharatAtlasHydrology1'||m.officiallyVerified!==false||m.riverNamesVerified!==false||m.featureCount<1||m.featureCount>2400||
  !expectedFields.every(k=>Object.hasOwn(m,k))||m.licence!=='LGPL-3.0-or-later'||!/^https:\/\//.test(m.sourceUrl)||!/^[0-9a-f]{64}$/.test(m.sha256)||!m.attribution)
    throw Error('Incomplete historical river source/rights record');
  return m;
}
const hex=b=>[...new Uint8Array(b)].map(v=>v.toString(16).padStart(2,'0')).join('');
async function loadHydrology({fetcher=fetch,base='./data/hydrography/',hasher=null}={}){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),4500);
  try{
    const metaResponse=await fetcher(base+'manifest.json',{signal:controller.signal});
    if(metaResponse.status===404)return null;
    if(!metaResponse.ok)throw Error('Historic river metadata request failed');
    const info=validateHydrologyManifest(await metaResponse.json());
    const response=await fetcher(base+'rivers.geojson',{signal:controller.signal});
    if(!response.ok)throw Error('Historic river data request failed');
    if(Number(response.headers?.get?.('content-length')||0)>HYDRO_LIMIT_BYTES)throw Error('Historic river dataset too large');
    const bytes=await response.arrayBuffer();
    if(bytes.byteLength>HYDRO_LIMIT_BYTES)throw Error('Historic river dataset too large');
    const calc=hasher?await hasher(bytes):globalThis.crypto?.subtle?hex(await globalThis.crypto.subtle.digest('SHA-256',bytes)):null;
    if(!calc||calc!==info.sha256)throw Error('Historic river SHA-256 integrity check failed');
    const fc=validateHydrology(JSON.parse(new TextDecoder().decode(bytes)));
    if(fc.features.length!==info.featureCount)throw Error('Historic river feature count mismatch');
    return {fc,metadata:info};
  }catch(e){if(e.name==='AbortError'||/Failed to fetch|NetworkError/i.test(String(e.message)))return null;throw e}
  finally{clearTimeout(timer)}
}

/* src/shorelines.mjs */
/* Historical, generalized GSHHG physical shore outlines with cryptographic source checks.
 * These do NOT show sovereign boundaries, treaty lines, navigation coast surveys or
 * official, contemporary lake outlines. Optional and never blocks political viewer.
 */
const SHORE_MAX_BYTES=350000;
const shoreHex=b=>[...new Uint8Array(b)].map(v=>v.toString(16).padStart(2,'0')).join('');
function validateShoreManifest(m){
  if(m?.format!=='BharatAtlasShorelines1'||m.officiallyVerified!==false||m.namesVerified!==false||m.licence!=='LGPL-3.0-or-later'||!/^https:\/\//.test(m.sourceUrl||'')||!m.attribution||
     !Array.isArray(m.extent)||m.extent.join(',')!=='68,6,99,38')throw Error('Invalid GSHHG shore source record');
  for(const layer of ['coastlines','lakes']){
    const a=m.layers?.[layer];
    if(!a||!Number.isInteger(a.count)||a.count<1||a.count>300||!Number.isInteger(a.bytes)||a.bytes<1||a.bytes>SHORE_MAX_BYTES||!/^[0-9a-f]{64}$/.test(a.sha256))throw Error('Invalid physical shoreline layer declaration');
  }
  return m;
}
function validateShoreFeatures(fc,layer){
  if(fc?.type!=='FeatureCollection'||!Array.isArray(fc.features)||!fc.features.length||fc.features.length>300)throw Error('Invalid shoreline feature collection');
  let vertices=0;
  for(const f of fc.features){
    if(f.type!=='Feature'||f.geometry?.type!=='LineString'||!Array.isArray(f.geometry.coordinates)||f.geometry.coordinates.length<2)throw Error('Invalid shoreline geometry');
    vertices+=f.geometry.coordinates.length;
    if(vertices>20000)throw Error('Shoreline vertex budget exceeded');
    for(const p of f.geometry.coordinates){
      if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<68||p[0]>99||p[1]<6||p[1]>38)throw Error('Shoreline point outside study bounds');
    }
    if(typeof f.properties?.name!=='string'||!f.properties.name.includes('Unlabelled'))throw Error('Shoreline source must not invent a place name');
  }
  if(!['coastlines','lakes'].includes(layer))throw Error('Unknown shore type');
  return fc;
}
async function loadShorelines({fetcher=fetch,base='./data/shorelines/',hasher=null}={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4500);
 try{
  const response=await fetcher(base+'manifest.json',{signal:controller.signal});
  if(response.status===404)return null;
  if(!response.ok)throw Error('Physical shoreline manifest request failed');
  const info=validateShoreManifest(await response.json());
  const out={metadata:info};
  for(const layer of ['coastlines','lakes']){
   const reply=await fetcher(base+layer+'.geojson',{signal:controller.signal});
   if(!reply.ok||Number(reply.headers?.get?.('content-length')||0)>SHORE_MAX_BYTES)throw Error('Physical shoreline source unavailable or oversized');
   const bytes=await reply.arrayBuffer(),meta=info.layers[layer];
   if(bytes.byteLength!==meta.bytes||bytes.byteLength>SHORE_MAX_BYTES)throw Error('Shoreline byte count incorrect');
   const digest=hasher?await hasher(bytes):globalThis.crypto?.subtle?shoreHex(await globalThis.crypto.subtle.digest('SHA-256',bytes)):null;
   if(digest!==meta.sha256)throw Error('Physical shoreline SHA-256 mismatch');
   const fc=validateShoreFeatures(JSON.parse(new TextDecoder().decode(bytes)),layer);
   if(fc.features.length!==meta.count)throw Error('Physical shoreline feature count mismatch');
   out[layer]=fc;
  }
  return out;
 }catch(e){if(e.name==='AbortError'||/Failed to fetch|NetworkError/i.test(String(e.message)))return null;throw e}
 finally{clearTimeout(timer)}
}

/* src/landcover.mjs */
/* GSHHG historical land mask. NEVER an administrative or territorial authority. */
const LAND_MAX_BYTES=400000;
const landHex=buf=>[...new Uint8Array(buf)].map(v=>v.toString(16).padStart(2,'0')).join('');
function validateLandManifest(m){
 if(m?.format!=='BharatAtlasLandcover1'||m.officiallyVerified!==false||m.administrativeBoundaries!==false||m.licence!=='LGPL-3.0-or-later'||!/^https:\/\//.test(m.sourceUrl||'')||!m.attribution||!Array.isArray(m.extent)||m.extent.join(',')!=='68,6,99,38'||!Number.isInteger(m.featureCount)||m.featureCount<1||m.featureCount>200||!Number.isInteger(m.bytes)||m.bytes<1||m.bytes>LAND_MAX_BYTES||!/^[0-9a-f]{64}$/.test(m.sha256))throw Error('Invalid physical land source metadata');
 return m;
}
function validateLandFeatures(fc){
 if(fc?.type!=='FeatureCollection'||!Array.isArray(fc.features)||fc.features.length<1||fc.features.length>200)throw Error('Invalid land mask collection');
 let vertices=0;
 for(const f of fc.features){
  if(f.type!=='Feature'||f.geometry?.type!=='Polygon'||!Array.isArray(f.geometry.coordinates)||!f.geometry.coordinates.length||f.properties?.name!=='Unlabelled generalized land')throw Error('Invalid land mask feature');
  for(const ring of f.geometry.coordinates){
   if(!Array.isArray(ring)||ring.length<4)throw Error('Invalid land polygon ring');
   vertices+=ring.length;if(vertices>30000)throw Error('Land mask complexity exceeded');
   for(const p of ring)if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<68||p[0]>99||p[1]<6||p[1]>38)throw Error('Land mask outside study bounds');
   if(ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])throw Error('Unclosed land polygon');
  }
 }
 return fc;
}
async function loadLandcover({fetcher=fetch,base='./data/landcover/',hasher=null}={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9500);
 try{
  const response=await fetcher(base+'manifest.json',{signal:controller.signal});
  if(response.status===404)return null;if(!response.ok)throw Error('Land mask manifest unavailable');
  const metadata=validateLandManifest(await response.json());
  const data=await fetcher(base+'land.geojson',{signal:controller.signal});
  if(!data.ok||Number(data.headers?.get?.('content-length')||0)>LAND_MAX_BYTES)throw Error('Land geometry unavailable or oversized');
  const bytes=await data.arrayBuffer();if(bytes.byteLength!==metadata.bytes||bytes.byteLength>LAND_MAX_BYTES)throw Error('Land geometry byte count mismatch');
  const digest=hasher?await hasher(bytes):globalThis.crypto?.subtle?landHex(await globalThis.crypto.subtle.digest('SHA-256',bytes)):null;
  if(digest!==metadata.sha256)throw Error('Land mask SHA-256 mismatch');
  const fc=validateLandFeatures(JSON.parse(new TextDecoder().decode(bytes)));
  if(fc.features.length!==metadata.featureCount)throw Error('Land mask feature count mismatch');
  return {fc,metadata};
 }catch(e){if(e.name==='AbortError'||/Failed to fetch|NetworkError/i.test(String(e.message)))return null;throw e}
 finally{clearTimeout(timer)}
}

/* src/physical-only.mjs */
/* Physical-only GSHHG/WDBII research view: intentionally NO political boundary geometry. */
const WIDTH=1600,HEIGHT=1120;
const FRAME={x:75,y:147,w:1450,h:820};
// Study extent defined by the packaged licensed source; not a country boundary.
const PHYSICAL_EXTENT=Object.freeze([68,6,99,38]);
const physicalOnlyFormat=n=>n.toFixed(2);
function physicalOnlyProjector(){
 const [west,south,east,north]=PHYSICAL_EXTENT;
 const cos=Math.cos((south+north)*Math.PI/360),rw=(east-west)*cos,rh=north-south;
 const factor=Math.min(FRAME.w/rw,FRAME.h/rh);
 const x0=FRAME.x+(FRAME.w-rw*factor)/2,y0=FRAME.y+(FRAME.h-rh*factor)/2;
 return ([lon,lat])=>[x0+(lon-west)*cos*factor,y0+(north-lat)*factor];
}
function physicalOnlyPolygonPath(coords,project){return coords.map((p,i)=>(i?'L':'M')+project(p).map(physicalOnlyFormat).join(' ')).join(' ')+' Z'}
function physicalOnlyLandPaths(land,project){return land.features.map(feature=>'<path d="'+feature.geometry.coordinates.map(r=>physicalOnlyPolygonPath(r,project)).join(' ')+'"/>').join('\n')}
function physicalOnlyLinePaths(fc,project){return (fc?.features||[]).filter(v=>v.geometry?.type==='LineString').map(feat=>'<path d="'+feat.geometry.coordinates.map((p,i)=>(i?'L':'M')+project(p).map(physicalOnlyFormat).join(' ')).join(' ')+'"/>').join('\n')}
function physicalOnlyClaimOutline(fc,project){
 if(!fc)return '';
 if(fc.type!=='FeatureCollection'||!Array.isArray(fc.features)||fc.features.length!==1)throw Error('Invalid SoI national-outline collection');
 const geometry=fc.features[0]?.geometry;
 if(!geometry||!['Polygon','MultiPolygon'].includes(geometry.type))throw Error('Invalid SoI national-outline polygon');
 const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
 const paths=[];let n=0;
 for(const poly of polygons){for(const ring of poly){
   if(!Array.isArray(ring)||ring.length<4)throw Error('Invalid national-outline ring');
   for(const pair of ring){
     if(!Array.isArray(pair)||pair.length<2||!Number.isFinite(pair[0])||!Number.isFinite(pair[1])||
        pair[0]<60||pair[0]>102||pair[1]<3||pair[1]>42)throw Error('Invalid national-outline coordinates');
     if(++n>200000)throw Error('National-outline SVG exceeds vertex cap');
   }
   if(ring[0][0]!==ring[ring.length-1][0]||ring[0][1]!==ring[ring.length-1][1])throw Error('Unclosed outline polygon');
   paths.push(physicalOnlyPolygonPath(ring,project));
 }}
 return `<g id="india-official-claim-outline" fill="none" stroke="#aa5d23" stroke-width="3.2" stroke-linejoin="round" aria-label="Generalized Survey of India claimed national outline">`+
   `<path d="${paths.join(' ')}" fill="none"/></g>`;
}
function renderPhysicalOnlySVG({land,hydrology=null,shorelines=null,showRivers=true,showShores=true,officialClaim=null}={}){
 if(land?.type!=='FeatureCollection'||!Array.isArray(land.features)||!land.features.length)throw Error('A validated physical land source is required');
 const project=physicalOnlyProjector();
 const [west,south,east,north]=PHYSICAL_EXTENT;
 const c=Math.cos((south+north)*Math.PI/360);
 const factor=Math.min(FRAME.w/((east-west)*c),FRAME.h/(north-south));
 const x0=FRAME.x+(FRAME.w-(east-west)*c*factor)/2;
 const y0=FRAME.y+(FRAME.h-(north-south)*factor)/2;
 const atlasProjection=[west,north,x0,y0,c*factor,factor].join(',');
 const lines=showRivers?physicalOnlyLinePaths(hydrology,project):'';
 const coast=showShores?physicalOnlyLinePaths(shorelines?.coastlines,project):'';
 const lakes=showShores?physicalOnlyLinePaths(shorelines?.lakes,project):'';
 const claimedOutline=physicalOnlyClaimOutline(officialClaim,project);
 const svg=`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" data-atlas-projection="${atlasProjection}" role="img" aria-labelledby="title desc">
<title id="title">Bharat Atlas — Physical geography research view</title>
<desc id="desc">Generalized physical map for 68–99 degrees east and 6–38 degrees north. ${officialClaim?'Survey of India source-labelled national claim outline shown; this is not a certified 2026 political-map match, control boundary, or state division.':'No political or national boundary geometries are included.'} Physical data: GSHHG LGPL-3.0-or-later.</desc>
<rect width="${WIDTH}" height="${HEIGHT}" fill="#f5f9f9"/>
<rect x="33" y="31" width="1534" height="1058" rx="15" fill="#fff" stroke="#dbe5df" stroke-width="2"/>
<text x="78" y="87" font-family="Arial,sans-serif" font-size="38" font-weight="bold" fill="#264d3e">BHARAT ATLAS</text>
<text x="79" y="122" font-family="Arial,sans-serif" font-size="20" fill="#55746b">Physical geography • GSHHG/WDBII historical reference data</text>
<defs><clipPath id="map-frame"><rect x="75" y="147" width="1450" height="820"/></clipPath></defs>
<rect x="75" y="147" width="1450" height="820" fill="#e8f3f6" stroke="#d7e4e0" stroke-width="1"/>
<g clip-path="url(#map-frame)"><g id="physical-land" fill="#c9dfc2" stroke="#729988" stroke-width="0.4" fill-rule="evenodd">${physicalOnlyLandPaths(land,project)}</g>
<g id="historical-rivers" fill="none" stroke="#438ca9" stroke-width="1.05" stroke-opacity=".76" stroke-linejoin="round" stroke-linecap="round">${lines}</g>
<g id="physical-coastlines" fill="none" stroke="#2b766b" stroke-width="1.55">${coast}</g>
<g id="physical-lakes" fill="none" stroke="#5c9fbe" stroke-width="1.2">${lakes}</g>${claimedOutline}</g>
<text x="78" y="1017" font-family="Arial,sans-serif" font-size="19" font-weight="bold" fill="#a05531">${officialClaim?'SOI-SOURCED NATIONAL CLAIM OUTLINE — GENERALIZED, NOT 2026-CERTIFIED':'PHYSICAL GEOGRAPHY ONLY — NO POLITICAL BOUNDARIES'}</text>
<text x="78" y="1046" font-family="Arial,sans-serif" font-size="15" fill="#3f6159">GSHHG 2.3.6 via Basemap Data 2.0.0 · LGPL-3.0-or-later · Wessel &amp; Smith</text>
<text x="78" y="1072" font-family="Arial,sans-serif" font-size="13" fill="#6a8279">Study area 68–99°E, 6–38°N · Includes neighbouring countries · Historical generalized data, not for navigation</text>
</svg>`;
 if(svg.length>15_000_000)throw Error('Physical geography export too large');
 return svg;
}
const PHYSICAL_ONLY_FILENAME='bharat-atlas-physical-geography-research.svg';

/* src/places.mjs */
/* Pilot city-centre locations for interface development only.
 * Coordinates are APPROXIMATE and have not been independently survey-verified.
 * These are not address points, road networks, official centroids or a nationwide gazetteer.
 */
const PILOT_PLACES = Object.freeze([
  {name:'New Delhi',region:'Delhi',lon:77.2090,lat:28.6139},
  {name:'Mumbai',region:'Maharashtra',lon:72.8777,lat:19.0760},
  {name:'Kolkata',region:'West Bengal',lon:88.3639,lat:22.5726},
  {name:'Chennai',region:'Tamil Nadu',lon:80.2707,lat:13.0827},
  {name:'Bengaluru',region:'Karnataka',lon:77.5946,lat:12.9716,aliases:['Bangalore']},
  {name:'Hyderabad',region:'Telangana',lon:78.4867,lat:17.3850},
  {name:'Ahmedabad',region:'Gujarat',lon:72.5714,lat:23.0225},
  {name:'Jaipur',region:'Rajasthan',lon:75.7873,lat:26.9124},
  {name:'Lucknow',region:'Uttar Pradesh',lon:80.9462,lat:26.8467},
  {name:'Patna',region:'Bihar',lon:85.1376,lat:25.5941},
  {name:'Bhopal',region:'Madhya Pradesh',lon:77.4126,lat:23.2599},
  {name:'Gwalior',region:'Madhya Pradesh',lon:78.1828,lat:26.2183},
  {name:'Jabalpur',region:'Madhya Pradesh',lon:79.9864,lat:23.1815},
  {name:'Indore',region:'Madhya Pradesh',lon:75.8577,lat:22.7196},
  {name:'Ranchi',region:'Jharkhand',lon:85.3096,lat:23.3441},
  {name:'Raipur',region:'Chhattisgarh',lon:81.6296,lat:21.2514},
  {name:'Guwahati',region:'Assam',lon:91.7362,lat:26.1445},
  {name:'Chandigarh',region:'Chandigarh',lon:76.7794,lat:30.7333},
  {name:'Srinagar',region:'Jammu and Kashmir',lon:74.7973,lat:34.0837},
  {name:'Jammu',region:'Jammu and Kashmir',lon:74.8570,lat:32.7266},
  {name:'Leh',region:'Ladakh',lon:77.5770,lat:34.1526},
  {name:'Panaji',region:'Goa',lon:73.8278,lat:15.4909},
  {name:'Kochi',region:'Kerala',lon:76.2673,lat:9.9312},
  {name:'Puducherry',region:'Puducherry',lon:79.8083,lat:11.9416},
  {name:'Sri Vijaya Puram',region:'Andaman and Nicobar Islands',lon:92.7265,lat:11.6234,aliases:['Port Blair']}
]);
const PILOT_PROVENANCE = Object.freeze({
  category:'approximate pilot city centres',
  coverage:`${PILOT_PLACES.length} manually curated entries`,
  verification:'not survey-verified or licensed as an authoritative place database',
  intendedUse:'search, progressive rendering and interaction demonstration only'
});
function pilotFeatureCollection(places=PILOT_PLACES){return {type:'FeatureCollection',features:places.map((p,i)=>({type:'Feature',id:i+1,properties:{name:p.name,region:p.region,pilot:true},geometry:{type:'Point',coordinates:[p.lon,p.lat]}}))};}

/* src/coordinates.mjs */
/* Deliberately limited coordinate navigation. This is not an address geocoder.
 * Numerical map-centering does not confirm that a coordinate lies inside India.
 */
function parseAtlasCoordinates(value){
 const m=String(value??'').trim().match(/^([+-]?\d{1,2}(?:\.\d+)?)\s*°?\s*([NS])?\s*,\s*([+-]?\d{1,3}(?:\.\d+)?)\s*°?\s*([EW])?$/i);
 if(!m)return null;
 let lat=Number(m[1]),lon=Number(m[3]);
 const ns=m[2]?.toUpperCase(),ew=m[4]?.toUpperCase();
 if((ns==='N'&&lat<0)||(ns==='S'&&lat>0)||(ew==='E'&&lon<0)||(ew==='W'&&lon>0))return null;
 if(ns==='S')lat=-Math.abs(lat);if(ns==='N')lat=Math.abs(lat);
 if(ew==='W')lon=-Math.abs(lon);if(ew==='E')lon=Math.abs(lon);
 // This atlas is India-focused. In-range does not mean land or sovereignty.
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<3||lat>41||lon<60||lon>102)return null;
 return Object.freeze({lat,lon,name:`${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`});
}

/* src/search.mjs */

/* Deterministic and small pilot search, not a commercial geocoder. */
const normalizeQuery = value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu,' ').trim();
function fuzzyDistance(a,b,limit=2){
  if(Math.abs(a.length-b.length)>limit)return limit+1;
  let prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    const curr=[i];let best=i;
    for(let j=1;j<=b.length;j++){
      const d=Math.min(curr[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
      curr[j]=d;best=Math.min(best,d);
    }
    if(best>limit)return limit+1;
    prev=curr;
  }
  return prev[b.length];
}
function searchAtlas(query,regions,places=PILOT_PLACES,{includePlaces=true,filter='all',limit=50}={}){
  const q=normalizeQuery(query);const entries=[];
  for(const f of regions??[]){if(filter!=='all'&&f.properties.kind!==filter)continue;
    entries.push({kind:'region',name:f.properties.name,subtitle:f.properties.kind,entry:f,terms:[f.properties.name]});}
  if(includePlaces&&filter==='all'&&q)for(const p of places){const suffix=p.source==='gazetteer'?`${p.kind} · ${p.region} (research label) · source-backed point`:`Pilot city · ${p.region}`;entries.push({kind:'place',name:p.name,subtitle:suffix,entry:p,terms:[p.name,...(p.aliases||[])]});}
  if(!q)return entries.filter(x=>x.kind==='region').slice(0,limit);
  const direct=entries.map(x=>{
    let rank=Infinity;
    for(const t of x.terms){const n=normalizeQuery(t);
      if(n===q)rank=Math.min(rank,0);
      else if(n.startsWith(q))rank=Math.min(rank,1);
      else if(n.includes(q))rank=Math.min(rank,2);

    }
    return {...x,rank};
  }).filter(x=>x.rank!==Infinity);
  // Fuzzy distances are expensive on a 10,000-place catalogue. Only compute them
  // when direct exact/prefix/substring results cannot fill the first result page.
  if(q.length>=4 && direct.length<Math.min(limit,10)){
    const found=new Set(direct.map(x=>x.entry));
    for(const x of entries){
      if(found.has(x.entry))continue;
      if(x.terms.some(t=>{const n=normalizeQuery(t);return n[0]===q[0]&&Math.abs(n.length-q.length)<=2&&fuzzyDistance(n,q,2)<=2})){
        direct.push({...x,rank:3});
      }
    }
  }
  return direct.sort((a,b)=>a.rank-b.rank||Number(a.kind==='place')-Number(b.kind==='place')||a.name.localeCompare(b.name)).slice(0,limit);
}

/* src/region-catalog.mjs */
/** Bharat Atlas 1.0: region-name catalogue only; NEVER polygon or boundary evidence.
 * English region classification aligned to National Portal of India IGOD directory
 * https://www.india.gov.in/directory/web-directory/state-uts
 * Hindi names are interface aliases, not formal authoritative translations.
 */

const ATLAS_REGIONS=Object.freeze([
  {
    "name": "Andhra Pradesh",
    "hindi": "आंध्र प्रदेश",
    "kind": "State"
  },
  {
    "name": "Arunachal Pradesh",
    "hindi": "अरुणाचल प्रदेश",
    "kind": "State"
  },
  {
    "name": "Assam",
    "hindi": "असम",
    "kind": "State"
  },
  {
    "name": "Bihar",
    "hindi": "बिहार",
    "kind": "State"
  },
  {
    "name": "Chhattisgarh",
    "hindi": "छत्तीसगढ़",
    "kind": "State"
  },
  {
    "name": "Goa",
    "hindi": "गोवा",
    "kind": "State"
  },
  {
    "name": "Gujarat",
    "hindi": "गुजरात",
    "kind": "State"
  },
  {
    "name": "Haryana",
    "hindi": "हरियाणा",
    "kind": "State"
  },
  {
    "name": "Himachal Pradesh",
    "hindi": "हिमाचल प्रदेश",
    "kind": "State"
  },
  {
    "name": "Jharkhand",
    "hindi": "झारखंड",
    "kind": "State"
  },
  {
    "name": "Karnataka",
    "hindi": "कर्नाटक",
    "kind": "State"
  },
  {
    "name": "Kerala",
    "hindi": "केरल",
    "kind": "State"
  },
  {
    "name": "Madhya Pradesh",
    "hindi": "मध्य प्रदेश",
    "kind": "State"
  },
  {
    "name": "Maharashtra",
    "hindi": "महाराष्ट्र",
    "kind": "State"
  },
  {
    "name": "Manipur",
    "hindi": "मणिपुर",
    "kind": "State"
  },
  {
    "name": "Meghalaya",
    "hindi": "मेघालय",
    "kind": "State"
  },
  {
    "name": "Mizoram",
    "hindi": "मिजोरम",
    "kind": "State"
  },
  {
    "name": "Nagaland",
    "hindi": "नागालैंड",
    "kind": "State"
  },
  {
    "name": "Odisha",
    "hindi": "ओडिशा",
    "kind": "State"
  },
  {
    "name": "Punjab",
    "hindi": "पंजाब",
    "kind": "State"
  },
  {
    "name": "Rajasthan",
    "hindi": "राजस्थान",
    "kind": "State"
  },
  {
    "name": "Sikkim",
    "hindi": "सिक्किम",
    "kind": "State"
  },
  {
    "name": "Tamil Nadu",
    "hindi": "तमिलनाडु",
    "kind": "State"
  },
  {
    "name": "Telangana",
    "hindi": "तेलंगाना",
    "kind": "State"
  },
  {
    "name": "Tripura",
    "hindi": "त्रिपुरा",
    "kind": "State"
  },
  {
    "name": "Uttar Pradesh",
    "hindi": "उत्तर प्रदेश",
    "kind": "State"
  },
  {
    "name": "Uttarakhand",
    "hindi": "उत्तराखंड",
    "kind": "State"
  },
  {
    "name": "West Bengal",
    "hindi": "पश्चिम बंगाल",
    "kind": "State"
  },
  {
    "name": "Andaman and Nicobar Islands",
    "hindi": "अंडमान और निकोबार द्वीपसमूह",
    "kind": "Union territory"
  },
  {
    "name": "Chandigarh",
    "hindi": "चंडीगढ़",
    "kind": "Union territory"
  },
  {
    "name": "Dadra and Nagar Haveli and Daman and Diu",
    "hindi": "दादरा और नगर हवेली और दमन और दीव",
    "kind": "Union territory"
  },
  {
    "name": "Delhi",
    "hindi": "दिल्ली",
    "kind": "Union territory"
  },
  {
    "name": "Jammu and Kashmir",
    "hindi": "जम्मू और कश्मीर",
    "kind": "Union territory"
  },
  {
    "name": "Ladakh",
    "hindi": "लद्दाख",
    "kind": "Union territory"
  },
  {
    "name": "Lakshadweep",
    "hindi": "लक्षद्वीप",
    "kind": "Union territory"
  },
  {
    "name": "Puducherry",
    "hindi": "पुदुचेरी",
    "kind": "Union territory"
  }
].map(x=>Object.freeze(x)));
function atlasRegionCatalogueSearch(query='', filter='all', availableNames=[]){
 const normalized=normalizeQuery(query);const available=new Set(availableNames.map(normalizeQuery));
 return ATLAS_REGIONS.filter(x=>(filter==='all'||x.kind===filter)&&!available.has(normalizeQuery(x.name)))
  .map(x=>{const terms=[x.name,x.hindi];const rank=normalized ? Math.min(...terms.map(t=>{const n=normalizeQuery(t);return n===normalized?0:n.startsWith(normalized)?1:n.includes(normalized)?2:99})) : 0;return {kind:'region-catalog',name:x.name,subtitle:`${x.hindi} · ${x.kind} · name catalogue, no verified polygon`,entry:x,rank};})
  .filter(x=>x.rank!==99)
  .sort((a,b)=>a.rank-b.rank||a.name.localeCompare(b.name));
}
function atlasCatalogueSummary(){return {states:ATLAS_REGIONS.filter(x=>x.kind==='State').length,unionTerritories:ATLAS_REGIONS.filter(x=>x.kind==='Union territory').length,verifiedPolygons:0,source:'National Portal of India (IGOD) — names only, no geometry'}};

/* src/search-shards.mjs */
/* Offline/local integrity-checked bilingual search. No public Nominatim API or invented translations. */


const ATLAS_SEARCH_FORMAT='BharatAtlasSearchShards1';
function atlasSearchKey(query){
 const first=normalizeQuery(query).split(' ')[0]||'';
 return [...first].length>=2?[...[...first].slice(0,2)].map(c=>c.codePointAt(0).toString(16).padStart(6,'0')).join(''):null;
}
function validateSearchManifest(m){
 if(m?.format!==ATLAS_SEARCH_FORMAT||m.researchOnly!==true||m.officiallyVerified!==false||!Number.isInteger(m.recordCount)||m.recordCount<1||m.recordCount>500000||
 !/^https:\/\//.test(m.sourceUrl||'')||!m.licence||!m.attribution||!/^[a-f0-9]{64}$/.test(m.sourceSha256||'')||
 !m.shards||typeof m.shards!=='object'||Object.keys(m.shards).length>12000)throw Error('Invalid source-labelled search manifest');
 for(const [key,detail] of Object.entries(m.shards)){
  if(!/^(?:[a-f0-9]{6}){2}$/.test(key)||detail.path!==`${key}.jsonl`|| !/^[a-f0-9]{64}$/.test(detail.sha256||'')||!Number.isInteger(detail.bytes)||detail.bytes<=0||detail.bytes>8000000||!Number.isInteger(detail.records)||detail.records<1||detail.records>500000)throw Error('Invalid search shard manifest entry');
 }
 return m;
}
function rankSearchRows(query,lines,{limit=20}={}){
 const q=normalizeQuery(query),rows=[];
 if(q.length<2)return rows;
 const seen=new Set();
 for(const line of lines.split('\n')){
  if(!line.trim())continue;
  const p=JSON.parse(line);
  if(typeof p.id!=='string'||seen.has(p.id)||typeof p.name!=='string'||!Number.isFinite(p.lon)||!Number.isFinite(p.lat)||!Array.isArray(p.aliases)||!['city','town','village','hamlet','locality','station','landmark','poi','hospital','school','shop'].includes(p.kind))throw Error('Invalid indexed place record');
  if(p.lon<60||p.lon>102||p.lat<3||p.lat>41)throw Error('Indexed coordinate outside coverage');
  seen.add(p.id);
  const words=[p.name,...p.aliases].map(normalizeQuery);
  const rank=words.some(v=>v===q)?0:words.some(v=>v.startsWith(q))?1:words.some(v=>v.split(' ').some(t=>t.startsWith(q)))?2:Infinity;
  if(Number.isFinite(rank))rows.push({...p,source:'indexed',rank});
 }
 rows.sort((a,b)=>a.rank-b.rank||a.name.localeCompare(b.name));
 return rows.slice(0,Math.min(50,Math.max(1,limit)));
}
async function createAtlasShardSearch({fetcher=fetch,base='./data/search-index/',timeout=7000}={}){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
 let manifest;
 try{
  const response=await fetcher(base+'manifest.json',{signal:controller.signal,cache:'no-cache'});
  if(response.status===404)return null;
  if(!response.ok)throw Error('Search metadata HTTP '+response.status);
  manifest=validateSearchManifest(JSON.parse(await readBoundedText(response,2_000_000)));
 }finally{clearTimeout(timer)}
 const cache=new Map();
 return {
  manifest,
  async search(query){
   const key=atlasSearchKey(query),s=key&&manifest.shards[key];if(!s)return [];
   let text=cache.get(key);
   if(text===undefined){
    const ac=new AbortController(),t=setTimeout(()=>ac.abort(),timeout);
    try{
     const r=await fetcher(base+s.path,{signal:ac.signal});if(!r.ok)throw Error('Search shard HTTP '+r.status);
     text=await readBoundedText(r,Math.min(8_000_000,s.bytes+1));
     if(new TextEncoder().encode(text).length!==s.bytes)throw Error('Search shard size mismatch');
     await verifyBoundaryDigest(text,s.sha256);
     cache.set(key,text);if(cache.size>8)cache.delete(cache.keys().next().value);
    }finally{clearTimeout(t)}
   }
   return rankSearchRows(query,text);
  }
 };
}

/* src/tiles.mjs */
/* Optional self-hosted XYZ vector tile layers. Never equate tile availability with accuracy. */
const TILE_LAYER_NAMES = Object.freeze(['roads','railways','rivers','settlements','pois','coastlines','lakes']);
function validateTileManifest(value){
  const a=value;
  if(!a||a.format!=='BharatAtlasMVT1'||a.officiallyVerified!==false)throw new Error('Invalid provisional vector tile catalogue');
  if(!a.licence||!a.attribution||!/^https:\/\//.test(a.sourceUrl||''))throw new Error('Vector tile provenance incomplete');
  if(!Number.isInteger(a.minzoom)||!Number.isInteger(a.maxzoom)||a.minzoom<0||a.maxzoom>12||a.minzoom>a.maxzoom)throw new Error('Invalid vector tile zoom limits');
  if(!Array.isArray(a.layers)||!a.layers.length||a.layers.some(x=>!TILE_LAYER_NAMES.includes(x))||new Set(a.layers).size!==a.layers.length)throw new Error('Invalid vector tile layers');
  if(!Array.isArray(a.bounds)||a.bounds.length!==4||a.bounds.some(v=>!Number.isFinite(v))||a.bounds[0]<-180||a.bounds[1]<-85||a.bounds[2]>180||a.bounds[3]>85||a.bounds[0]>=a.bounds[2]||a.bounds[1]>=a.bounds[3])throw new Error('Invalid tile extent');
  if(!Number.isInteger(a.tileCount)||a.tileCount<1||a.tileCount>25000||Object.keys(a.tileHashes||{}).length!==a.tileCount)throw new Error('Invalid vector tile count');
  const regex=/^(?:[0-9]|1[0-2])\/(?:0|[1-9][0-9]*)\/(?:0|[1-9][0-9]*)\.pbf$/;
  for(const [path,sha] of Object.entries(a.tileHashes)){
    if(!regex.test(path)||!/^[0-9a-f]{64}$/.test(sha))throw new Error('Invalid vector tile file manifest');
    const [z,x,y]=path.split('/').map(Number);
    if(z<a.minzoom||z>a.maxzoom||x>=2**z||y>=2**z)throw new Error('Vector tile out of bounds');
  }
  if(a.tileLayerCounts!==undefined){
    if(!a.tileLayerCounts||typeof a.tileLayerCounts!=='object'||Array.isArray(a.tileLayerCounts)||
       Object.keys(a.tileLayerCounts).length!==a.tileCount)throw Error('Invalid per-tile feature inventory');
    for(const [path,counts] of Object.entries(a.tileLayerCounts)){
      if(!Object.hasOwn(a.tileHashes,path)||!counts||typeof counts!=='object'||Array.isArray(counts)||
         Object.keys(counts).length<1)throw Error('Undeclared/empty tile inventory');
      for(const [layer,number] of Object.entries(counts)){
        if(!a.layers.includes(layer)||!Number.isSafeInteger(number)||number<1||number>50000)
          throw Error('Invalid tile feature count');
      }
    }
  }
  if(a.sourceLayers){
    if(!a.sourceLayers||typeof a.sourceLayers!=='object'||Object.keys(a.sourceLayers).sort().join(',')!==[...a.layers].sort().join(','))throw Error('Tile source-layer registry does not match published layers');
    for(const [layer,source] of Object.entries(a.sourceLayers))
      if(!TILE_LAYER_NAMES.includes(layer)||source?.officiallyVerified!==false||!/^https:\/\//.test(source.sourceUrl||'')||!source.licence||!source.attribution||!(/^[0-9a-f]{64}$/).test(source.sourceSha256||''))throw Error('Invalid layer-specific source rights and provenance');
  }
  return Object.freeze({format:a.format,officiallyVerified:false,licence:a.licence,attribution:a.attribution,sourceUrl:a.sourceUrl,
    minzoom:a.minzoom,maxzoom:a.maxzoom,layers:Object.freeze([...a.layers]),tileCount:a.tileCount,bounds:Object.freeze([...a.bounds]),tileHashes:Object.freeze({...a.tileHashes}),
    sourceLayers:a.sourceLayers?Object.freeze({...a.sourceLayers}):null,
    tileLayerCounts:a.tileLayerCounts?Object.freeze(Object.fromEntries(Object.entries(a.tileLayerCounts).map(([k,v])=>[k,Object.freeze({...v})]))):null});
}
/** Bound manifest memory use *while reading*, not only after response.text(). */
async function readBoundedTileManifest(response,maxBytes=2_000_000){
  if(Number(response.headers?.get?.('content-length')||0)>maxBytes)
    throw new Error('Tile catalogue exceeds size limit');
  if(typeof response.body?.getReader==='function'){
    const reader=response.body.getReader(),decoder=new TextDecoder();
    let count=0,result='';
    try{
      while(true){
        const {done,value}=await reader.read();if(done)break;
        count+=value.byteLength;
        if(count>maxBytes)throw new Error('Tile catalogue exceeds size limit');
        result+=decoder.decode(value,{stream:true});
      }
      return result+decoder.decode();
    }catch(error){try{await reader.cancel()}catch{}throw error}
    finally{reader.releaseLock()}
  }
  const text=await response.text();
  if(new TextEncoder().encode(text).byteLength>maxBytes)throw new Error('Tile catalogue exceeds size limit');
  return text;
}
async function loadTileManifest({fetcher=fetch,base='./data/tiles/atlas-tiles.json',timeout=3000}={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const response=await fetcher(base,{cache:'no-store',signal:controller.signal});
    if(response.status===404)return null;
    if(!response.ok)throw new Error('Tile catalogue could not be fetched');
    const payload=await readBoundedTileManifest(response);
    return validateTileManifest(JSON.parse(payload));
  }catch(e){if(e.name==='AbortError'||/failed to fetch|networkerror/i.test(String(e.message)))return null;throw e}
  finally{clearTimeout(timer)}
}
// Sparse XYZ tiles cannot be requested directly from static hosting: missing tiles produce 404s.
// A custom MapLibre protocol explicitly returns an empty vector tile for absent coordinates,
// and verifies SHA-256 for declared tiles. No external tile services are contacted.
const SPARSE_PROTOCOL='atlas-detail';
const EMPTY_MVT=new ArrayBuffer(0); // No layers is a valid empty vector-tile payload.
function tileRequestPath(url){
  const match=String(url).match(/^atlas-detail:\/\/(?:([0-9]|1[0-2])\/(0|[1-9][0-9]*)\/(0|[1-9][0-9]*))\.pbf$/);
  if(!match)throw new Error('Unexpected local vector tile URL');
  const z=Number(match[1]),x=Number(match[2]),y=Number(match[3]);
  if(x>=2**z||y>=2**z)throw new Error('Local vector tile coordinate is out of range');
  return `${z}/${x}/${y}.pbf`;
}
function bytesToHex(bytes){return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}
function createTileCache({maxBytes=12*1024*1024,maxEntries=128}={}){
 if(!Number.isInteger(maxBytes)||maxBytes<1||maxBytes>64*1024*1024||!Number.isInteger(maxEntries)||maxEntries<1||maxEntries>1024)throw Error('Invalid tile cache budget');
 const values=new Map();let size=0;
 return {
  get(path){if(!values.has(path))return null;const buf=values.get(path);values.delete(path);values.set(path,buf);return buf.slice(0)},
  put(path,data){if(!(data instanceof ArrayBuffer)||data.byteLength>maxBytes)return false;
    if(values.has(path)){size-=values.get(path).byteLength;values.delete(path)}
    values.set(path,data.slice(0));size+=data.byteLength;
    while(size>maxBytes||values.size>maxEntries){const oldest=values.keys().next().value;size-=values.get(oldest).byteLength;values.delete(oldest)}
    return true;
  },
  stats(){return {entries:values.size,bytes:size}},
  clear(){values.clear();size=0}
 };
}
function sparseTileHandler(catalog,{fetcher=fetch,hasher=null,baseUrl='./data/tiles/',cache=createTileCache()}={}){
  const known=catalog.tileHashes;
  if(!known||typeof known!=='object')throw new Error('Missing tile hash manifest');
  const inflight=new Map();
  const digest=hasher||(async data=>{
    if(!globalThis.crypto?.subtle)throw new Error('Secure browser context required for tile integrity');
    return bytesToHex(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',data)));
  });
  return async (params,abortController)=>{
    const path=tileRequestPath(params.url), signal=abortController?.signal;
    if(signal?.aborted)throw new DOMException('Tile request cancelled','AbortError');
    if(!Object.hasOwn(known,path))return {data:EMPTY_MVT};
    const hit=cache.get(path);if(hit)return {data:hit};
    let task=inflight.get(path);
    if(!task){
      const controller=new AbortController();
      task={controller,readers:0,pending:true,promise:null};
      const current=task;
      task.promise=(async()=>{
        const origin=typeof document==='undefined'?'https://atlas.invalid/':document.baseURI;
        const resolved=new URL(path,new URL(baseUrl,origin));
        const response=await fetcher(resolved.href,{signal:controller.signal,cache:'force-cache'});
        if(!response.ok)throw new Error(`Local tile ${path} failed: HTTP ${response.status}`);
        // Reject known oversized payloads before buffering; post-read byte cap is the final safeguard.
        if(Number(response.headers?.get?.('content-length')||0)>3*1024*1024)
          throw new Error(`Local tile ${path} exceeds size budget`);
        let data;
        if(typeof response.body?.getReader==='function'){
          const reader=response.body.getReader();const parts=[];let total=0;
          try{
            while(true){const {done,value}=await reader.read();if(done)break;
              total+=value.byteLength;
              if(total>3*1024*1024)throw new Error(`Local tile ${path} exceeds size budget`);
              parts.push(value);
            }
          }catch(error){try{await reader.cancel()}catch{}throw error}
          finally{reader.releaseLock()}
          const joined=new Uint8Array(total);let offset=0;
          for(const part of parts){joined.set(part,offset);offset+=part.byteLength;}
          data=joined.buffer;
        }else{
          data=await response.arrayBuffer();
          if(data.byteLength>3*1024*1024)throw new Error(`Local tile ${path} exceeds size budget`);
        }
        if(await digest(data)!==known[path])throw new Error(`Local tile ${path} failed SHA-256 verification`);
        if(!controller.signal.aborted)cache.put(path,data);
        return data;
      })().finally(()=>{
        current.pending=false;
        if(inflight.get(path)===current)inflight.delete(path);
      });
      inflight.set(path,task);
    }
    task.readers++;
    let removeAbort=()=>{};
    const aborted=new Promise((_,reject)=>{
      if(!signal)return;
      const onAbort=()=>reject(new DOMException('Tile request cancelled','AbortError'));
      signal.addEventListener('abort',onAbort,{once:true});
      removeAbort=()=>signal.removeEventListener('abort',onAbort);
      if(signal.aborted)onAbort();
    });
    try{
      const bytes=await Promise.race([task.promise,aborted]);
      return {data:bytes.slice(0)}; // No caller can mutate another reader's copy.
    }finally{
      removeAbort();
      task.readers--;
      // Cancel the physical fetch only when no active map request still needs it.
      if(task.readers===0&&task.pending){
        task.controller.abort();
        if(inflight.get(path)===task)inflight.delete(path);
      }
    }
  };
}
function registerSparseTileProtocol(maplibregl,catalog,options={}){
  if(typeof maplibregl?.addProtocol!=='function')throw new Error('MapLibre custom protocol API unavailable');
  maplibregl.addProtocol(SPARSE_PROTOCOL,sparseTileHandler(catalog,options));
}
function tileSourceSpec(catalog){
  return {type:'vector',tiles:[SPARSE_PROTOCOL+'://{z}/{x}/{y}.pbf'],scheme:'xyz',
    minzoom:catalog.minzoom,maxzoom:catalog.maxzoom,bounds:catalog.bounds,
    attribution:catalog.attribution};
}
function localDetailLayers(catalog){
  if(!catalog)return [];
  const present=name=>catalog.layers.includes(name);
  return [
    ...(present('coastlines')?[{id:'local-coastlines',type:'line',source:'local-detail','source-layer':'coastlines',minzoom:catalog.minzoom,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#347d76','line-width':['interpolate',['linear'],['zoom'],3,0.85,8,1.7],'line-opacity':0.92}}]:[]),
    ...(present('lakes')?[{id:'local-lakes',type:'line',source:'local-detail','source-layer':'lakes',minzoom:catalog.minzoom,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#539fc4','line-width':['interpolate',['linear'],['zoom'],3,0.75,8,1.35],'line-opacity':0.83}}]:[]),
    ...(present('rivers')?[{id:'local-rivers',type:'line',source:'local-detail', 'source-layer':'rivers',minzoom:catalog.minzoom,
      layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#5a9abb','line-width':['interpolate',['linear'],['zoom'],5,0.7,11,2.5],'line-opacity':0.8}}]:[]),
    ...(present('railways')?[{id:'local-railways',type:'line',source:'local-detail','source-layer':'railways',minzoom:Math.max(5,catalog.minzoom),
      paint:{'line-color':'#66676c','line-width':['interpolate',['linear'],['zoom'],5,0.6,12,2],'line-dasharray':[2,2],'line-opacity':0.8}}]:[]),
    ...(present('roads')?[{id:'local-roads',type:'line',source:'local-detail','source-layer':'roads',minzoom:catalog.minzoom,
      layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#f5f1e7','line-width':['interpolate',['linear'],['zoom'],5,0.9,12,5],'line-opacity':0.94}},
      {id:'local-roads-centerline',type:'line',source:'local-detail','source-layer':'roads',minzoom:catalog.minzoom,
      paint:{'line-color':'#bd9e83','line-width':['interpolate',['linear'],['zoom'],5,0.35,12,1.2]}}]:[]),
    ...(present('settlements')?[{id:'local-settlements',type:'circle',source:'local-detail','source-layer':'settlements',minzoom:catalog.minzoom,
      paint:{'circle-radius':['interpolate',['linear'],['zoom'],5,2,12,4.5],'circle-color':'#315e5b','circle-stroke-width':1.1,'circle-stroke-color':'white'}},
      {id:'local-settlements-labels',type:'symbol',source:'local-detail','source-layer':'settlements',minzoom:Math.max(6,catalog.minzoom),
      layout:{'text-field':['get','name'],'text-font':['sans-serif'],'text-size':['interpolate',['linear'],['zoom'],6,10,13,15],
        'text-anchor':'top','text-offset':[0,0.65],'text-allow-overlap':false},
      paint:{'text-color':'#385052','text-halo-color':'#fff','text-halo-width':1}}]:[])
  ];
}

/* src/export.mjs */
/* Standalone, resolution-independent research map exports.
 * Does not certify geographic data; preserves complete multipolygon rings and holes.
 * Coordinates are a simple equirectangular display projection (not survey-grade).
 */

const W=1600,H=1120,frame={x:75,y:150,w:1450,h:820};
const COLORS=['#dae9dc','#c2dccf','#e6ead6','#d0e4e0','#e1e0d2'];
const escapeXML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=n=>Number.isFinite(n);
function coordsOf(feature,visit){
 const walk=c=>{if(typeof c?.[0]==='number'){visit(c);return}for(const x of c??[])walk(x)};
 walk(feature.geometry.coordinates);
}
function exportExtent(fs){
 let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;
 for(const f of fs){const [[a,b],[c,d]]=featureBounds(f);xmin=Math.min(xmin,a);xmax=Math.max(xmax,c);ymin=Math.min(ymin,b);ymax=Math.max(ymax,d)}
 if(![xmin,xmax,ymin,ymax].every(finite)||xmin>=xmax||ymin>=ymax)throw Error('No valid export extent');
 // A modest margin for coastlines and individual city-state outlines.
 const dw=Math.max(xmax-xmin,.05),dh=Math.max(ymax-ymin,.05);
 return {xmin:xmin-.06*dw,xmax:xmax+.06*dw,ymin:ymin-.06*dh,ymax:ymax+.06*dh};
}
function projector(fs){
 const e=exportExtent(fs);
 // Correct East-West scale approximately at the map midpoint. A cartographic display,
 // not a geodesic metric projection or a basis for distance measurement.
 const c=Math.max(.5,Math.cos((e.ymin+e.ymax)/2*Math.PI/180));
 const dw=(e.xmax-e.xmin)*c,dh=e.ymax-e.ymin;
 const k=Math.min(frame.w/dw,frame.h/dh);
 const ox=frame.x+(frame.w-dw*k)/2,oy=frame.y+(frame.h-dh*k)/2;
 const project=([lon,lat])=>[ox+(lon-e.xmin)*c*k,oy+(e.ymax-lat)*k];
 project.atlasProjection={west:e.xmin,north:e.ymax,x0:ox,y0:oy,scaleX:c*k,scaleY:k};
 return project;
}
const fmt=n=>n.toFixed(2);
function polygonPath(feature,project){
 const g=feature.geometry,polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates;
 return polygons.map(poly=>poly.map(ring=>ring.map((p,i)=>`${i?'L':'M'}${project(p).map(fmt).join(' ')}`).join(' ')+' Z').join(' ')).join(' ');
}
function canonicalFeature(f){
 return f?.type==='Feature' && typeof f.properties?.name==='string' && ['Polygon','MultiPolygon'].includes(f.geometry?.type);
}
function renderResearchSVG(collection,{selected='',source=null,labels=true,physicalLines=null,physicalShore=null,physicalLand=null,physicalTheme=false}={}){
 if(collection?.type!=='FeatureCollection'||!Array.isArray(collection.features)||!collection.features.length||!collection.features.every(canonicalFeature))throw Error('Load a validated polygon collection before export');
 const features=selected?collection.features.filter(f=>f.properties.name===selected):collection.features;
 if(!features.length)throw Error('Selected region is no longer in the map');
 const project=projector(features);
 const title=selected?`${selected} · Research map`:'India · Research map';
 const sourceTitle=source?.title||'Unknown source';
 const licence=source?.licence||'Unknown licence';
 const attribution=source?.attribution||'Data attribution not supplied';
 const safeTitle=escapeXML(title);
 const paths=features.map((f,i)=>{
  const path=polygonPath(f,project),colour=COLORS[Number(f.properties.palette)%COLORS.length]||COLORS[i%COLORS.length];
  return `<path data-region="${escapeXML(f.properties.name)}" d="${path}" fill="${physicalTheme?'#d5e8da':colour}" fill-opacity="${physicalTheme?'0.06':'1'}" fill-rule="evenodd" stroke="#557e70" stroke-width="1.65" stroke-linejoin="round"/>`;
 }).join('\n');
 const landPaths=physicalLand?.features?.filter(f=>f.geometry?.type==='Polygon').map(f=>`<path d="${polygonPath(f,project)}"/>`).join('\n')||'';
 // Source-labelled *historical* hydrology; rendered under region labels, never
 // represented as complete, current or officially verified river geography.
 const riverPaths=physicalLines?.features?.map(f=>{
   if(f.geometry?.type!=='LineString')return '';
   return `<path d="${f.geometry.coordinates.map((p,i)=>`${i?'L':'M'}${project(p).map(fmt).join(' ')}`).join(' ')}"/>`;
 }).join('\n')||'';
 const shorePaths=physicalShore?['coastlines','lakes'].map(kind=>{
   const lines=physicalShore[kind]?.features||[];
   return `<g id="historic-${kind}" aria-label="Source-labelled historical generalized ${kind}" fill="none" stroke="${kind==='coastlines'?'#347d76':'#539fc4'}" stroke-width="${kind==='coastlines'?'1.65':'1.35'}" stroke-opacity="0.9">${lines.filter(f=>f.geometry?.type==='LineString').map(f=>`<path d="${f.geometry.coordinates.map((p,i)=>`${i?'L':'M'}${project(p).map(fmt).join(' ')}`).join(' ')}"/>`).join('')}</g>`;
 }).join(''):'';
 // Keep single-region titles legible; avoid overlap by omitting all-region labels for tiny polygons.
 const pointLabels=labels?features.map(f=>{
   const [x,y]=project(labelPoint(f));
   // Skip collisions with the frame: no guessed leader-lines/coordinates.
   if(x<frame.x+6||x>frame.x+frame.w-6||y<frame.y+6||y>frame.y+frame.h-6)return '';
   return `<text x="${fmt(x)}" y="${fmt(y)}" class="region-label">${escapeXML(f.properties.name)}</text>`;
 }).join('\n'):'';
 const desc=`Source: ${sourceTitle}. Licence: ${licence}. Attribution: ${attribution}. Provisional/independently unverified boundaries. Display projection is approximate; not intended for legal or navigational use.`;
 const svg=`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1120" viewBox="0 0 ${W} ${H}" data-atlas-projection="${[project.atlasProjection.west,project.atlasProjection.north,project.atlasProjection.x0,project.atlasProjection.y0,project.atlasProjection.scaleX,project.atlasProjection.scaleY].join(',')}" role="img" aria-labelledby="title desc">
<title id="title">${safeTitle}</title><desc id="desc">${escapeXML(desc)}</desc>
<rect width="1600" height="1120" fill="#f8faf7"/>
<rect x="33" y="31" width="1534" height="1058" rx="15" fill="white" stroke="#dae4df" stroke-width="1.5"/>
<text x="78" y="87" font-family="Arial,sans-serif" font-size="38" font-weight="700" fill="#234c3d">BHARAT ATLAS</text>
<text x="79" y="121" font-family="Arial,sans-serif" font-size="21" fill="#426458">${safeTitle}</text>
<g id="physical-land" fill="#d4e4ce" fill-rule="evenodd" stroke="none" clip-path="url(#hydrology-frame)">${landPaths}</g>
<g id="geography">${paths}</g>
<defs><clipPath id="hydrology-frame"><rect x="75" y="150" width="1450" height="820"/></clipPath><clipPath id="hydrology-selected">${selected?features.map(f=>`<path d="${polygonPath(f,project)}" clip-rule="evenodd"/>`).join(''):''}</clipPath></defs>
<g id="historic-hydrology" aria-label="Historic unlabelled WDBII river traces" clip-path="url(#${selected?'hydrology-selected':'hydrology-frame'})" fill="none" stroke="#4a9ab6" stroke-width="1.15" stroke-opacity="0.8" stroke-linecap="round">${riverPaths}</g>
<g id="physical-shorelines" clip-path="url(#${selected?'hydrology-selected':'hydrology-frame'})">${shorePaths}</g>
<style>.region-label{font-family:Arial,sans-serif;font-weight:600;font-size:${selected?21:14}px;fill:#244f43;stroke:#fff;stroke-width:3px;paint-order:stroke;stroke-linejoin:round;text-anchor:middle}</style>
<g id="labels">${pointLabels}</g>
<rect x="75" y="986" width="1450" height="1.5" fill="#d5e1da"/>
<text x="78" y="1019" font-family="Arial,sans-serif" font-size="18" font-weight="bold" fill="#ae572e">PROVISIONAL GEOGRAPHY — NOT OFFICIAL OR SURVEY-VERIFIED</text>
<text x="78" y="1048" font-family="Arial,sans-serif" font-size="15" fill="#4b635c">${escapeXML(`${sourceTitle} · ${licence} · ${attribution}`).slice(0,450)}</text>
<text x="78" y="1073" font-family="Arial,sans-serif" font-size="13" fill="#6b8279">Physical overlays if shown: GSHHG/WDBII 2.3.6, LGPL-3.0+ · Not for survey, legal or navigation use</text>
</svg>`;
 if(svg.length>25_000_000)throw Error('Export is too large; choose an individual region');
 return svg;
}
function exportFileName(selected=''){
 const basename=selected?selected.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''):'india';
 return `bharat-atlas-${basename||'region'}-research.svg`;
}

/* src/style.mjs */




const hues=['#e6eee5','#cfdfd4','#dce9d9','#e8e6d7','#d5e6e5'];
function mapStyle(theme='terrain',tileCatalog=null,transportCatalog=null){
  const modern=atlasTransportStyle(transportCatalog);
  const palette=theme==='outline'?['#fafcfb','#fafcfb','#fafcfb','#fafcfb','#fafcfb']:theme==='ink'?['#e9ebe9','#dadfdf','#f0ece6','#e1e5e2','#e8ded8']:hues;
  const fill=['match',['get','palette'],0,palette[0],1,palette[1],2,palette[2],3,palette[3],4,palette[4],palette[0]];
  return {version:8,name:`Bharat Atlas — ${theme}`, // MapLibre >=5.11 resolves fonts locally; no demo glyph network request.
    sources:{grid:{type:'geojson',data:graticule()},regions:{type:'geojson',data:{type:'FeatureCollection',features:[]}},'official-india-claim':{type:'geojson',data:{type:'FeatureCollection',features:[]}},'soi-state-boundaries':{type:'geojson',data:{type:'FeatureCollection',features:[]}},'land-mask':{type:'geojson',data:{type:'FeatureCollection',features:[]}},labels:{type:'geojson',data:{type:'FeatureCollection',features:[]}},checkpoints:{type:'geojson',data:{type:'FeatureCollection',features:[]}},'pilot-places':{type:'geojson',data:pilotFeatureCollection()},'search-location':{type:'geojson',data:{type:'FeatureCollection',features:[]}},'gazetteer-places':{type:'geojson',data:{type:'FeatureCollection',features:[]}},'atlas-measure':{type:'geojson',data:{type:'FeatureCollection',features:[]}},'atlas-user-overlay':{type:'geojson',data:{type:'FeatureCollection',features:[]}},'atlas-route':{type:'geojson',data:{type:'FeatureCollection',features:[]}},'atlas-journey-trail':{type:'geojson',data:{type:'FeatureCollection',features:[]}},'atlas-comparison':{type:'geojson',data:{type:'FeatureCollection',features:[]}},...(tileCatalog?{'local-detail':tileSourceSpec(tileCatalog)}:{}),...modern.sources},
    layers:[
      {id:'sea',type:'background',paint:{'background-color':theme==='ink'?'#eef1f3':'#edf5f6'}},
      {id:'land-fill',type:'fill',source:'land-mask',paint:{'fill-color':theme==='physical'?'#d3e3c9':theme==='ink'?'#dde3e1':theme==='outline'?'#f8faf7':'#e0e8d8','fill-opacity':0.94}},
      {id:'land-edge',type:'line',source:'land-mask',paint:{'line-color':theme==='outline'?'#325c53':'#729f8b','line-width':theme==='outline'?1.6:0.7,'line-opacity':theme==='outline'?0.9:theme==='ink'?0.42:0.15}},
      {id:'graticule',type:'line',source:'grid',layout:{visibility:'visible'},paint:{'line-color':'#a7c0c3','line-opacity':.35,'line-width':.7,'line-dasharray':[2,4]}},
      {id:'regions-fill',type:'fill',source:'regions',paint:{'fill-color':fill,'fill-opacity':theme==='physical'?0.07:1}},
      {id:'official-india-claim-line',type:'line',source:'official-india-claim',paint:{'line-color':'#b06527','line-width':['interpolate',['linear'],['zoom'],2,2,8,4],'line-opacity':0.94,'line-dasharray':[2,1]}},
      {id:'soi-state-fill',type:'fill',source:'soi-state-boundaries',paint:{'fill-color':'#e3c69c','fill-opacity':0.08}},
      {id:'soi-state-line',type:'line',source:'soi-state-boundaries',paint:{'line-color':'#9a542c','line-width':['interpolate',['linear'],['zoom'],3,1.3,7,2],'line-opacity':0.92}},
      {id:'regions-border',type:'line',source:'regions',paint:{'line-color':theme==='ink'?'#70827e':'#829b8b','line-opacity':theme==='physical'?0.36:1,'line-width':['interpolate',['linear'],['zoom'],2,0.65,6,1.2,10,1.8]}},
      {id:'regions-hover',type:'fill',source:'regions',filter:['==',['get','name'],'@@NO_REGION@@'],paint:{'fill-color':'#2e776c','fill-opacity':.12}},
      {id:'regions-selected',type:'line',source:'regions',filter:['==',['get','name'],'@@NO_REGION@@'],paint:{'line-color':'#08756c','line-width':['interpolate',['linear'],['zoom'],2,2.1,8,3.8]}},
      {id:'region-labels',type:'symbol',source:'labels',minzoom:3,layout:{'text-field':['get','name'],'text-font':['sans-serif'],'text-size':['interpolate',['linear'],['zoom'],3,10,8,14],'text-max-width':11,'text-allow-overlap':false,'text-padding':5,'visibility':'visible'},paint:{'text-color':'#36584f','text-halo-color':'rgba(250,253,250,0.94)','text-halo-width':1.4}},
      ...localDetailLayers(tileCatalog),
      ...modern.layers,
      {id:'search-location-pin',type:'circle',source:'search-location',paint:{'circle-radius':7,'circle-color':'#c04c2d','circle-stroke-width':3,'circle-stroke-color':'#ffffff'}},
      {id:'pilot-city-dots',type:'circle',source:'pilot-places',minzoom:5.4,layout:{visibility:'visible'},paint:{'circle-radius':['interpolate',['linear'],['zoom'],5.4,2.8,10,5],'circle-color':'#254e5a','circle-stroke-color':'#ffffff','circle-stroke-width':1.5}},
      {id:'pilot-city-labels',type:'symbol',source:'pilot-places',minzoom:6.0,layout:{visibility:'visible','text-field':['get','name'],'text-font':['sans-serif'],'text-size':['interpolate',['linear'],['zoom'],6,11,10,14],'text-anchor':'top','text-offset':[0,0.7],'text-allow-overlap':false,'text-padding':4},paint:{'text-color':'#283a43','text-halo-color':'#fff','text-halo-width':1.2}},
      {id:'gazetteer-dots',type:'circle',source:'gazetteer-places',minzoom:5,layout:{visibility:'visible'},paint:{'circle-radius':['interpolate',['linear'],['zoom'],5,2.4,12,4.5],'circle-color':'#65528a','circle-stroke-color':'#fff','circle-stroke-width':1.2}},
      {id:'gazetteer-labels',type:'symbol',source:'gazetteer-places',minzoom:6.6,layout:{visibility:'visible','text-field':['get','name'],'text-font':['sans-serif'],'text-size':['interpolate',['linear'],['zoom'],6.6,10,13,13],'text-anchor':'top','text-offset':[0,0.7],'text-allow-overlap':false},paint:{'text-color':'#504063','text-halo-color':'#fff','text-halo-width':1.2}},
      {id:'gazetteer-selected',type:'circle',source:'gazetteer-places',minzoom:3,filter:['==',['get','id'],'@@NO_PLACE@@'],paint:{'circle-radius':9,'circle-color':'#6f4ab5','circle-stroke-color':'#fff','circle-stroke-width':2}},
      {id:'pilot-place-selected',type:'circle',source:'pilot-places',filter:['==',['get','name'],'@@NO_PLACE@@'],minzoom:3,paint:{'circle-radius':9,'circle-color':'#d38b3c','circle-stroke-color':'white','circle-stroke-width':2}},
      {id:'atlas-transport-lines',type:'line',source:'atlas-user-overlay',filter:['!=',['get','kind'],'settlement'],paint:{'line-color':['match',['get','kind'],'railway','#b5694f','waterway','#2389b0','#cd975a'],'line-width':['interpolate',['linear'],['zoom'],3,1.5,12,3.5],'line-opacity':.85}},
      {id:'atlas-transport-points',type:'circle',source:'atlas-user-overlay',filter:['==',['get','kind'],'settlement'],paint:{'circle-radius':5,'circle-color':'#8c6493','circle-stroke-color':'white','circle-stroke-width':1.5}},
      {id:'atlas-journey-path',type:'line',source:'atlas-journey-trail',paint:{'line-color':'#1c8b7b','line-width':['interpolate',['linear'],['zoom'],3,1.8,10,3.3],'line-dasharray':[2,2],'line-opacity':.85}},
      {id:'atlas-comparison-line',type:'line',source:'atlas-comparison',filter:['==',['geometry-type'],'LineString'],paint:{'line-color':'#b35435','line-width':['interpolate',['linear'],['zoom'],3,2.4,10,4],'line-dasharray':[2,1.5],'line-opacity':.92}},
      {id:'atlas-comparison-points',type:'circle',source:'atlas-comparison',filter:['==',['geometry-type'],'Point'],paint:{'circle-radius':7,'circle-color':['match',['get','role'],'A','#b35435','B','#176c63','#b35435'],'circle-stroke-width':2,'circle-stroke-color':'#ffffff'}},
      {id:'atlas-research-route',type:'line',source:'atlas-route',paint:{'line-color':'#1c7cc3','line-width':5,'line-opacity':.95}},
      {id:'atlas-measure-area',type:'fill',source:'atlas-measure',filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':'#efac45','fill-opacity':.22}},
      {id:'atlas-measure-stroke',type:'line',source:'atlas-measure',paint:{'line-color':'#b86629','line-width':3,'line-dasharray':[2,1]}},
      {id:'atlas-measure-vertices',type:'circle',source:'atlas-measure',filter:['==',['geometry-type'],'Point'],paint:{'circle-radius':6,'circle-color':'#b86629','circle-stroke-width':2,'circle-stroke-color':'white'}},
      {id:'qa-points',type:'circle',source:'checkpoints',layout:{visibility:'none'},paint:{'circle-radius':6,'circle-color':['case',['get','pass'],'#19785e','#b94a37'],'circle-stroke-color':'#fff','circle-stroke-width':2}}
    ]};
}

/* src/data.mjs */

const COMMUNITY_COMMIT='2c829a3543171810a4b28162ea736fb76dfdef40';
const PINNED=`https://cdn.jsdelivr.net/gh/Vardhan-Systems/vardhan-maps@${COMMUNITY_COMMIT}/src/data/generated/states.low.json`;
const RAW=`https://raw.githubusercontent.com/Vardhan-Systems/vardhan-maps/${COMMUNITY_COMMIT}/src/data/generated/states.low.json`;
const COMMUNITY_SOURCE={kind:'community',title:'Community research data',url:'https://github.com/Vardhan-Systems/vardhan-maps',licence:'ODbL 1.0',attribution:'© OpenStreetMap contributors',verified:false};
function importedSource(filename){return {kind:'import',title:filename,licence:'Unknown — check your data rights',attribution:'User-provided file',verified:false,url:null}}
async function verifyBoundaryDigest(text,expected,hasher=globalThis.crypto?.subtle){
  if(!/^[0-9a-f]{64}$/.test(String(expected||'')))throw new Error('Invalid geographic checksum metadata');
  if(!hasher?.digest)throw new Error('Secure context required for geographic integrity verification');
  const bytes=new TextEncoder().encode(text);
  const hash=new Uint8Array(await hasher.digest('SHA-256',bytes));
  const actual=Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('');
  if(actual!==expected)throw new Error('Local geographic integrity check failed');
  return true;
}
async function readBoundedText(response,maxBytes=4_000_000){
  if(Number(response.headers?.get?.('content-length')||0)>maxBytes)throw new Error('Boundary file exceeds size limit');
  if(typeof response.body?.getReader==='function'){
    const reader=response.body.getReader();const decoder=new TextDecoder();let bytes=0,result='';
    try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;
      if(bytes>maxBytes)throw new Error('Boundary file exceeds size limit');result+=decoder.decode(value,{stream:true})}
      return result+decoder.decode();
    }catch(e){try{await reader.cancel()}catch{}throw e}finally{reader.releaseLock()}
  }
  const text=await response.text();if(new TextEncoder().encode(text).byteLength>maxBytes)throw new Error('Boundary file exceeds size limit');return text;
}
async function readJSON(url,{signal,timeout=9000,expectedSha256=null}={}){
  const ac=new AbortController();const abort=()=>ac.abort();if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,timeout);
  try{
    const response=await fetch(url,{signal:ac.signal,cache:'no-cache'});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const text=await readBoundedText(response);
    if(expectedSha256)await verifyBoundaryDigest(text,expectedSha256);
    return JSON.parse(text);
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
}
async function loadCommunity({signal,allowRemoteFallback=true}={}){
  let last,bundledFound=false;
  // A bundled file requires separate, explicit provenance. Never silently assign ODbL to a different import.
  try{
    const provenance=await readJSON('./data/preview-provenance.json',{signal,timeout:2500});
    bundledFound=true;
    if(provenance.officiallyVerified!==false||!provenance.licence||!provenance.attribution||!provenance.sourceUrl?.startsWith('https://')||!(/^[0-9a-f]{64}$/).test(provenance.sha256||''))throw new Error('Bundled source lacks valid provisional provenance or SHA-256');
    const json=await readJSON('./data/states.provisional.geojson',{signal,timeout:3500,expectedSha256:provenance.sha256});
    const fc=validateCollection(json,{requireComplete:true});
    return {fc,audit:inspectCollection(fc),source:{kind:'licensed-preview',title:'Self-hosted provisional data',url:provenance.sourceUrl,licence:provenance.licence,attribution:provenance.attribution,verified:false,loadedFrom:'./data/states.provisional.geojson'}};
  }catch(e){last=e;if(signal?.aborted)throw e;
    // A present-but-invalid local archive is a security failure; do not silently replace it
    // with unrelated remote geometry, which could mislead the user about provenance.
    if(bundledFound || !/HTTP 404|failed to fetch|networkerror|abort/i.test(String(e.message)))throw e;
  }
  // In India official-claims mode do not silently fetch provisional remote borders.
  if(!allowRemoteFallback)throw new Error('No reviewed Indian political polygons loaded; use the source-backed official outline where available.');
  for(const url of [PINNED,RAW]){
    if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
    try{const json=await readJSON(url,{signal});const fc=validateCollection(json,{requireComplete:true});return {fc,audit:inspectCollection(fc),source:{...COMMUNITY_SOURCE,loadedFrom:url}}}catch(e){last=e;if(signal?.aborted)throw e}
  }
  throw new Error(`Boundary data unavailable. Import your own GeoJSON or try again. (${last?.message||'Network error'})`);
}

/* src/renderer-health.mjs */
/** Research viewer renderer diagnostics. Never calls a remote endpoint or claims GPU certification. */
const RENDERER_DIAGNOSTICS_VERSION='BharatAtlasRendererDiagnostics1';
const RENDERER_RETRY_COOLDOWN_MS=1500;

function canRetryRenderer({now,lastAttemptAt=0,attempts=0}={}){
  return Number.isFinite(now)&&now>=0&&Number.isFinite(lastAttemptAt)
    &&(attempts===0||now-lastAttemptAt>=RENDERER_RETRY_COOLDOWN_MS);
}

function rendererFailureType(message=''){
  const value=String(message).toLowerCase();
  if(/context.*lost|lost.*context|webglcontextlost|graphics interrupted/.test(value))return 'context_lost';
  if(/webgl|gpu|unsupported/.test(value))return 'webgl_unsupported_or_failed';
  if(/library|engine|script|maplibre/.test(value))return 'engine_missing_or_failed';
  if(/tile|sha-256|integrity|protocol/.test(value))return 'tile_loading_or_integrity';
  if(/boundar|geograph|source/.test(value))return 'boundary_data_unavailable';
  return 'other';
}

function createRendererDiagnosticRecord(input={}){
  const status=String(input.status||'not_tested').slice(0,80);
  const reason=String(input.reason||'').slice(0,250);
  return {
    format:RENDERER_DIAGNOSTICS_VERSION,
    generatedAt:input.generatedAt||new Date().toISOString(),
    status,
    failureType:rendererFailureType(reason),
    reason,
    engine:{available:!!input.engineAvailable,version:String(input.engineVersion||'unknown').slice(0,40),supported:input.engineSupported??null},
    webgl2Probe:input.webgl2Probe??'not_tested',
    browser:{userAgent:input.userAgent?String(input.userAgent).slice(0,250):'not_shared'},
    map:{loaded:!!input.mapLoaded,politicalBordersLoaded:!!input.politicalBordersLoaded,physicalLandLoaded:!!input.physicalLandLoaded,
      verifiedTileCatalogueLoaded:!!input.tileCatalogueLoaded,attemptCount:Math.max(0,Math.min(999,Number(input.attemptCount)||0))},
    disclosure:'Local diagnostic only. This record is not a real-GPU rendering proof, source certification, or official political-map verification.'
  };
}

/* src/transport-pack.mjs */
/* Separate modern transport research tile pack, preserving the bundled historic
 * GSHHG physical archive. Requires independently approved source metadata.
 * This is not a road navigation graph or a political boundary layer.
 */

const ATLAS_TRANSPORT_PROTOCOL='atlas-transport';
async function atlasLoadTransportPack(fetcher=fetch){
 return loadTileManifest({fetcher,base:'./data/transport-pack/atlas-tiles.json',timeout:3500});
}
function atlasRegisterTransportPack(maplibregl,catalog,opts={}){
 if(typeof maplibregl?.addProtocol!=='function')throw Error('Transport tile protocol unavailable');
 const handler=sparseTileHandler(catalog,{baseUrl:'./data/transport-pack/',...opts});
 maplibregl.addProtocol(ATLAS_TRANSPORT_PROTOCOL,(params,signal)=>{
  const url=String(params?.url||'');
  if(!/^atlas-transport:\/\//.test(url))throw Error('Unexpected transport tile protocol');
  return handler({...params,url:url.replace(/^atlas-transport:\/\//,'atlas-detail://')},signal);
 });
}
function atlasTransportStyle(catalog){
 if(!catalog)return {sources:{},layers:[]};
 const has=name=>catalog.layers.includes(name);
 return {
  sources:{'research-transport':{...tileSourceSpec(catalog),tiles:[ATLAS_TRANSPORT_PROTOCOL+'://{z}/{x}/{y}.pbf']}},
  layers:[
   ...(has('roads')?[{id:'research-roads-casing',type:'line',source:'research-transport','source-layer':'roads',minzoom:catalog.minzoom,paint:{'line-color':'#fff','line-width':['interpolate',['linear'],['zoom'],4,1,12,5.5]}},{id:'research-roads',type:'line',source:'research-transport','source-layer':'roads',minzoom:catalog.minzoom,paint:{'line-color':['match',['get','highway'],['motorway','trunk'],'#cf7953',['primary','secondary'],'#bf9363','#ad9a85'],'line-width':['interpolate',['linear'],['zoom'],4,0.65,9,['match',['get','highway'],['motorway','trunk'],2.4,['primary','secondary'],1.5,0.85],12,['match',['get','highway'],['motorway','trunk'],5,['primary','secondary'],3.2,1.5]]}}]:[]),
   ...(has('roads')?[{id:'research-road-labels',type:'symbol',source:'research-transport','source-layer':'roads',minzoom:Math.max(9,catalog.minzoom),filter:['has','name'],layout:{'symbol-placement':'line','text-field':['get','name'],'text-font':['sans-serif'],'text-size':['interpolate',['linear'],['zoom'],9,9,13,12],'text-max-angle':25,'text-padding':4},paint:{'text-color':'#72543d','text-halo-color':'#fff','text-halo-width':1.4}}]:[]),
   ...(has('railways')?[{id:'research-railways',type:'line',source:'research-transport','source-layer':'railways',minzoom:catalog.minzoom,paint:{'line-color':'#6c6376','line-width':['interpolate',['linear'],['zoom'],4,1,12,2.5],'line-dasharray':[2,2]}}]:[]),
   ...(has('rivers')?[{id:'research-waterways',type:'line',source:'research-transport','source-layer':'rivers',minzoom:catalog.minzoom,paint:{'line-color':'#238cb4','line-width':['interpolate',['linear'],['zoom'],4,.8,12,2.5]}}]:[]),
   ...(has('rivers')?[{id:'research-waterway-labels',type:'symbol',source:'research-transport','source-layer':'rivers',minzoom:Math.max(8,catalog.minzoom),filter:['has','name'],layout:{'symbol-placement':'line','text-field':['get','name'],'text-font':['sans-serif'],'text-size':11,'text-padding':6},paint:{'text-color':'#246f94','text-halo-color':'#fff','text-halo-width':1.3}}]:[]),
   ...(has('pois')?[{id:'research-pois',type:'circle',source:'research-transport','source-layer':'pois',minzoom:Math.max(11,catalog.minzoom),paint:{'circle-radius':3.3,'circle-color':['match',['get','amenity'],'hospital','#c35766','school','#398aa5','#bd7451'],'circle-stroke-color':'white','circle-stroke-width':1}},
    {id:'research-poi-labels',type:'symbol',source:'research-transport','source-layer':'pois',minzoom:Math.max(12,catalog.minzoom),layout:{'text-field':['get','name'],'text-size':10,'text-offset':[0,1.1],'text-anchor':'top','text-allow-overlap':false},paint:{'text-color':'#70443d','text-halo-color':'#fff','text-halo-width':1}}]:[]),
   ...(has('settlements')?[{id:'research-settlements',type:'circle',source:'research-transport','source-layer':'settlements',minzoom:catalog.minzoom,paint:{'circle-radius':4,'circle-color':'#5a4d88','circle-stroke-color':'#fff','circle-stroke-width':1.2}},
    {id:'research-settlement-labels',type:'symbol',source:'research-transport','source-layer':'settlements',minzoom:Math.max(6,catalog.minzoom),layout:{'text-field':['get','name'],'text-font':['sans-serif'],'text-size':11,'text-offset':[0,.8],'text-anchor':'top','text-allow-overlap':false},paint:{'text-color':'#49425f','text-halo-color':'white','text-halo-width':1.2}}]:[])
  ]
 };
}

/* src/detail-math.mjs */
/* Bharat Atlas v0.32 – source-aware geographic context.
 * Calculations are approximate WGS84/spherical research aids, never roads,
 * authoritative survey distances or state/sovereignty determinations.
 */
const DEG=Math.PI/180;
const EARTH_KM=6371.0088;
function atlasValidLonLat(lon,lat){return Number.isFinite(lon)&&Number.isFinite(lat)&&lon>=-180&&lon<=180&&lat>=-90&&lat<=90;}
function atlasGreatCircleKm(a,b){
 if(!a||!b||!atlasValidLonLat(a.lon,a.lat)||!atlasValidLonLat(b.lon,b.lat))throw Error('Valid longitude and latitude required');
 const dlat=(b.lat-a.lat)*DEG,dlon=(b.lon-a.lon)*DEG;
 const hav=Math.min(1,Math.max(0,Math.sin(dlat/2)**2+Math.cos(a.lat*DEG)*Math.cos(b.lat*DEG)*Math.sin(dlon/2)**2));
 return 2*EARTH_KM*Math.atan2(Math.sqrt(hav),Math.sqrt(1-hav));
}
function atlasBearing(a,b){
 if(!a||!b||!atlasValidLonLat(a.lon,a.lat)||!atlasValidLonLat(b.lon,b.lat))throw Error('Invalid bearing coordinates');
 if(atlasGreatCircleKm(a,b)<0.000001)return null;
 const dl=(b.lon-a.lon)*DEG;
 const y=Math.sin(dl)*Math.cos(b.lat*DEG);
 const x=Math.cos(a.lat*DEG)*Math.sin(b.lat*DEG)-Math.sin(a.lat*DEG)*Math.cos(b.lat*DEG)*Math.cos(dl);
 return (Math.atan2(y,x)/DEG+360)%360;
}
function atlasCompass(bearing){return bearing===null?'same location':['N','NE','E','SE','S','SW','W','NW'][Math.round(bearing/45)%8];}
function atlasNearbyPlaces(centre,places,{limit=5,minKm=0.25}={}){
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
function atlasScaleFromMetersPerPixel(metresPerPixel,{targetPx=95}={}){
 if(!Number.isFinite(metresPerPixel)||metresPerPixel<=0||!Number.isFinite(targetPx)||targetPx<=0)throw Error('Invalid map scale');
 const desired=metresPerPixel*targetPx;
 const power=10**Math.floor(Math.log10(desired));
 const unit=[1,2,5,10].filter(n=>n*power<=desired).at(-1)||1;
 const metres=power*unit;
 return {metres,pixels:metres/metresPerPixel,label:metres>=1000?`${Number((metres/1000).toFixed(3))} km`:`${Number(metres.toFixed(2))} m`};
}
function atlasMercatorScale(latitude,zoom){
 if(!Number.isFinite(latitude)||Math.abs(latitude)>85.05||!Number.isFinite(zoom)||zoom<0||zoom>23)throw Error('Invalid map centre or zoom');
 const metresPerPixel=(2*Math.PI*6378137*Math.cos(latitude*DEG))/(512*2**zoom);
 return atlasScaleFromMetersPerPixel(metresPerPixel);
}
function atlasGreatCircleSegment(a,b,{steps=28}={}){
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
function atlasJourneyTrail(stops,currentIndex){
 if(!Array.isArray(stops)||!Number.isInteger(currentIndex))throw Error('Invalid journey progress');
 const features=[];
 for(let i=1;i<=Math.min(currentIndex,stops.length-1);i++){
  const a=stops[i-1],b=stops[i];
  features.push({type:'Feature',properties:{sequence:i,kind:'great-circle-research-line',description:'Approximate direct-line geographic connector; not a road, flight or travel route'},geometry:{type:'LineString',coordinates:atlasGreatCircleSegment(a,b)}});
 }
 return {type:'FeatureCollection',features};
}

/* src/coverage-inspector.mjs */
/** Inspect a declared local research tile at a WGS84 coordinate.
 * A tile hash declares *data availability*, never actual feature presence,
 * completeness, precision, official status, or country-wide coverage.
 */
function atlasXYZ(lon,lat,zoom){
  if(![lon,lat,zoom].every(Number.isFinite)||lon < -180||lon > 180 || lat < -90||lat > 90||!Number.isInteger(zoom)||zoom<0||zoom>12)
    throw new RangeError('Expected valid WGS84 longitude, latitude and integer zoom (0..12)');
  const n=2**zoom;
  const x=Math.max(0,Math.min(n-1,Math.floor(((lon===180?180-Number.EPSILON*180:lon)+180)/360*n)));
  const clamped=Math.max(-85.05112878,Math.min(85.05112878,lat));
  const radians=clamped*Math.PI/180;
  const y=Math.max(0,Math.min(n-1,Math.floor((1-Math.asinh(Math.tan(radians))/Math.PI)/2*n)));
  return {z:zoom,x,y,path:`${zoom}/${x}/${y}.pbf`};
}
function atlasInspectResearchTile(catalog,lon,lat,viewZoom=6){
  if(!catalog)return {status:'catalogue_unavailable',message:'No verified local tile catalogue is loaded',available:false};
  if(!Number.isInteger(catalog.minzoom)||!Number.isInteger(catalog.maxzoom)||catalog.minzoom<0||catalog.maxzoom>12||catalog.minzoom>catalog.maxzoom)
    throw new TypeError('Invalid catalogue zoom limits');
  if(!Number.isFinite(viewZoom)||viewZoom<0||viewZoom>22)throw new RangeError('Invalid map zoom');
  const zoom=Math.min(catalog.maxzoom,Math.max(catalog.minzoom,Math.floor(viewZoom)));
  const tile=atlasXYZ(lon,lat,zoom);
  const hasDeclaredTile=Object.hasOwn(catalog.tileHashes||{},tile.path);
  const hasDecodedInventory=hasDeclaredTile&&catalog.tileLayerCounts!==undefined&&catalog.tileLayerCounts!==null;
  const counts=hasDecodedInventory?catalog.tileLayerCounts[tile.path]:null;
  return {
    featureCounts:counts?{...counts}:null,featureCountEvidence:counts?'decoded_mvt':'not_recorded',
    status:hasDeclaredTile?'declared_tile':'no_declared_tile',available:hasDeclaredTile,
    zoom:tile.z,requestedZoom:viewZoom,path:tile.path,
    overscaled:viewZoom>catalog.maxzoom,underscaled:viewZoom<catalog.minzoom,
    layers:counts?Object.keys(counts):Array.isArray(catalog.layers)?[...catalog.layers]:[],
    tileSha256:hasDeclaredTile?catalog.tileHashes[tile.path]:null,
    disclaimer:counts?'Decoded tile-layer feature occurrences are verified; they do not prove coordinate-level intersection, nationwide completeness, current accuracy, or official boundaries.':'The presence of a hashed tile does not prove individual layers contain features here, complete local coverage, current accuracy or official boundaries.'
  };
}
function atlasTileZoomInventory(catalog){
  if(!catalog)return [];
  const counts=new Map(),perZoom=new Map();
  for(const path of Object.keys(catalog.tileHashes||{})){
    const zoom=Number(path.split('/')[0]);
    if(Number.isInteger(zoom)&&zoom>=catalog.minzoom&&zoom<=catalog.maxzoom)
      counts.set(zoom,(counts.get(zoom)||0)+1);
    const found=catalog.tileLayerCounts?.[path];
    if(found){
      if(!perZoom.has(zoom))perZoom.set(zoom,{});
      for(const [layer,number] of Object.entries(found)){
        perZoom.get(zoom)[layer]=(perZoom.get(zoom)[layer]||0)+number;
      }
    }
  }
  return Array.from({length:catalog.maxzoom-catalog.minzoom+1},(_,i)=>({zoom:i+catalog.minzoom,occupiedTiles:counts.get(i+catalog.minzoom)||0,decodedLayerOccurrences:catalog.tileLayerCounts?(perZoom.get(i+catalog.minzoom)||{}):null}));
}

/* src/compare.mjs */
/* Bharat Atlas v0.33 — source-backed city pair comparison.
 * This is spherical geographic context, NOT a road or legally surveyed route.
 */

const ATLAS_COMPARISON_RADIUS=6371.0088;
function atlasSphericalMidpoint(a,b){
 if(!a||!b||!atlasValidLonLat(a.lon,a.lat)||!atlasValidLonLat(b.lon,b.lat))throw Error('Invalid midpoint endpoints');
 const x1=Math.cos(a.lat*Math.PI/180)*Math.cos(a.lon*Math.PI/180),y1=Math.cos(a.lat*Math.PI/180)*Math.sin(a.lon*Math.PI/180),z1=Math.sin(a.lat*Math.PI/180);
 const x2=Math.cos(b.lat*Math.PI/180)*Math.cos(b.lon*Math.PI/180),y2=Math.cos(b.lat*Math.PI/180)*Math.sin(b.lon*Math.PI/180),z2=Math.sin(b.lat*Math.PI/180);
 const x=x1+x2,y=y1+y2,z=z1+z2,n=Math.hypot(x,y,z);
 if(n<1e-9)throw Error('Midpoint undefined for antipodal points');
 return {lon:Math.atan2(y,x)*180/Math.PI,lat:Math.atan2(z,Math.hypot(x,y))*180/Math.PI};
}
function atlasComparePlaces(a,b){
 if(!a||!b||!atlasValidLonLat(a.lon,a.lat)||!atlasValidLonLat(b.lon,b.lat)||typeof a.name!=='string'||typeof b.name!=='string'||!a.name.trim()||!b.name.trim())throw Error('Two named WGS84 locations are required');
 const distanceKm=atlasGreatCircleKm(a,b);
 if(distanceKm<.001)throw Error('Select distinct locations at least one metre apart');
 const reverse=atlasBearing(b,a),forward=atlasBearing(a,b),midpoint=atlasSphericalMidpoint(a,b);
 const coordinates=atlasGreatCircleSegment(a,b,{steps:48});
 return {format:'BharatAtlasComparison1',method:'Spherical haversine, initial great-circle bearings, spherical midpoint',earthRadiusKm:ATLAS_COMPARISON_RADIUS,
  officiallyVerified:false,navigationReady:false,distanceKm,initialBearingDegrees:forward,returnBearingDegrees:reverse,
  bearingCompass:atlasCompass(forward),returnCompass:atlasCompass(reverse),midpoint,
  endpoints:[a,b].map(p=>({id:String(p.id??''),name:p.name,lon:p.lon,lat:p.lat,region:p.region||'Unverified research label',kind:p.kind||'place',source:p.source||'unknown'})),
  disclaimer:'Approximate direct-line geographic relation; not a road, railway, flight path, territorial claim, surveying result, or navigation guidance',
  geometry:{type:'FeatureCollection',features:[{type:'Feature',properties:{kind:'research-great-circle',route:false,officiallyVerified:false},geometry:{type:'LineString',coordinates}},...([a,b].map((p,i)=>({type:'Feature',properties:{kind:'endpoint',role:i===0?'A':'B',name:p.name},geometry:{type:'Point',coordinates:[p.lon,p.lat]}})))]}};
}
function atlasComparisonBounds(report){
 if(!report?.endpoints||report.endpoints.length!==2)throw Error('Comparison endpoints missing');
 const [a,b]=report.endpoints;
 return [[Math.min(a.lon,b.lon),Math.min(a.lat,b.lat)],[Math.max(a.lon,b.lon),Math.max(a.lat,b.lat)]];
}

/* src/motion.mjs */
/* Motion and zoom language for Bharat Atlas. Pure, deterministic functions.
 * Does not imply survey accuracy or national dataset completeness. */
function atlasReducedMotion(media = null) {
  try { return Boolean(media?.matches); } catch (_) { return false; }
}
function atlasMotionDuration(current, target, {reduced=false, speed=1}={}) {
  if(reduced) return 0;
  const a=Array.isArray(current)?current:[79.5,22.6];
  const b=Array.isArray(target)?target:a;
  if(![...a,...b].every(Number.isFinite)) return 580;
  const dx=(a[0]-b[0])*Math.cos(((a[1]+b[1])/2)*Math.PI/180),dy=a[1]-b[1];
  const dist=Math.hypot(dx,dy);
  const rate=Math.min(1.75,Math.max(.6,Number(speed)||1));
  return Math.round(Math.min(1450,Math.max(360,390+dist*28))/rate);
}
function atlasZoomNarrative(zoom,{hasTransport=false,hasTiles=false,hasPlaces=false}={}) {
  if(!Number.isFinite(zoom))return {title:'Map overview',description:'Zoom level not available'};
  if(zoom<4.5)return {title:'Regional overview',description:'Generalized physical geography. Boundaries are not certified.'};
  if(zoom<6.5)return {title:'Landscape & cities',description:hasPlaces?'Selected, source-labelled populated places appear as you zoom.':'City-level coverage is not yet loaded.'};
  if(zoom<9)return {title:'Closer geography',description:hasTiles?'Source-backed generalized waterways, shorelines and city points where tiles exist.':'No verified local detail tiles at this scale.'};
  return {title:'Close inspection',description:hasTransport?'Modern transport research features only where supplied; not a navigable street map.':'National roads, addresses and detailed locality coverage are not bundled.'};
}
function validPlace(p){return p&&typeof p.name==='string'&&p.name.trim()&&Number.isFinite(p.lon)&&Number.isFinite(p.lat)&&p.lon>=60&&p.lon<=102&&p.lat>=3&&p.lat<=41;}
function atlasJourneyStops(places,limit=7) {
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
function atlasClampZoom(value){return Math.min(6,Math.max(1,value));}
function atlasFallbackTarget({currentZoom=1,newZoom=1,pan={x:0,y:0},anchor={x:0,y:0}}={}){
  const z=atlasClampZoom(newZoom),old=atlasClampZoom(currentZoom);
  if(!Number.isFinite(anchor.x)||!Number.isFinite(anchor.y))throw Error('Invalid map zoom anchor');
  if(z===1)return {zoom:1,pan:{x:0,y:0}};
  const ratio=z/old;
  // Transforms use the SVG's center as origin. Anchor coordinates are in viewport pixels relative to that center.
  return {zoom:z,pan:{x:anchor.x-(anchor.x-(Number(pan.x)||0))*ratio,y:anchor.y-(anchor.y-(Number(pan.y)||0))*ratio}};
}

/* src/explorer-tools.mjs */
/* Bharat Atlas research toolkit v0.31.
 * Locally calculated exploratory quantities and source-labelled overlays.
 * Not a survey, official boundary, address geocoder or road-routing engine.
 */
const ATLAS_EARTH_RADIUS_KM=6371.0088;
function atlasValidCoordinate(pair){return Array.isArray(pair)&&pair.length===2&&pair.every(n=>typeof n==='number'&&Number.isFinite(n))&&pair[0]>=60&&pair[0]<=102&&pair[1]>=3&&pair[1]<=41;}
function atlasParseCoordinateInput(value){
  const parts=String(value).trim().split(/[,\s]+/);
  if(parts.length!==2||parts.some(v=>v===''||!/^[-+]?\d+(?:\.\d+)?$/.test(v)))throw Error('Enter longitude, latitude in decimal degrees, e.g. 77.41, 23.26');
  const point=parts.map(Number);
  if(!atlasValidCoordinate(point))throw Error('Coordinate is outside the supported India research window (60–102°E, 3–41°N)');
  return point;
}
function atlasHaversineKm(a,b){
 if(!atlasValidCoordinate(a)||!atlasValidCoordinate(b))throw Error('Invalid WGS84 research coordinate');
 const radians=Math.PI/180,phi1=a[1]*radians,phi2=b[1]*radians;
 const dPhi=(b[1]-a[1])*radians,dLam=(b[0]-a[0])*radians;
 const s=Math.sin(dPhi/2)**2+Math.cos(phi1)*Math.cos(phi2)*Math.sin(dLam/2)**2;
 return 2*ATLAS_EARTH_RADIUS_KM*Math.asin(Math.min(1,Math.sqrt(s)));
}
function atlasMeasurePath(points,mode='distance'){
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
function atlasMeasurementGeoJSON(points,mode){
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
function atlasValidateResearchOverlay(input,metadata){
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
function atlasMakeBookmark({name,lon,lat,kind='coordinate'}){
 const pair=[lon,lat];if(!atlasValidCoordinate(pair)||!['coordinate','city'].includes(kind))throw Error('Bookmark location invalid');
 const label=String(name||'').trim().slice(0,100);if(!label)throw Error('Bookmark label required');
 return {name:label,lon,lat,kind};
}
function atlasCleanBookmarks(value){
 if(!Array.isArray(value))return [];
 const clean=[];
 for(const item of value.slice(0,100))try{const b=atlasMakeBookmark(item);if(!clean.some(p=>p.lon===b.lon&&p.lat===b.lat))clean.push(b);}catch(_){/* Reject invalid saved records */}
 return clean.slice(0,40);
}
function atlasParseViewParams(search){
 const p=new URLSearchParams(String(search||'').slice(0,700));const out={};
 const style=p.get('theme');if(['terrain','physical','ink','outline'].includes(style))out.style=style;
 const region=p.get('region');if(region&&region.length<=100&&/^[\p{L} .&()-]+$/u.test(region))out.region=region;
 if(p.has('lon')||p.has('lat')){
  const lon=Number(p.get('lon')),lat=Number(p.get('lat'));
  if(p.get('lon')!==null&&p.get('lat')!==null&&atlasValidCoordinate([lon,lat]))out.coordinate=[lon,lat];
 }
 return out;
}
function atlasViewURL(base,{style,region,coordinate,officiallyVerified=false}={}){
 const url=new URL(base);url.search='';url.hash='';
 if(['terrain','physical','ink','outline'].includes(style))url.searchParams.set('theme',style);
 if(!officiallyVerified&&region&&region.length<=100)url.searchParams.set('region',region);
 if(coordinate&&atlasValidCoordinate(coordinate)){
  url.searchParams.delete('region');url.searchParams.set('lon',String(Number(coordinate[0].toFixed(5))));url.searchParams.set('lat',String(Number(coordinate[1].toFixed(5))));
 }
 return url.href;
}

/* src/router.mjs */
/* Evidence-bounded road graph. Honours explicit source oneway/vehicle access,
 * grade-separated vertices and optional reviewed turn prohibitions.
 * Never certify navigation from partial research data. */

const blocked=v=>['no','private','destination','delivery'].includes(String(v??'').toLowerCase());
const carExcluded=v=>['footway','pedestrian','cycleway','path','steps','bridleway'].includes(String(v??'').toLowerCase());
function atlasRoadGraph(collection,{maxNodes=14000}={}){
 if(collection?.type!=='FeatureCollection'||!Array.isArray(collection.features))throw Error('Load a valid source-backed research overlay first');
 const nodes=[],edges=[],ids=new Map(),adj=[];
 const getId=(pair,grade='0')=>{
  if(!atlasValidCoordinate(pair))throw Error('Invalid routing coordinate');
  // Exact point AND grade match; separate bridges/tunnels never join by proximity.
  const key=String(pair[0])+':'+String(pair[1])+':'+grade;
  if(ids.has(key))return ids.get(key);
  if(nodes.length>=maxNodes)throw Error('Local road graph exceeds the configured vertex limit; use a regional extract');
  const id=nodes.length;ids.set(key,id);nodes.push([...pair]);adj.push([]);return id;
 };
 let excluded=0,onewaySegments=0;
 for(let featureIndex=0;featureIndex<collection.features.length;featureIndex++){
  const f=collection.features[featureIndex],p=f.properties||{};
  if(p.kind!=='road')continue;
  if(blocked(p.motor_vehicle)||blocked(p.vehicle)||blocked(p.access)||carExcluded(p.highway)){excluded++;continue;}
  const geom=f.geometry||{};
  if(!['LineString','MultiLineString'].includes(geom.type))continue;
  const layer=String(p.layer??'0');
  if(!/^-?[0-5]$/.test(layer))throw Error('Invalid road layer; require reviewed grade data');
  const grade=layer+':'+String(p.bridge??'no')+':'+String(p.tunnel??'no');
  const roadId=String(p.id??p.sourceIndex??featureIndex);
  if(!/^[\w.:-]{1,80}$/.test(roadId))throw Error('Invalid road source ID');
  const one=String(p.oneway??'no').toLowerCase();
  if(!['yes','true','1','no','false','0','-1','reversible','alternating'].includes(one))throw Error('Unsupported one-way tag; cannot infer routing permission');
  if(['reversible','alternating'].includes(one)){excluded++;continue;}
  const forward=one!=='-1',reverse=!['yes','true','1'].includes(one);
  const lines=geom.type==='LineString'?[geom.coordinates]:geom.coordinates;
  for(const line of lines){let last=null;
   for(const point of line){const next=getId(point,grade);
    if(last!==null&&next!==last){
      const weight=atlasHaversineKm(nodes[last],nodes[next]);
      if(weight>0&&weight<300){
       if(forward)adj[last].push({to:next,weight,roadId});
       if(reverse)adj[next].push({to:last,weight,roadId});
       edges.push([last,next]);if(!forward||!reverse)onewaySegments++;
      }
    }last=next;
   }
  }
 }
 if(nodes.length<2||!edges.length)throw Error('No routable local road segments; import licensed road lines first');
 return {nodes,edges,adj,sourceFeatures:collection.features.filter(f=>f.properties?.kind==='road').length,excluded,onewaySegments,
  caveat:'Respecting supplied one-way/access/grade tags and optional reviewed turn rules does NOT prove completeness, traffic safety or navigability.'};
}
function atlasNearestGraphVertex(graph,coordinate,maxSnapKm){
 if(!atlasValidCoordinate(coordinate))throw Error('Route endpoint must be valid WGS84 coordinates');
 let nearest=-1,distance=Infinity;
 for(let i=0;i<graph.nodes.length;i++){
  const p=graph.nodes[i];if(Math.abs(p[0]-coordinate[0])>0.3||Math.abs(p[1]-coordinate[1])>0.3)continue;
  const d=atlasHaversineKm(p,coordinate);if(d<distance){nearest=i;distance=d;}
 }
 if(distance>maxSnapKm)throw Error(`Endpoint is ${distance===Infinity?'outside the source coverage':distance.toFixed(2)+' km from mapped road vertices'}; no suitable connection within ${maxSnapKm} km`);
 return {node:nearest,distance};
}
function atlasResearchRoute(graph,start,end,{maxSnapKm=1,turnRestrictions=[]}={}){
 if(!graph?.nodes||!graph?.adj)throw Error('No source-backed road network loaded');
 if(!Number.isFinite(maxSnapKm)||maxSnapKm<=0||maxSnapKm>5)throw Error('Invalid snap distance');
 if(!Array.isArray(turnRestrictions)||turnRestrictions.length>50000)throw Error('Invalid restriction list');
 const forbidden=new Set();
 for(const r of turnRestrictions){
  if(!r||!atlasValidCoordinate(r.at)||!r.fromRoadId||!r.toRoadId)throw Error('Invalid reviewed turn restriction');
  forbidden.add(`${r.at[0]},${r.at[1]}|${r.fromRoadId}|${r.toRoadId}`);
 }
 const first=atlasNearestGraphVertex(graph,start,maxSnapKm),last=atlasNearestGraphVertex(graph,end,maxSnapKm);
 const states=new Map(),heap=[];
 const push=state=>{heap.push(state);let i=heap.length-1;while(i>0){const j=(i-1)>>1;if(heap[j].cost<=state.cost)break;heap[i]=heap[j];i=j;}heap[i]=state};
 const pop=()=>{const first=heap[0],tail=heap.pop();if(heap.length){let i=0;while(true){let j=i*2+1;if(j>=heap.length)break;if(j+1<heap.length&&heap[j+1].cost<heap[j].cost)j++;if(heap[j].cost>=tail.cost)break;heap[i]=heap[j];i=j;}heap[i]=tail;}return first};
 const stateKey=(node,road)=>`${node}|${road}`;
 const origin={node:first.node,road:'',cost:0,parent:null};states.set(stateKey(first.node,''),origin);push(origin);
 let dest=null;
 while(heap.length){const state=pop();if(state!==states.get(stateKey(state.node,state.road)))continue;
  if(state.node===last.node){dest=state;break;}
  for(const edge of graph.adj[state.node]){
   const at=graph.nodes[state.node];
   if(state.road&&forbidden.has(`${at[0]},${at[1]}|${state.road}|${edge.roadId}`))continue;
   const cost=state.cost+edge.weight,key=stateKey(edge.to,edge.roadId);
   if(cost<(states.get(key)?.cost??Infinity)){
    const next={node:edge.to,road:edge.roadId,cost,parent:state};states.set(key,next);push(next);
   }
  }
 }
 if(!dest)throw Error('These locations are disconnected or restricted in the supplied research road network');
 const sequence=[];for(let s=dest;s;s=s.parent){sequence.push(graph.nodes[s.node]);if(sequence.length>states.size+1)throw Error('Route parent cycle detected')}
 sequence.reverse();
 if(sequence.length<2)throw Error('Endpoints collapse to a single mapped vertex; choose distinct locations');
 return {km:dest.cost,snapStartKm:first.distance,snapEndKm:last.distance,sourceFeatures:graph.sourceFeatures,vertexCount:sequence.length,
  restrictionCount:forbidden.size,onewaySegments:graph.onewaySegments,excludedRoadFeatures:graph.excluded,
  geometry:{type:'FeatureCollection',features:[{type:'Feature',properties:{name:'Source-derived research graph path',kind:'research-route',navigationCertified:false},geometry:{type:'LineString',coordinates:sequence}}]},
  warnings:['Routing only covers supplied source segments and explicit access, one-way, grade and turn information','Traffic, road quality, signal rules and unrestricted connectivity have not been independently verified','NOT navigation-grade; verify routes on an authoritative service before travel']};
}

/* src/data-readiness.mjs */
/** Data-readiness inventory based on current client state, never source authority. */

const flag = (id,title,state,reason,next) => ({id,title,state,reason,next});
function atlasReadiness(state={}){
 const physical=Boolean(state.landcover||state.hydrology||state.shorelines);
 const core=Boolean(state.tileCatalog?.tileHashes && state.tileCatalog.tileCount>0);
 const transport=Boolean(state.transportCatalog?.tileHashes && state.transportCatalog.tileCount>0);
 const sourcePlaces=Array.isArray(state.gazetteerPlaces)?state.gazetteerPlaces.length:0;
 const boundaries=Boolean(state.features?.features?.length);
 const items=[
  flag('physical','Physical reference geography',physical?'research_available':'missing',physical?'Locally loaded generalized or historical physical data':'No physical source loaded','Validate data age and source-level accuracy'),
  flag('tiles','Source-checked vector tiling',core?'research_available':'missing',core?`${state.tileCatalog.tileCount} declared historical physical tiles; actual layer presence varies`:'No local tile manifest loaded','Inspect decoded features and per-location coverage'),
  flag('transport','Contemporary transport layer',transport?'research_available':'missing',transport?'Optional research transport pack loaded, not navigation certified':'No permitted road/rail transport pack installed','Acquire and review current licensed data; build regional packs first'),
  flag('places','Search and place catalogue',sourcePlaces?'research_available':'missing',sourcePlaces?`${sourcePlaces} source-labelled selected places; not nationwide addresses`:'No source-labelled place points available','Build bilingual settlement gazetteer with source IDs'),
  flag('boundaries','Political and administrative geometry','blocked',boundaries?'Provisional polygons loaded; NOT certified by Survey of India':'No administrative geometry; official licensing and GIS checks outstanding','Acquire permitted reference geometry and review claims/control separately'),
  flag('renderer','Genuine GPU/device evidence','blocked','Automated simulated browser tests cannot prove WebGL2 or physical devices','Collect unmocked GPU proof and physical Android/iOS evidence'),
  flag('navigation','Navigation-grade routing','blocked','Graph research mode cannot model access, turn restrictions, road conditions or traffic','Build properly sourced topology, restrictions and independent field validation'),
  flag('production','Public production release','blocked','Official geometry, data rights, real-GPU and independent load QA remain release gates','Complete security, accessibility, monitoring and rollback acceptance')
 ];
 return {format:'BharatAtlasReadiness1',version:'0.37',researchOnly:true,
   sourceSummary:{localTileCount:state.tileCatalog?.tileCount||0,transportTileCount:state.transportCatalog?.tileCount||0,sourcePlaceCount:sourcePlaces,provisionalPolygonCount:state.features?.features?.length||0},
   coverageZoom:core?atlasTileZoomInventory(state.tileCatalog):[],
   transportZoom:transport?atlasTileZoomInventory(state.transportCatalog):[],
   items,productionReady:false,
   disclaimer:'Catalogue tile occupancy, license metadata and automated checks do not certify geographic completeness, political boundaries, navigation or GPU behavior.'};
}

/* src/explorer-ui.mjs */
/* Source-labelled Atlas Toolkit: all user data is session-local, except opt-in
 * browser-local bookmarks. No network requests or telemetry are made here. */
function atlasInitToolkit({getApp,notify,save,goToCoordinate,goToRegion,applyStyle}){
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

/* src/compare-ui.mjs */

/* Local-only UI. All user-facing strings are inserted via textContent.
 * The report never invents transportation links or government-endorsed boundaries.
 */
function atlasInitComparison({getApp,save,notify,motionOff}){
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

/* src/main.mjs */























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
const app={map:null,rendererFailure:null,ready:false,features:null,audit:null,source:null,selected:'',selectedCatalogRegion:null,selectedPlace:null,selectedCoordinate:null,hovered:'',style:'terrain',styleEpoch:0,labels:true,places:true,rivers:true,hydrology:null,shores:true,shorelines:null,landcover:null,checks:false,officialClaim:null,soiStates:null,soiStateDetails:null,soiOutlineDetails:null,filter:'all',requestId:0,abort:null,toastTimer:null,tileCatalog:null,transportCatalog:null,gazetteerPlaces:[],gazetteerMeta:null,searchIndex:null,indexMatches:[],indexSearchEpoch:0,boundaryLoadFailed:false,rendererAttempts:0,lastRendererAttemptAt:0,rendererStatus:'not_tested',rendererReason:''};
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
  const fallbackRegions=allCatalogueMatches.filter(x=>!polygonsByName.has(normalizeQuery(x.name)));
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
  $('region-count').textContent=searching?`${entries.length} results`:`${entries.length} listed · ${app.features?.features.length||0} mapped`; 
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
function selectCatalogRegion(record){
  if(!record)return;
  const polygon=app.features?.features.find(f=>normalizeQuery(f.properties.name)===normalizeQuery(record.name));
  if(polygon){selectRegion(polygon.properties.name);return;}
  journeyPause();app.selected='';app.selectedPlace=null;app.selectedCoordinate=null;app.selectedCatalogRegion=record;
  renderRegions();updateFocus();updateNearbyPlaces();
  toast(`${record.name}: name/classification available; no vetted polygon is loaded`);
  toggleMobile(false);
}
function updateFocus(){
  if(app.selectedCatalogRegion){
    const record=app.selectedCatalogRegion;
    $('focus-title').textContent=record.name+' · '+record.hindi;
    $('focus-description').textContent=`${record.kind}. The India government directory lists this administrative unit, but this build contains no independently validated polygon for it. No outline or zoom extent has been inferred. See the official reference map for territorial representation.`;
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

function loadLocalSoIBoundary(file){
  const status=$('soi-import-status'),button=$('soi-import-btn');
  if(!file)return;
  if(!/\.(zip|rar)$/i.test(file.name)){status.textContent='Choose the official .rar or .zip archive';return}
  if(file.size>250*1024*1024){status.textContent='The archive exceeds the 250 MB browser limit';return}
  button.disabled=true;
  status.textContent='Opening official archive on this device; no upload to our servers…';
  const worker=new Worker('./vendor/soi-archive-worker.mjs',{type:'module'});
  const timeout=setTimeout(()=>{worker.terminate();button.disabled=false;status.textContent='Import timed out; try a desktop browser or extract only the State Boundary files as a ZIP.'},230000);
  const done=()=>{clearTimeout(timeout);worker.terminate();button.disabled=false;$('soi-file-input').value=''};
  worker.onmessage=e=>{
    const info=e.data||{};
    if(info.type==='progress'){status.textContent=info.text;return}
    if(info.type==='error'){done();status.textContent='Archive not loaded: '+info.message;return}
    if(info.type!=='success')return;
    const {data,details}=info;
    if(details.type==='outline'){
      app.officialClaim=data;
      app.soiOutlineDetails=details;
      status.textContent='Survey of India February 2026 national outline installed ('+details.vertices.toLocaleString('en-IN')+' points). State/UT borders still require the ABDB RAR.';
    }else{
      app.soiStates=data;
      app.soiStateDetails=details;
      status.textContent='State/UT boundary layer loaded from '+details.features+' local polygons. Dataset format validated; compare against SoI 2026 political map before relying on it.';
    }
    if(app.ready)syncMapData();
    updateStyleButtons();
    if(details.type==='states'){
      setStyle('terrain');
      $('region-coverage-tag').textContent=details.features+' SOI-FORMAT OUTLINES · LOCAL IMPORT · REVIEW NEEDED';
      $('map-source-status').textContent='LOCAL SOI-FORMAT ADMINISTRATIVE SHAPES · SOURCE REVIEW PENDING';
    }else{
      $('map-source-status').textContent='SOI 2026 NATIONAL OUTLINE · 1:16M · STATES NOT INSTALLED';
    }
    if(app.rendererStatus==='fallback'&&app.landcover)rendererFallback('Static research viewer','Official outline imported locally; interactive renderer is unavailable.');
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
      btn.title=app.features?'User-provided regional polygons — not official or verified':'Official political geometry is not bundled. Import licensed GeoJSON to enable regional borders.';
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
    ['regions-border','line-color',style==='outline'?'#335f57':'#718a7f']
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
  $('soi-file-input').addEventListener('change',()=>loadLocalSoIBoundary($('soi-file-input').files?.[0]));$('download-qa').addEventListener('click',downloadQA);$('download-svg').addEventListener('click',downloadSVG);
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

})();
