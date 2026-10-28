import test from 'node:test';
import assert from 'node:assert/strict';
import {renderResearchSVG,escapeXML,exportFileName} from '../src/export.mjs';
const polygon=(name,coordinates)=>({type:'Feature',properties:{name,palette:1,kind:'State'},geometry:{type:'Polygon',coordinates}});
const r=(a,b,c,d)=>[[a,b],[c,b],[c,d],[a,d],[a,b]];
const regions={type:'FeatureCollection',features:[polygon('Telangana',[r(77,17,79,19),r(77.5,17.5,78.5,18.5)]),{type:'Feature',properties:{name:'Andaman and Nicobar Islands',kind:'Union territory',palette:2},geometry:{type:'MultiPolygon',coordinates:[[r(92,12,93,13)],[r(93,8,94,9)]]}}]};
test('renders resolution-independent map, preserves holes and separate islands',()=>{
 const svg=renderResearchSVG(regions,{source:{title:'Local pilot',licence:'CC BY 4.0',attribution:'Research test'}});
 assert.match(svg,/viewBox="0 0 1600 1120"/);
 assert.match(svg,/fill-rule="evenodd"/);
 assert.equal((svg.match(/<path data-region=/g)||[]).length,2);
 assert.equal((svg.match(/ Z/g)||[]).length,4); // two rings in one region, two islands
 assert.match(svg,/PROVISIONAL GEOGRAPHY/);
 assert.match(svg,/CC BY 4.0/);
 assert.match(svg,/data-region="Telangana"/);
 assert.match(svg,/data-region="Andaman and Nicobar Islands"/);
});
test('selected-region SVG omits other polygons, includes provenance',()=>{
 const svg=renderResearchSVG(regions,{selected:'Telangana',source:{title:'User import',licence:'Unknown',attribution:'User-provided'}});
 assert.equal((svg.match(/<path data-region=/g)||[]).length,1);
 assert.match(svg,/Telangana · Research map/);
 assert.match(svg,/User-provided/);
 assert.doesNotMatch(svg,/Andaman and Nicobar Islands/);
});
test('proper XML escaping blocks embedded markup',()=>{
 assert.equal(escapeXML('<script a="b">&\'</script>'),'&lt;script a=&quot;b&quot;&gt;&amp;&#39;&lt;/script&gt;');
 const svg=renderResearchSVG(regions,{source:{title:'<img src=x onerror=alert(1)>',licence:'<unsafe>',attribution:'A&B'}});
 assert.doesNotMatch(svg,/<img/);
 assert.match(svg,/&lt;img/);
});
test('rejects empty or unknown selection',()=>{
 assert.throws(()=>renderResearchSVG({type:'FeatureCollection',features:[]}),/validated polygon/);
 assert.throws(()=>renderResearchSVG(regions,{selected:'Kashmir'}),/no longer/);
});
test('safe filenames',()=>{
 assert.equal(exportFileName('Andaman and Nicobar Islands'),'bharat-atlas-andaman-and-nicobar-islands-research.svg');
 assert.equal(exportFileName(),'bharat-atlas-india-research.svg');
});

test('historic source-backed rivers appear as separate SVG overlay without affecting political polygons',()=>{
 const historic={type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'LineString',coordinates:[[78,17],[79,18]]},properties:{name:'Unlabelled historical watercourse'}}]};
 const svg=renderResearchSVG(regions,{physicalLines:historic,source:{title:'Provisional demo',licence:'ODbL',attribution:'Test'}});
 assert.match(svg,/id="historic-hydrology"/);
 assert.match(svg,/clip-path="url\(#hydrology-frame\)"/);
 assert.match(svg,/LGPL-3.0/);
 assert.equal((svg.match(/<path data-region=/g)||[]).length,2);
 assert.equal((svg.match(/<g id="historic-hydrology"[\s\S]*?<path /g)||[]).length,1);
});
