'use strict';const test=require('node:test');const assert=require('node:assert/strict');
const {matches,normalize}=require('../world-place-search.js');
const make=(name,iso,lon=0)=>({type:'Feature',geometry:{type:'Point',coordinates:[lon,0]},properties:{name,countryIso3:iso}});
test('diacritic-safe name matching distinguishes geography from country labels',()=>{
 const dataset=new Map([['cities',{features:[make('São Paulo','BRA'),make('Sao Sebastiao','BRA'),make('Paris','FRA')]}]]);
 assert.deepEqual(matches(dataset,'sao').map(x=>x.name),['São Paulo','Sao Sebastiao']);
 assert.equal(normalize('  São  Paulo '),'sao paulo');
 assert.equal(matches(dataset,'Paulo')[0].name,'São Paulo');
});
test('identically named places in different countries are distinct',()=>{
 const dataset=new Map([['cities',{features:[make('Springfield','USA',-90),make('Springfield','CAN',-71),make('Springfield','USA',-90)]}]]);
 assert.equal(matches(dataset,'springfield').length,2);
 assert.deepEqual(matches(dataset,'s'),[]);
});
test('matches provinces and waterways without claiming uninstalled data',()=>{
 const f=(name)=>({type:'Feature',properties:{name,countryIso3:'USA'},geometry:{type:'Polygon',coordinates:[]},_bounds:[-80,20,-79,21]});
 const set=new Map([['admin1',{features:[f('New York')]}],['rivers',{features:[f('Nile')]}]]);
 assert.equal(matches(set,'new york')[0].layer,'admin1');
 assert.equal(matches(set,'nile')[0].layer,'rivers');
 assert.deepEqual(matches(new Map(),'paris'),[]);
});
test('bounded query and safe ordering for partial strings',()=>{
 const set=new Map([['cities',{features:[make('Delhi','IND'),make('New Delhi','IND'),make('Old Delhi','IND')]}]]);
 assert.deepEqual(matches(set,'delhi').map(x=>x.name),['Delhi','New Delhi','Old Delhi']);
 assert.deepEqual(matches(set,'a'.repeat(121)),[]);
 assert.deepEqual(matches(set,'delhi',500),[]);
});
