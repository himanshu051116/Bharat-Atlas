import test from 'node:test';import assert from 'node:assert/strict';
import {PILOT_PLACES,pilotFeatureCollection} from '../src/places.mjs';
import {searchAtlas,fuzzyDistance,normalizeQuery} from '../src/search.mjs';
import {mapStyle} from '../src/style.mjs';
import {STATES,UTS} from '../src/geography.mjs';
const regions=[...STATES.map(name=>({properties:{name,kind:'State'}})),...UTS.map(name=>({properties:{name,kind:'Union territory'}}))];
test('pilot place features are well-formed and unique',()=>{
 assert.equal(PILOT_PLACES.length,25);
 assert.equal(new Set(PILOT_PLACES.map(x=>x.name)).size,25);
 const fc=pilotFeatureCollection();assert.equal(fc.type,'FeatureCollection');assert.equal(fc.features.length,25);
 for(const p of PILOT_PLACES){assert(p.lon>=68&&p.lon<=96&&p.lat>=7&&p.lat<=38);assert([...STATES,...UTS].includes(p.region));}
});
test('empty search returns only administrative regions',()=>{const result=searchAtlas('',regions);assert.equal(result.length,36);assert(result.every(x=>x.kind==='region'))});
test('search city by prefix with region context',()=>{const result=searchAtlas('mumb',regions);assert.equal(result[0].name,'Mumbai');assert.equal(result[0].kind,'place')});
test('search accepts pilot city alternate name',()=>{assert.equal(searchAtlas('Bangalore',regions)[0].name,'Bengaluru');assert.equal(searchAtlas('port blair',regions)[0].name,'Sri Vijaya Puram')});
test('search prioritizes exact administrative name',()=>{const x=searchAtlas('Delhi',regions);assert.equal(x[0].kind,'region');assert.equal(x[0].name,'Delhi')});
test('filter removes pilot city results',()=>{assert.equal(searchAtlas('Bhopal',regions,PILOT_PLACES,{filter:'State'}).length,0);assert.equal(searchAtlas('Bhopal',regions,PILOT_PLACES,{includePlaces:false}).length,0)});
test('fuzzy search handles modest typos',()=>{assert.equal(normalizeQuery('  NEW   Delhi! '),'new delhi');assert(fuzzyDistance('jaipur','jaipr')<=2);assert.equal(searchAtlas('Jaipr',regions)[0].name,'Jaipur')});
test('map layers reveal pilot dots and labels by zoom',()=>{for(const theme of ['terrain','ink','outline']){const s=mapStyle(theme);assert.equal(s.glyphs,undefined);assert(s.sources['pilot-places']);assert.equal(s.layers.find(x=>x.id==='pilot-city-dots').minzoom,5.4);assert.equal(s.layers.find(x=>x.id==='pilot-city-labels').minzoom,6.0);}});
