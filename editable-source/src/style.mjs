import {graticule} from './geography.mjs';
import {pilotFeatureCollection} from './places.mjs';
import {tileSourceSpec,localDetailLayers} from './tiles.mjs';
import {atlasTransportStyle} from './transport-pack.mjs';
const hues=['#e6eee5','#cfdfd4','#dce9d9','#e8e6d7','#d5e6e5'];
export function mapStyle(theme='terrain',tileCatalog=null,transportCatalog=null){
  const modern=atlasTransportStyle(transportCatalog);
  const palette=theme==='outline'?['#fafcfb','#fafcfb','#fafcfb','#fafcfb','#fafcfb']:theme==='ink'?['#e9ebe9','#dadfdf','#f0ece6','#e1e5e2','#e8ded8']:hues;
  const fill=['match',['get','palette'],0,palette[0],1,palette[1],2,palette[2],3,palette[3],4,palette[4],palette[0]];
  return {version:8,name:`Bharat Atlas — ${theme}`, // MapLibre >=5.11 resolves fonts locally; no demo glyph network request.
    sources:{grid:{type:'geojson',data:graticule()},regions:{type:'geojson',data:{type:'FeatureCollection',features:[]}},'official-india-claim':{type:'geojson',data:{type:'FeatureCollection',features:[]}},'soi-state-boundaries':{type:'geojson',data:{type:'FeatureCollection',features:[]}},'land-mask':{type:'geojson',data:{type:'FeatureCollection',features:[]}},labels:{type:'geojson',data:{type:'FeatureCollection',features:[]}},checkpoints:{type:'geojson',data:{type:'FeatureCollection',features:[]}},'pilot-places':{type:'geojson',data:pilotFeatureCollection()},'search-location':{type:'geojson',data:{type:'FeatureCollection',features:[]}},'gazetteer-places':{type:'geojson',data:{type:'FeatureCollection',features:[]}},'atlas-measure':{type:'geojson',data:{type:'FeatureCollection',features:[]}},'atlas-user-overlay':{type:'geojson',data:{type:'FeatureCollection',features:[]}},'atlas-route':{type:'geojson',data:{type:'FeatureCollection',features:[]}},'atlas-journey-trail':{type:'geojson',data:{type:'FeatureCollection',features:[]}},'atlas-comparison':{type:'geojson',data:{type:'FeatureCollection',features:[]}},...(tileCatalog?{'local-detail':tileSourceSpec(tileCatalog)}:{}),...modern.sources},
    layers:[
      {id:'sea',type:'background',paint:{'background-color':theme==='ink'?'#eef1f3':'#edf5f6'}},
      {id:'land-fill',type:'fill',source:'land-mask',paint:{'fill-color':theme==='physical'?'#d3e3c9':theme==='ink'?'#dde3e1':theme==='outline'?'#f8faf7':'#e0e8d8','fill-opacity':0.94}},
      {id:'land-edge',type:'line',source:'land-mask',paint:{'line-color':theme==='outline'?'#325c53':'#729f8b','line-width':theme==='outline'?1.6:0.7,'line-opacity':theme==='outline'?0.9:theme==='ink'?0.42:0.15}},
      {id:'graticule',type:'line',source:'grid',layout:{visibility:'visible'},paint:{'line-color':'#a7c0c3','line-opacity':.35,'line-width':.7,'line-dasharray':[2,4]}},
      {id:'regions-fill',type:'fill',source:'regions',paint:{'fill-color':fill,'fill-opacity':theme==='physical'?0.07:1}},
      {id:'official-india-claim-line',type:'line',source:'official-india-claim',paint:{'line-color':'#b06527','line-width':['interpolate',['linear'],['zoom'],2,2,8,4],'line-opacity':0.94,'line-dasharray':[2,1]}},
      {id:'soi-state-fill',type:'fill',source:'soi-state-boundaries',paint:{'fill-color':'#e3c69c','fill-opacity':0.08}},
      {id:'soi-state-line',type:'line',source:'soi-state-boundaries',paint:{'line-color':'#9a542c','line-width':['interpolate',['linear'],['zoom'],3,1.3,7,2],'line-opacity':0.92}},
      {id:'regions-border',type:'line',source:'regions',paint:{'line-color':theme==='ink'?'#70827e':'#829b8b','line-opacity':theme==='physical'?0.36:1,'line-width':['interpolate',['linear'],['zoom'],2,0.65,6,1.2,10,1.8]}},
      {id:'regions-hover',type:'fill',source:'regions',filter:['==',['get','name'],'@@NO_REGION@@'],paint:{'fill-color':'#2e776c','fill-opacity':.12}},
      {id:'regions-selected',type:'line',source:'regions',filter:['==',['get','name'],'@@NO_REGION@@'],paint:{'line-color':'#08756c','line-width':['interpolate',['linear'],['zoom'],2,2.1,8,3.8]}},
      {id:'region-labels',type:'symbol',source:'labels',minzoom:3,layout:{'text-field':['get','name'],'text-font':['sans-serif'],'text-size':['interpolate',['linear'],['zoom'],3,10,8,14],'text-max-width':11,'text-allow-overlap':false,'text-padding':5,'visibility':'visible'},paint:{'text-color':'#36584f','text-halo-color':'rgba(250,253,250,0.94)','text-halo-width':1.4}},
      ...localDetailLayers(tileCatalog),
      ...modern.layers,
      {id:'search-location-pin',type:'circle',source:'search-location',paint:{'circle-radius':7,'circle-color':'#c04c2d','circle-stroke-width':3,'circle-stroke-color':'#ffffff'}},
      {id:'pilot-city-dots',type:'circle',source:'pilot-places',minzoom:5.4,layout:{visibility:'visible'},paint:{'circle-radius':['interpolate',['linear'],['zoom'],5.4,2.8,10,5],'circle-color':'#254e5a','circle-stroke-color':'#ffffff','circle-stroke-width':1.5}},
      {id:'pilot-city-labels',type:'symbol',source:'pilot-places',minzoom:6.0,layout:{visibility:'visible','text-field':['get','name'],'text-font':['sans-serif'],'text-size':['interpolate',['linear'],['zoom'],6,11,10,14],'text-anchor':'top','text-offset':[0,0.7],'text-allow-overlap':false,'text-padding':4},paint:{'text-color':'#283a43','text-halo-color':'#fff','text-halo-width':1.2}},
      {id:'gazetteer-dots',type:'circle',source:'gazetteer-places',minzoom:5,layout:{visibility:'visible'},paint:{'circle-radius':['interpolate',['linear'],['zoom'],5,2.4,12,4.5],'circle-color':'#65528a','circle-stroke-color':'#fff','circle-stroke-width':1.2}},
      {id:'gazetteer-labels',type:'symbol',source:'gazetteer-places',minzoom:6.6,layout:{visibility:'visible','text-field':['get','name'],'text-font':['sans-serif'],'text-size':['interpolate',['linear'],['zoom'],6.6,10,13,13],'text-anchor':'top','text-offset':[0,0.7],'text-allow-overlap':false},paint:{'text-color':'#504063','text-halo-color':'#fff','text-halo-width':1.2}},
      {id:'gazetteer-selected',type:'circle',source:'gazetteer-places',minzoom:3,filter:['==',['get','id'],'@@NO_PLACE@@'],paint:{'circle-radius':9,'circle-color':'#6f4ab5','circle-stroke-color':'#fff','circle-stroke-width':2}},
      {id:'pilot-place-selected',type:'circle',source:'pilot-places',filter:['==',['get','name'],'@@NO_PLACE@@'],minzoom:3,paint:{'circle-radius':9,'circle-color':'#d38b3c','circle-stroke-color':'white','circle-stroke-width':2}},
      {id:'atlas-transport-lines',type:'line',source:'atlas-user-overlay',filter:['!=',['get','kind'],'settlement'],paint:{'line-color':['match',['get','kind'],'railway','#b5694f','waterway','#2389b0','#cd975a'],'line-width':['interpolate',['linear'],['zoom'],3,1.5,12,3.5],'line-opacity':.85}},
      {id:'atlas-transport-points',type:'circle',source:'atlas-user-overlay',filter:['==',['get','kind'],'settlement'],paint:{'circle-radius':5,'circle-color':'#8c6493','circle-stroke-color':'white','circle-stroke-width':1.5}},
      {id:'atlas-journey-path',type:'line',source:'atlas-journey-trail',paint:{'line-color':'#1c8b7b','line-width':['interpolate',['linear'],['zoom'],3,1.8,10,3.3],'line-dasharray':[2,2],'line-opacity':.85}},
      {id:'atlas-comparison-line',type:'line',source:'atlas-comparison',filter:['==',['geometry-type'],'LineString'],paint:{'line-color':'#b35435','line-width':['interpolate',['linear'],['zoom'],3,2.4,10,4],'line-dasharray':[2,1.5],'line-opacity':.92}},
      {id:'atlas-comparison-points',type:'circle',source:'atlas-comparison',filter:['==',['geometry-type'],'Point'],paint:{'circle-radius':7,'circle-color':['match',['get','role'],'A','#b35435','B','#176c63','#b35435'],'circle-stroke-width':2,'circle-stroke-color':'#ffffff'}},
      {id:'atlas-research-route',type:'line',source:'atlas-route',paint:{'line-color':'#1c7cc3','line-width':5,'line-opacity':.95}},
      {id:'atlas-measure-area',type:'fill',source:'atlas-measure',filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':'#efac45','fill-opacity':.22}},
      {id:'atlas-measure-stroke',type:'line',source:'atlas-measure',paint:{'line-color':'#b86629','line-width':3,'line-dasharray':[2,1]}},
      {id:'atlas-measure-vertices',type:'circle',source:'atlas-measure',filter:['==',['geometry-type'],'Point'],paint:{'circle-radius':6,'circle-color':'#b86629','circle-stroke-width':2,'circle-stroke-color':'white'}},
      {id:'qa-points',type:'circle',source:'checkpoints',layout:{visibility:'none'},paint:{'circle-radius':6,'circle-color':['case',['get','pass'],'#19785e','#b94a37'],'circle-stroke-color':'#fff','circle-stroke-width':2}}
    ]};
}
