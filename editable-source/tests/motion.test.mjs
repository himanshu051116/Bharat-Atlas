import test from 'node:test';
import assert from 'node:assert/strict';
import {atlasTransportStyle} from '../src/transport-pack.mjs';
import {atlasMotionDuration,atlasJourneyStops,atlasFallbackTarget,atlasZoomNarrative,atlasReducedMotion} from '../src/motion.mjs';
test('camera time adapts to geographic travel and reduced-motion',()=>{
  const small=atlasMotionDuration([78,22],[78.1,22.1]);
  const large=atlasMotionDuration([78,22],[90,34]);
  assert.ok(small<large);
  assert.equal(atlasMotionDuration([78,22],[90,34],{reduced:true}),0);
  assert.ok(atlasMotionDuration([78,22],[90,34],{speed:2})<large);
  assert.equal(atlasReducedMotion({matches:true}),true);
});
test('journey uses only valid source entries, spreads stops and is deterministic',()=>{
  const pts=[{name:'South',lon:75,lat:8},{name:'West',lon:69,lat:24},{name:'East',lon:94,lat:26},{name:'North',lon:77,lat:36},{name:'Center',lon:78,lat:21},{name:'South',lon:75,lat:8},{name:'Invalid',lon:NaN,lat:20}];
  const a=atlasJourneyStops(pts,4),b=atlasJourneyStops(pts,4);
  assert.deepEqual(a,b);assert.equal(a.length,4);assert.equal(a[0].name,'South');
  assert.ok(!a.some(p=>p.name==='Invalid'));
  assert.throws(()=>atlasJourneyStops(pts,100));
});
test('fallback anchored zoom and reset preserve the inspected area',()=>{
 const p=atlasFallbackTarget({currentZoom:2,newZoom:4,pan:{x:12,y:0},anchor:{x:40,y:-20}});
 assert.equal(p.zoom,4);assert.equal(p.pan.x,-16);assert.equal(p.pan.y,20);
 assert.deepEqual(atlasFallbackTarget({currentZoom:3,newZoom:1,pan:{x:10,y:20}}).pan,{x:0,y:0});
});
test('zoom narratives never claim unprovided national detail',()=>{
 assert.match(atlasZoomNarrative(12,{hasTransport:false}).description,/not bundled/);
 assert.match(atlasZoomNarrative(12,{hasTransport:true}).description,/where supplied/);
 assert.match(atlasZoomNarrative(3).description,/not certified/);
});

test('source-backed transport labels appear only when corresponding tiles exist',()=>{
 const absent=atlasTransportStyle(null);assert.equal(absent.layers.length,0);
 const source={layers:['roads','rivers','settlements'],minzoom:3,maxzoom:10,bounds:[60,3,102,41],attribution:'test'};
 const layers=atlasTransportStyle(source).layers;
 assert.ok(layers.some(x=>x.id==='research-road-labels'&&x.minzoom>=9&&x.filter[1]==='name'));
 assert.ok(layers.some(x=>x.id==='research-waterway-labels'&&x.minzoom>=8));
 assert.ok(!layers.some(x=>x.id==='research-railways'));
});
