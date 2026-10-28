/* Source-labelled, hash-verified historical hydrology for the accessible SVG mode.
 * The same derived WDBII segments are also available as static MVT tiles.
 * Geographic accuracy is NOT verified by Survey of India.
 */
export const HYDRO_LIMIT_BYTES=900000;
const expectedFields=['format','licence','attribution','sourceUrl','sha256','featureCount'];
export function validateHydrology(fc,{maxFeatures=2400,maxVertices=35000}={}){
  if(fc?.type!=='FeatureCollection'||!Array.isArray(fc.features)||fc.features.length<1||fc.features.length>maxFeatures)throw Error('Invalid river collection');
  let vertices=0;
  for(const f of fc.features){
    const c=f.geometry?.coordinates;
    if(f.type!=='Feature'||f.geometry?.type!=='LineString'||!Array.isArray(c)||c.length<2)throw Error('River geometry must contain a line');
    vertices+=c.length;if(vertices>maxVertices)throw Error('River dataset exceeds complexity budget');
    for(const xy of c)if(!Array.isArray(xy)||xy.length!==2||!xy.every(Number.isFinite)||xy[0]<68||xy[0]>99||xy[1]<6||xy[1]>38)throw Error('River coordinate outside declared study area');
  }
  return fc;
}
export function validateHydrologyManifest(m){
  if(!m||m.format!=='BharatAtlasHydrology1'||m.officiallyVerified!==false||m.riverNamesVerified!==false||m.featureCount<1||m.featureCount>2400||
  !expectedFields.every(k=>Object.hasOwn(m,k))||m.licence!=='LGPL-3.0-or-later'||!/^https:\/\//.test(m.sourceUrl)||!/^[0-9a-f]{64}$/.test(m.sha256)||!m.attribution)
    throw Error('Incomplete historical river source/rights record');
  return m;
}
const hex=b=>[...new Uint8Array(b)].map(v=>v.toString(16).padStart(2,'0')).join('');
export async function loadHydrology({fetcher=fetch,base='./data/hydrography/',hasher=null}={}){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),4500);
  try{
    const metaResponse=await fetcher(base+'manifest.json',{signal:controller.signal});
    if(metaResponse.status===404)return null;
    if(!metaResponse.ok)throw Error('Historic river metadata request failed');
    const info=validateHydrologyManifest(await metaResponse.json());
    const response=await fetcher(base+'rivers.geojson',{signal:controller.signal});
    if(!response.ok)throw Error('Historic river data request failed');
    if(Number(response.headers?.get?.('content-length')||0)>HYDRO_LIMIT_BYTES)throw Error('Historic river dataset too large');
    const bytes=await response.arrayBuffer();
    if(bytes.byteLength>HYDRO_LIMIT_BYTES)throw Error('Historic river dataset too large');
    const calc=hasher?await hasher(bytes):globalThis.crypto?.subtle?hex(await globalThis.crypto.subtle.digest('SHA-256',bytes)):null;
    if(!calc||calc!==info.sha256)throw Error('Historic river SHA-256 integrity check failed');
    const fc=validateHydrology(JSON.parse(new TextDecoder().decode(bytes)));
    if(fc.features.length!==info.featureCount)throw Error('Historic river feature count mismatch');
    return {fc,metadata:info};
  }catch(e){if(e.name==='AbortError'||/Failed to fetch|NetworkError/i.test(String(e.message)))return null;throw e}
  finally{clearTimeout(timer)}
}
