/* Bharat Atlas v1.7: source-labelled optional world-feature search. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BharatWorldPlaceSearch=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const TYPES=['cities','admin1','peaks','rivers','lakes'];
 function normalize(text){return String(text||'').normalize('NFKD').toLocaleLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim()}
 function matches(available, query, limit=10){
  const q=normalize(query);if(q.length<2||q.length>120||!Number.isSafeInteger(limit)||limit<1||limit>30)return [];
  const matches=[];const seen=new Set();
  for(const layer of TYPES){
   const features=available.get(layer)?.features||[];
   for(const feature of features){
    const props=feature.properties||{},name=String(props.name||''),nn=normalize(name);
    if(!nn||!nn.includes(q))continue;
    const key=layer+'|'+nn+'|'+String(props.countryIso3||'')+'|'+String(props.code||'')+'|'+JSON.stringify(feature.geometry?.type==='Point'?feature.geometry.coordinates:feature._bounds);
    if(seen.has(key))continue;seen.add(key);
    matches.push({layer,f:feature,priority:nn===q?0:nn.startsWith(q)?1:2,
      name,country:String(props.countryIso3||props.countryName||''),key});
    if(matches.length>=300)break;
   }
  }
  matches.sort((a,b)=>a.priority-b.priority||a.name.localeCompare(b.name)||a.country.localeCompare(b.country)||a.layer.localeCompare(b.layer));
  return matches.slice(0,limit);
 }
 return Object.freeze({normalize,matches});
});
