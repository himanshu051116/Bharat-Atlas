/* Historical, generalized GSHHG physical shore outlines with cryptographic source checks.
 * These do NOT show sovereign boundaries, treaty lines, navigation coast surveys or
 * official, contemporary lake outlines. Optional and never blocks political viewer.
 */
export const SHORE_MAX_BYTES=350000;
const shoreHex=b=>[...new Uint8Array(b)].map(v=>v.toString(16).padStart(2,'0')).join('');
export function validateShoreManifest(m){
  if(m?.format!=='BharatAtlasShorelines1'||m.officiallyVerified!==false||m.namesVerified!==false||m.licence!=='LGPL-3.0-or-later'||!/^https:\/\//.test(m.sourceUrl||'')||!m.attribution||
     !Array.isArray(m.extent)||m.extent.join(',')!=='68,6,99,38')throw Error('Invalid GSHHG shore source record');
  for(const layer of ['coastlines','lakes']){
    const a=m.layers?.[layer];
    if(!a||!Number.isInteger(a.count)||a.count<1||a.count>300||!Number.isInteger(a.bytes)||a.bytes<1||a.bytes>SHORE_MAX_BYTES||!/^[0-9a-f]{64}$/.test(a.sha256))throw Error('Invalid physical shoreline layer declaration');
  }
  return m;
}
export function validateShoreFeatures(fc,layer){
  if(fc?.type!=='FeatureCollection'||!Array.isArray(fc.features)||!fc.features.length||fc.features.length>300)throw Error('Invalid shoreline feature collection');
  let vertices=0;
  for(const f of fc.features){
    if(f.type!=='Feature'||f.geometry?.type!=='LineString'||!Array.isArray(f.geometry.coordinates)||f.geometry.coordinates.length<2)throw Error('Invalid shoreline geometry');
    vertices+=f.geometry.coordinates.length;
    if(vertices>20000)throw Error('Shoreline vertex budget exceeded');
    for(const p of f.geometry.coordinates){
      if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<68||p[0]>99||p[1]<6||p[1]>38)throw Error('Shoreline point outside study bounds');
    }
    if(typeof f.properties?.name!=='string'||!f.properties.name.includes('Unlabelled'))throw Error('Shoreline source must not invent a place name');
  }
  if(!['coastlines','lakes'].includes(layer))throw Error('Unknown shore type');
  return fc;
}
export async function loadShorelines({fetcher=fetch,base='./data/shorelines/',hasher=null}={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4500);
 try{
  const response=await fetcher(base+'manifest.json',{signal:controller.signal});
  if(response.status===404)return null;
  if(!response.ok)throw Error('Physical shoreline manifest request failed');
  const info=validateShoreManifest(await response.json());
  const out={metadata:info};
  for(const layer of ['coastlines','lakes']){
   const reply=await fetcher(base+layer+'.geojson',{signal:controller.signal});
   if(!reply.ok||Number(reply.headers?.get?.('content-length')||0)>SHORE_MAX_BYTES)throw Error('Physical shoreline source unavailable or oversized');
   const bytes=await reply.arrayBuffer(),meta=info.layers[layer];
   if(bytes.byteLength!==meta.bytes||bytes.byteLength>SHORE_MAX_BYTES)throw Error('Shoreline byte count incorrect');
   const digest=hasher?await hasher(bytes):globalThis.crypto?.subtle?shoreHex(await globalThis.crypto.subtle.digest('SHA-256',bytes)):null;
   if(digest!==meta.sha256)throw Error('Physical shoreline SHA-256 mismatch');
   const fc=validateShoreFeatures(JSON.parse(new TextDecoder().decode(bytes)),layer);
   if(fc.features.length!==meta.count)throw Error('Physical shoreline feature count mismatch');
   out[layer]=fc;
  }
  return out;
 }catch(e){if(e.name==='AbortError'||/Failed to fetch|NetworkError/i.test(String(e.message)))return null;throw e}
 finally{clearTimeout(timer)}
}
