import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCollection,validateUserImport} from '../src/geography.mjs';
const rectangle=(x,y,w=2,h=2)=>[[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]];
function feature(name,coordinates){return {type:'Feature',properties:{name},geometry:{type:'Polygon',coordinates}}}
function collection(...features){return {type:'FeatureCollection',features}}
test('strict browser import rejects identical overlapping named regions that lightweight preview allowed',()=>{
  const data=collection(feature('Goa',rectangle(72,15)),feature('Telangana',rectangle(72,15)));
  assert.equal(validateCollection(data).features.length,2);
  assert.throws(()=>validateUserImport(data),/Overlapping regions: Goa and Telangana/);
});
test('strict browser import rejects partial overlap with collinear boundaries',()=>{
  assert.throws(()=>validateUserImport(collection(feature('Goa',rectangle(72,15)),feature('Telangana',rectangle(73,15)))),/Overlapping regions/);
});
test('strict browser import accepts legitimate adjacent shared boundaries',()=>{
  const out=validateUserImport(collection(feature('Goa',rectangle(72,15)),feature('Telangana',rectangle(74,15))));
  assert.equal(out.features.length,2);
});
test('strict browser import accepts disjoint complex-region bounding boxes',()=>{
  const out=validateUserImport(collection(feature('Goa',rectangle(72,15)),feature('Telangana',rectangle(76,15))));
  assert.equal(out.features.length,2);
});
test('strict browser import rejects nested polygon overlap',()=>{
  assert.throws(()=>validateUserImport(collection(feature('Goa',rectangle(72,15,4,4)),feature('Telangana',rectangle(73,16)))),/Overlapping regions/);
});
test('strict browser import rejects oversized ring with intersection beyond legacy 512-segment cutoff',()=>{
  const pts=[];const steps=170;
  for(let i=0;i<steps;i++)pts.push([70+4*i/steps,15]);
  for(let i=0;i<steps;i++)pts.push([74,15+4*i/steps]);
  for(let i=0;i<steps;i++)pts.push([74-4*i/steps,19]);
  for(let i=0;i<steps;i++)pts.push([70,19-4*i/steps]);
  pts.push(pts[0]);
  // Swapping non-adjacent points creates crossing non-neighbor edges.
  [pts[230],pts[500]]=[pts[500],pts[230]];
  const data=collection(feature('Goa',[pts]));
  assert.ok(pts.length>512);
  assert.equal(validateCollection(data).features.length,1);
  assert.throws(()=>validateUserImport(data),/self-intersecting/);
});
test('strict browser import allows 680+ segment valid ring and retains proper geometry',()=>{
  const pts=[];for(let i=0;i<700;i++){const t=i*2*Math.PI/700;pts.push([75+Math.cos(t),18+Math.sin(t)])}pts.push(pts[0]);
  assert.equal(validateUserImport(collection(feature('Goa',[pts]))).features.length,1);
});
test('strict upload rejects highly detailed map that requires offline GIS workflow',()=>{
  const pts=[];for(let i=0;i<36000;i++){const t=i*2*Math.PI/36000;pts.push([75+Math.cos(t),18+Math.sin(t)])}pts.push(pts[0]);
  assert.throws(()=>validateUserImport(collection(feature('Goa',[pts]))),/offline GIS validation/);
});
test('strict browser import rejects duplicate overlapping islands within one multipolygon feature',()=>{
 const data={type:'FeatureCollection',features:[{type:'Feature',properties:{name:'Ladakh'},geometry:{type:'MultiPolygon',coordinates:[rectangle(72,20),rectangle(72,20)]}}]};
 assert.throws(()=>validateUserImport(data),/overlapping multipart polygons/);
});
test('strict browser import accepts separate islands within one multipolygon feature',()=>{
 const data={type:'FeatureCollection',features:[{type:'Feature',properties:{name:'Lakshadweep'},geometry:{type:'MultiPolygon',coordinates:[rectangle(72,14),rectangle(77,16)]}}]};
 assert.equal(validateUserImport(data).features.length,1);
});
