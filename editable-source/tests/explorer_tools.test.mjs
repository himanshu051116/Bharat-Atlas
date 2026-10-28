import test from 'node:test';
import assert from 'node:assert/strict';
import {atlasHaversineKm,atlasMeasurePath,atlasParseCoordinateInput,atlasValidateResearchOverlay,atlasMeasurementGeoJSON,atlasMakeBookmark,atlasCleanBookmarks,atlasViewURL,atlasParseViewParams} from '../src/explorer-tools.mjs';
import {atlasRoadGraph,atlasResearchRoute} from '../src/router.mjs';

const meta={title:'sample.geojson',sourceUrl:'https://data.example.org/roads',licence:'Research rights reviewed by importer',attribution:'Sample fixture — not official'};
const point=(lon,lat)=>[lon,lat];
const fc={type:'FeatureCollection',features:[
 {type:'Feature',properties:{name:'Segment 1',highway:'residential'},geometry:{type:'LineString',coordinates:[point(77.4,23.2),point(77.405,23.2)]}},
 {type:'Feature',properties:{name:'Segment 2',highway:'residential'},geometry:{type:'LineString',coordinates:[point(77.405,23.2),point(77.41,23.2)]}},
 {type:'Feature',properties:{name:'Fixture town',place:'town'},geometry:{type:'Point',coordinates:point(77.41,23.2)}}
]};

test('direct distance and area remain research estimates and reject out of window coords',()=>{
 assert.equal(atlasMeasurePath([point(77,23)],'distance').pointCount,1);
 assert.ok(atlasHaversineKm(point(77,23),point(78,23))>100);
 const triangle=atlasMeasurePath([point(77,23),point(77.1,23),point(77.1,23.1)],'area');
 assert.ok(triangle.km2>0);assert.ok(triangle.km>0);
 assert.equal(atlasMeasurementGeoJSON([point(77,23),point(78,23)],'distance').features.length,3);
 assert.deepEqual(atlasParseCoordinateInput('77.41, 23.26'),[77.41,23.26]);
 assert.throws(()=>atlasParseCoordinateInput('NaN, 23'));assert.throws(()=>atlasParseCoordinateInput('10, 80'));
});
test('research sources require clear provenance and limited WGS84 geometry',()=>{
 const item=atlasValidateResearchOverlay(fc,meta);
 assert.equal(item.counts.road,2);assert.equal(item.counts.settlement,1);
 assert.equal(item.metadata.officiallyVerified,false);
 assert.throws(()=>atlasValidateResearchOverlay(fc,{...meta,licence:''}));
 const outside=structuredClone(fc);outside.features[0].geometry.coordinates[0]=point(0,0);
 assert.throws(()=>atlasValidateResearchOverlay(outside,meta));
});
test('road graph follows supplied matching vertices only and never fabricates routes',()=>{
 const item=atlasValidateResearchOverlay(fc,meta);
 const graph=atlasRoadGraph(item.collection);
 const route=atlasResearchRoute(graph,point(77.4,23.2),point(77.41,23.2));
 assert.equal(route.geometry.features[0].properties.navigationCertified,false);
 assert.ok(route.km>0);assert.ok(route.vertexCount>=3);
 assert.throws(()=>atlasResearchRoute(graph,point(78,25),point(77.41,23.2)));
});
test('browser-local bookmarks and shared views validate inputs',()=>{
 const clean=atlasCleanBookmarks([atlasMakeBookmark({name:'Research point',lon:77.4,lat:23.2}),{name:'bad',lon:999,lat:100}]);
 assert.equal(clean.length,1);
 const url=atlasViewURL('http://localhost:8000/?secret=not-copied',{style:'ink',coordinate:[77.41,23.26]});
 assert.equal(new URL(url).searchParams.has('secret'),false);
 assert.deepEqual(atlasParseViewParams(new URL(url).search).coordinate,[77.41,23.26]);
});
