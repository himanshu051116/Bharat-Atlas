/** Inspect a declared local research tile at a WGS84 coordinate.
 * A tile hash declares *data availability*, never actual feature presence,
 * completeness, precision, official status, or country-wide coverage.
 */
export function atlasXYZ(lon,lat,zoom){
  if(![lon,lat,zoom].every(Number.isFinite)||lon < -180||lon > 180 || lat < -90||lat > 90||!Number.isInteger(zoom)||zoom<0||zoom>12)
    throw new RangeError('Expected valid WGS84 longitude, latitude and integer zoom (0..12)');
  const n=2**zoom;
  const x=Math.max(0,Math.min(n-1,Math.floor(((lon===180?180-Number.EPSILON*180:lon)+180)/360*n)));
  const clamped=Math.max(-85.05112878,Math.min(85.05112878,lat));
  const radians=clamped*Math.PI/180;
  const y=Math.max(0,Math.min(n-1,Math.floor((1-Math.asinh(Math.tan(radians))/Math.PI)/2*n)));
  return {z:zoom,x,y,path:`${zoom}/${x}/${y}.pbf`};
}
export function atlasInspectResearchTile(catalog,lon,lat,viewZoom=6){
  if(!catalog)return {status:'catalogue_unavailable',message:'No verified local tile catalogue is loaded',available:false};
  if(!Number.isInteger(catalog.minzoom)||!Number.isInteger(catalog.maxzoom)||catalog.minzoom<0||catalog.maxzoom>12||catalog.minzoom>catalog.maxzoom)
    throw new TypeError('Invalid catalogue zoom limits');
  if(!Number.isFinite(viewZoom)||viewZoom<0||viewZoom>22)throw new RangeError('Invalid map zoom');
  const zoom=Math.min(catalog.maxzoom,Math.max(catalog.minzoom,Math.floor(viewZoom)));
  const tile=atlasXYZ(lon,lat,zoom);
  const hasDeclaredTile=Object.hasOwn(catalog.tileHashes||{},tile.path);
  const hasDecodedInventory=hasDeclaredTile&&catalog.tileLayerCounts!==undefined&&catalog.tileLayerCounts!==null;
  const counts=hasDecodedInventory?catalog.tileLayerCounts[tile.path]:null;
  return {
    featureCounts:counts?{...counts}:null,featureCountEvidence:counts?'decoded_mvt':'not_recorded',
    status:hasDeclaredTile?'declared_tile':'no_declared_tile',available:hasDeclaredTile,
    zoom:tile.z,requestedZoom:viewZoom,path:tile.path,
    overscaled:viewZoom>catalog.maxzoom,underscaled:viewZoom<catalog.minzoom,
    layers:counts?Object.keys(counts):Array.isArray(catalog.layers)?[...catalog.layers]:[],
    tileSha256:hasDeclaredTile?catalog.tileHashes[tile.path]:null,
    disclaimer:counts?'Decoded tile-layer feature occurrences are verified; they do not prove coordinate-level intersection, nationwide completeness, current accuracy, or official boundaries.':'The presence of a hashed tile does not prove individual layers contain features here, complete local coverage, current accuracy or official boundaries.'
  };
}
export function atlasTileZoomInventory(catalog){
  if(!catalog)return [];
  const counts=new Map(),perZoom=new Map();
  for(const path of Object.keys(catalog.tileHashes||{})){
    const zoom=Number(path.split('/')[0]);
    if(Number.isInteger(zoom)&&zoom>=catalog.minzoom&&zoom<=catalog.maxzoom)
      counts.set(zoom,(counts.get(zoom)||0)+1);
    const found=catalog.tileLayerCounts?.[path];
    if(found){
      if(!perZoom.has(zoom))perZoom.set(zoom,{});
      for(const [layer,number] of Object.entries(found)){
        perZoom.get(zoom)[layer]=(perZoom.get(zoom)[layer]||0)+number;
      }
    }
  }
  return Array.from({length:catalog.maxzoom-catalog.minzoom+1},(_,i)=>({zoom:i+catalog.minzoom,occupiedTiles:counts.get(i+catalog.minzoom)||0,decodedLayerOccurrences:catalog.tileLayerCounts?(perZoom.get(i+catalog.minzoom)||{}):null}));
}
