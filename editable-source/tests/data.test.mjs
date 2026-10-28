import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {verifyBoundaryDigest,readJSON,loadCommunity} from '../src/data.mjs';
const message='{"states":36}';
const digest=createHash('sha256').update(message).digest('hex');
test('verify SHA-256 protects browser-loaded bundled geography',async()=>{
 assert.equal(await verifyBoundaryDigest(message,digest,webcrypto.subtle),true);
 await assert.rejects(verifyBoundaryDigest(message+'X',digest,webcrypto.subtle),/integrity check failed/);
 await assert.rejects(verifyBoundaryDigest(message,'abc',webcrypto.subtle),/Invalid geographic checksum/);
});
test('readJSON verifies content and releases its timeout after success',async()=>{
 const old=globalThis.fetch; globalThis.fetch=async()=>({ok:true,headers:{get:()=>null},text:async()=>message});
 try{const value=await readJSON('https://test.invalid',{expectedSha256:digest});assert.equal(value.states,36);
 await assert.rejects(readJSON('https://test.invalid',{expectedSha256:'f'.repeat(64)}),/integrity check failed/)}finally{globalThis.fetch=old;}
});
test('invalid local provenance must not silently fall back to remote community data',async()=>{
 const old=globalThis.fetch;const seen=[];
 globalThis.fetch=async url=>{seen.push(String(url));return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify({officiallyVerified:true,licence:'fake',attribution:'fake',sourceUrl:'https://example.com',sha256:digest})}};
 try{await assert.rejects(loadCommunity(),/provenance/);assert.equal(seen.length,1);}finally{globalThis.fetch=old;}
});

test('a missing bundled geometry file is not silently replaced after metadata exists',async()=>{
 const old=globalThis.fetch;const seen=[];
 globalThis.fetch=async url=>{seen.push(String(url));if(String(url).includes('preview-provenance'))return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify({officiallyVerified:false,licence:'ODbL 1.0',attribution:'OpenStreetMap',sourceUrl:'https://example.com',sha256:digest})};return {ok:false,status:404};};
 try{await assert.rejects(loadCommunity(),/HTTP 404/);assert.equal(seen.length,2);}finally{globalThis.fetch=old;}
});
