import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateShoreManifest,validateShoreFeatures,loadShorelines} from '../src/shorelines.mjs';
import {validateTileManifest,localDetailLayers} from '../src/tiles.mjs';
import {renderResearchSVG} from '../src/export.mjs';
const dir=new URL('../data/shorelines/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',dir),'utf8'));
const get=name=>readFileSync(new URL(name,dir));
const fakeFetch=async url=>{
 const name=String(url).split('/').at(-1);
 if(name==='manifest.json')return {ok:true,status:200,json:async()=>manifest};
 const bytes=get(name);
 return {ok:true,status:200,headers:{get:()=>String(bytes.length)},arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
};
test('GSHHG coast and lake datasets have valid verifiable provenance and are not official',()=>{
 assert.equal(validateShoreManifest(manifest).officiallyVerified,false);
 for(const layer of ['coastlines','lakes']){
  const bytes=get(layer+'.geojson'),fc=JSON.parse(bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.layers[layer].sha256);
  assert.equal(validateShoreFeatures(fc,layer).features.length,manifest.layers[layer].count);
 }
 assert.ok(manifest.layers.coastlines.count>=25);
 assert.ok(manifest.layers.lakes.count>=35);
});
test('shoreline extraction suppresses artificial rectangle borders and source remains bounded',()=>{
 for(const layer of ['coastlines','lakes']){
  const fc=JSON.parse(get(layer+'.geojson'));
  for(const f of fc.features){
   const pts=f.geometry.coordinates;
   for(let i=1;i<pts.length;i++){
    const a=pts[i-1],b=pts[i];
    const frame=[[0,68],[0,99],[1,6],[1,38]];
    assert(!frame.some(([k,v])=>Math.abs(a[k]-v)<1e-5&&Math.abs(b[k]-v)<1e-5),'Artificial viewport-edge segment');
   }
  }
 }
});
test('shorelines are not silently trusted after edits or license edits',async()=>{
 const ok=await loadShorelines({fetcher:fakeFetch});
 assert.equal(ok.coastlines.features.length,39);
 assert.equal(ok.lakes.features.length,93);
 assert.throws(()=>validateShoreManifest({...manifest,officiallyVerified:true}),/source record/);
 assert.throws(()=>validateShoreManifest({...manifest,licence:'Unknown'}),/source record/);
 const bytes=get('lakes.geojson');
 const changed=new Uint8Array(bytes); changed[changed.length-2]^=1;
 const altered=async path=>String(path).endsWith('lakes.geojson')?{ok:true,status:200,headers:{get:()=>String(changed.length)},arrayBuffer:async()=>changed.buffer}:fakeFetch(path);
 await assert.rejects(()=>loadShorelines({fetcher:altered}),/SHA-256/);
});
test('coasts and lakes get independent zoom-aware styled MVT line layers',()=>{
 const c=validateTileManifest(JSON.parse(readFileSync(new URL('../data/tiles/atlas-tiles.json',import.meta.url),'utf8')));
 assert.deepEqual([...c.layers].sort(),['coastlines','lakes','rivers','settlements']);
 const layers=localDetailLayers(c);
 for(const name of ['local-coastlines','local-lakes','local-rivers']){
  const layer=layers.find(v=>v.id===name);
  assert.ok(layer);assert.equal(layer.type,'line');assert.equal(layer.source,'local-detail');
 }
});
test('research SVG includes separate coastline and lake overlays without asserting boundary accuracy',()=>{
 const p={type:'Feature',properties:{name:'Test region',palette:0},geometry:{type:'Polygon',coordinates:[[[70,10],[71,10],[71,11],[70,11],[70,10]]]}};
 const svg=renderResearchSVG({type:'FeatureCollection',features:[p]},{physicalShore:{coastlines:{type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'LineString',coordinates:[[70,10],[71,10]]}}]},lakes:{type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'LineString',coordinates:[[70.1,10.2],[70.8,10.2]]}}]}}});
 assert.match(svg,/id="physical-shorelines"/);assert.match(svg,/id="historic-coastlines"/);assert.match(svg,/id="historic-lakes"/);
 assert.match(svg,/PROVISIONAL GEOGRAPHY/);
});
