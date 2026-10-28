import test from 'node:test';import assert from 'node:assert/strict';
import {ATLAS_REGIONS,atlasRegionCatalogueSearch,atlasCatalogueSummary} from '../src/region-catalog.mjs';
test('28 states and 8 UTs without any pretend polygons',()=>{const s=atlasCatalogueSummary();assert.equal(s.states,28);assert.equal(s.unionTerritories,8);assert.equal(s.verifiedPolygons,0);assert.equal(ATLAS_REGIONS.length,36);});
test('Hindi / English lookup and type filtering',()=>{assert.equal(atlasRegionCatalogueSearch('मध्य प्रदेश')[0].name,'Madhya Pradesh');assert.equal(atlasRegionCatalogueSearch('Telang')[0].name,'Telangana');assert.equal(atlasRegionCatalogueSearch('लद्दाख','Union territory')[0].name,'Ladakh');assert.equal(atlasRegionCatalogueSearch('गोवा','Union territory').length,0);});
test('deduplicate only when matching geometry is loaded',()=>{assert.equal(atlasRegionCatalogueSearch('goa','all',['Goa']).length,0);assert.equal(atlasRegionCatalogueSearch('goa','all',[]).length,1);});
test('names are catalogue only, with no polygon geometry',()=>{assert.ok(ATLAS_REGIONS.every(x=>!('geometry' in x)&&!('coordinates' in x)));});
