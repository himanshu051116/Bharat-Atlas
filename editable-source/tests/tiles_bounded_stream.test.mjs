import test from 'node:test';
import assert from 'node:assert/strict';
import {readBoundedTileManifest,sparseTileHandler} from '../src/tiles.mjs';
function body(chunks){
  let cancelled=false;
  return {getReader(){let pos=0;return {
    async read(){return pos<chunks.length?{done:false,value:chunks[pos++]}:{done:true}},
    async cancel(){cancelled=true},releaseLock(){}
  }},get cancelled(){return cancelled}};
}
test('manifest streaming accepts UTF-8 split over chunks',async()=>{
  const raw=new TextEncoder().encode('caf\u00e9'),b=body([raw.slice(0,4),raw.slice(4)]);
  assert.equal(await readBoundedTileManifest({headers:{get(){return null}},body:b},30),'caf\u00e9');
});
test('manifest streaming stops oversized payload before buffering entire response',async()=>{
  const b=body([new Uint8Array(6),new Uint8Array(5)]);
  await assert.rejects(readBoundedTileManifest({headers:{get(){return null}},body:b},10),/exceeds size/);
  assert.equal(b.cancelled,true);
});
test('tile payload refuses oversized streamed bytes before digest or caching',async()=>{
 const payload=body([new Uint8Array(2*1024*1024),new Uint8Array(2*1024*1024)]);
 const catalog={tileHashes:{'0/0/0.pbf':'a'.repeat(64)}};
 const handler=sparseTileHandler(catalog,{fetcher:async()=>({ok:true,headers:{get:()=>null},body:payload}),hasher:async()=> 'a'.repeat(64)});
 await assert.rejects(handler({url:'atlas-detail://0/0/0.pbf'}),/exceeds size/);
 assert.equal(payload.cancelled,true);
});
