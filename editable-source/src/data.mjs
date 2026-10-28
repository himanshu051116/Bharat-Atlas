import {validateCollection,inspectCollection} from './geography.mjs';
export const COMMUNITY_COMMIT='2c829a3543171810a4b28162ea736fb76dfdef40';
const PINNED=`https://cdn.jsdelivr.net/gh/Vardhan-Systems/vardhan-maps@${COMMUNITY_COMMIT}/src/data/generated/states.low.json`;
const RAW=`https://raw.githubusercontent.com/Vardhan-Systems/vardhan-maps/${COMMUNITY_COMMIT}/src/data/generated/states.low.json`;
export const COMMUNITY_SOURCE={kind:'community',title:'Community research data',url:'https://github.com/Vardhan-Systems/vardhan-maps',licence:'ODbL 1.0',attribution:'© OpenStreetMap contributors',verified:false};
export function importedSource(filename){return {kind:'import',title:filename,licence:'Unknown — check your data rights',attribution:'User-provided file',verified:false,url:null}}
export async function verifyBoundaryDigest(text,expected,hasher=globalThis.crypto?.subtle){
  if(!/^[0-9a-f]{64}$/.test(String(expected||'')))throw new Error('Invalid geographic checksum metadata');
  if(!hasher?.digest)throw new Error('Secure context required for geographic integrity verification');
  const bytes=new TextEncoder().encode(text);
  const hash=new Uint8Array(await hasher.digest('SHA-256',bytes));
  const actual=Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('');
  if(actual!==expected)throw new Error('Local geographic integrity check failed');
  return true;
}
export async function readBoundedText(response,maxBytes=4_000_000){
  if(Number(response.headers?.get?.('content-length')||0)>maxBytes)throw new Error('Boundary file exceeds size limit');
  if(typeof response.body?.getReader==='function'){
    const reader=response.body.getReader();const decoder=new TextDecoder();let bytes=0,result='';
    try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;
      if(bytes>maxBytes)throw new Error('Boundary file exceeds size limit');result+=decoder.decode(value,{stream:true})}
      return result+decoder.decode();
    }catch(e){try{await reader.cancel()}catch{}throw e}finally{reader.releaseLock()}
  }
  const text=await response.text();if(new TextEncoder().encode(text).byteLength>maxBytes)throw new Error('Boundary file exceeds size limit');return text;
}
export async function readJSON(url,{signal,timeout=9000,expectedSha256=null}={}){
  const ac=new AbortController();const abort=()=>ac.abort();if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,timeout);
  try{
    const response=await fetch(url,{signal:ac.signal,cache:'no-cache'});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const text=await readBoundedText(response);
    if(expectedSha256)await verifyBoundaryDigest(text,expectedSha256);
    return JSON.parse(text);
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
}
export async function loadCommunity({signal,allowRemoteFallback=true}={}){
  let last,bundledFound=false;
  // A bundled file requires separate, explicit provenance. Never silently assign ODbL to a different import.
  try{
    const provenance=await readJSON('./data/preview-provenance.json',{signal,timeout:2500});
    bundledFound=true;
    if(provenance.officiallyVerified!==false||!provenance.licence||!provenance.attribution||!provenance.sourceUrl?.startsWith('https://')||!(/^[0-9a-f]{64}$/).test(provenance.sha256||''))throw new Error('Bundled source lacks valid provisional provenance or SHA-256');
    const json=await readJSON('./data/states.provisional.geojson',{signal,timeout:3500,expectedSha256:provenance.sha256});
    const fc=validateCollection(json,{requireComplete:true});
    return {fc,audit:inspectCollection(fc),source:{kind:'licensed-preview',title:'Self-hosted provisional data',url:provenance.sourceUrl,licence:provenance.licence,attribution:provenance.attribution,verified:false,loadedFrom:'./data/states.provisional.geojson'}};
  }catch(e){last=e;if(signal?.aborted)throw e;
    // A present-but-invalid local archive is a security failure; do not silently replace it
    // with unrelated remote geometry, which could mislead the user about provenance.
    if(bundledFound || !/HTTP 404|failed to fetch|networkerror|abort/i.test(String(e.message)))throw e;
  }
  // In India official-claims mode do not silently fetch provisional remote borders.
  if(!allowRemoteFallback)throw new Error('No reviewed Indian political polygons loaded; use the source-backed official outline where available.');
  for(const url of [PINNED,RAW]){
    if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
    try{const json=await readJSON(url,{signal});const fc=validateCollection(json,{requireComplete:true});return {fc,audit:inspectCollection(fc),source:{...COMMUNITY_SOURCE,loadedFrom:url}}}catch(e){last=e;if(signal?.aborted)throw e}
  }
  throw new Error(`Boundary data unavailable. Import your own GeoJSON or try again. (${last?.message||'Network error'})`);
}
