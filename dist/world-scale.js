/* Screen-distance reference for the equirectangular world overview. Approximate only. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BharatWorldScale=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const KM_PER_DEG=111.19508023353;
 function niceFloor(x){if(!Number.isFinite(x)||x<=0)return 0;const p=10**Math.floor(Math.log10(x)),m=x/p;return (m>=5?5:m>=2?2:1)*p;}
 function estimate(view,pixelsPerSvgUnit,desiredPx=108){
  if(!view||![view.x,view.y,view.w,view.h,pixelsPerSvgUnit,desiredPx].every(Number.isFinite)||pixelsPerSvgUnit<=0||desiredPx<=0)return null;
  const latitude=Math.max(-89.9,Math.min(89.9,90-(view.y+view.h/2)/4));
  const kmPerPixel=KM_PER_DEG*Math.max(.01,Math.cos(latitude*Math.PI/180))/(4*pixelsPerSvgUnit);
  const km=niceFloor(kmPerPixel*desiredPx);
  return km>0?{km,pixels:km/kmPerPixel,latitude,approximate:true}:null;
 }
 return Object.freeze({estimate,niceFloor});
});
