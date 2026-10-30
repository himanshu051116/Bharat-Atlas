import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('India boot never fetches unverified politics',()=>{
 const app=read('public-site/app.bundle.js'),html=read('public-site/index.html');
 assert.match(app,/initializeSafePhysicalMode\(\);initMap\(\)/);assert.doesNotMatch(app,/atlasLoadTransportPack\(\)\.then/);
 assert.doesNotMatch(app,/initMap\(\);fetchPreview\(\)/);
 assert.match(html,/Borders: import GeoJSON/);
 assert.match(html,/physical-preview\.svg/);
 assert.equal(existsSync('public-site/data/official-india/india-claim.geojson'),false);
});
test('CDN not required, static fallback available',()=>{
 const html=read('public-site/index.html');
 assert.match(html,/atlas-maplibre-loader\.mjs/);
 assert.match(html,/vendor\/maplibre-gl\.css/);
 assert.doesNotMatch(html,/cdn\.jsdelivr\.net\/npm\/maplibre-gl/);
 assert.match(read('public-site/styles.css'),/\.physical-poster/);
 assert.ok(existsSync('public-site/physical-preview.svg'));
 assert.doesNotThrow(()=>new Function(read('public-site/app.bundle.js')));
});
test('world map does not silently use incorrect India polygon',()=>{
 const world=read('public-site/world.js');
 assert.match(world,/c\.name==='India'/);
 assert.match(world,/p\.style\.opacity='0'/);
 assert.doesNotMatch(world,/await Promise\.all\(\[loadOfficialIndiaOverlay/);
 assert.doesNotThrow(()=>new Function(world));
});
test('release is not certified political geography',()=>{
 const m=JSON.parse(read('public-site/build-manifest.json'));
 assert.equal(m.previewOnly,true);
 assert.equal(m.officialGeometryVerified,false);
 assert.equal(m.verifiedAdminPolygonsBundled,false);
});


test('MapLibre cannot reduce the interactive map container to zero height',()=>{
 const css=read('public-site/styles.css');
 const app=read('public-site/app.bundle.js');
 assert.match(css,/#map\.map-canvas\.maplibregl-map/);
 assert.match(css,/position:\s*absolute;/);
 assert.match(css,/min-height:\s*100%/);
 assert.match(app,/size\.height<150/);
 assert.match(app,/app\.map\?\.resize\?\.\(\)/);
});


test('map wheel zoom preserves the geographic center and coalesces events',()=>{
 const app=read('public-site/app.bundle.js');
 assert.match(app,/scrollZoom:false/);
 assert.match(app,/installStableMapZoom\(mapInstance\)/);
 assert.match(app,/addEventListener\('wheel',handleWheel,\{passive:false\}\)/);
 assert.match(app,/event\.preventDefault\(\)/);
 assert.match(app,/frame=requestAnimationFrame\(/);
 assert.match(app,/map\.jumpTo\(\{zoom,center:map\.getCenter\(\)\}\)/);
 assert.match(app,/map\.easeTo\(\{zoom:target,center:map\.getCenter\(\),duration:/);
 assert.doesNotMatch(app,/app\.map\.zoomIn\(\{duration:/);
});


test('world wheel zoom also batches input without vertical cursor drift',()=>{
 const world=read('public-site/world.js');
 assert.match(world,/let worldWheelDelta=0,worldWheelFrame=0/);
 assert.match(world,/zoom\(Math\.exp\(delta\*\.0015\),null,0\)/);
 assert.match(world,/y:a\.y-ry\*\(newW\/2\)/);
 assert.doesNotMatch(world,/zoom\(factor,coordsFromPoint\(e\.clientX,e\.clientY\),0\)/);
});

test('physical style variants never require political geometry',()=>{
 const app=read('public-site/app.bundle.js'),html=read('public-site/index.html');
 assert.doesNotMatch(app,/Political styles require a separately loaded boundary dataset/);
 assert.match(app,/function updateStyleButtons\(\)/);
 assert.match(app,/function applyStylePaint\(style\)/);
 assert.match(app,/style==='terrain'&&!app\.features&&!app\.soiStates/);
 assert.match(app,/if\(source\.kind==='import'\)setStyle\('terrain'\)/);
 assert.match(app,/\['land-edge','line-opacity',opacity\]/);
 assert.match(html,/data-style="ink"[^>]+>Muted land/);
 assert.match(html,/data-style="outline"[^>]+>Coastlines/);
 assert.match(html,/Survey of India administrative boundary downloads/);
});

test('official boundary archive reader is strictly local and has source limits',()=>{
 const app=read('public-site/app.bundle.js');
 const worker=read('scripts/soi-archive-worker.mjs');
 const html=read('public-site/index.html');
 assert.match(html,/id="soi-import-btn"/);
 assert.match(html,/State_District_Subdistrict_PAN%20INDIA\.rar/);
 assert.match(html,/Outline_of_India\.zip/);
 assert.match(app,/new Worker\('\.\/vendor\/soi-archive-worker\.mjs'/);
 assert.match(app,/mapSource\('soi-state-boundaries'\)\?\.setData/);
 assert.match(app,/setStyle\('terrain'\)/);
 assert.match(worker,/250\*1024\*1024/);
 assert.match(worker,/OFFICIAL_OUTLINE_HASH/);
 assert.match(worker,/node-unrar-js\/esm\/index\.esm\.js/);
 assert.doesNotMatch(worker,/postMessage\(\{.*buffer/);
 assert.equal(existsSync('public-site/data/official-india/india-claim.geojson'),false);
});

test('MapLibre v6 patched dependency is pinned and loaded as an ES module',()=>{
 const pkg=JSON.parse(read('package.json'));
 const loader=read('public-site/atlas-maplibre-loader.mjs');
 const build=read('scripts/build-site.mjs');
 assert.equal(pkg.dependencies['maplibre-gl'],'6.16.0');
 assert.match(loader,/vendor\/maplibre-gl\.mjs/);
 assert.match(loader,/await import\('\.\/app\.bundle\.js'\)/);
 assert.match(build,/maplibre-gl-worker\.mjs/);
});
test('SHA-256 archive verification precedes Shapefile decompression',()=>{
 const worker=read('scripts/soi-archive-worker.mjs');
 assert.ok(worker.indexOf('if(digest!==expectedHash)')>0);
 assert.ok(worker.indexOf('if(digest!==expectedHash)')<worker.indexOf('await fromRAR(buffer)'));
 assert.match(worker,/expectedBytes=isRAR\?202524438:7513409/);
});
test('Source-labelled state lookup supports navigation and selected boundaries',()=>{
 const app=read('public-site/app.bundle.js');
 assert.match(app,/function soiPolygonForName\(name\)/);
 assert.match(app,/soi-state-selected/);
 assert.match(app,/app\.map\.fitBounds\(featureBounds\(officialPolygon\)/);
 assert.match(app,/function normalizeSoIRegionName/);
});
test('Importer can be cancelled without retaining worker',()=>{
 const html=read('public-site/index.html'),app=read('public-site/app.bundle.js');
 assert.match(html,/id="soi-cancel-btn"/);
 assert.match(app,/app\.soiImportWorker=worker/);
 assert.match(app,/worker\.terminate\(\)/);
 assert.match(app,/app\.soiImportWorker=null/);
});


test('sourced state catalogue entries are not described as unmapped',()=>{
 const app=read('public-site/app.bundle.js');
 assert.match(app,/const sourced=soiPolygonForName\(x\.name\)/);
 assert.match(app,/Locally loaded SoI May 2026 polygon/);
 assert.match(app,/ATLAS_REGIONS\.filter\(x=>soiPolygonForName\(x\.name\)\)\.length/);
});

test('opt-in on-device boundary cache is separate from public release files',()=>{
 const html=read('public-site/index.html');
 const cache=read('public-site/soi-local-cache.js');
 const app=read('public-site/app.bundle.js');
 assert.match(html,/id="soi-remember" type="checkbox"/);
 assert.match(html,/id="soi-clear-cache"/);
 assert.match(html,/soi-local-cache.js/);
 assert.match(cache,/indexedDB\.open\(NAME,VERSION\)/);
 assert.match(cache,/async function clear\(\)/);
 assert.match(cache,/details\?\.verifiedOfficial!==true/);
 assert.doesNotMatch(cache,/\bfetch\s*\(/);
 assert.match(app,/function rememberSoIBoundaries\(data,details\)/);
 assert.match(app,/function restoreRememberedSoIBoundaries/);
 assert.match(app,/function clearRememberedSoIBoundaries/);
});
