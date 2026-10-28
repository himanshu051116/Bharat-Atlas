/* Bharat Atlas v1.9 — preindexed offline gazetteer.
 * Only names from installed source-backed geographic layers are indexed.
 * Indexed bigrams reduce work on every keystroke after world-city/admin-1 imports.
 * Country labels and historical capital references remain explicitly distinguished.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BharatWorldExploreSearch=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
'use strict';
const DETAIL=['cities','admin1','peaks','rivers','lakes'];
const ORDER={country:0,capital:1,cities:2,admin1:3,peaks:4,rivers:5,lakes:6};
const normalize=t=>String(t||'').normalize('NFKD').toLocaleLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
function ranked(names,q){if(names.some(n=>n===q))return 0;if(names.some(n=>n.startsWith(q)))return 1;if(names.some(n=>n.includes(q)))return 2;return -1;}
function grams(value){const unique=new Set();for(let i=0;i<value.length-1;i++)unique.add(value.slice(i,i+2));return unique;}
function createCatalog(countries,capitalByCountry,available){
 const rows=[],bigram=new Map(),seen=new Set();
 function add(type,name,alt,country,ref,lat,lon){
  name=String(name||'').trim();if(!name)return;
  const normalizedNames=[...new Set([normalize(name),normalize(alt)].filter(Boolean))];
  const identity=type+'|'+(country?.iso3||country?.id||'')+'|'+normalize(name)+'|'+(Number.isFinite(lat)?lat:'')+'|'+(Number.isFinite(lon)?lon:'');
  if(seen.has(identity))return;seen.add(identity);
  const row={type,name,country:country?.name||'',countryIso3:country?.iso3||'',ref,lat,lon,names:normalizedNames};
  const index=rows.length;rows.push(row);
  const allGrams=new Set();for(const value of normalizedNames)for(const g of grams(value))allGrams.add(g);
  for(const key of allGrams){if(!bigram.has(key))bigram.set(key,[]);bigram.get(key).push(index)}
 }
 for(const c of countries||[]){add('country',c.name,c.hi,c,c,c.lat,c.lon);
  const cap=capitalByCountry?.(c);if(cap&&Number.isFinite(cap.lat)&&Number.isFinite(cap.lon))add('capital',cap.name,'',c,c,cap.lat,cap.lon);
 }
 for(const layer of DETAIL){for(const f of available?.get(layer)?.features||[]){const p=f.properties||{};
  const point=f.geometry?.type==='Point'?f.geometry.coordinates:null;
  const loc=Array.isArray(point)&&point.length>=2&&point.slice(0,2).every(Number.isFinite)?point:null;
  add(layer,p.name,p.nameHi,{name:p.countryName||p.countryIso3||'',iso3:p.countryIso3||''},f,loc?.[1],loc?.[0]);
 }}
 function search(query,limit=12){
  const q=normalize(query);if(q.length<2||q.length>120||!Number.isSafeInteger(limit)||limit<1||limit>30)return [];
  const initial=bigram.get(q.slice(0,2))||[];
  const matches=[];
  for(const index of initial){const row=rows[index],rank=ranked(row.names,q);if(rank<0)continue;matches.push({...row,rank})}
  matches.sort((a,b)=>a.rank-b.rank||(ORDER[a.type]-ORDER[b.type])||a.name.localeCompare(b.name)||a.country.localeCompare(b.country));
  return matches.slice(0,limit).map(({names,...item})=>item);
 }
 return Object.freeze({search,count:rows.length});
}
function find(countries,capitalByCountry,available,query,limit=12){return createCatalog(countries,capitalByCountry,available).search(query,limit)}
return Object.freeze({find,createCatalog,normalize});
});
