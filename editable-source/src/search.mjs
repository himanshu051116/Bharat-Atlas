import {PILOT_PLACES} from './places.mjs';
/* Deterministic and small pilot search, not a commercial geocoder. */
export const normalizeQuery = value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu,' ').trim();
export function fuzzyDistance(a,b,limit=2){
  if(Math.abs(a.length-b.length)>limit)return limit+1;
  let prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    const curr=[i];let best=i;
    for(let j=1;j<=b.length;j++){
      const d=Math.min(curr[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
      curr[j]=d;best=Math.min(best,d);
    }
    if(best>limit)return limit+1;
    prev=curr;
  }
  return prev[b.length];
}
export function searchAtlas(query,regions,places=PILOT_PLACES,{includePlaces=true,filter='all',limit=50}={}){
  const q=normalizeQuery(query);const entries=[];
  for(const f of regions??[]){if(filter!=='all'&&f.properties.kind!==filter)continue;
    entries.push({kind:'region',name:f.properties.name,subtitle:f.properties.kind,entry:f,terms:[f.properties.name]});}
  if(includePlaces&&filter==='all'&&q)for(const p of places){const suffix=p.source==='gazetteer'?`${p.kind} · ${p.region} (research label) · source-backed point`:`Pilot city · ${p.region}`;entries.push({kind:'place',name:p.name,subtitle:suffix,entry:p,terms:[p.name,...(p.aliases||[])]});}
  if(!q)return entries.filter(x=>x.kind==='region').slice(0,limit);
  const direct=entries.map(x=>{
    let rank=Infinity;
    for(const t of x.terms){const n=normalizeQuery(t);
      if(n===q)rank=Math.min(rank,0);
      else if(n.startsWith(q))rank=Math.min(rank,1);
      else if(n.includes(q))rank=Math.min(rank,2);

    }
    return {...x,rank};
  }).filter(x=>x.rank!==Infinity);
  // Fuzzy distances are expensive on a 10,000-place catalogue. Only compute them
  // when direct exact/prefix/substring results cannot fill the first result page.
  if(q.length>=4 && direct.length<Math.min(limit,10)){
    const found=new Set(direct.map(x=>x.entry));
    for(const x of entries){
      if(found.has(x.entry))continue;
      if(x.terms.some(t=>{const n=normalizeQuery(t);return n[0]===q[0]&&Math.abs(n.length-q.length)<=2&&fuzzyDistance(n,q,2)<=2})){
        direct.push({...x,rank:3});
      }
    }
  }
  return direct.sort((a,b)=>a.rank-b.rank||Number(a.kind==='place')-Number(b.kind==='place')||a.name.localeCompare(b.name)).slice(0,limit);
}
