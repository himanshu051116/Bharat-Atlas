import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateLandManifest,validateLandFeatures,loadLandcover} from '../src/landcover.mjs';
import {mapStyle} from '../src/style.mjs';
import {renderResearchSVG} from '../src/export.mjs';
const dir=new URL('../data/landcover/',import.meta.url);
const info=JSON.parse(readFileSync(new URL('manifest.json',dir)));
const bytes=readFileSync(new URL('land.geojson',dir));
const fc=JSON.parse(bytes);
const fakeFetch=async url=>String(url).endsWith('manifest.json')?{ok:true,status:200,json:async()=>info}:{ok:true,status:200,headers:{get:()=>String(bytes.length)},arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length)};
test('historical physical land mask carries provenance and real polygon islands',()=>{
 assert.equal(validateLandManifest(info).officiallyVerified,false);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),info.sha256);
 assert.equal(validateLandFeatures(fc).features.length,info.featureCount);
 assert.ok(fc.features.length>30);
 assert.ok(fc.features.some(f=>f.geometry.coordinates.length>1),'GSHHG inland lakes should be represented by holes');
});
test('land mask does not accept falsely official or malformed geographic source',()=>{
 assert.throws(()=>validateLandManifest({...info,officiallyVerified:true}),/metadata/);
 assert.throws(()=>validateLandManifest({...info,administrativeBoundaries:true}),/metadata/);
 const copy=structuredClone(fc);copy.features[0].geometry.coordinates[0][0]=[200,200];
 assert.throws(()=>validateLandFeatures(copy),/bounds/);
});
test('land mask is checked against SHA-256 before browser use',async()=>{
 const loaded=await loadLandcover({fetcher:fakeFetch,hasher:async d=>createHash('sha256').update(new Uint8Array(d)).digest('hex')});
 assert.equal(loaded.fc.features.length,info.featureCount);
 const forged=async url=>String(url).endsWith('manifest.json')?{ok:true,status:200,json:async()=>({...info,sha256:'a'.repeat(64)})}:fakeFetch(url);
 await assert.rejects(()=>loadLandcover({fetcher:forged,hasher:async d=>createHash('sha256').update(new Uint8Array(d)).digest('hex')}),/SHA-256/);
});
test('physical MapLibre style uses real land polygon source and transparent administrative fill',()=>{
 const p=mapStyle('physical');const basic=mapStyle('terrain');
 assert.equal(p.sources['land-mask'].type,'geojson');
 assert.equal(p.layers.find(x=>x.id==='land-fill').type,'fill');
 assert.equal(p.layers.find(x=>x.id==='regions-fill').paint['fill-opacity'],0.07);
 assert.equal(basic.layers.find(x=>x.id==='regions-fill').paint['fill-opacity'],1);
 assert.ok(p.layers.findIndex(x=>x.id==='land-fill')<p.layers.findIndex(x=>x.id==='regions-fill'));
});
test('physical export renders source-derived island polygons without implying political border certification',()=>{
 const p={type:'Feature',properties:{name:'Test region',palette:0},geometry:{type:'Polygon',coordinates:[[[70,10],[71,10],[71,11],[70,11],[70,10]]]}};
 const svg=renderResearchSVG({type:'FeatureCollection',features:[p]},{physicalLand:fc,physicalTheme:true});
 assert.match(svg,/id="physical-land"/);assert.match(svg,/fill-rule="evenodd"/);
 assert.match(svg,/fill-opacity="0.06"/);assert.match(svg,/PROVISIONAL GEOGRAPHY/);
});
