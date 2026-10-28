/* Evidence-bounded road graph. Honours explicit source oneway/vehicle access,
 * grade-separated vertices and optional reviewed turn prohibitions.
 * Never certify navigation from partial research data. */
import {atlasValidCoordinate,atlasHaversineKm} from './explorer-tools.mjs';
const blocked=v=>['no','private','destination','delivery'].includes(String(v??'').toLowerCase());
const carExcluded=v=>['footway','pedestrian','cycleway','path','steps','bridleway'].includes(String(v??'').toLowerCase());
export function atlasRoadGraph(collection,{maxNodes=14000}={}){
 if(collection?.type!=='FeatureCollection'||!Array.isArray(collection.features))throw Error('Load a valid source-backed research overlay first');
 const nodes=[],edges=[],ids=new Map(),adj=[];
 const getId=(pair,grade='0')=>{
  if(!atlasValidCoordinate(pair))throw Error('Invalid routing coordinate');
  // Exact point AND grade match; separate bridges/tunnels never join by proximity.
  const key=String(pair[0])+':'+String(pair[1])+':'+grade;
  if(ids.has(key))return ids.get(key);
  if(nodes.length>=maxNodes)throw Error('Local road graph exceeds the configured vertex limit; use a regional extract');
  const id=nodes.length;ids.set(key,id);nodes.push([...pair]);adj.push([]);return id;
 };
 let excluded=0,onewaySegments=0;
 for(let featureIndex=0;featureIndex<collection.features.length;featureIndex++){
  const f=collection.features[featureIndex],p=f.properties||{};
  if(p.kind!=='road')continue;
  if(blocked(p.motor_vehicle)||blocked(p.vehicle)||blocked(p.access)||carExcluded(p.highway)){excluded++;continue;}
  const geom=f.geometry||{};
  if(!['LineString','MultiLineString'].includes(geom.type))continue;
  const layer=String(p.layer??'0');
  if(!/^-?[0-5]$/.test(layer))throw Error('Invalid road layer; require reviewed grade data');
  const grade=layer+':'+String(p.bridge??'no')+':'+String(p.tunnel??'no');
  const roadId=String(p.id??p.sourceIndex??featureIndex);
  if(!/^[\w.:-]{1,80}$/.test(roadId))throw Error('Invalid road source ID');
  const one=String(p.oneway??'no').toLowerCase();
  if(!['yes','true','1','no','false','0','-1','reversible','alternating'].includes(one))throw Error('Unsupported one-way tag; cannot infer routing permission');
  if(['reversible','alternating'].includes(one)){excluded++;continue;}
  const forward=one!=='-1',reverse=!['yes','true','1'].includes(one);
  const lines=geom.type==='LineString'?[geom.coordinates]:geom.coordinates;
  for(const line of lines){let last=null;
   for(const point of line){const next=getId(point,grade);
    if(last!==null&&next!==last){
      const weight=atlasHaversineKm(nodes[last],nodes[next]);
      if(weight>0&&weight<300){
       if(forward)adj[last].push({to:next,weight,roadId});
       if(reverse)adj[next].push({to:last,weight,roadId});
       edges.push([last,next]);if(!forward||!reverse)onewaySegments++;
      }
    }last=next;
   }
  }
 }
 if(nodes.length<2||!edges.length)throw Error('No routable local road segments; import licensed road lines first');
 return {nodes,edges,adj,sourceFeatures:collection.features.filter(f=>f.properties?.kind==='road').length,excluded,onewaySegments,
  caveat:'Respecting supplied one-way/access/grade tags and optional reviewed turn rules does NOT prove completeness, traffic safety or navigability.'};
}
function atlasNearestGraphVertex(graph,coordinate,maxSnapKm){
 if(!atlasValidCoordinate(coordinate))throw Error('Route endpoint must be valid WGS84 coordinates');
 let nearest=-1,distance=Infinity;
 for(let i=0;i<graph.nodes.length;i++){
  const p=graph.nodes[i];if(Math.abs(p[0]-coordinate[0])>0.3||Math.abs(p[1]-coordinate[1])>0.3)continue;
  const d=atlasHaversineKm(p,coordinate);if(d<distance){nearest=i;distance=d;}
 }
 if(distance>maxSnapKm)throw Error(`Endpoint is ${distance===Infinity?'outside the source coverage':distance.toFixed(2)+' km from mapped road vertices'}; no suitable connection within ${maxSnapKm} km`);
 return {node:nearest,distance};
}
export function atlasResearchRoute(graph,start,end,{maxSnapKm=1,turnRestrictions=[]}={}){
 if(!graph?.nodes||!graph?.adj)throw Error('No source-backed road network loaded');
 if(!Number.isFinite(maxSnapKm)||maxSnapKm<=0||maxSnapKm>5)throw Error('Invalid snap distance');
 if(!Array.isArray(turnRestrictions)||turnRestrictions.length>50000)throw Error('Invalid restriction list');
 const forbidden=new Set();
 for(const r of turnRestrictions){
  if(!r||!atlasValidCoordinate(r.at)||!r.fromRoadId||!r.toRoadId)throw Error('Invalid reviewed turn restriction');
  forbidden.add(`${r.at[0]},${r.at[1]}|${r.fromRoadId}|${r.toRoadId}`);
 }
 const first=atlasNearestGraphVertex(graph,start,maxSnapKm),last=atlasNearestGraphVertex(graph,end,maxSnapKm);
 const states=new Map(),heap=[];
 const push=state=>{heap.push(state);let i=heap.length-1;while(i>0){const j=(i-1)>>1;if(heap[j].cost<=state.cost)break;heap[i]=heap[j];i=j;}heap[i]=state};
 const pop=()=>{const first=heap[0],tail=heap.pop();if(heap.length){let i=0;while(true){let j=i*2+1;if(j>=heap.length)break;if(j+1<heap.length&&heap[j+1].cost<heap[j].cost)j++;if(heap[j].cost>=tail.cost)break;heap[i]=heap[j];i=j;}heap[i]=tail;}return first};
 const stateKey=(node,road)=>`${node}|${road}`;
 const origin={node:first.node,road:'',cost:0,parent:null};states.set(stateKey(first.node,''),origin);push(origin);
 let dest=null;
 while(heap.length){const state=pop();if(state!==states.get(stateKey(state.node,state.road)))continue;
  if(state.node===last.node){dest=state;break;}
  for(const edge of graph.adj[state.node]){
   const at=graph.nodes[state.node];
   if(state.road&&forbidden.has(`${at[0]},${at[1]}|${state.road}|${edge.roadId}`))continue;
   const cost=state.cost+edge.weight,key=stateKey(edge.to,edge.roadId);
   if(cost<(states.get(key)?.cost??Infinity)){
    const next={node:edge.to,road:edge.roadId,cost,parent:state};states.set(key,next);push(next);
   }
  }
 }
 if(!dest)throw Error('These locations are disconnected or restricted in the supplied research road network');
 const sequence=[];for(let s=dest;s;s=s.parent){sequence.push(graph.nodes[s.node]);if(sequence.length>states.size+1)throw Error('Route parent cycle detected')}
 sequence.reverse();
 if(sequence.length<2)throw Error('Endpoints collapse to a single mapped vertex; choose distinct locations');
 return {km:dest.cost,snapStartKm:first.distance,snapEndKm:last.distance,sourceFeatures:graph.sourceFeatures,vertexCount:sequence.length,
  restrictionCount:forbidden.size,onewaySegments:graph.onewaySegments,excludedRoadFeatures:graph.excluded,
  geometry:{type:'FeatureCollection',features:[{type:'Feature',properties:{name:'Source-derived research graph path',kind:'research-route',navigationCertified:false},geometry:{type:'LineString',coordinates:sequence}}]},
  warnings:['Routing only covers supplied source segments and explicit access, one-way, grade and turn information','Traffic, road quality, signal rules and unrestricted connectivity have not been independently verified','NOT navigation-grade; verify routes on an authoritative service before travel']};
}
