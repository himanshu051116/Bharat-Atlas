/* Bharat Atlas v1.6 — cartographic viewport helpers.
 * Independent of the DOM so geometry decisions can be regression-tested.
 * World SVG uses equirectangular coordinates: x=(lon+180)*4, y=(90-lat)*4.
 * Neither this module nor its calculations certify geographic source accuracy.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BharatWorldGeometry = api;
})(typeof globalThis !== 'undefined' ? globalThis : null, function () {
  'use strict';
  function longitudeToX(lon) { return (lon + 180) * 4; }
  function latitudeToY(lat) { return (90 - lat) * 4; }
  function pointInView(coords, view, pad = 6) {
    if (!Array.isArray(coords) || coords.length < 2 || !view) return false;
    const [lon, lat] = coords;
    if (![lon, lat, view.x, view.y, view.w, view.h].every(Number.isFinite) ||
        Math.abs(lon) > 180 || Math.abs(lat) > 90 || view.w <= 0 || view.h <= 0) return false;
    const x = longitudeToX(lon), y = latitudeToY(lat);
    return x >= view.x - pad && x <= view.x + view.w + pad &&
           y >= view.y - pad && y <= view.y + view.h + pad;
  }
  function boundsInView(box, view, horizontalPadFraction = .2) {
    if (!Array.isArray(box) || box.length !== 4 || !view ||
        ![...box, view.x, view.y, view.w, view.h].every(Number.isFinite) ||
        view.w <= 0 || view.h <= 0 || box[1] > box[3]) return false;
    if (box[2] < box[0] || box[2] - box[0] > 180) return true; // Conservatively retain date-line-crossing features.
    const left = longitudeToX(box[0]), right = longitudeToX(box[2]);
    const top = latitudeToY(box[3]), bottom = latitudeToY(box[1]);
    const padx = view.w * horizontalPadFraction, pady = view.h * horizontalPadFraction;
    return right >= view.x - padx && left <= view.x + view.w + padx &&
           bottom >= view.y - pady && top <= view.y + view.h + pady;
  }
  function viewportPixel(coords, view, pixelWidth, pixelHeight) {
    if (!pointInView(coords, view, 0) || pixelWidth <= 0 || pixelHeight <= 0) return null;
    return {
      x: (longitudeToX(coords[0]) - view.x) / view.w * pixelWidth,
      y: (latitudeToY(coords[1]) - view.y) / view.h * pixelHeight
    };
  }
  function visibleFeaturePaths(features, view, maxItems, toPath) {
    const paths = [];
    if (!view || !Array.isArray(features) || !Number.isSafeInteger(maxItems) || maxItems <= 0) return paths;
    for (const f of features) {
      if (paths.length >= maxItems) break;
      if (!boundsInView(f._bounds, view)) continue;
      const path = f._cachedPath || (f._cachedPath = toPath(f.geometry));
      if (path) paths.push(path);
    }
    return paths;
  }
  // Grid-binned polygon and line envelopes. Geometry is not changed or inferred.
  // Dateline-spanning envelopes are handled conservatively, never dropped.
  function buildBoundsIndex(features, cellDegrees = 20) {
    if (!Array.isArray(features) || !(cellDegrees >= 5 && cellDegrees <= 45)) throw Error('Invalid bounds index');
    const cols = Math.ceil(360 / cellDegrees), rows = Math.ceil(180 / cellDegrees);
    const bins = new Map(), global = [];
    for (let i = 0; i < features.length; i++) {
      const box = features[i]?._bounds;
      if (!Array.isArray(box) || box.length !== 4 || !box.every(Number.isFinite) ||
          box[1] > box[3] || box[1] < -90.01 || box[3] > 90.01 ||
          box[0] < -180.01 || box[2] > 180.01) continue;
      if (box[2] < box[0] || box[2] - box[0] > 180) { global.push(i); continue; }
      const west = Math.max(0, Math.min(cols-1, Math.floor((box[0]+180)/cellDegrees)));
      const east = Math.max(0, Math.min(cols-1, Math.floor((box[2]+180)/cellDegrees)));
      const south = Math.max(0, Math.min(rows-1, Math.floor((box[1]+90)/cellDegrees)));
      const north = Math.max(0, Math.min(rows-1, Math.floor((box[3]+90)/cellDegrees)));
      for (let r = south; r <= north; r++) for (let c = west; c <= east; c++) {
        const k = r*cols+c;
        if (!bins.has(k)) bins.set(k,[]);
        bins.get(k).push(i);
      }
    }
    return {features,cellDegrees,cols,rows,bins,global};
  }
  function queryBoundsIndex(index,view,maxItems=1800,predicate=()=>true) {
    if (!index || !view || !Number.isSafeInteger(maxItems) || maxItems < 1 ||
        ![view.x,view.y,view.w,view.h].every(Number.isFinite) || view.w <= 0 || view.h <= 0) return [];
    const {cellDegrees:step,cols,rows,bins,global,features} = index;
    const padX = view.w*.2, padY = view.h*.2;
    const west = Math.max(-180,(view.x-padX)/4-180),east = Math.min(180,(view.x+view.w+padX)/4-180);
    const south = Math.max(-90,90-(view.y+view.h+padY)/4),north = Math.min(90,90-(view.y-padY)/4);
    const c0 = Math.max(0,Math.min(cols-1,Math.floor((west+180)/step)));
    const c1 = Math.max(0,Math.min(cols-1,Math.floor((east+180)/step)));
    const r0 = Math.max(0,Math.min(rows-1,Math.floor((south+90)/step)));
    const r1 = Math.max(0,Math.min(rows-1,Math.floor((north+90)/step)));
    const matches = new Set(global);
    for (let r=r0;r<=r1;r++) for (let c=c0;c<=c1;c++) {
      for (const i of bins.get(r*cols+c)||[]) matches.add(i);
    }
    const result=[];
    for (const i of [...matches].sort((a,b)=>a-b)) {
      const feature=features[i];
      if (predicate(feature) && boundsInView(feature._bounds,view)) {
        result.push(feature);if(result.length>=maxItems)break;
      }
    }
    return result;
  }
  // Spatially bin named points by degrees once; this avoids scanning every city
  // on every small pan when the full 50m populated-places layer is installed.
  function buildPointIndex(features, cellDegrees = 10) {
    if (!Array.isArray(features) || !(cellDegrees >= 1 && cellDegrees <= 30)) throw Error('Invalid point index');
    const cols = Math.ceil(360 / cellDegrees), rows = Math.ceil(180 / cellDegrees);
    const bins = new Map();
    for (const feature of features) {
      const coords = feature?.geometry?.coordinates;
      if (feature?.geometry?.type !== 'Point' || !Array.isArray(coords) || coords.length < 2 ||
          !Number.isFinite(coords[0]) || !Number.isFinite(coords[1]) ||
          Math.abs(coords[0]) > 180 || Math.abs(coords[1]) > 90) continue;
      const col = Math.max(0, Math.min(cols - 1, Math.floor((coords[0] + 180) / cellDegrees)));
      const row = Math.max(0, Math.min(rows - 1, Math.floor((coords[1] + 90) / cellDegrees)));
      const key = row * cols + col;
      if (!bins.has(key)) bins.set(key, []);
      bins.get(key).push(feature);
    }
    return { cellDegrees, cols, rows, bins };
  }
  function queryPointIndex(index, view, maxItems = 600) {
    if (!index || !view || !Number.isSafeInteger(maxItems) || maxItems < 1 ||
        ![view.x,view.y,view.w,view.h].every(Number.isFinite) || view.w <= 0 || view.h <= 0) return [];
    const padDegrees = 2; // Match screen-margin candidates without losing edge markers.
    const west = Math.max(-180, view.x / 4 - 180 - padDegrees);
    const east = Math.min(180, (view.x + view.w) / 4 - 180 + padDegrees);
    const south = Math.max(-90, 90 - (view.y + view.h) / 4 - padDegrees);
    const north = Math.min(90, 90 - view.y / 4 + padDegrees);
    const {cellDegrees:step, cols, rows, bins} = index;
    const firstCol = Math.max(0, Math.min(cols - 1, Math.floor((west + 180) / step)));
    const lastCol = Math.max(0, Math.min(cols - 1, Math.floor((east + 180) / step)));
    const firstRow = Math.max(0, Math.min(rows - 1, Math.floor((south + 90) / step)));
    const lastRow = Math.max(0, Math.min(rows - 1, Math.floor((north + 90) / step)));
    const visible = [];
    for(let row = firstRow; row <= lastRow; row++)for(let col = firstCol; col <= lastCol; col++){
      for(const feature of bins.get(row * cols + col) || []){
        if(pointInView(feature.geometry.coordinates,view,8)) visible.push(feature);
      }
    }
    visible.sort((a,b)=>Number(a.properties?.rank||99)-Number(b.properties?.rank||99)||
      String(a.properties?.name||'').localeCompare(String(b.properties?.name||'')));
    return visible.slice(0,maxItems);
  }
  return Object.freeze({ longitudeToX, latitudeToY, pointInView, boundsInView, viewportPixel, visibleFeaturePaths, buildPointIndex, queryPointIndex, buildBoundsIndex, queryBoundsIndex });
});
