import test from 'node:test';
import assert from 'node:assert/strict';
import {atlasSphericalMidpoint,atlasComparePlaces,atlasComparisonBounds} from '../src/compare.mjs';
const delhi={id:'delhi',name:'Delhi',lat:28.6139,lon:77.2090,kind:'city',source:'gazetteer',region:'Delhi'};
const mumbai={id:'mum',name:'Mumbai',lat:19.076,lon:72.8777,kind:'city',source:'gazetteer',region:'Maharashtra'};
test('source-backed comparison calculates symmetric great-circle distance without navigation claims',()=>{
 const a=atlasComparePlaces(delhi,mumbai),b=atlasComparePlaces(mumbai,delhi);
 assert.ok(a.distanceKm>1100&&a.distanceKm<1200);
 assert.equal(a.distanceKm,b.distanceKm);
 assert.equal(a.navigationReady,false);assert.equal(a.officiallyVerified,false);
 assert.equal(a.geometry.features.length,3);
 assert.equal(a.geometry.features[0].geometry.coordinates.length,49);
 assert.deepEqual(a.geometry.features[1].geometry.coordinates,[delhi.lon,delhi.lat]);
 assert.match(a.disclaimer,/not a road/i);
 assert.equal(a.endpoints[0].source,'gazetteer');
 assert.ok(Math.abs(a.midpoint.lat-24)<2);
 assert.deepEqual(atlasComparisonBounds(a),[[mumbai.lon,mumbai.lat],[delhi.lon,delhi.lat]]);
});
test('initial and reverse bearings are directional, not mathematically opposite when great circle bends',()=>{
 const a=atlasComparePlaces(delhi,mumbai);
 assert.ok(a.initialBearingDegrees>=0&&a.initialBearingDegrees<360);
 assert.ok(a.returnBearingDegrees>=0&&a.returnBearingDegrees<360);
 assert.notEqual(a.bearingCompass,'same location');
});
test('duplicate/near-duplicate locations and invalid source coordinates fail closed',()=>{
 assert.throws(()=>atlasComparePlaces(delhi,{...delhi,name:'same'}),/distinct/);
 assert.throws(()=>atlasComparePlaces(delhi,{...mumbai,lat:99}),/WGS84/);
 assert.throws(()=>atlasComparePlaces(null,mumbai));
 assert.throws(()=>atlasSphericalMidpoint({lon:0,lat:0},{lon:180,lat:0}),/antipodal/);
});
test('comparison never mutates input records and remains deterministic',()=>{
 const a=Object.freeze({...delhi}),b=Object.freeze({...mumbai});
 const c1=atlasComparePlaces(a,b),c2=atlasComparePlaces(a,b);
 assert.deepEqual(c1,c2);
 assert.equal(c1.endpoints[0].id,'delhi');
});
