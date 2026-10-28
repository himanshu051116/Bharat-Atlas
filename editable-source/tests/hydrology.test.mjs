import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateHydrology,validateHydrologyManifest,loadHydrology} from '../src/hydrology.mjs';
const source=JSON.parse(readFileSync(new URL('../data/hydrography/rivers.geojson',import.meta.url),'utf8'));
const m=JSON.parse(readFileSync(new URL('../data/hydrography/manifest.json',import.meta.url),'utf8'));
test('historical source is real and source-labelled, not falsely verified',()=>{
 assert.equal(validateHydrology(source).features.length,1723);
 assert.equal(validateHydrologyManifest(m).officiallyVerified,false);
 assert.equal(m.licence,'LGPL-3.0-or-later');
 assert.equal(m.riverNamesVerified,false);
});
test('reject fabricated river coordinates and tampered metadata',()=>{
 const mutated=structuredClone(source);mutated.features[0].geometry.coordinates[0][0]=999;
 assert.throws(()=>validateHydrology(mutated),/outside declared/);
 assert.throws(()=>validateHydrologyManifest({...m,officiallyVerified:true}),/source\/rights/);
});
test('load verified bytes and reject tampered source',async()=>{
 const bytes=readFileSync(new URL('../data/hydrography/rivers.geojson',import.meta.url));
 const fetcher=async path=>{
   if(path.endsWith('manifest.json'))return {ok:true,json:async()=>m};
   return {ok:true,headers:{get:()=>null},arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
 };

   const loaded=await loadHydrology({fetcher});assert.equal(loaded.fc.features.length,1723);
   const tampered=async path=>path.endsWith('manifest.json')?{ok:true,json:async()=>m}:{ok:true,headers:{get:()=>null},arrayBuffer:async()=>new TextEncoder().encode('{}').buffer};
   await assert.rejects(loadHydrology({fetcher:tampered}),/SHA-256/);
});
