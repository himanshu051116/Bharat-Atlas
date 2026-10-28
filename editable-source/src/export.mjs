/* Standalone, resolution-independent research map exports.
 * Does not certify geographic data; preserves complete multipolygon rings and holes.
 * Coordinates are a simple equirectangular display projection (not survey-grade).
 */
import {featureBounds,labelPoint} from './geography.mjs';
const W=1600,H=1120,frame={x:75,y:150,w:1450,h:820};
const COLORS=['#dae9dc','#c2dccf','#e6ead6','#d0e4e0','#e1e0d2'];
export const escapeXML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=n=>Number.isFinite(n);
function coordsOf(feature,visit){
 const walk=c=>{if(typeof c?.[0]==='number'){visit(c);return}for(const x of c??[])walk(x)};
 walk(feature.geometry.coordinates);
}
function exportExtent(fs){
 let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;
 for(const f of fs){const [[a,b],[c,d]]=featureBounds(f);xmin=Math.min(xmin,a);xmax=Math.max(xmax,c);ymin=Math.min(ymin,b);ymax=Math.max(ymax,d)}
 if(![xmin,xmax,ymin,ymax].every(finite)||xmin>=xmax||ymin>=ymax)throw Error('No valid export extent');
 // A modest margin for coastlines and individual city-state outlines.
 const dw=Math.max(xmax-xmin,.05),dh=Math.max(ymax-ymin,.05);
 return {xmin:xmin-.06*dw,xmax:xmax+.06*dw,ymin:ymin-.06*dh,ymax:ymax+.06*dh};
}
function projector(fs){
 const e=exportExtent(fs);
 // Correct East-West scale approximately at the map midpoint. A cartographic display,
 // not a geodesic metric projection or a basis for distance measurement.
 const c=Math.max(.5,Math.cos((e.ymin+e.ymax)/2*Math.PI/180));
 const dw=(e.xmax-e.xmin)*c,dh=e.ymax-e.ymin;
 const k=Math.min(frame.w/dw,frame.h/dh);
 const ox=frame.x+(frame.w-dw*k)/2,oy=frame.y+(frame.h-dh*k)/2;
 const project=([lon,lat])=>[ox+(lon-e.xmin)*c*k,oy+(e.ymax-lat)*k];
 project.atlasProjection={west:e.xmin,north:e.ymax,x0:ox,y0:oy,scaleX:c*k,scaleY:k};
 return project;
}
const fmt=n=>n.toFixed(2);
function polygonPath(feature,project){
 const g=feature.geometry,polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates;
 return polygons.map(poly=>poly.map(ring=>ring.map((p,i)=>`${i?'L':'M'}${project(p).map(fmt).join(' ')}`).join(' ')+' Z').join(' ')).join(' ');
}
function canonicalFeature(f){
 return f?.type==='Feature' && typeof f.properties?.name==='string' && ['Polygon','MultiPolygon'].includes(f.geometry?.type);
}
export function renderResearchSVG(collection,{selected='',source=null,labels=true,physicalLines=null,physicalShore=null,physicalLand=null,physicalTheme=false}={}){
 if(collection?.type!=='FeatureCollection'||!Array.isArray(collection.features)||!collection.features.length||!collection.features.every(canonicalFeature))throw Error('Load a validated polygon collection before export');
 const features=selected?collection.features.filter(f=>f.properties.name===selected):collection.features;
 if(!features.length)throw Error('Selected region is no longer in the map');
 const project=projector(features);
 const title=selected?`${selected} · Research map`:'India · Research map';
 const sourceTitle=source?.title||'Unknown source';
 const licence=source?.licence||'Unknown licence';
 const attribution=source?.attribution||'Data attribution not supplied';
 const safeTitle=escapeXML(title);
 const paths=features.map((f,i)=>{
  const path=polygonPath(f,project),colour=COLORS[Number(f.properties.palette)%COLORS.length]||COLORS[i%COLORS.length];
  return `<path data-region="${escapeXML(f.properties.name)}" d="${path}" fill="${physicalTheme?'#d5e8da':colour}" fill-opacity="${physicalTheme?'0.06':'1'}" fill-rule="evenodd" stroke="#557e70" stroke-width="1.65" stroke-linejoin="round"/>`;
 }).join('\n');
 const landPaths=physicalLand?.features?.filter(f=>f.geometry?.type==='Polygon').map(f=>`<path d="${polygonPath(f,project)}"/>`).join('\n')||'';
 // Source-labelled *historical* hydrology; rendered under region labels, never
 // represented as complete, current or officially verified river geography.
 const riverPaths=physicalLines?.features?.map(f=>{
   if(f.geometry?.type!=='LineString')return '';
   return `<path d="${f.geometry.coordinates.map((p,i)=>`${i?'L':'M'}${project(p).map(fmt).join(' ')}`).join(' ')}"/>`;
 }).join('\n')||'';
 const shorePaths=physicalShore?['coastlines','lakes'].map(kind=>{
   const lines=physicalShore[kind]?.features||[];
   return `<g id="historic-${kind}" aria-label="Source-labelled historical generalized ${kind}" fill="none" stroke="${kind==='coastlines'?'#347d76':'#539fc4'}" stroke-width="${kind==='coastlines'?'1.65':'1.35'}" stroke-opacity="0.9">${lines.filter(f=>f.geometry?.type==='LineString').map(f=>`<path d="${f.geometry.coordinates.map((p,i)=>`${i?'L':'M'}${project(p).map(fmt).join(' ')}`).join(' ')}"/>`).join('')}</g>`;
 }).join(''):'';
 // Keep single-region titles legible; avoid overlap by omitting all-region labels for tiny polygons.
 const pointLabels=labels?features.map(f=>{
   const [x,y]=project(labelPoint(f));
   // Skip collisions with the frame: no guessed leader-lines/coordinates.
   if(x<frame.x+6||x>frame.x+frame.w-6||y<frame.y+6||y>frame.y+frame.h-6)return '';
   return `<text x="${fmt(x)}" y="${fmt(y)}" class="region-label">${escapeXML(f.properties.name)}</text>`;
 }).join('\n'):'';
 const desc=`Source: ${sourceTitle}. Licence: ${licence}. Attribution: ${attribution}. Provisional/independently unverified boundaries. Display projection is approximate; not intended for legal or navigational use.`;
 const svg=`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1120" viewBox="0 0 ${W} ${H}" data-atlas-projection="${[project.atlasProjection.west,project.atlasProjection.north,project.atlasProjection.x0,project.atlasProjection.y0,project.atlasProjection.scaleX,project.atlasProjection.scaleY].join(',')}" role="img" aria-labelledby="title desc">
<title id="title">${safeTitle}</title><desc id="desc">${escapeXML(desc)}</desc>
<rect width="1600" height="1120" fill="#f8faf7"/>
<rect x="33" y="31" width="1534" height="1058" rx="15" fill="white" stroke="#dae4df" stroke-width="1.5"/>
<text x="78" y="87" font-family="Arial,sans-serif" font-size="38" font-weight="700" fill="#234c3d">BHARAT ATLAS</text>
<text x="79" y="121" font-family="Arial,sans-serif" font-size="21" fill="#426458">${safeTitle}</text>
<g id="physical-land" fill="#d4e4ce" fill-rule="evenodd" stroke="none" clip-path="url(#hydrology-frame)">${landPaths}</g>
<g id="geography">${paths}</g>
<defs><clipPath id="hydrology-frame"><rect x="75" y="150" width="1450" height="820"/></clipPath><clipPath id="hydrology-selected">${selected?features.map(f=>`<path d="${polygonPath(f,project)}" clip-rule="evenodd"/>`).join(''):''}</clipPath></defs>
<g id="historic-hydrology" aria-label="Historic unlabelled WDBII river traces" clip-path="url(#${selected?'hydrology-selected':'hydrology-frame'})" fill="none" stroke="#4a9ab6" stroke-width="1.15" stroke-opacity="0.8" stroke-linecap="round">${riverPaths}</g>
<g id="physical-shorelines" clip-path="url(#${selected?'hydrology-selected':'hydrology-frame'})">${shorePaths}</g>
<style>.region-label{font-family:Arial,sans-serif;font-weight:600;font-size:${selected?21:14}px;fill:#244f43;stroke:#fff;stroke-width:3px;paint-order:stroke;stroke-linejoin:round;text-anchor:middle}</style>
<g id="labels">${pointLabels}</g>
<rect x="75" y="986" width="1450" height="1.5" fill="#d5e1da"/>
<text x="78" y="1019" font-family="Arial,sans-serif" font-size="18" font-weight="bold" fill="#ae572e">PROVISIONAL GEOGRAPHY — NOT OFFICIAL OR SURVEY-VERIFIED</text>
<text x="78" y="1048" font-family="Arial,sans-serif" font-size="15" fill="#4b635c">${escapeXML(`${sourceTitle} · ${licence} · ${attribution}`).slice(0,450)}</text>
<text x="78" y="1073" font-family="Arial,sans-serif" font-size="13" fill="#6b8279">Physical overlays if shown: GSHHG/WDBII 2.3.6, LGPL-3.0+ · Not for survey, legal or navigation use</text>
</svg>`;
 if(svg.length>25_000_000)throw Error('Export is too large; choose an individual region');
 return svg;
}
export function exportFileName(selected=''){
 const basename=selected?selected.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''):'india';
 return `bharat-atlas-${basename||'region'}-research.svg`;
}
