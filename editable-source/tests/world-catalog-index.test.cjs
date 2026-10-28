const test = require('node:test');
const assert = require('node:assert/strict');
const {createCatalog,find} = require('../world-explore-search.js');
const {performance} = require('node:perf_hooks');
const countries=[{id:1,iso3:'IND',name:'India',hi:'भारत',lat:21,lon:78},{id:2,iso3:'CAN',name:'Canada',hi:'कनाडा',lat:57,lon:-104}];
const cap=c=>c.iso3==='CAN'?{name:'Ottawa',lat:45.42,lon:-75.7}:null;
const cities=Array.from({length:18000},(_,i)=>({type:'Feature',properties:{name:`Village ${i} Region`,countryIso3:i%2?'CAN':'USA'},geometry:{type:'Point',coordinates:[i%180,15]}}));
cities.push({type:'Feature',properties:{name:'São Paulo',nameHi:'साओ पाउलो',countryIso3:'BRA'},geometry:{type:'Point',coordinates:[-46.63,-23.55]}});
cities.push({type:'Feature',properties:{name:'San José',countryIso3:'CRI'},geometry:{type:'Point',coordinates:[-84.1,9.9]}});
const layers=new Map([['cities',{features:cities}]]);
test('offline catalog indexes large place lists, preserving rankings and bilingual matches',()=>{
 const before=performance.now(),catalog=createCatalog(countries,cap,layers),buildMs=performance.now()-before;
 assert.equal(catalog.count,18005);
 assert.equal(catalog.search('भारत')[0].name,'India');
 assert.equal(catalog.search('ottawa')[0].type,'capital');
 assert.equal(catalog.search('sao paulo')[0].name,'São Paulo');
 assert.equal(catalog.search('पाउलो')[0].name,'São Paulo');
 assert.equal(catalog.search('JOSE')[0].name,'San José');
 assert.equal(catalog.search('Village 17999')[0].name,'Village 17999 Region');
 assert.equal(catalog.search('Village',5).length,5);
 assert.deepEqual(catalog.search('z'.repeat(200)),[]);
 assert(buildMs<8000,`Unexpectedly slow index: ${buildMs.toFixed(0)}ms`);
});
test('catalog results match existing search behavior on partial and exact queries',()=>{
 const subset=new Map([['cities',{features:cities.slice(0,60).concat(cities.slice(-2))}]]);
 const catalog=createCatalog(countries,cap,subset);
 for(const q of ['India','ट','Village 1','Region','Ottawa','sao','San José','00055']){
  assert.deepEqual(catalog.search(q),find(countries,cap,subset,q));
 }
});
