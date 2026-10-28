/* Optional self-hosted XYZ vector tile layers. Never equate tile availability with accuracy. */
export const TILE_LAYER_NAMES = Object.freeze(['roads','railways','rivers','settlements','pois','coastlines','lakes']);
export function validateTileManifest(value){
  const a=value;
  if(!a||a.format!=='BharatAtlasMVT1'||a.officiallyVerified!==false)throw new Error('Invalid provisional vector tile catalogue');
  if(!a.licence||!a.attribution||!/^https:\/\//.test(a.sourceUrl||''))throw new Error('Vector tile provenance incomplete');
  if(!Number.isInteger(a.minzoom)||!Number.isInteger(a.maxzoom)||a.minzoom<0||a.maxzoom>12||a.minzoom>a.maxzoom)throw new Error('Invalid vector tile zoom limits');
  if(!Array.isArray(a.layers)||!a.layers.length||a.layers.some(x=>!TILE_LAYER_NAMES.includes(x))||new Set(a.layers).size!==a.layers.length)throw new Error('Invalid vector tile layers');
  if(!Array.isArray(a.bounds)||a.bounds.length!==4||a.bounds.some(v=>!Number.isFinite(v))||a.bounds[0]<-180||a.bounds[1]<-85||a.bounds[2]>180||a.bounds[3]>85||a.bounds[0]>=a.bounds[2]||a.bounds[1]>=a.bounds[3])throw new Error('Invalid tile extent');
  if(!Number.isInteger(a.tileCount)||a.tileCount<1||a.tileCount>25000||Object.keys(a.tileHashes||{}).length!==a.tileCount)throw new Error('Invalid vector tile count');
  const regex=/^(?:[0-9]|1[0-2])\/(?:0|[1-9][0-9]*)\/(?:0|[1-9][0-9]*)\.pbf$/;
  for(const [path,sha] of Object.entries(a.tileHashes)){
    if(!regex.test(path)||!/^[0-9a-f]{64}$/.test(sha))throw new Error('Invalid vector tile file manifest');
    const [z,x,y]=path.split('/').map(Number);
    if(z<a.minzoom||z>a.maxzoom||x>=2**z||y>=2**z)throw new Error('Vector tile out of bounds');
  }
  if(a.tileLayerCounts!==undefined){
    if(!a.tileLayerCounts||typeof a.tileLayerCounts!=='object'||Array.isArray(a.tileLayerCounts)||
       Object.keys(a.tileLayerCounts).length!==a.tileCount)throw Error('Invalid per-tile feature inventory');
    for(const [path,counts] of Object.entries(a.tileLayerCounts)){
      if(!Object.hasOwn(a.tileHashes,path)||!counts||typeof counts!=='object'||Array.isArray(counts)||
         Object.keys(counts).length<1)throw Error('Undeclared/empty tile inventory');
      for(const [layer,number] of Object.entries(counts)){
        if(!a.layers.includes(layer)||!Number.isSafeInteger(number)||number<1||number>50000)
          throw Error('Invalid tile feature count');
      }
    }
  }
  if(a.sourceLayers){
    if(!a.sourceLayers||typeof a.sourceLayers!=='object'||Object.keys(a.sourceLayers).sort().join(',')!==[...a.layers].sort().join(','))throw Error('Tile source-layer registry does not match published layers');
    for(const [layer,source] of Object.entries(a.sourceLayers))
      if(!TILE_LAYER_NAMES.includes(layer)||source?.officiallyVerified!==false||!/^https:\/\//.test(source.sourceUrl||'')||!source.licence||!source.attribution||!(/^[0-9a-f]{64}$/).test(source.sourceSha256||''))throw Error('Invalid layer-specific source rights and provenance');
  }
  return Object.freeze({format:a.format,officiallyVerified:false,licence:a.licence,attribution:a.attribution,sourceUrl:a.sourceUrl,
    minzoom:a.minzoom,maxzoom:a.maxzoom,layers:Object.freeze([...a.layers]),tileCount:a.tileCount,bounds:Object.freeze([...a.bounds]),tileHashes:Object.freeze({...a.tileHashes}),
    sourceLayers:a.sourceLayers?Object.freeze({...a.sourceLayers}):null,
    tileLayerCounts:a.tileLayerCounts?Object.freeze(Object.fromEntries(Object.entries(a.tileLayerCounts).map(([k,v])=>[k,Object.freeze({...v})]))):null});
}
/** Bound manifest memory use *while reading*, not only after response.text(). */
export async function readBoundedTileManifest(response,maxBytes=2_000_000){
  if(Number(response.headers?.get?.('content-length')||0)>maxBytes)
    throw new Error('Tile catalogue exceeds size limit');
  if(typeof response.body?.getReader==='function'){
    const reader=response.body.getReader(),decoder=new TextDecoder();
    let count=0,result='';
    try{
      while(true){
        const {done,value}=await reader.read();if(done)break;
        count+=value.byteLength;
        if(count>maxBytes)throw new Error('Tile catalogue exceeds size limit');
        result+=decoder.decode(value,{stream:true});
      }
      return result+decoder.decode();
    }catch(error){try{await reader.cancel()}catch{}throw error}
    finally{reader.releaseLock()}
  }
  const text=await response.text();
  if(new TextEncoder().encode(text).byteLength>maxBytes)throw new Error('Tile catalogue exceeds size limit');
  return text;
}
export async function loadTileManifest({fetcher=fetch,base='./data/tiles/atlas-tiles.json',timeout=3000}={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const response=await fetcher(base,{cache:'no-store',signal:controller.signal});
    if(response.status===404)return null;
    if(!response.ok)throw new Error('Tile catalogue could not be fetched');
    const payload=await readBoundedTileManifest(response);
    return validateTileManifest(JSON.parse(payload));
  }catch(e){if(e.name==='AbortError'||/failed to fetch|networkerror/i.test(String(e.message)))return null;throw e}
  finally{clearTimeout(timer)}
}
// Sparse XYZ tiles cannot be requested directly from static hosting: missing tiles produce 404s.
// A custom MapLibre protocol explicitly returns an empty vector tile for absent coordinates,
// and verifies SHA-256 for declared tiles. No external tile services are contacted.
export const SPARSE_PROTOCOL='atlas-detail';
export const EMPTY_MVT=new ArrayBuffer(0); // No layers is a valid empty vector-tile payload.
export function tileRequestPath(url){
  const match=String(url).match(/^atlas-detail:\/\/(?:([0-9]|1[0-2])\/(0|[1-9][0-9]*)\/(0|[1-9][0-9]*))\.pbf$/);
  if(!match)throw new Error('Unexpected local vector tile URL');
  const z=Number(match[1]),x=Number(match[2]),y=Number(match[3]);
  if(x>=2**z||y>=2**z)throw new Error('Local vector tile coordinate is out of range');
  return `${z}/${x}/${y}.pbf`;
}
function bytesToHex(bytes){return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}
export function createTileCache({maxBytes=12*1024*1024,maxEntries=128}={}){
 if(!Number.isInteger(maxBytes)||maxBytes<1||maxBytes>64*1024*1024||!Number.isInteger(maxEntries)||maxEntries<1||maxEntries>1024)throw Error('Invalid tile cache budget');
 const values=new Map();let size=0;
 return {
  get(path){if(!values.has(path))return null;const buf=values.get(path);values.delete(path);values.set(path,buf);return buf.slice(0)},
  put(path,data){if(!(data instanceof ArrayBuffer)||data.byteLength>maxBytes)return false;
    if(values.has(path)){size-=values.get(path).byteLength;values.delete(path)}
    values.set(path,data.slice(0));size+=data.byteLength;
    while(size>maxBytes||values.size>maxEntries){const oldest=values.keys().next().value;size-=values.get(oldest).byteLength;values.delete(oldest)}
    return true;
  },
  stats(){return {entries:values.size,bytes:size}},
  clear(){values.clear();size=0}
 };
}
export function sparseTileHandler(catalog,{fetcher=fetch,hasher=null,baseUrl='./data/tiles/',cache=createTileCache()}={}){
  const known=catalog.tileHashes;
  if(!known||typeof known!=='object')throw new Error('Missing tile hash manifest');
  const inflight=new Map();
  const digest=hasher||(async data=>{
    if(!globalThis.crypto?.subtle)throw new Error('Secure browser context required for tile integrity');
    return bytesToHex(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',data)));
  });
  return async (params,abortController)=>{
    const path=tileRequestPath(params.url), signal=abortController?.signal;
    if(signal?.aborted)throw new DOMException('Tile request cancelled','AbortError');
    if(!Object.hasOwn(known,path))return {data:EMPTY_MVT};
    const hit=cache.get(path);if(hit)return {data:hit};
    let task=inflight.get(path);
    if(!task){
      const controller=new AbortController();
      task={controller,readers:0,pending:true,promise:null};
      const current=task;
      task.promise=(async()=>{
        const origin=typeof document==='undefined'?'https://atlas.invalid/':document.baseURI;
        const resolved=new URL(path,new URL(baseUrl,origin));
        const response=await fetcher(resolved.href,{signal:controller.signal,cache:'force-cache'});
        if(!response.ok)throw new Error(`Local tile ${path} failed: HTTP ${response.status}`);
        // Reject known oversized payloads before buffering; post-read byte cap is the final safeguard.
        if(Number(response.headers?.get?.('content-length')||0)>3*1024*1024)
          throw new Error(`Local tile ${path} exceeds size budget`);
        let data;
        if(typeof response.body?.getReader==='function'){
          const reader=response.body.getReader();const parts=[];let total=0;
          try{
            while(true){const {done,value}=await reader.read();if(done)break;
              total+=value.byteLength;
              if(total>3*1024*1024)throw new Error(`Local tile ${path} exceeds size budget`);
              parts.push(value);
            }
          }catch(error){try{await reader.cancel()}catch{}throw error}
          finally{reader.releaseLock()}
          const joined=new Uint8Array(total);let offset=0;
          for(const part of parts){joined.set(part,offset);offset+=part.byteLength;}
          data=joined.buffer;
        }else{
          data=await response.arrayBuffer();
          if(data.byteLength>3*1024*1024)throw new Error(`Local tile ${path} exceeds size budget`);
        }
        if(await digest(data)!==known[path])throw new Error(`Local tile ${path} failed SHA-256 verification`);
        if(!controller.signal.aborted)cache.put(path,data);
        return data;
      })().finally(()=>{
        current.pending=false;
        if(inflight.get(path)===current)inflight.delete(path);
      });
      inflight.set(path,task);
    }
    task.readers++;
    let removeAbort=()=>{};
    const aborted=new Promise((_,reject)=>{
      if(!signal)return;
      const onAbort=()=>reject(new DOMException('Tile request cancelled','AbortError'));
      signal.addEventListener('abort',onAbort,{once:true});
      removeAbort=()=>signal.removeEventListener('abort',onAbort);
      if(signal.aborted)onAbort();
    });
    try{
      const bytes=await Promise.race([task.promise,aborted]);
      return {data:bytes.slice(0)}; // No caller can mutate another reader's copy.
    }finally{
      removeAbort();
      task.readers--;
      // Cancel the physical fetch only when no active map request still needs it.
      if(task.readers===0&&task.pending){
        task.controller.abort();
        if(inflight.get(path)===task)inflight.delete(path);
      }
    }
  };
}
export function registerSparseTileProtocol(maplibregl,catalog,options={}){
  if(typeof maplibregl?.addProtocol!=='function')throw new Error('MapLibre custom protocol API unavailable');
  maplibregl.addProtocol(SPARSE_PROTOCOL,sparseTileHandler(catalog,options));
}
export function tileSourceSpec(catalog){
  return {type:'vector',tiles:[SPARSE_PROTOCOL+'://{z}/{x}/{y}.pbf'],scheme:'xyz',
    minzoom:catalog.minzoom,maxzoom:catalog.maxzoom,bounds:catalog.bounds,
    attribution:catalog.attribution};
}
export function localDetailLayers(catalog){
  if(!catalog)return [];
  const present=name=>catalog.layers.includes(name);
  return [
    ...(present('coastlines')?[{id:'local-coastlines',type:'line',source:'local-detail','source-layer':'coastlines',minzoom:catalog.minzoom,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#347d76','line-width':['interpolate',['linear'],['zoom'],3,0.85,8,1.7],'line-opacity':0.92}}]:[]),
    ...(present('lakes')?[{id:'local-lakes',type:'line',source:'local-detail','source-layer':'lakes',minzoom:catalog.minzoom,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#539fc4','line-width':['interpolate',['linear'],['zoom'],3,0.75,8,1.35],'line-opacity':0.83}}]:[]),
    ...(present('rivers')?[{id:'local-rivers',type:'line',source:'local-detail', 'source-layer':'rivers',minzoom:catalog.minzoom,
      layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#5a9abb','line-width':['interpolate',['linear'],['zoom'],5,0.7,11,2.5],'line-opacity':0.8}}]:[]),
    ...(present('railways')?[{id:'local-railways',type:'line',source:'local-detail','source-layer':'railways',minzoom:Math.max(5,catalog.minzoom),
      paint:{'line-color':'#66676c','line-width':['interpolate',['linear'],['zoom'],5,0.6,12,2],'line-dasharray':[2,2],'line-opacity':0.8}}]:[]),
    ...(present('roads')?[{id:'local-roads',type:'line',source:'local-detail','source-layer':'roads',minzoom:catalog.minzoom,
      layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#f5f1e7','line-width':['interpolate',['linear'],['zoom'],5,0.9,12,5],'line-opacity':0.94}},
      {id:'local-roads-centerline',type:'line',source:'local-detail','source-layer':'roads',minzoom:catalog.minzoom,
      paint:{'line-color':'#bd9e83','line-width':['interpolate',['linear'],['zoom'],5,0.35,12,1.2]}}]:[]),
    ...(present('settlements')?[{id:'local-settlements',type:'circle',source:'local-detail','source-layer':'settlements',minzoom:catalog.minzoom,
      paint:{'circle-radius':['interpolate',['linear'],['zoom'],5,2,12,4.5],'circle-color':'#315e5b','circle-stroke-width':1.1,'circle-stroke-color':'white'}},
      {id:'local-settlements-labels',type:'symbol',source:'local-detail','source-layer':'settlements',minzoom:Math.max(6,catalog.minzoom),
      layout:{'text-field':['get','name'],'text-font':['sans-serif'],'text-size':['interpolate',['linear'],['zoom'],6,10,13,15],
        'text-anchor':'top','text-offset':[0,0.65],'text-allow-overlap':false},
      paint:{'text-color':'#385052','text-halo-color':'#fff','text-halo-width':1}}]:[])
  ];
}
