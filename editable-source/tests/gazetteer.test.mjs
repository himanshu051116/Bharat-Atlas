import test from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateGazetteer,validateGazetteerManifest,gazetteerFeatures,loadGazetteer} from '../src/gazetteer.mjs';
import {searchAtlas,normalizeQuery} from '../src/search.mjs';
import {mapStyle} from '../src/style.mjs';
const entry=(id,name='Gwalior',region='Madhya Pradesh',lon=78.18,lat=26.21,kind='city')=>({type:'Feature',properties:{id,name,region,kind,aliases:['ग्वालियर']},geometry:{type:'Point',coordinates:[lon,lat]}});
const fc={type:'FeatureCollection',features:[entry('p001'),entry('p002','Rewa','Madhya Pradesh',81.3,24.5,'town')]};
const manifest=text=>({format:'BharatAtlasGazetteer1',officiallyVerified:false,count:2,sha256:createHash('sha256').update(text).digest('hex'),sourceUrl:'https://example.org/licensed',licence:'Test licensed data',attribution:'Synthetic test points'});
test('validate legitimate gazetteer and preserve non-ASCII alias',()=>{const p=validateGazetteer(fc);assert.equal(p.length,2);assert.equal(p[0].aliases[0],'ग्वालियर');assert.equal(gazetteerFeatures(p).features[0].properties.id,'p001')});
test('reject duplicate IDs, missing regions, unexpected shapes, and invalid coordinates',()=>{
  const bads=[
    [{...entry('p001')},{...entry('p001')}],
    [entry('p001','X','Made Up')],
    [{...entry('p001'),geometry:{type:'LineString',coordinates:[]}}],
    [entry('p001','X','Madhya Pradesh',500,26)],
    [entry('p001','X','Madhya Pradesh',78,NaN)],
  ];
  for(const features of bads)assert.throws(()=>validateGazetteer({type:'FeatureCollection',features}));
});
test('reject oversized catalogue, malicious strings, and unsupported place categories',()=>{
 assert.throws(()=>validateGazetteer({type:'FeatureCollection',features:[entry('p001'),entry('p002')]},{maxEntries:1}));
 assert.throws(()=>validateGazetteer({type:'FeatureCollection',features:[entry('p001','bad\nname')]}));
 assert.throws(()=>validateGazetteer({type:'FeatureCollection',features:[entry('p001','X','Madhya Pradesh',78,26,'hotel')]}));
});
test('place source metadata is explicit and can never claim official verification',()=>{
 const text=JSON.stringify(fc);assert.equal(validateGazetteerManifest(manifest(text)).officiallyVerified,false);
 assert.throws(()=>validateGazetteerManifest({...manifest(text),officiallyVerified:true}));
});
test('search licensed points, maintain region disambiguation and Unicode',()=>{
 const points=validateGazetteer(fc),regions=[{properties:{name:'Madhya Pradesh',kind:'State'}}];
 assert.equal(searchAtlas('ग्वालियर',regions,points)[0].entry.id,'p001');
 assert.equal(searchAtlas('gwa',regions,points)[0].entry.id,'p001');
 assert.equal(normalizeQuery(' गाँव १२ '),'गाँव १२');
 assert.equal(searchAtlas('Rew',regions,points)[0].subtitle.includes('source-backed point'),true);
});
test('styles preserve gazetteer source and label layer',()=>{for(const theme of ['terrain','ink','outline']){
 const s=mapStyle(theme);assert(s.sources['gazetteer-places']);assert.equal(s.layers.find(l=>l.id==='gazetteer-labels').minzoom,6.6);
}});
test('verified optional gazetteer loads with matching checksum and rejects tampering',async()=>{
 const body=JSON.stringify(fc);const m=manifest(body);
 const fetcher=async url=>new Response(url.endsWith('manifest.json')?JSON.stringify(m):body,{status:200});
 const result=await loadGazetteer({fetcher});assert.equal(result.places.length,2);
 const corrupted=async url=>new Response(url.endsWith('manifest.json')?JSON.stringify(m):body+' ',{status:200});
 await assert.rejects(()=>loadGazetteer({fetcher:corrupted}),/integrity/i);
});
test('missing optional catalog does not break primary atlas',async()=>{
 assert.equal(await loadGazetteer({fetcher:async()=>new Response('not found',{status:404})}),null);
});
