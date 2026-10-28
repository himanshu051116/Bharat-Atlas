import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateGazetteer,loadGazetteer} from '../src/gazetteer.mjs';
import {searchAtlas} from '../src/search.mjs';
import {PILOT_PLACES,pilotFeatureCollection} from '../src/places.mjs';
const manifest=JSON.parse(readFileSync(new URL('../data/gazetteer/manifest.json',import.meta.url),'utf8'));
const text=readFileSync(new URL('../data/gazetteer/places.geojson',import.meta.url),'utf8');
const fc=JSON.parse(text);
const places=validateGazetteer(fc);

test('71 traceable public-domain city points and source digest',()=>{
 assert.equal(places.length,71);
 assert.equal(createHash('sha256').update(text).digest('hex'),manifest.sha256);
 assert.equal(manifest.officiallyVerified,false);
 assert.equal(manifest.pinnedGitBlobSha,'f692f6a1311569612a2d3fbb3554e97ec0bfe64c');
 assert.equal(places.find(p=>p.name==='Ahmedabad').region,'Gujarat');
});
test('Hindi, source-name and editorial alternate-name search',()=>{
 assert.equal(searchAtlas('ग्वालियर',[],places)[0].entry.name,'Gwalior');
 assert.equal(searchAtlas('प्रयागराज',[],places)[0].entry.name,'Allahabad');
 assert.equal(searchAtlas('Prayagraj',[],places)[0].entry.name,'Allahabad');
 assert.equal(searchAtlas('Jalandhar',[],places)[0].entry.name,'Jullundur');
});
test('deduplicating pilot city markers retains unsourced pilot towns',()=>{
 const names=new Set(places.map(p=>p.name.toLowerCase()));
 const pilot=PILOT_PLACES.filter(p=>!names.has(p.name.toLowerCase()));
 assert.equal(pilotFeatureCollection(pilot).features.some(f=>f.properties.name==='Gwalior'),false);
 assert.equal(pilot.some(p=>p.name==='Panaji'),true);
});
test('real local catalog passes WebCrypto integrity and tampering fails',async()=>{
 const fetcher=async u=>new Response(u.endsWith('manifest.json')?JSON.stringify(manifest):text,{status:200});
 const ok=await loadGazetteer({fetcher});assert.equal(ok.places.length,71);
 const altered=async u=>new Response(u.endsWith('manifest.json')?JSON.stringify(manifest):text+' ',{status:200});
 await assert.rejects(()=>loadGazetteer({fetcher:altered}),/integrity/i);
});
