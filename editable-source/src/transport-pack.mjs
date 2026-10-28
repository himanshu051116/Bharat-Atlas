/* Separate modern transport research tile pack, preserving the bundled historic
 * GSHHG physical archive. Requires independently approved source metadata.
 * This is not a road navigation graph or a political boundary layer.
 */
import {loadTileManifest,sparseTileHandler,tileSourceSpec} from './tiles.mjs';
export const ATLAS_TRANSPORT_PROTOCOL='atlas-transport';
export async function atlasLoadTransportPack(fetcher=fetch){
 return loadTileManifest({fetcher,base:'./data/transport-pack/atlas-tiles.json',timeout:3500});
}
export function atlasRegisterTransportPack(maplibregl,catalog,opts={}){
 if(typeof maplibregl?.addProtocol!=='function')throw Error('Transport tile protocol unavailable');
 const handler=sparseTileHandler(catalog,{baseUrl:'./data/transport-pack/',...opts});
 maplibregl.addProtocol(ATLAS_TRANSPORT_PROTOCOL,(params,signal)=>{
  const url=String(params?.url||'');
  if(!/^atlas-transport:\/\//.test(url))throw Error('Unexpected transport tile protocol');
  return handler({...params,url:url.replace(/^atlas-transport:\/\//,'atlas-detail://')},signal);
 });
}
export function atlasTransportStyle(catalog){
 if(!catalog)return {sources:{},layers:[]};
 const has=name=>catalog.layers.includes(name);
 return {
  sources:{'research-transport':{...tileSourceSpec(catalog),tiles:[ATLAS_TRANSPORT_PROTOCOL+'://{z}/{x}/{y}.pbf']}},
  layers:[
   ...(has('roads')?[{id:'research-roads-casing',type:'line',source:'research-transport','source-layer':'roads',minzoom:catalog.minzoom,paint:{'line-color':'#fff','line-width':['interpolate',['linear'],['zoom'],4,1,12,5.5]}},{id:'research-roads',type:'line',source:'research-transport','source-layer':'roads',minzoom:catalog.minzoom,paint:{'line-color':['match',['get','highway'],['motorway','trunk'],'#cf7953',['primary','secondary'],'#bf9363','#ad9a85'],'line-width':['interpolate',['linear'],['zoom'],4,0.65,9,['match',['get','highway'],['motorway','trunk'],2.4,['primary','secondary'],1.5,0.85],12,['match',['get','highway'],['motorway','trunk'],5,['primary','secondary'],3.2,1.5]]}}]:[]),
   ...(has('roads')?[{id:'research-road-labels',type:'symbol',source:'research-transport','source-layer':'roads',minzoom:Math.max(9,catalog.minzoom),filter:['has','name'],layout:{'symbol-placement':'line','text-field':['get','name'],'text-font':['sans-serif'],'text-size':['interpolate',['linear'],['zoom'],9,9,13,12],'text-max-angle':25,'text-padding':4},paint:{'text-color':'#72543d','text-halo-color':'#fff','text-halo-width':1.4}}]:[]),
   ...(has('railways')?[{id:'research-railways',type:'line',source:'research-transport','source-layer':'railways',minzoom:catalog.minzoom,paint:{'line-color':'#6c6376','line-width':['interpolate',['linear'],['zoom'],4,1,12,2.5],'line-dasharray':[2,2]}}]:[]),
   ...(has('rivers')?[{id:'research-waterways',type:'line',source:'research-transport','source-layer':'rivers',minzoom:catalog.minzoom,paint:{'line-color':'#238cb4','line-width':['interpolate',['linear'],['zoom'],4,.8,12,2.5]}}]:[]),
   ...(has('rivers')?[{id:'research-waterway-labels',type:'symbol',source:'research-transport','source-layer':'rivers',minzoom:Math.max(8,catalog.minzoom),filter:['has','name'],layout:{'symbol-placement':'line','text-field':['get','name'],'text-font':['sans-serif'],'text-size':11,'text-padding':6},paint:{'text-color':'#246f94','text-halo-color':'#fff','text-halo-width':1.3}}]:[]),
   ...(has('pois')?[{id:'research-pois',type:'circle',source:'research-transport','source-layer':'pois',minzoom:Math.max(11,catalog.minzoom),paint:{'circle-radius':3.3,'circle-color':['match',['get','amenity'],'hospital','#c35766','school','#398aa5','#bd7451'],'circle-stroke-color':'white','circle-stroke-width':1}},
    {id:'research-poi-labels',type:'symbol',source:'research-transport','source-layer':'pois',minzoom:Math.max(12,catalog.minzoom),layout:{'text-field':['get','name'],'text-size':10,'text-offset':[0,1.1],'text-anchor':'top','text-allow-overlap':false},paint:{'text-color':'#70443d','text-halo-color':'#fff','text-halo-width':1}}]:[]),
   ...(has('settlements')?[{id:'research-settlements',type:'circle',source:'research-transport','source-layer':'settlements',minzoom:catalog.minzoom,paint:{'circle-radius':4,'circle-color':'#5a4d88','circle-stroke-color':'#fff','circle-stroke-width':1.2}},
    {id:'research-settlement-labels',type:'symbol',source:'research-transport','source-layer':'settlements',minzoom:Math.max(6,catalog.minzoom),layout:{'text-field':['get','name'],'text-font':['sans-serif'],'text-size':11,'text-offset':[0,.8],'text-anchor':'top','text-allow-overlap':false},paint:{'text-color':'#49425f','text-halo-color':'white','text-halo-width':1.2}}]:[])
  ]
 };
}
