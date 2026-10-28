/** Data-readiness inventory based on current client state, never source authority. */
import {atlasTileZoomInventory} from './coverage-inspector.mjs';
const flag = (id,title,state,reason,next) => ({id,title,state,reason,next});
export function atlasReadiness(state={}){
 const physical=Boolean(state.landcover||state.hydrology||state.shorelines);
 const core=Boolean(state.tileCatalog?.tileHashes && state.tileCatalog.tileCount>0);
 const transport=Boolean(state.transportCatalog?.tileHashes && state.transportCatalog.tileCount>0);
 const sourcePlaces=Array.isArray(state.gazetteerPlaces)?state.gazetteerPlaces.length:0;
 const boundaries=Boolean(state.features?.features?.length);
 const items=[
  flag('physical','Physical reference geography',physical?'research_available':'missing',physical?'Locally loaded generalized or historical physical data':'No physical source loaded','Validate data age and source-level accuracy'),
  flag('tiles','Source-checked vector tiling',core?'research_available':'missing',core?`${state.tileCatalog.tileCount} declared historical physical tiles; actual layer presence varies`:'No local tile manifest loaded','Inspect decoded features and per-location coverage'),
  flag('transport','Contemporary transport layer',transport?'research_available':'missing',transport?'Optional research transport pack loaded, not navigation certified':'No permitted road/rail transport pack installed','Acquire and review current licensed data; build regional packs first'),
  flag('places','Search and place catalogue',sourcePlaces?'research_available':'missing',sourcePlaces?`${sourcePlaces} source-labelled selected places; not nationwide addresses`:'No source-labelled place points available','Build bilingual settlement gazetteer with source IDs'),
  flag('boundaries','Political and administrative geometry','blocked',boundaries?'Provisional polygons loaded; NOT certified by Survey of India':'No administrative geometry; official licensing and GIS checks outstanding','Acquire permitted reference geometry and review claims/control separately'),
  flag('renderer','Genuine GPU/device evidence','blocked','Automated simulated browser tests cannot prove WebGL2 or physical devices','Collect unmocked GPU proof and physical Android/iOS evidence'),
  flag('navigation','Navigation-grade routing','blocked','Graph research mode cannot model access, turn restrictions, road conditions or traffic','Build properly sourced topology, restrictions and independent field validation'),
  flag('production','Public production release','blocked','Official geometry, data rights, real-GPU and independent load QA remain release gates','Complete security, accessibility, monitoring and rollback acceptance')
 ];
 return {format:'BharatAtlasReadiness1',version:'0.37',researchOnly:true,
   sourceSummary:{localTileCount:state.tileCatalog?.tileCount||0,transportTileCount:state.transportCatalog?.tileCount||0,sourcePlaceCount:sourcePlaces,provisionalPolygonCount:state.features?.features?.length||0},
   coverageZoom:core?atlasTileZoomInventory(state.tileCatalog):[],
   transportZoom:transport?atlasTileZoomInventory(state.transportCatalog):[],
   items,productionReady:false,
   disclaimer:'Catalogue tile occupancy, license metadata and automated checks do not certify geographic completeness, political boundaries, navigation or GPU behavior.'};
}
