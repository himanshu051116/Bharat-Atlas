/* Offline/local integrity-checked bilingual search. No public Nominatim API or invented translations. */
import {normalizeQuery} from './search.mjs';
import {readBoundedText,verifyBoundaryDigest} from './data.mjs';
export const ATLAS_SEARCH_FORMAT='BharatAtlasSearchShards1';
export function atlasSearchKey(query){
 const first=normalizeQuery(query).split(' ')[0]||'';
 return [...first].length>=2?[...[...first].slice(0,2)].map(c=>c.codePointAt(0).toString(16).padStart(6,'0')).join(''):null;
}
export function validateSearchManifest(m){
 if(m?.format!==ATLAS_SEARCH_FORMAT||m.researchOnly!==true||m.officiallyVerified!==false||!Number.isInteger(m.recordCount)||m.recordCount<1||m.recordCount>500000||
 !/^https:\/\//.test(m.sourceUrl||'')||!m.licence||!m.attribution||!/^[a-f0-9]{64}$/.test(m.sourceSha256||'')||
 !m.shards||typeof m.shards!=='object'||Object.keys(m.shards).length>12000)throw Error('Invalid source-labelled search manifest');
 for(const [key,detail] of Object.entries(m.shards)){
  if(!/^(?:[a-f0-9]{6}){2}$/.test(key)||detail.path!==`${key}.jsonl`|| !/^[a-f0-9]{64}$/.test(detail.sha256||'')||!Number.isInteger(detail.bytes)||detail.bytes<=0||detail.bytes>8000000||!Number.isInteger(detail.records)||detail.records<1||detail.records>500000)throw Error('Invalid search shard manifest entry');
 }
 return m;
}
export function rankSearchRows(query,lines,{limit=20}={}){
 const q=normalizeQuery(query),rows=[];
 if(q.length<2)return rows;
 const seen=new Set();
 for(const line of lines.split('\n')){
  if(!line.trim())continue;
  const p=JSON.parse(line);
  if(typeof p.id!=='string'||seen.has(p.id)||typeof p.name!=='string'||!Number.isFinite(p.lon)||!Number.isFinite(p.lat)||!Array.isArray(p.aliases)||!['city','town','village','hamlet','locality','station','landmark','poi','hospital','school','shop'].includes(p.kind))throw Error('Invalid indexed place record');
  if(p.lon<60||p.lon>102||p.lat<3||p.lat>41)throw Error('Indexed coordinate outside coverage');
  seen.add(p.id);
  const words=[p.name,...p.aliases].map(normalizeQuery);
  const rank=words.some(v=>v===q)?0:words.some(v=>v.startsWith(q))?1:words.some(v=>v.split(' ').some(t=>t.startsWith(q)))?2:Infinity;
  if(Number.isFinite(rank))rows.push({...p,source:'indexed',rank});
 }
 rows.sort((a,b)=>a.rank-b.rank||a.name.localeCompare(b.name));
 return rows.slice(0,Math.min(50,Math.max(1,limit)));
}
export async function createAtlasShardSearch({fetcher=fetch,base='./data/search-index/',timeout=7000}={}){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
 let manifest;
 try{
  const response=await fetcher(base+'manifest.json',{signal:controller.signal,cache:'no-cache'});
  if(response.status===404)return null;
  if(!response.ok)throw Error('Search metadata HTTP '+response.status);
  manifest=validateSearchManifest(JSON.parse(await readBoundedText(response,2_000_000)));
 }finally{clearTimeout(timer)}
 const cache=new Map();
 return {
  manifest,
  async search(query){
   const key=atlasSearchKey(query),s=key&&manifest.shards[key];if(!s)return [];
   let text=cache.get(key);
   if(text===undefined){
    const ac=new AbortController(),t=setTimeout(()=>ac.abort(),timeout);
    try{
     const r=await fetcher(base+s.path,{signal:ac.signal});if(!r.ok)throw Error('Search shard HTTP '+r.status);
     text=await readBoundedText(r,Math.min(8_000_000,s.bytes+1));
     if(new TextEncoder().encode(text).length!==s.bytes)throw Error('Search shard size mismatch');
     await verifyBoundaryDigest(text,s.sha256);
     cache.set(key,text);if(cache.size>8)cache.delete(cache.keys().next().value);
    }finally{clearTimeout(t)}
   }
   return rankSearchRows(query,text);
  }
 };
}
