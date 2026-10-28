import {cpSync,existsSync,mkdirSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,join,relative} from 'node:path';
const input=resolve('public-site'),output=resolve('dist');
if(!existsSync(join(input,'index.html')))throw Error('Public release directory missing');
const manifest=JSON.parse(readFileSync(join(input,'build-manifest.json'),'utf8'));
if(manifest.previewOnly!==true||manifest.officialGeometryVerified!==false||manifest.verifiedAdminPolygonsBundled!==false)throw Error('Public research release safety flags invalid');
if(manifest.assets.length<780)throw Error('Incomplete baseline asset manifest');
const amended=new Set(['index.html','app.bundle.js','styles.css','world.js','world.html','offline-shell.js']);
const expected=new Set(manifest.assets.map(x=>x.path));
const sha=buf=>createHash('sha256').update(buf).digest('hex');
for(const entry of manifest.assets){
 const name=entry.path;
 if(name.startsWith('/')||name.includes('..')||name.includes('\\')||/official-india\/|india-claim\.geojson/i.test(name))throw Error('Unsafe or unapproved asset: '+name);
 const path=resolve(input,name);
 if(!path.startsWith(input+'/'))throw Error('Unsafe source path: '+name);
 const data=readFileSync(path);
 if(!amended.has(name)&&(data.length!==entry.bytes||sha(data)!==entry.sha256))throw Error('Unmodified geographic asset fails SHA-256: '+name);
}
function list(dir,rel=''){
 let items=[];
 for(const item of readdirSync(dir,{withFileTypes:true})){
  const path=rel?rel+'/'+item.name:item.name;
  if(item.isSymbolicLink())throw Error('Symlink not permitted in release');
  if(item.isDirectory())items.push(...list(join(dir,item.name),path));
  else if(item.isFile()&&path!=='build-manifest.json')items.push(path);
 }
 return items;
}
const names=list(input).sort();
for(const name of names)if(!expected.has(name)&&name!=='physical-preview.svg')throw Error('Unexpected additional release file: '+name);
if(!names.includes('physical-preview.svg'))throw Error('Missing always-visible physical map');
const library=resolve('node_modules/maplibre-gl/dist');
for(const file of ['maplibre-gl.js','maplibre-gl.css'])if(!existsSync(join(library,file)))throw Error('Pinned MapLibre distribution missing: '+file);
rmSync(output,{recursive:true,force:true});mkdirSync(output,{recursive:true});cpSync(input,output,{recursive:true});
mkdirSync(join(output,'vendor'),{recursive:true});
for(const file of ['maplibre-gl.js','maplibre-gl.css'])cpSync(join(library,file),join(output,'vendor',file));
manifest.assets=names.map(name=>{const bytes=readFileSync(join(output,name));return {path:name,bytes:bytes.length,sha256:sha(bytes)}});
manifest.version='1.11.1';manifest.externalMapLibreDependency=false;
manifest.releaseMode='PUBLIC PHYSICAL RESEARCH PREVIEW — NO CERTIFIED POLITICAL BOUNDARIES';
manifest.politicalBoundarySource='Not bundled: reference the Survey of India 2026 political map';
writeFileSync(join(output,'build-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Bharat Atlas v1.11.1 verified '+manifest.assets.length+' public-site assets + self-hosted MapLibre');
