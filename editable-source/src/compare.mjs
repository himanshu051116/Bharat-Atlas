/* Bharat Atlas v0.33 — source-backed city pair comparison.
 * This is spherical geographic context, NOT a road or legally surveyed route.
 */
import {atlasGreatCircleKm,atlasBearing,atlasCompass,atlasGreatCircleSegment,atlasValidLonLat} from './detail-math.mjs';
const ATLAS_COMPARISON_RADIUS=6371.0088;
export function atlasSphericalMidpoint(a,b){
 if(!a||!b||!atlasValidLonLat(a.lon,a.lat)||!atlasValidLonLat(b.lon,b.lat))throw Error('Invalid midpoint endpoints');
 const x1=Math.cos(a.lat*Math.PI/180)*Math.cos(a.lon*Math.PI/180),y1=Math.cos(a.lat*Math.PI/180)*Math.sin(a.lon*Math.PI/180),z1=Math.sin(a.lat*Math.PI/180);
 const x2=Math.cos(b.lat*Math.PI/180)*Math.cos(b.lon*Math.PI/180),y2=Math.cos(b.lat*Math.PI/180)*Math.sin(b.lon*Math.PI/180),z2=Math.sin(b.lat*Math.PI/180);
 const x=x1+x2,y=y1+y2,z=z1+z2,n=Math.hypot(x,y,z);
 if(n<1e-9)throw Error('Midpoint undefined for antipodal points');
 return {lon:Math.atan2(y,x)*180/Math.PI,lat:Math.atan2(z,Math.hypot(x,y))*180/Math.PI};
}
export function atlasComparePlaces(a,b){
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
export function atlasComparisonBounds(report){
 if(!report?.endpoints||report.endpoints.length!==2)throw Error('Comparison endpoints missing');
 const [a,b]=report.endpoints;
 return [[Math.min(a.lon,b.lon),Math.min(a.lat,b.lat)],[Math.max(a.lon,b.lon),Math.max(a.lat,b.lat)]];
}
