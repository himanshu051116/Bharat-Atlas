/* Physical-only GSHHG/WDBII research view: intentionally NO political boundary geometry. */
const WIDTH=1600,HEIGHT=1120;
const FRAME={x:75,y:147,w:1450,h:820};
// Study extent defined by the packaged licensed source; not a country boundary.
export const PHYSICAL_EXTENT=Object.freeze([68,6,99,38]);
const physicalOnlyFormat=n=>n.toFixed(2);
function physicalOnlyProjector(){
 const [west,south,east,north]=PHYSICAL_EXTENT;
 const cos=Math.cos((south+north)*Math.PI/360),rw=(east-west)*cos,rh=north-south;
 const factor=Math.min(FRAME.w/rw,FRAME.h/rh);
 const x0=FRAME.x+(FRAME.w-rw*factor)/2,y0=FRAME.y+(FRAME.h-rh*factor)/2;
 return ([lon,lat])=>[x0+(lon-west)*cos*factor,y0+(north-lat)*factor];
}
function physicalOnlyPolygonPath(coords,project){return coords.map((p,i)=>(i?'L':'M')+project(p).map(physicalOnlyFormat).join(' ')).join(' ')+' Z'}
function physicalOnlyLandPaths(land,project){return land.features.map(feature=>'<path d="'+feature.geometry.coordinates.map(r=>physicalOnlyPolygonPath(r,project)).join(' ')+'"/>').join('\n')}
function physicalOnlyLinePaths(fc,project){return (fc?.features||[]).filter(v=>v.geometry?.type==='LineString').map(feat=>'<path d="'+feat.geometry.coordinates.map((p,i)=>(i?'L':'M')+project(p).map(physicalOnlyFormat).join(' ')).join(' ')+'"/>').join('\n')}
function physicalOnlyClaimOutline(fc,project){
 if(!fc)return '';
 if(fc.type!=='FeatureCollection'||!Array.isArray(fc.features)||fc.features.length!==1)throw Error('Invalid SoI national-outline collection');
 const geometry=fc.features[0]?.geometry;
 if(!geometry||!['Polygon','MultiPolygon'].includes(geometry.type))throw Error('Invalid SoI national-outline polygon');
 const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
 const paths=[];let n=0;
 for(const poly of polygons){for(const ring of poly){
   if(!Array.isArray(ring)||ring.length<4)throw Error('Invalid national-outline ring');
   for(const pair of ring){
     if(!Array.isArray(pair)||pair.length<2||!Number.isFinite(pair[0])||!Number.isFinite(pair[1])||
        pair[0]<60||pair[0]>102||pair[1]<3||pair[1]>42)throw Error('Invalid national-outline coordinates');
     if(++n>200000)throw Error('National-outline SVG exceeds vertex cap');
   }
   if(ring[0][0]!==ring[ring.length-1][0]||ring[0][1]!==ring[ring.length-1][1])throw Error('Unclosed outline polygon');
   paths.push(physicalOnlyPolygonPath(ring,project));
 }}
 return `<g id="india-official-claim-outline" fill="none" stroke="#aa5d23" stroke-width="3.2" stroke-linejoin="round" aria-label="Generalized Survey of India claimed national outline">`+
   `<path d="${paths.join(' ')}" fill="none"/></g>`;
}
export function renderPhysicalOnlySVG({land,hydrology=null,shorelines=null,showRivers=true,showShores=true,officialClaim=null}={}){
 if(land?.type!=='FeatureCollection'||!Array.isArray(land.features)||!land.features.length)throw Error('A validated physical land source is required');
 const project=physicalOnlyProjector();
 const [west,south,east,north]=PHYSICAL_EXTENT;
 const c=Math.cos((south+north)*Math.PI/360);
 const factor=Math.min(FRAME.w/((east-west)*c),FRAME.h/(north-south));
 const x0=FRAME.x+(FRAME.w-(east-west)*c*factor)/2;
 const y0=FRAME.y+(FRAME.h-(north-south)*factor)/2;
 const atlasProjection=[west,north,x0,y0,c*factor,factor].join(',');
 const lines=showRivers?physicalOnlyLinePaths(hydrology,project):'';
 const coast=showShores?physicalOnlyLinePaths(shorelines?.coastlines,project):'';
 const lakes=showShores?physicalOnlyLinePaths(shorelines?.lakes,project):'';
 const claimedOutline=physicalOnlyClaimOutline(officialClaim,project);
 const svg=`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" data-atlas-projection="${atlasProjection}" role="img" aria-labelledby="title desc">
<title id="title">Bharat Atlas — Physical geography research view</title>
<desc id="desc">Generalized physical map for 68–99 degrees east and 6–38 degrees north. ${officialClaim?'Survey of India source-labelled national claim outline shown; this is not a certified 2026 political-map match, control boundary, or state division.':'No political or national boundary geometries are included.'} Physical data: GSHHG LGPL-3.0-or-later.</desc>
<rect width="${WIDTH}" height="${HEIGHT}" fill="#f5f9f9"/>
<rect x="33" y="31" width="1534" height="1058" rx="15" fill="#fff" stroke="#dbe5df" stroke-width="2"/>
<text x="78" y="87" font-family="Arial,sans-serif" font-size="38" font-weight="bold" fill="#264d3e">BHARAT ATLAS</text>
<text x="79" y="122" font-family="Arial,sans-serif" font-size="20" fill="#55746b">Physical geography • GSHHG/WDBII historical reference data</text>
<defs><clipPath id="map-frame"><rect x="75" y="147" width="1450" height="820"/></clipPath></defs>
<rect x="75" y="147" width="1450" height="820" fill="#e8f3f6" stroke="#d7e4e0" stroke-width="1"/>
<g clip-path="url(#map-frame)"><g id="physical-land" fill="#c9dfc2" stroke="#729988" stroke-width="0.4" fill-rule="evenodd">${physicalOnlyLandPaths(land,project)}</g>
<g id="historical-rivers" fill="none" stroke="#438ca9" stroke-width="1.05" stroke-opacity=".76" stroke-linejoin="round" stroke-linecap="round">${lines}</g>
<g id="physical-coastlines" fill="none" stroke="#2b766b" stroke-width="1.55">${coast}</g>
<g id="physical-lakes" fill="none" stroke="#5c9fbe" stroke-width="1.2">${lakes}</g>${claimedOutline}</g>
<text x="78" y="1017" font-family="Arial,sans-serif" font-size="19" font-weight="bold" fill="#a05531">${officialClaim?'SOI-SOURCED NATIONAL CLAIM OUTLINE — GENERALIZED, NOT 2026-CERTIFIED':'PHYSICAL GEOGRAPHY ONLY — NO POLITICAL BOUNDARIES'}</text>
<text x="78" y="1046" font-family="Arial,sans-serif" font-size="15" fill="#3f6159">GSHHG 2.3.6 via Basemap Data 2.0.0 · LGPL-3.0-or-later · Wessel &amp; Smith</text>
<text x="78" y="1072" font-family="Arial,sans-serif" font-size="13" fill="#6a8279">Study area 68–99°E, 6–38°N · Includes neighbouring countries · Historical generalized data, not for navigation</text>
</svg>`;
 if(svg.length>15_000_000)throw Error('Physical geography export too large');
 return svg;
}
export const PHYSICAL_ONLY_FILENAME='bharat-atlas-physical-geography-research.svg';
