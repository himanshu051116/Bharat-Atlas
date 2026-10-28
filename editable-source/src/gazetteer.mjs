/* Optional, source-labelled geographic point catalogue. Never used as a legal boundary source. */
import {verifyBoundaryDigest,readBoundedText} from './data.mjs';
import {REGIONS,canonical} from './geography.mjs';
export const GAZETTEER_FORMAT='BharatAtlasGazetteer1';
export const GAZETTEER_TYPES=Object.freeze(['city','town','village','landmark','station']);
const validRegions=new Set(REGIONS);
const safeLabel=s=>typeof s==='string' && s.length>0 && s.length<=120 && s.trim()===s && !/[\x00-\x1f\x7f]/.test(s);
export function validateGazetteer(fc,{maxEntries=10000}={}){
  if(fc?.type!=='FeatureCollection'||!Array.isArray(fc.features)||fc.features.length<1||fc.features.length>maxEntries)
    throw Error(`Place catalogue must contain 1–${maxEntries} points`);
  const seen=new Set();
  const places=fc.features.map((f,i)=>{
    const props=f?.properties||{},coordinate=f?.geometry?.coordinates;
    const id=props.id,name=props.name,region=canonical(props.region),kind=props.kind;
    if(f?.type!=='Feature'||f?.geometry?.type!=='Point'||!Array.isArray(coordinate)||coordinate.length!==2)
      throw Error(`Place ${i+1}: WGS84 Point required`);
    const [lon,lat]=coordinate;
    if(!Number.isFinite(lon)||!Number.isFinite(lat)||lon<60||lon>102||lat<3||lat>41)
      throw Error(`Place ${i+1}: coordinates outside Indian atlas study envelope`);
    if(!safeLabel(id)||!/^[a-zA-Z0-9_-]{1,70}$/.test(id)||seen.has(id))throw Error(`Place ${i+1}: missing or duplicate ID`);
    if(!safeLabel(name)||!validRegions.has(region)||!GAZETTEER_TYPES.includes(kind))throw Error(`Place ${i+1}: bad name, region or category`);
    const aliases=props.aliases??[];
    if(!Array.isArray(aliases)||aliases.length>6||aliases.some(a=>!safeLabel(a)))throw Error(`Place ${i+1}: invalid alternate names`);
    seen.add(id);
    return Object.freeze({id,name,region,kind,aliases:Object.freeze([...aliases]),lon,lat,source:'gazetteer'});
  });
  return Object.freeze(places);
}
export function validateGazetteerManifest(manifest){
  if(manifest?.format!==GAZETTEER_FORMAT||manifest.officiallyVerified!==false||
    !Number.isInteger(manifest.count)||manifest.count<1||manifest.count>10000||
    !/^[a-f0-9]{64}$/.test(manifest.sha256||'')||
    !/^https:\/\//.test(manifest.sourceUrl||'')||!safeLabel(manifest.licence)||!safeLabel(manifest.attribution))
    throw Error('Invalid optional place-catalogue provenance');
  return Object.freeze({format:GAZETTEER_FORMAT,count:manifest.count,sha256:manifest.sha256,
    sourceUrl:manifest.sourceUrl,licence:manifest.licence,attribution:manifest.attribution,officiallyVerified:false});
}
export function gazetteerFeatures(places){return {type:'FeatureCollection',features:places.map(p=>({type:'Feature',properties:{id:p.id,name:p.name,region:p.region,kind:p.kind},geometry:{type:'Point',coordinates:[p.lon,p.lat]}}))};}
export async function loadGazetteer({fetcher=fetch,base='./data/gazetteer/',timeout=3500}={}){
  // Abort together across manifest and data; success does not imply geographic authority.
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const response=await fetcher(base+'manifest.json',{signal:controller.signal,cache:'no-cache'});
    if(response.status===404)return null;
    if(!response.ok)throw Error(`Place provenance HTTP ${response.status}`);
    const mtext=await readBoundedText(response,16000);
    const metadata=validateGazetteerManifest(JSON.parse(mtext));
    const geores=await fetcher(base+'places.geojson',{signal:controller.signal,cache:'no-cache'});
    if(!geores.ok)throw Error(`Place data HTTP ${geores.status}`);
    const text=await readBoundedText(geores,4_000_000);
    await verifyBoundaryDigest(text,metadata.sha256);
    const places=validateGazetteer(JSON.parse(text));
    if(places.length!==metadata.count)throw Error('Place catalogue count does not match provenance');
    return {places,metadata};
  }finally{clearTimeout(timer)}
}
