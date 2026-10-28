const test=require('node:test'),assert=require('node:assert/strict');
const {find}=require('../world-explore-search.js');
const {estimate,niceFloor}=require('../world-scale.js');
const states=[{id:1,iso3:'IND',name:'India',hi:'भारत',lat:22,lon:78},{id:2,iso3:'CAN',name:'Canada',hi:'कनाडा',lat:56,lon:-100}];
const capital=c=>c.id===2?{name:'Ottawa',lon:-75.69,lat:45.42}:null;
test('search merges localized country and coordinate-backed capital',()=>{
 assert.equal(find(states,capital,new Map(),'भारत')[0].type,'country');
 const out=find(states,capital,new Map(),'Ottawa');assert.equal(out[0].type,'capital');assert.equal(out[0].lon,-75.69);
});
test('later exact result is not suppressed by hundreds of earlier substring matches',()=>{
 const entries=Array.from({length:380},(_,i)=>({type:'Feature',properties:{name:'New Place '+i},geometry:{type:'Point',coordinates:[i%180,10]}}));
 entries.push({type:'Feature',properties:{name:'Place'},geometry:{type:'Point',coordinates:[3,4]}});
 const out=find([],()=>null,new Map([['cities',{features:entries}]]),'Place',10);
 assert.equal(out[0].name,'Place');assert.equal(out[0].rank,0);
});
test('search does not merge same-named cities in different countries',()=>{
 const points=['A','B'].map(countryIso3=>({type:'Feature',properties:{name:'Springfield',countryIso3},geometry:{type:'Point',coordinates:[8,9]}}));
 assert.equal(find([],null,new Map([['cities',{features:points}]]),'Springfield').length,2);
});
test('invalid or very short queries return nothing',()=>{
 assert.deepEqual(find(states,capital,new Map(),'O'),[]);
 assert.deepEqual(find(states,capital,new Map(),'a'.repeat(130)),[]);
});
test('scale matches equator and shrinks in km at northern latitude',()=>{
 const eq=estimate({x:0,y:0,w:1440,h:720},1,100),north=estimate({x:0,y:0,w:1440,h:360},1,100);
 assert.equal(eq.latitude,0);assert.equal(eq.km,2000);assert(north.km<eq.km);
 assert(eq.pixels>0);
});
test('scale refuses invalid geometry',()=>{
 assert.equal(estimate({x:0,y:0,w:1440,h:720},0),null);
 assert.equal(niceFloor(330),200);assert.equal(niceFloor(740),500);
});
