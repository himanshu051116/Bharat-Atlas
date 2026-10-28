import test from 'node:test';
import assert from 'node:assert/strict';
import {sparseTileHandler,createTileCache} from '../src/tiles.mjs';
const path='4/11/7.pbf', q={url:'atlas-detail://4/11/7.pbf'};
const sha='d'.repeat(64), raw=new Uint8Array([26,0]).buffer;
function deferred(){let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j});return {promise,resolve,reject}}

test('simultaneous vector-tile readers share one verified request and get independent buffers',async()=>{
 const gate=deferred();let calls=0;
 const handler=sparseTileHandler({tileHashes:{[path]:sha}},{hasher:async()=>sha,fetcher:async()=>{calls++;await gate.promise;return {ok:true,arrayBuffer:async()=>raw}}});
 const a=handler(q,new AbortController()),b=handler(q,new AbortController());
 gate.resolve();const [av,bv]=await Promise.all([a,b]);
 assert.equal(calls,1);new Uint8Array(av.data)[0]=99;assert.equal(new Uint8Array(bv.data)[0],26);
 await handler(q,new AbortController());assert.equal(calls,1);
});
test('aborting one tile consumer does not kill the fetch needed by another',async()=>{
 const gate=deferred();let signal;
 const handler=sparseTileHandler({tileHashes:{[path]:sha}},{hasher:async()=>sha,fetcher:async(_url,options)=>{signal=options.signal;await gate.promise;return {ok:true,arrayBuffer:async()=>raw}}});
 const a=new AbortController(),b=new AbortController();
 const first=handler(q,a),second=handler(q,b);a.abort();
 await assert.rejects(first,{name:'AbortError'});assert.equal(signal.aborted,false);
 gate.resolve();const r=await second;assert.equal(r.data.byteLength,2);
});
test('aborting all readers aborts physical fetch and permits clean retry',async()=>{
 let calls=0,wasAborted=false;
 const handler=sparseTileHandler({tileHashes:{[path]:sha}},{hasher:async()=>sha,
   fetcher:async(_url,options)=>{calls++;
      if(calls===1)return await new Promise((_,reject)=>options.signal.addEventListener('abort',()=>{wasAborted=true;reject(new DOMException('aborted','AbortError'))},{once:true}));
      return {ok:true,arrayBuffer:async()=>raw};}});
 const ac=new AbortController();const first=handler(q,ac);ac.abort();await assert.rejects(first,{name:'AbortError'});
 assert.equal(wasAborted,true);
 const second=await handler(q,new AbortController());assert.equal(second.data.byteLength,2);assert.equal(calls,2);
});
test('tile handler refuses data with oversized Content-Length before buffering',async()=>{
 let read=false;const handler=sparseTileHandler({tileHashes:{[path]:sha}},{hasher:async()=>sha,
  fetcher:async()=>({ok:true,headers:{get:()=>String(4*1024*1024)},arrayBuffer:async()=>{read=true;return raw}})});
 await assert.rejects(handler(q,new AbortController()),/size budget/);assert.equal(read,false);
});
