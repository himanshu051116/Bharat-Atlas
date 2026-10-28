import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderPhysicalOnlySVG,PHYSICAL_EXTENT,PHYSICAL_ONLY_FILENAME} from '../src/physical-only.mjs';
const data=JSON.parse(readFileSync(new URL('../data/landcover/land.geojson',import.meta.url)));
const hydro=JSON.parse(readFileSync(new URL('../data/hydrography/rivers.geojson',import.meta.url)));
const shore={coastlines:JSON.parse(readFileSync(new URL('../data/shorelines/coastlines.geojson',import.meta.url))),lakes:JSON.parse(readFileSync(new URL('../data/shorelines/lakes.geojson',import.meta.url)))};
test('physical only view draws genuine source land, rivers and coastlines without boundaries',()=>{
 const s=renderPhysicalOnlySVG({land:data,hydrology:hydro,shorelines:shore});
 assert.match(s,/PHYSICAL GEOGRAPHY ONLY — NO POLITICAL BOUNDARIES/);
 assert.match(s,/<g id="physical-land"/);
 assert.match(s,/<g id="historical-rivers"[^>]*>\s*<path/);
 assert.match(s,/<g id="physical-coastlines"[^>]*>\s*<path/);
 assert.match(s,/<g id="physical-lakes"[^>]*>\s*<path/);
 assert.doesNotMatch(s,/data-region=/);
 assert.doesNotMatch(s,/Survey of India certified|officially verified/i);
 assert.match(s,/fill-rule="evenodd"/);
 assert.deepEqual(PHYSICAL_EXTENT,[68,6,99,38]);
 assert.equal(PHYSICAL_ONLY_FILENAME,'bharat-atlas-physical-geography-research.svg');
});
test('hydrology and shores toggles really omit lines',()=>{
 const svg=renderPhysicalOnlySVG({land:data,hydrology:hydro,shorelines:shore,showRivers:false,showShores:false});
 assert.match(svg,/<g id="historical-rivers"[^>]*><\/g>/);
 assert.match(svg,/<g id="physical-coastlines"[^>]*><\/g>/);
 assert.match(svg,/<g id="physical-lakes"[^>]*><\/g>/);
});
test('physical-only export rejects absent land instead of creating misleading blank SVG',()=>{
 assert.throws(()=>renderPhysicalOnlySVG({}),/validated physical land/);
 assert.throws(()=>renderPhysicalOnlySVG({land:{type:'FeatureCollection',features:[]}}),/validated physical land/);
});
test('physical fallback displays supplied claimed national outline separately from physical geography',()=>{
 const claim={type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Polygon',coordinates:[[[72,10],[76,10],[76,13],[72,13],[72,10]]]},properties:{}}]};
 const svg=renderPhysicalOnlySVG({land:data,officialClaim:claim});
 assert.match(svg,/id="india-official-claim-outline"/);
 assert.match(svg,/SOI-SOURCED NATIONAL CLAIM OUTLINE — GENERALIZED, NOT 2026-CERTIFIED/);
 assert.doesNotMatch(svg,/PHYSICAL GEOGRAPHY ONLY — NO POLITICAL BOUNDARIES/);
 assert.throws(()=>renderPhysicalOnlySVG({land:data,officialClaim:{type:'FeatureCollection',features:[]}}),/Invalid SoI national-outline/);
});
