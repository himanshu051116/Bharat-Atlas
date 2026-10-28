import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCollection} from '../src/geography.mjs';
import {createTileCache,sparseTileHandler} from '../src/tiles.mjs';
import {readBoundedText} from '../src/data.mjs';
const f=(name,coords)=>({type:'Feature',properties:{name},geometry:{type:'Polygon',coordinates:coords}});
const fc=(features)=>({type:'FeatureCollection',features});
test('browser geography rejects bow-tie/self crossing rings',()=>{
 const cross=[[72,20],[74,22],[72,22],[74,20],[72,20]];
 assert.throws(()=>validateCollection(fc([f('Goa',[cross])])),/self-intersecting|zero-area/);
 // Nonzero signed area bow-tie: intersection at the center remains invalid.
 const crossing=[[72,20],[74,22],[72,22],[74,20],[72,21],[72,20]];
 assert.throws(()=>validateCollection(fc([f('Goa',[crossing])])),/self-intersecting/);
});
test('reject outside polygon holes and consecutive duplicate vertices',()=>{
 const shell=[[70,20],[76,20],[76,26],[70,26],[70,20]];
 const exteriorHole=[[78,24],[79,24],[79,25],[78,25],[78,24]];
 assert.throws(()=>validateCollection(fc([f('Goa',[shell,exteriorHole])])),/outside its shell/);
 const repeated=[[70,20],[76,20],[76,20],[76,26],[70,26],[70,20]];
 assert.throws(()=>validateCollection(fc([f('Goa',[repeated])])),/duplicate consecutive/);
});
test('accept standard valid polygons including holes',()=>{
 const shell=[[70,20],[76,20],[76,26],[70,26],[70,20]];
 const hole=[[72,22],[74,22],[74,24],[72,24],[72,22]];
 assert.equal(validateCollection(fc([f('Goa',[shell,hole])])).features.length,1);
});
test('bounded GeoJSON stream reader stops on oversized chunks',async()=>{
 let cancelled=false;
 const response={headers:{get:()=>null},body:{getReader:()=>({
  read:async()=>({done:false,value:new Uint8Array(100)}),
  cancel:async()=>{cancelled=true},releaseLock:()=>{}
 })}};
 await assert.rejects(()=>readBoundedText(response,50),/size limit/);
 assert.equal(cancelled,true);
});
test('bounded reader correctly decodes split UTF-8 text',async()=>{
 const source=new TextEncoder().encode('{"city":"पुणे"}');let offset=0;
 const reader={read:async()=>offset>=source.length?{done:true}:{done:false,value:source.subarray(offset,offset+=2)},releaseLock(){}};
 const got=await readBoundedText({headers:{get:()=>null},body:{getReader:()=>reader}});
 assert.deepEqual(JSON.parse(got),{city:'पुणे'});
});
test('tile LRU cache is bounded, protects buffers and evicts the oldest',()=>{
 const c=createTileCache({maxBytes:5,maxEntries:2});
 const x=new Uint8Array([1,2,3]).buffer,y=new Uint8Array([4,5,6]).buffer;
 assert.equal(c.put('a',x),true);assert.equal(c.get('a').byteLength,3);
 assert.equal(c.put('b',y),true);assert.equal(c.get('a'),null);
 assert.deepEqual(c.stats(),{entries:1,bytes:3});
 const fetched=c.get('b');new Uint8Array(fetched)[0]=0;
 assert.equal(new Uint8Array(c.get('b'))[0],4);
});
test('tile protocol cache avoids duplicate requests without bypassing SHA-256',async()=>{
 let calls=0;const content=new Uint8Array([26,0]).buffer;
 const hash='d'.repeat(64);
 const catalog={tileHashes:{'4/11/7.pbf':hash}};
 const protocol=sparseTileHandler(catalog,{fetcher:async()=>{calls++;return {ok:true,arrayBuffer:async()=>content}},hasher:async()=>hash});
 const q={url:'atlas-detail://4/11/7.pbf'};
 assert.equal((await protocol(q,new AbortController())).data.byteLength,2);
 assert.equal((await protocol(q,new AbortController())).data.byteLength,2);
 assert.equal(calls,1);
 const bad=sparseTileHandler(catalog,{fetcher:async()=>{calls++;return {ok:true,arrayBuffer:async()=>content}},hasher:async()=> '0'.repeat(64)});
 await assert.rejects(()=>bad(q,new AbortController()),/SHA-256/);
 await assert.rejects(()=>bad(q,new AbortController()),/SHA-256/);
 assert.equal(calls,3);
});
