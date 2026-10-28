import test from 'node:test';
import assert from 'node:assert/strict';
import {atlasRoadGraph,atlasResearchRoute} from '../src/router.mjs';
const make=(id,pts,extra={})=>({type:'Feature',properties:{kind:'road',id,...extra},geometry:{type:'LineString',coordinates:pts}});
const fc=(...features)=>({type:'FeatureCollection',features});
const A=[77.4,23.2],B=[77.401,23.2],C=[77.402,23.2],D=[77.401,23.201];
test('one-way road permits forward but not backward',()=>{
 const graph=atlasRoadGraph(fc(make('w1',[A,B,C],{oneway:'yes'})));
 assert.ok(atlasResearchRoute(graph,A,C).km>0);
 assert.throws(()=>atlasResearchRoute(graph,C,A),/disconnected/);
});
test('motor vehicle no and footways are excluded',()=>{
 const graph=atlasRoadGraph(fc(make('bad',[A,B],{motor_vehicle:'no'}),make('walk',[B,C],{highway:'footway'}),make('valid',[A,D])));
 assert.equal(graph.excluded,2);assert.throws(()=>atlasResearchRoute(graph,A,C,{maxSnapKm:0.01}),/outside|disconnected|no suitable connection/);
});
test('grade-separated roads at same map coordinates do not connect',()=>{
 const graph=atlasRoadGraph(fc(make('upper',[A,B],{layer:'1',bridge:'yes'}),make('lower',[B,C],{layer:'0'})));
 assert.throws(()=>atlasResearchRoute(graph,A,C),/disconnected/);
});
test('explicit reviewed turn restrictions block forbidden road transition',()=>{
 const graph=atlasRoadGraph(fc(make('west',[A,B]),make('east',[B,C])));
 assert.ok(atlasResearchRoute(graph,A,C).km>0);
 assert.throws(()=>atlasResearchRoute(graph,A,C,{turnRestrictions:[{at:B,fromRoadId:'west',toRoadId:'east'}]}),/restricted/);
});
