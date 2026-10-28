import test from 'node:test';
import assert from 'node:assert/strict';
import {atlasReadiness} from '../src/data-readiness.mjs';

test('readiness remains blocked when all runtime inputs are empty',()=>{
 const r=atlasReadiness({});
 assert.equal(r.productionReady,false);
 assert.equal(r.items.find(x=>x.id==='renderer').state,'blocked');
 assert.equal(r.items.find(x=>x.id==='boundaries').state,'blocked');
 assert.equal(r.sourceSummary.localTileCount,0);
});
test('tiles and a transport sample may be research-available without claiming national coverage',()=>{
 const tiles={minzoom:3,maxzoom:5,tileCount:2,tileHashes:{'3/5/3.pbf':'abc','5/22/12.pbf':'def'},layers:['rivers']};
 const r=atlasReadiness({tileCatalog:tiles,transportCatalog:tiles,gazetteerPlaces:[{name:'A'}],features:{features:[{properties:{name:'test'}}]}});
 assert.equal(r.coverageZoom.length,3);
 assert.equal(r.coverageZoom[1].occupiedTiles,0);
 assert.equal(r.items.find(x=>x.id==='boundaries').state,'blocked');
 assert.equal(r.items.find(x=>x.id==='transport').state,'research_available');
 assert.equal(r.productionReady,false);
});
