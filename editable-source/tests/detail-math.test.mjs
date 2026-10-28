import test from 'node:test';
import assert from 'node:assert/strict';
import {atlasGreatCircleKm,atlasBearing,atlasCompass,atlasNearbyPlaces,atlasMercatorScale,atlasScaleFromMetersPerPixel,atlasJourneyTrail,atlasGreatCircleSegment} from '../src/detail-math.mjs';
const delhi={id:'dl',name:'New Delhi',lat:28.6139,lon:77.2090};
const mumbai={id:'mb',name:'Mumbai',lat:19.0760,lon:72.8777};
const boulder={id:'bh',name:'Bhopal',lat:23.2599,lon:77.4126};
test('spherical distance and bearings are symmetric, stable, directionally useful',()=>{
 const km=atlasGreatCircleKm(delhi,mumbai);assert.ok(km>1100&&km<1200);
 assert.ok(Math.abs(atlasGreatCircleKm(mumbai,delhi)-km)<1e-6);
 assert.equal(atlasGreatCircleKm(delhi,delhi),0);
 assert.equal(atlasCompass(atlasBearing(delhi,delhi)),'same location');
 assert.equal(atlasCompass(0),'N');assert.equal(atlasCompass(350),'N');assert.equal(atlasCompass(45),'NE');
 assert.throws(()=>atlasGreatCircleKm(delhi,{lat:NaN,lon:74}));
});
test('nearby search lists only source-backed points, sorted with duplicates removed',()=>{
 const pts=[mumbai,delhi,boulder,{...mumbai},{name:'invalid',lon:200,lat:20}];
 const nearest=atlasNearbyPlaces(delhi,pts,{limit:3});
 assert.equal(nearest.length,2);assert.equal(nearest[0].id,'bh');assert.equal(nearest[1].id,'mb');
 assert.ok(nearest[0].km>0&&nearest[0].km<1000);assert.throws(()=>atlasNearbyPlaces(delhi,pts,{limit:99}));
});
test('scale bar chooses human-friendly steps with a bounded rendered width',()=>{
 const s=atlasMercatorScale(22.6,5);assert.ok(s.pixels>0&&s.pixels<=95);assert.ok(s.metres>0);
 assert.ok(/km|m/.test(s.label));assert.ok(atlasMercatorScale(22.6,9).metres<s.metres);
 assert.deepEqual(atlasScaleFromMetersPerPixel(100,{targetPx:95}),{metres:5000,pixels:50,label:'5 km'});
 assert.throws(()=>atlasMercatorScale(90,4));assert.throws(()=>atlasScaleFromMetersPerPixel(0));
});
test('great circle paths preserve endpoints and never invent road segments',()=>{
 const c=atlasGreatCircleSegment(delhi,mumbai,{steps:20});
 assert.equal(c.length,21);assert.ok(Math.abs(c[0][0]-delhi.lon)<1e-10);assert.ok(Math.abs(c[20][1]-mumbai.lat)<1e-10);
 assert.equal(atlasJourneyTrail([delhi,mumbai,boulder],-1).features.length,0);
 const result=atlasJourneyTrail([delhi,mumbai,boulder],2);
 assert.equal(result.features.length,2);
 assert.equal(result.features[0].properties.kind,'great-circle-research-line');
 assert.match(result.features[1].properties.description,/not a road/);
 assert.throws(()=>atlasGreatCircleSegment(delhi,mumbai,{steps:999}));
});
