const test=require('node:test'),assert=require('node:assert/strict');
const g=require('../world-detail-geometry.js');
const features=Array.from({length:13000},(_,i)=>{
 const lon=-178+(i%72)*5,lat=-88+(Math.floor(i/72)%35)*5;
 return {_bounds:[lon,lat,lon+1,lat+1],properties:{countryIso3:i%2?'USA':'CAN'}};
});
features.push({_bounds:[-179,-45,179,80],properties:{countryIso3:'RUS'}});
test('bounding box index returns exact source subset for many regional viewports',()=>{
 const index=g.buildBoundsIndex(features);
 for(const view of [{x:0,y:0,w:1440,h:720},{x:730,y:250,w:100,h:50},{x:20,y:180,w:400,h:200},{x:1200,y:300,w:130,h:65}]){
  const expected=features.filter(f=>g.boundsInView(f._bounds,view)).slice(0,15000);
  const actual=g.queryBoundsIndex(index,view,15000);
  assert.deepEqual(actual,expected);
 }
});
test('indexed regional filtering occurs before item limit, no unrelated province starvation',()=>{
 const view={x:500,y:150,w:350,h:175},index=g.buildBoundsIndex(features);
 const expected=features.filter(f=>f.properties.countryIso3==='CAN'&&g.boundsInView(f._bounds,view)).slice(0,25);
 const actual=g.queryBoundsIndex(index,view,25,f=>f.properties.countryIso3==='CAN');
 assert.deepEqual(actual,expected);
});
test('date-line envelopes are conservatively indexed',()=>{
 const crossing=[{_bounds:[175,-20,-175,25]}];
 const index=g.buildBoundsIndex(crossing);
 assert.deepEqual(g.queryBoundsIndex(index,{x:0,y:0,w:40,h:20},5),crossing);
});
