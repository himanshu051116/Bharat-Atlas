import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateTileManifest,localDetailLayers} from '../src/tiles.mjs';
const catalogue=JSON.parse(readFileSync(new URL('../data/tiles/atlas-tiles.json',import.meta.url)));
test('real settlement vector tiles preserve individual public domain source and original GSHHG rights',()=>{
 const validated=validateTileManifest(catalogue);
 assert.deepEqual([...validated.layers].sort(),['coastlines','lakes','rivers','settlements']);
 assert.equal(validated.sourceLayers.settlements.licence,'Public Domain (Natural Earth)');
 assert.match(validated.sourceLayers.rivers.attribution,/GSHHG/);
 assert.ok(catalogue.featureOccurrences.settlements>=71);
 const layers=localDetailLayers(validated);
 assert.ok(layers.some(l=>l.id==='local-settlements'&&l.type==='circle'));
 assert.ok(layers.some(l=>l.id==='local-settlements-labels'&&l.type==='symbol'));
});
test('source-layer omissions or falsified source verification are blocked',()=>{
 const missing=structuredClone(catalogue);
 delete missing.sourceLayers.settlements;
 assert.throws(()=>validateTileManifest(missing),/source-layer registry/);
 const falseClaim=structuredClone(catalogue);
 falseClaim.sourceLayers.settlements.officiallyVerified=true;
 assert.throws(()=>validateTileManifest(falseClaim),/source rights and provenance/);
});
test('railways are opt-in style support, never claimed as present',()=>{
 assert.ok(!catalogue.layers.includes('railways'));
 const mock={...validateTileManifest(catalogue),layers:[...catalogue.layers,'railways']};
 const layers=localDetailLayers(mock);
 assert.ok(layers.some(x=>x.id==='local-railways'&&x['source-layer']==='railways'));
});
