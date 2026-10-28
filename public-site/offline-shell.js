/* Bharat Atlas focused v1 shell cache — same-origin public assets only.
 * Does not cache external political boundary endpoints, user imports, or private files.
 * Offline physical research content works only after its data has been loaded at least once.
 * Authentic MapLibre's optional remote CDN is not automatically made offline.
 */
const ATLAS_CACHE='bharat-atlas-research-v1115-soi-20261028';
const ATLAS_SHELL=['./','./index.html','./styles.css','./atlas-focus.css','./app.bundle.js','./physical-preview.svg','./vendor/maplibre-gl.css','./vendor/maplibre-gl.js','./atlas-labs.html','./atlas-labs.css','./atlas-labs.mjs','./world.html','./world.css','./world-camera-scheduler.js','./world.js','./world-detail-geometry.js','./world-place-search.js','./world-explore-search.js','./world-scale.js','./world-detail.js','./atlas-visitor.js','./data/world/world-boundaries.json','./data/world/manifest.json','./data/world/world-capital-references.json','./data/world/capitals-manifest.json','./data/world/capitals-license.txt','./data/world/world-hydrography.json','./data/world/hydrography-manifest.json','./data/world/world-shorelines.json','./data/world/shoreline-manifest.json','./data/world/COPYING.LESSER','./data/world/COPYING.GPL','./data/world/LICENSE-AND-SOURCE.txt','./data/world-detail/manifest.json','./data/world-detail/cities.geojson'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(ATLAS_CACHE).then(async cache=>{
  await Promise.allSettled(ATLAS_SHELL.map(path=>cache.add(path)));
 }).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('bharat-atlas-research-')&&k!==ATLAS_CACHE).map(k=>caches.delete(k)))),self.clients.claim()]));
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||request.headers.has('authorization')||request.headers.has('range'))return;
 let url;try{url=new URL(request.url)}catch(_){return;}
 if(url.origin!==self.location.origin)return;
 if(!['http:','https:'].includes(url.protocol)||url.search)return;
 // Do not cache unbounded private routes or server-generated downloads.
 const allowed=ATLAS_SHELL.some(f=>new URL(f,self.registration.scope).pathname===url.pathname)||
    /^\/(?:.*\/)?(?:data\/(?:search-index|tiles|gazetteer|hydrography|shorelines|landcover|world|world-detail|official-india)\/|legacy\/|proof\/)/.test(url.pathname);
 if(!allowed)return;
 event.respondWith((async()=>{
  const cache=await caches.open(ATLAS_CACHE);
  try{
   const response=await fetch(request);
   const length=Number(response.headers.get('content-length')||0);
   // Unknown Content-Length is not a permission to cache an unbounded response.
   // Bounded local static assets are safe to store; larger/unknown responses remain network-only.
   const maxCacheBytes=url.pathname.endsWith('/data/official-india/india-claim.geojson')?5*1024*1024:3*1024*1024;
   if(response.ok&&response.type==='basic'&&length>0&&length<=maxCacheBytes)await cache.put(request,response.clone()).catch(()=>{});
   return response;
  }catch(error){
   const old=await cache.match(request);
   if(old)return old;
   throw error;
  }
 })());
});
