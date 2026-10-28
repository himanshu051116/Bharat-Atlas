import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {atlasSearchKey,createAtlasShardSearch,rankSearchRows,validateSearchManifest} from '../src/search-shards.mjs';
const dir=new URL('../data/search-index/',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',dir),'utf8'));
test('real source-reviewed Natural Earth bilingual shard exists and yields matching place',async()=>{
 assert.equal(manifest.recordCount,71);assert.equal(manifest.researchOnly,true);
 const fetcher=async(url)=>{
  const p=new URL(url.replace('./data/search-index/',''),dir);
  const data=fs.readFileSync(p);
  return new Response(data,{status:200,headers:{'content-length':String(data.length)}});
 };
 const search=await createAtlasShardSearch({fetcher});
 const en=await search.search('Mumbai');
 assert.ok(en.some(p=>p.name==='Mumbai'));assert.ok(en.every(p=>p.source==='indexed'));
 const first=Object.keys(manifest.shards)[0],raw=fs.readFileSync(new URL(manifest.shards[first].path,dir));
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),manifest.shards[first].sha256);
});
test('query bucket cannot traverse directories and malformed source claims fail closed',()=>{
 assert.equal(atlasSearchKey('../'),null);
 assert.match(atlasSearchKey('Mumbai'),/^[a-f0-9]{12}$/);
 assert.throws(()=>validateSearchManifest({...manifest,officiallyVerified:true}),/Invalid source/);
 assert.throws(()=>rankSearchRows('city','{"id":"x","name":"City","aliases":[],"lon":0,"lat":0,"kind":"city"}\n'),/outside coverage/);
});
