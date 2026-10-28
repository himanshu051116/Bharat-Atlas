import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTileManifest,localDetailLayers,tileSourceSpec,loadTileManifest,sparseTileHandler,tileRequestPath,registerSparseTileProtocol} from '../src/tiles.mjs';
const hash='a'.repeat(64);
const good={format:'BharatAtlasMVT1',officiallyVerified:false,licence:'Synthetic test',attribution:'Synthetic data',sourceUrl:'https://example.org/synthetic',minzoom:4,maxzoom:8,layers:['roads','rivers','settlements'],bounds:[60,3,102,41],tileCount:1,tileHashes:{'4/11/7.pbf':hash}};
test('tile catalogue validates source, limits and clean paths',()=>{
 const c=validateTileManifest(good);assert.equal(c.officiallyVerified,false);assert.equal(c.tileCount,1);
 assert.throws(()=>validateTileManifest({...good,officiallyVerified:true}),/Invalid provisional/);
 assert.throws(()=>validateTileManifest({...good,sourceUrl:'javascript:alert(1)'}),/provenance/);
 assert.throws(()=>validateTileManifest({...good,layers:['roads','admin']}),/layers/);
 assert.throws(()=>validateTileManifest({...good,bounds:[75,25,70,28]}),/extent/);
 assert.throws(()=>validateTileManifest({...good,tileHashes:{'../../other.pbf':hash}}),/file manifest/);
 assert.throws(()=>validateTileManifest({...good,tileHashes:{'4/16/0.pbf':hash}}),/out of bounds/);
});
test('no catalog on 404; no fake demo tiles introduced', async()=>{
 assert.equal(await loadTileManifest({fetcher:async()=>({ok:false,status:404})}),null);
 assert.equal((await loadTileManifest({fetcher:async()=>({ok:true,status:200,text:async()=>JSON.stringify(good)})})).tileCount,1);
});
test('MapLibre source and detail layers reference only explicit tile data',()=>{
 const c=validateTileManifest(good),source=tileSourceSpec(c);
 assert.equal(source.type,'vector');assert.match(source.tiles[0],/^atlas-detail:\/\/\{z\}\/\{x\}\/\{y\}\.pbf$/);
 const layers=localDetailLayers(c);assert.equal(layers.length,5);
 assert.ok(layers.every(l=>l.source==='local-detail'));
 assert.ok(layers.some(l=>l['source-layer']==='rivers'));
 assert.deepEqual(localDetailLayers(null),[]);
});

test('sparse tile protocol returns an empty MVT buffer for absent tiles without network access',async()=>{
  let calls=0;
  const fn=sparseTileHandler(good,{fetcher:async()=>{calls++;throw new Error('Unexpected network request')}});
  const result=await fn({url:'atlas-detail://4/12/7.pbf'},new AbortController());
  assert.equal(result.data.byteLength,0);assert.equal(calls,0);
  assert.throws(()=>tileRequestPath('atlas-detail://../../secret'),/Unexpected/);
  assert.throws(()=>tileRequestPath('atlas-detail://4/16/1.pbf'),/out of range/);
});
test('available tiles are fetched and digest-verified before the MapLibre renderer sees them',async()=>{
  const buffer=new Uint8Array([26,0]).buffer;
  const fn=sparseTileHandler(good,{fetcher:async u=>({ok:true,arrayBuffer:async()=>buffer}),hasher:async b=>hash});
  assert.deepEqual(new Uint8Array((await fn({url:'atlas-detail://4/11/7.pbf'},new AbortController())).data),new Uint8Array(buffer));
  const bad=sparseTileHandler(good,{fetcher:async()=>({ok:true,arrayBuffer:async()=>buffer}),hasher:async()=> '0'.repeat(64)});
  await assert.rejects(()=>bad({url:'atlas-detail://4/11/7.pbf'},new AbortController()),/SHA-256/);
  let registered;
  registerSparseTileProtocol({addProtocol:(scheme,f)=>registered={scheme,f}},good,{hasher:async()=>hash});
  assert.equal(registered.scheme,'atlas-detail');
});

test('feature inventory cannot claim layers absent from the tile',()=>{
 const good={format:'BharatAtlasMVT1',officiallyVerified:false,licence:'Test',attribution:'Test',sourceUrl:'https://example.org/data',minzoom:3,maxzoom:3,layers:['rivers','settlements'],tileCount:1,bounds:[60,3,102,41],tileHashes:{'3/5/3.pbf':'a'.repeat(64)},tileLayerCounts:{'3/5/3.pbf':{rivers:2}}};
 const checked=validateTileManifest(good);
 assert.equal(checked.tileLayerCounts['3/5/3.pbf'].rivers,2);
 assert.throws(()=>validateTileManifest({...good,tileLayerCounts:{'3/5/3.pbf':{railways:4}}}),/feature count/);
 assert.throws(()=>validateTileManifest({...good,tileLayerCounts:{'3/6/3.pbf':{rivers:4}}}),/Undeclared/);
 assert.throws(()=>validateTileManifest({...good,tileLayerCounts:{'3/5/3.pbf':{rivers:-1}}}),/feature count/);
});
