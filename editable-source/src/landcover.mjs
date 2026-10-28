/* GSHHG historical land mask. NEVER an administrative or territorial authority. */
export const LAND_MAX_BYTES=400000;
const landHex=buf=>[...new Uint8Array(buf)].map(v=>v.toString(16).padStart(2,'0')).join('');
export function validateLandManifest(m){
 if(m?.format!=='BharatAtlasLandcover1'||m.officiallyVerified!==false||m.administrativeBoundaries!==false||m.licence!=='LGPL-3.0-or-later'||!/^https:\/\//.test(m.sourceUrl||'')||!m.attribution||!Array.isArray(m.extent)||m.extent.join(',')!=='68,6,99,38'||!Number.isInteger(m.featureCount)||m.featureCount<1||m.featureCount>200||!Number.isInteger(m.bytes)||m.bytes<1||m.bytes>LAND_MAX_BYTES||!/^[0-9a-f]{64}$/.test(m.sha256))throw Error('Invalid physical land source metadata');
 return m;
}
export function validateLandFeatures(fc){
 if(fc?.type!=='FeatureCollection'||!Array.isArray(fc.features)||fc.features.length<1||fc.features.length>200)throw Error('Invalid land mask collection');
 let vertices=0;
 for(const f of fc.features){
  if(f.type!=='Feature'||f.geometry?.type!=='Polygon'||!Array.isArray(f.geometry.coordinates)||!f.geometry.coordinates.length||f.properties?.name!=='Unlabelled generalized land')throw Error('Invalid land mask feature');
  for(const ring of f.geometry.coordinates){
   if(!Array.isArray(ring)||ring.length<4)throw Error('Invalid land polygon ring');
   vertices+=ring.length;if(vertices>30000)throw Error('Land mask complexity exceeded');
   for(const p of ring)if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<68||p[0]>99||p[1]<6||p[1]>38)throw Error('Land mask outside study bounds');
   if(ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])throw Error('Unclosed land polygon');
  }
 }
 return fc;
}
export async function loadLandcover({fetcher=fetch,base='./data/landcover/',hasher=null}={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4500);
 try{
  const response=await fetcher(base+'manifest.json',{signal:controller.signal});
  if(response.status===404)return null;if(!response.ok)throw Error('Land mask manifest unavailable');
  const metadata=validateLandManifest(await response.json());
  const data=await fetcher(base+'land.geojson',{signal:controller.signal});
  if(!data.ok||Number(data.headers?.get?.('content-length')||0)>LAND_MAX_BYTES)throw Error('Land geometry unavailable or oversized');
  const bytes=await data.arrayBuffer();if(bytes.byteLength!==metadata.bytes||bytes.byteLength>LAND_MAX_BYTES)throw Error('Land geometry byte count mismatch');
  const digest=hasher?await hasher(bytes):globalThis.crypto?.subtle?landHex(await globalThis.crypto.subtle.digest('SHA-256',bytes)):null;
  if(digest!==metadata.sha256)throw Error('Land mask SHA-256 mismatch');
  const fc=validateLandFeatures(JSON.parse(new TextDecoder().decode(bytes)));
  if(fc.features.length!==metadata.featureCount)throw Error('Land mask feature count mismatch');
  return {fc,metadata};
 }catch(e){if(e.name==='AbortError'||/Failed to fetch|NetworkError/i.test(String(e.message)))return null;throw e}
 finally{clearTimeout(timer)}
}
