/* Bharat Atlas v0.8 · pure geographic-data validation utilities.
 * Never equate schema/spot-check success with official boundary verification.
 */
export const STATES = Object.freeze(['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal']);
export const UTS = Object.freeze(['Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry']);
export const REGIONS = Object.freeze([...STATES, ...UTS]);
const set = new Set(REGIONS);
const aliases = {'Orissa':'Odisha','Uttaranchal':'Uttarakhand','Andaman and Nicobar':'Andaman and Nicobar Islands','Pondicherry':'Puducherry','NCT of Delhi':'Delhi','Jammu & Kashmir':'Jammu and Kashmir'};
export const CHECKPOINTS = Object.freeze([
  {title:'Gilgit sample',lon:74.3,lat:35.92,expected:'Ladakh'},
  {title:'Muzaffarabad sample',lon:73.47,lat:34.37,expected:'Jammu and Kashmir'},
  {title:'Aksai Chin sample',lon:79.1,lat:35.0,expected:'Ladakh'},
  {title:'Shaksgam sample',lon:76.41987,lat:36.11126,expected:'Ladakh'}
]);
export const canonical = n => aliases[String(n??'').trim()] ?? String(n??'').trim();
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
export function validateCollection(raw,{requireComplete=false}={}){
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
export function containsRing(lon,lat,ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];if((a[1]>lat)!==(b[1]>lat)&&lon<(b[0]-a[0])*(lat-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
export function contains(feature,lon,lat){
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
export function validateUserImport(raw){
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

export function inspectCollection(fc){
  const names=new Set(fc.features.map(f=>f.properties.name));
  const points=CHECKPOINTS.map(p=>{
    const actual=fc.features.filter(f=>contains(f,p.lon,p.lat)).map(f=>f.properties.name);
    return {...p,actual,pass:actual.length===1&&actual[0]===p.expected};
  });
  return {count:fc.features.length,states:STATES.filter(x=>names.has(x)).length,uts:UTS.filter(x=>names.has(x)).length,
    missing:REGIONS.filter(x=>!names.has(x)),points,passesAllSamples:points.every(x=>x.pass),officiallyVerified:false};
}
function eachPoint(c,visit){if(typeof c?.[0]==='number'){visit(c);return;}for(const p of c??[])eachPoint(p,visit)}
export function featureBounds(feature){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  eachPoint(feature.geometry.coordinates,p=>{minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1])});
  return [[minX,minY],[maxX,maxY]];
}
export function allBounds(fc){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const f of fc.features){const [[x1,y1],[x2,y2]]=featureBounds(f);minX=Math.min(minX,x1);minY=Math.min(minY,y1);maxX=Math.max(maxX,x2);maxY=Math.max(maxY,y2)}
  return [[minX,minY],[maxX,maxY]];
}
function ringCentroid(ring){let x=0,y=0,A=0;for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i],c=a[0]*b[1]-b[0]*a[1];A+=c;x+=(a[0]+b[0])*c;y+=(a[1]+b[1])*c;}return Math.abs(A)>1e-12?[x/(3*A),y/(3*A)]:ring[0]}
export function labelPoint(f){
  const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
  let p=polys[0],max=-Infinity;
  for(const candidate of polys){const a=Math.abs(area2(candidate[0]));if(a>max){p=candidate;max=a}}
  const centroid=ringCentroid(p[0]);if(contains(f,...centroid))return centroid;
  const ring=p[0];const [[minX,minY],[maxX,maxY]]=featureBounds(f),guess=[(minX+maxX)/2,(minY+maxY)/2];
  if(contains(f,...guess))return guess;
  for(let i=0;i<ring.length-1;i++){const mid=[(ring[i][0]+centroid[0])/2,(ring[i][1]+centroid[1])/2];if(contains(f,...mid))return mid;}
  return ring[0];
}
export function labelCollection(fc){return {type:'FeatureCollection',features:fc.features.map(f=>({type:'Feature',properties:{name:f.properties.name,kind:f.properties.kind},geometry:{type:'Point',coordinates:labelPoint(f)}}))};}
export function graticule(){const fs=[];for(let lon=65;lon<=100;lon+=5)fs.push({type:'Feature',geometry:{type:'LineString',coordinates:[[lon,3],[lon,41]]},properties:{}});for(let lat=5;lat<=40;lat+=5)fs.push({type:'Feature',geometry:{type:'LineString',coordinates:[[60,lat],[102,lat]]},properties:{}});return {type:'FeatureCollection',features:fs};}
