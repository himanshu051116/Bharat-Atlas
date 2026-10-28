import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('India boot never fetches unverified politics',()=>{
 const app=read('public-site/app.bundle.js'),html=read('public-site/index.html');
 assert.match(app,/initializeSafePhysicalMode\(\);initMap\(\)/);
 assert.doesNotMatch(app,/initMap\(\);fetchPreview\(\)/);
 assert.match(html,/Borders unavailable/);
 assert.match(html,/physical-preview\.svg/);
 assert.equal(existsSync('public-site/data/official-india/india-claim.geojson'),false);
});
test('CDN not required, static fallback available',()=>{
 const html=read('public-site/index.html');
 assert.match(html,/vendor\/maplibre-gl\.js/);
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
