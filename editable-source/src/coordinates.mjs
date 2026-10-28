/* Deliberately limited coordinate navigation. This is not an address geocoder.
 * Numerical map-centering does not confirm that a coordinate lies inside India.
 */
export function parseAtlasCoordinates(value){
 const m=String(value??'').trim().match(/^([+-]?\d{1,2}(?:\.\d+)?)\s*°?\s*([NS])?\s*,\s*([+-]?\d{1,3}(?:\.\d+)?)\s*°?\s*([EW])?$/i);
 if(!m)return null;
 let lat=Number(m[1]),lon=Number(m[3]);
 const ns=m[2]?.toUpperCase(),ew=m[4]?.toUpperCase();
 if((ns==='N'&&lat<0)||(ns==='S'&&lat>0)||(ew==='E'&&lon<0)||(ew==='W'&&lon>0))return null;
 if(ns==='S')lat=-Math.abs(lat);if(ns==='N')lat=Math.abs(lat);
 if(ew==='W')lon=-Math.abs(lon);if(ew==='E')lon=Math.abs(lon);
 // This atlas is India-focused. In-range does not mean land or sovereignty.
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<3||lat>41||lon<60||lon>102)return null;
 return Object.freeze({lat,lon,name:`${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`});
}
