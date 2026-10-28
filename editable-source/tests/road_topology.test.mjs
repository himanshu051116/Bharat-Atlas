import test from 'node:test';
import assert from 'node:assert/strict';
import {atlasRoadGraph,atlasResearchRoute} from '../src/router.mjs';
const road=points=>({type:'Feature',properties:{kind:'road'},geometry:{type:'LineString',coordinates:points}});
const fc=features=>({type:'FeatureCollection',features});
test('almost-coincident roads are not merged into false junctions',()=>{
 const a=road([[77.4,23.2],[77.401,23.2]]);
 const b=road([[77.40100001,23.2],[77.402,23.2]]);
 const g=atlasRoadGraph(fc([a,b]));
 assert.equal(g.nodes.length,4);
 assert.throws(()=>atlasResearchRoute(g,[77.4,23.2],[77.402,23.2]),/disconnected/);
});
test('exact shared source vertices still create valid research-only paths',()=>{
 const g=atlasRoadGraph(fc([road([[77.4,23.2],[77.401,23.2]]),road([[77.401,23.2],[77.402,23.2]])]));
 assert.equal(g.nodes.length,3);
 const r=atlasResearchRoute(g,[77.4,23.2],[77.402,23.2]);
 assert.ok(r.km>0);assert.equal(r.vertexCount,3);
 assert.equal(r.geometry.features[0].properties.navigationCertified,false);
});
