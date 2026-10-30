/* Strict unmocked browser proof: the real MapLibre JS and WebGL2 are mandatory.
 * No CSS canvas substitute, no mock constructor, no simulated raster drawing.
 * The map uses actual, SHA-verified local MVT PBF files and local land GeoJSON.
 */
import {validateTileManifest, sparseTileHandler, tileSourceSpec} from '../src/tiles.mjs';
const results={status:'initializing',maplibreVersion:null,webgl2:false,renderer:null,origin:location.origin,realTileRequests:0,verifiedTileBytes:0,vectorRenderedFeatures:0,renderedSettlements:0,glPixelsVerified:false,styleLoaded:false,navigationRoundTrip:false,errors:[],source:'GSHHG/WDBII 2.3.6, LGPL-3.0-or-later',officialBoundaryVerified:false};
window.__atlasRealRendererProof=results;
function fail(e){results.status='failed';results.errors.push(String(e?.stack||e));document.getElementById('status').textContent='REAL RENDERER FAILURE: '+String(e?.message||e);}
function requireHTTPS(){if(!globalThis.crypto?.subtle)throw Error('Secure origin required for SHA-256; use localhost or HTTPS')}
async function main(){
 requireHTTPS();
 if(!window.maplibregl||typeof window.maplibregl.Map!=='function')throw Error('The locally bundled MapLibre runtime is absent');
 results.maplibreVersion=maplibregl.version||'unknown';
 if(results.maplibreVersion!=='5.13.0')throw Error('Authentic pinned MapLibre 5.13.0 required, observed '+results.maplibreVersion);
 const canvas=document.createElement('canvas');const gl=canvas.getContext('webgl2');
 if(!gl)throw Error('WebGL2 context unavailable on this browser/device');
 results.webgl2=true;
 const dbg=gl.getExtension('WEBGL_debug_renderer_info');
 results.renderer=dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
 if(typeof maplibregl.supported==='function'&&!maplibregl.supported())throw Error('MapLibre reports WebGL unsupported');
 const resp=await fetch('../data/tiles/atlas-tiles.json',{cache:'no-store'});
 if(!resp.ok)throw Error('Cannot load local tile catalogue: '+resp.status);
 const catalog=validateTileManifest(await resp.json());
 const landResponse=await fetch('../data/landcover/land.geojson',{cache:'no-store'});
 if(!landResponse.ok)throw Error('Cannot load local physical land: '+landResponse.status);
 const land=await landResponse.json();
 if(land.type!=='FeatureCollection'||land.features.length===0)throw Error('Missing valid land feature collection');
 const verifiedHandler=sparseTileHandler(catalog,{baseUrl:'../data/tiles/'});
 maplibregl.addProtocol('atlas-detail',async(params,abortController)=>{
   const result=await verifiedHandler(params,abortController);
   if(result?.data?.byteLength>0){results.realTileRequests++;results.verifiedTileBytes+=result.data.byteLength;}
   return result;
 });
 const style={version:8,name:'Bharat Atlas unmocked vector proof',sources:{
   land:{type:'geojson',data:land},
   vector:tileSourceSpec(catalog)
 },layers:[
   {id:'sea',type:'background',paint:{'background-color':'#e6f2f6'}},
   {id:'physical-land',type:'fill',source:'land',paint:{'fill-color':'#cfe3ce','fill-outline-color':'#699b87'}},
   {id:'real-coastlines',type:'line',source:'vector','source-layer':'coastlines',paint:{'line-color':'#3d766d','line-width':1.5}},
   {id:'real-lakes',type:'line',source:'vector','source-layer':'lakes',paint:{'line-color':'#377f9e','line-width':1.35}},
   {id:'real-rivers',type:'line',source:'vector','source-layer':'rivers',paint:{'line-color':'#498db0','line-width':1.1}},
   {id:'real-settlements',type:'circle',source:'vector','source-layer':'settlements',minzoom:3,paint:{'circle-color':'#bb552c','circle-radius':4,'circle-stroke-color':'#fff','circle-stroke-width':1}}
 ]};
 const map=new maplibregl.Map({container:'map',style,center:[79.5,23],zoom:4.35,minZoom:3,maxZoom:8,renderWorldCopies:false,attributionControl:false,dragRotate:false,preserveDrawingBuffer:true});
 window.__atlasRealMap=map;
 map.on('error',event=>{results.errors.push(String(event.error?.message||'MapLibre reported a rendering error'))});
 let idleCount=0;
 map.on('idle',()=>{
   idleCount++;
   results.styleLoaded=map.isStyleLoaded();
   try{
     results.vectorRenderedFeatures=map.queryRenderedFeatures({layers:['real-rivers','real-lakes','real-coastlines']}).length;
     results.renderedSettlements=map.queryRenderedFeatures({layers:['real-settlements']}).length;
     const liveCanvas=map.getCanvas(),webgl=liveCanvas.getContext('webgl2');
     if(webgl){const pixel=new Uint8Array(4);webgl.readPixels(Math.floor(liveCanvas.width/2),Math.floor(liveCanvas.height/2),1,1,webgl.RGBA,webgl.UNSIGNED_BYTE,pixel);results.glPixelsVerified=webgl.getError()===webgl.NO_ERROR && pixel[3]>0 && pixel.some(v=>v!==0);}
   }catch(e){results.errors.push('Render query: '+e.message)}
   if(results.realTileRequests>0 && results.verifiedTileBytes>0 && results.vectorRenderedFeatures>0 && results.renderedSettlements>0 && results.glPixelsVerified && results.styleLoaded){
     // Rendering alone is not a passing proof. The independent browser runner
     // must exercise real mouse/touch pan + zoom and verify a return to baseline.
     if(results.status==='rendering')results.status='rendered';
     document.getElementById('status').textContent=`REAL RENDER · navigation test pending · ${results.realTileRequests} verified MVT requests · ${results.vectorRenderedFeatures} rendered lines and ${results.renderedSettlements} settlements`;
   }
   else if(idleCount>=3 && results.status==='rendering'){results.status='failed';document.getElementById('status').textContent=`REAL MAP INCOMPLETE · ${results.realTileRequests} tile requests · ${results.vectorRenderedFeatures} rendered features`}
 });
 results.status='rendering';
 setTimeout(()=>{if(results.status==='rendering'){results.status='failed';results.errors.push('No successful idle/render within 20s');document.getElementById('status').textContent='Real renderer timed out'}},20000);
}
main().catch(fail);
