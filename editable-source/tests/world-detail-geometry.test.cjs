'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const g = require('../world-detail-geometry.js');
const view = { x: 400, y: 170, w: 400, h: 200 };
test('point visibility uses actual viewport height, not width/2 assumption', () => {
  const narrow = {x: 400,y:170,w:600,h:180};
  assert.equal(g.pointInView([0,-85], narrow), false);
  assert.equal(g.pointInView([0,10], narrow), true);
  assert.equal(g.pointInView([NaN,0], view), false);
});
test('bounding-box culling checks both viewport dimensions', () => {
  assert.equal(g.boundsInView([0,0,2,1], view), true);
  assert.equal(g.boundsInView([-170,-60,-160,-55], view), false);
  assert.equal(g.boundsInView([160,-4,-160,4], view), true);
  assert.equal(g.boundsInView([0,70,4,72], view,0), false);
  assert.equal(g.boundsInView([0,0,3,3], view,0), true);
});
test('pixel placement uses actual view aspect, not fixed 840x420',()=>{
 const pt=g.viewportPixel([0,0],{x:0,y:0,w:1440,h:720},1200,700);
 assert.deepEqual(pt,{x:600,y:350});
 assert.equal(g.viewportPixel([180,0],view,200,200), null);
});
test('visible collection is bounded and caches source paths',()=>{
 let calls=0;
 const f=[{_bounds:[-170,-50,-160,-40],geometry:{}},{_bounds:[0,0,1,1],geometry:{}}];
 const path=()=>{calls++;return 'M0 0'};
 assert.deepEqual(g.visibleFeaturePaths(f,view,1,path),['M0 0']);
 assert.deepEqual(g.visibleFeaturePaths(f,view,1,path),['M0 0']);
 assert.equal(calls,1);
});

test('spatial point index returns in-view entries, including longitude 180 and latitude boundaries',()=>{
 const city=(lon,lat,name,rank=2)=>({geometry:{type:'Point',coordinates:[lon,lat]},properties:{name,rank}});
 const features=[city(12,8,'Near',1),city(-120,40,'Far'),city(13,9,'Second',3),city(180,90,'Corner')];
 const idx=g.buildPointIndex(features);
 assert.equal(g.queryPointIndex(idx,view,2).map(f=>f.properties.name).join(','),'Near,Second');
 const global=g.queryPointIndex(idx,{x:0,y:0,w:1440,h:720},20);
 assert.equal(global.length,4);
 assert.ok(global.some(f=>f.properties.name==='Corner'));
});
test('point index ignores invalid geographic positions',()=>{
 const idx=g.buildPointIndex([{geometry:{type:'Point',coordinates:[NaN,1]}},{geometry:{type:'Polygon',coordinates:[]}}]);
 assert.deepEqual(g.queryPointIndex(idx,{x:0,y:0,w:1440,h:720}),[]);
});
