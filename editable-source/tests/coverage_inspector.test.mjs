import test from 'node:test';
import assert from 'node:assert/strict';
import {atlasXYZ,atlasInspectResearchTile,atlasTileZoomInventory} from '../src/coverage-inspector.mjs';
const manifest={minzoom:3,maxzoom:8,layers:['rivers','settlements'],tileHashes:{'3/5/3.pbf':'a'.repeat(64),'8/183/104.pbf':'b'.repeat(64)}};
test('canonical XYZ WGS84 locations and finite numeric guards',()=>{
  assert.deepEqual(atlasXYZ(0,0,0),{z:0,x:0,y:0,path:'0/0/0.pbf'});
  assert.deepEqual(atlasXYZ(180,0,2),{z:2,x:3,y:2,path:'2/3/2.pbf'});
  assert.equal(atlasXYZ(-180,90,5).x,0);
  assert.equal(atlasXYZ(180,-90,5).y,31);
  for(const v of [[Infinity,0,5],[0,NaN,5],[181,0,5],[0,91,5],[0,0,13],[0,0,2.5]])
    assert.throws(()=>atlasXYZ(...v),RangeError);
});
test('inspect catalogued cell without guessing feature coverage',()=>{
  const point=atlasXYZ(79.5,22.6,3);
  const current={...manifest,tileHashes:{[point.path]:'c'.repeat(64)}};
  const present=atlasInspectResearchTile(current,79.5,22.6,3.8);
  assert.equal(present.available,true); assert.equal(present.path,point.path);
  assert.match(present.disclaimer,/does not prove individual layers/);
  const absent=atlasInspectResearchTile(current,79.5,22.6,8.7);
  assert.equal(absent.available,false);assert.equal(absent.overscaled,true);assert.equal(absent.zoom,8);
  assert.equal(atlasInspectResearchTile(null,79.5,22.6,3).status,'catalogue_unavailable');
  assert.throws(()=>atlasInspectResearchTile(current,79.5,22.6,NaN),RangeError);
});
test('zoom inventory counts only declared hashed tiles',()=>{
  const hist=atlasTileZoomInventory(manifest);
  assert.deepEqual(hist.map(x=>x.occupiedTiles),[1,0,0,0,0,1]);
});

test('decoded per-tile counts distinguish local layers from global layer list',()=>{
 const path=atlasXYZ(79.5,22.6,3).path;
 const catalog={...manifest,tileHashes:{[path]:'c'.repeat(64)},tileLayerCounts:{[path]:{'rivers':3}}};
 const result=atlasInspectResearchTile(catalog,79.5,22.6,3);
 assert.deepEqual(result.layers,['rivers']);
 assert.deepEqual(result.featureCounts,{rivers:3});
 assert.equal(result.featureCountEvidence,'decoded_mvt');
 assert.match(result.disclaimer,/coordinate-level intersection/);
 assert.equal(atlasInspectResearchTile(manifest,79.5,22.6,3).featureCounts,null);
});

test('zoom inventory aggregates decoded layer occurrences without inventing unsourced layers',()=>{
 const cat={...manifest,tileLayerCounts:{'3/5/3.pbf':{rivers:4},'8/183/104.pbf':{settlements:2,rivers:1}}};
 const rows=atlasTileZoomInventory(cat);
 assert.deepEqual(rows[0].decodedLayerOccurrences,{rivers:4});
 assert.deepEqual(rows[5].decodedLayerOccurrences,{settlements:2,rivers:1});
 assert.deepEqual(rows[2].decodedLayerOccurrences,{});
 assert.equal(atlasTileZoomInventory(manifest)[0].decodedLayerOccurrences,null);
});
