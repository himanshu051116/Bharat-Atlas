/* Browser-local official Survey of India shapefile archive importer.
 * The original data remains on the user's device. No geodata is bundled,
 * uploaded to a server or placed into the repository.
 */
import shp from 'shpjs';
import {zipSync} from 'fflate';
import {createExtractorFromData} from 'node-unrar-js/esm/index.esm.js';

const ZIP_LIMIT=100*1024*1024;
const RAR_LIMIT=250*1024*1024;
const OFFICIAL_ABDB_HASH='b8325e5d9dd0f04a6663d775363fe38cd2f23bd9dbae3fb7118b4e6e0ce0bcb7';
const OFFICIAL_OUTLINE_HASH='bf48477f01fe8addd6384490fc6f8decc9643110331ffef2c3f17e5cccd53b88';
const statePath=path=>/State Boundary[\\/]+State Boundary\.(?:shp|shx|dbf|prj|cpg)$/i.test(path);
const outputName=path=>String(path).split(/[\\/]/).at(-1);
const report=text=>postMessage({type:'progress',text});
const sha256=async buffer=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join('');
function ensureFeatureCollection(layer){
 const input=Array.isArray(layer)?layer.find(f=>(f.fileName||'').toLowerCase().includes('state boundary'))||layer[0]:layer;
 if(input?.type!=='FeatureCollection'||!Array.isArray(input.features)||!input.features.length)throw Error('No valid Shapefile polygon layer found');
 return input;
}
function validateAndClassify(fc,file){
 if(fc.features.length>90)throw Error('Too many features for a national or state boundary layer; select the State Boundary Shapefile instead of district data');
 let n=0,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 const walk=c=>{
  if(typeof c?.[0]==='number'){
   const [lon,lat]=c;
   if(!Number.isFinite(lon)||!Number.isFinite(lat)||lon<59||lon>103||lat<1||lat>42)throw Error('Invalid longitude/latitude; check that the original SoI .prj was included');
   minX=Math.min(minX,lon);minY=Math.min(minY,lat);maxX=Math.max(maxX,lon);maxY=Math.max(maxY,lat);
   if(++n>1800000)throw Error('Too many vertices; simplify the source with a local GIS tool before importing');
   return;
  }
  if(!Array.isArray(c))throw Error('Malformed polygon ring');
  for(const child of c)walk(child);
 };
 for(const f of fc.features){
  if(!f.geometry||!['Polygon','MultiPolygon'].includes(f.geometry.type))throw Error('Polygon/MultiPolygon geometry required');
  walk(f.geometry.coordinates);
 }
 if(minX>69||maxX<91||minY>9||maxY<32)throw Error('The data does not cover the expected Indian subcontinent; please select the official nationwide product');
 const country=fc.features.length===1&&(String(fc.features[0].properties?.Country||'').toLowerCase()==='india'||/outline/i.test(file.name));
 const type=country?'outline':'states';
 if(type==='states'&&(fc.features.length<28||fc.features.length>65))throw Error('Expected nationwide State/UT boundaries; the archive contains '+fc.features.length+' polygons');
 return {type,features:fc.features.length,vertices:n,bounds:[minX,minY,maxX,maxY]};
}
async function fromRAR(buffer){
 report('Reading the local 2026 Survey of India RAR archive…');
 const wasm=await(await fetch(new URL('./unrar.wasm',import.meta.url),{cache:'force-cache'})).arrayBuffer();
 const extractor=await createExtractorFromData({data:buffer,wasmBinary:wasm});
 const files=[...extractor.getFileList().fileHeaders].filter(h=>statePath(h.name)&&!h.flags?.directory);
 const names=files.map(h=>h.name);
 if(!['.shp','.shx','.dbf','.prj'].every(ext=>names.some(n=>n.toLowerCase().endsWith(ext))))throw Error('The official State Boundary .shp/.shx/.dbf/.prj set was not found inside this RAR');
 if(files.some(f=>f.flags?.encrypted||f.unpSize>80*1024*1024))throw Error('Encrypted or oversized State Boundary member');
 report('Extracting just the state layer locally (districts and subdistricts are skipped)…');
 const extracted=[...extractor.extract({files:names}).files];
 const layer={};
 for(const member of extracted){
  const name=outputName(member.fileHeader.name);
  if(member.extraction)layer[name]=new Uint8Array(member.extraction);
 }
 if(!['.shp','.shx','.dbf','.prj'].every(ext=>Object.keys(layer).some(n=>n.toLowerCase().endsWith(ext))))throw Error('State Boundary extraction incomplete');
 // shapefile.js converts the original Lambert Conformal Conic .prj to WGS84.
 const zipped=zipSync(layer,{level:1});
 report('Reprojecting official shapefile coordinates to WGS84…');
 return ensureFeatureCollection(await shp(zipped));
}
async function fromZIP(buffer){
 report('Reading the selected official ZIP archive…');
 return ensureFeatureCollection(await shp(buffer));
}
self.onmessage=async event=>{
 const {file}=event.data||{};
 try{
  if(!file||!(file instanceof Blob))throw Error('Choose a local Survey of India .rar or .zip archive');
  const isRAR=/\.rar$/i.test(file.name),isZIP=/\.zip$/i.test(file.name);
  if(!isRAR&&!isZIP)throw Error('Only original .rar or .zip Shapefile archives are supported');
  if(file.size>(isRAR?RAR_LIMIT:ZIP_LIMIT))throw Error('Archive exceeds the browser import limit');
  // Reject wrong/altered files before invoking costly decompression or geometry parsers.
  // Digest identity is not proof of independent cartographic correctness.
  const expectedHash=isRAR?OFFICIAL_ABDB_HASH:OFFICIAL_OUTLINE_HASH;
  const expectedBytes=isRAR?202524438:7513409;
  if(file.size!==expectedBytes)throw Error('This archive does not match the pinned Survey of India release size. Re-download the original file.');
  report('Checking full-file SHA-256 before decompression ('+(file.size/1048576).toFixed(1)+' MB, on this device)…');
  const buffer=await file.arrayBuffer();
  const digest=await sha256(buffer);
  if(digest!==expectedHash)throw Error('The selected archive differs from the pinned Survey of India release. No untrusted geometry has been parsed.');
  report('Archive identity matches the pinned reference. Extracting and checking geography locally…');
  const fc=isRAR?await fromRAR(buffer):await fromZIP(buffer);
  const result=validateAndClassify(fc,file);
  if(isRAR&&result.type!=='states')throw Error('Official ABDB archive did not contain the expected state boundaries');
  if(isZIP&&result.type!=='outline')throw Error('The selected national outline archive has unexpected contents');
  postMessage({type:'success',data:fc,details:{...result,hash:digest,sourceName:file.name,verifiedOfficial:true,sourceDate:isRAR?'May 2026':'February 2026'}});
 }catch(error){postMessage({type:'error',message:String(error?.message||error).slice(0,350)});}
};
