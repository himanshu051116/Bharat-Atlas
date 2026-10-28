/* Pilot city-centre locations for interface development only.
 * Coordinates are APPROXIMATE and have not been independently survey-verified.
 * These are not address points, road networks, official centroids or a nationwide gazetteer.
 */
export const PILOT_PLACES = Object.freeze([
  {name:'New Delhi',region:'Delhi',lon:77.2090,lat:28.6139},
  {name:'Mumbai',region:'Maharashtra',lon:72.8777,lat:19.0760},
  {name:'Kolkata',region:'West Bengal',lon:88.3639,lat:22.5726},
  {name:'Chennai',region:'Tamil Nadu',lon:80.2707,lat:13.0827},
  {name:'Bengaluru',region:'Karnataka',lon:77.5946,lat:12.9716,aliases:['Bangalore']},
  {name:'Hyderabad',region:'Telangana',lon:78.4867,lat:17.3850},
  {name:'Ahmedabad',region:'Gujarat',lon:72.5714,lat:23.0225},
  {name:'Jaipur',region:'Rajasthan',lon:75.7873,lat:26.9124},
  {name:'Lucknow',region:'Uttar Pradesh',lon:80.9462,lat:26.8467},
  {name:'Patna',region:'Bihar',lon:85.1376,lat:25.5941},
  {name:'Bhopal',region:'Madhya Pradesh',lon:77.4126,lat:23.2599},
  {name:'Gwalior',region:'Madhya Pradesh',lon:78.1828,lat:26.2183},
  {name:'Jabalpur',region:'Madhya Pradesh',lon:79.9864,lat:23.1815},
  {name:'Indore',region:'Madhya Pradesh',lon:75.8577,lat:22.7196},
  {name:'Ranchi',region:'Jharkhand',lon:85.3096,lat:23.3441},
  {name:'Raipur',region:'Chhattisgarh',lon:81.6296,lat:21.2514},
  {name:'Guwahati',region:'Assam',lon:91.7362,lat:26.1445},
  {name:'Chandigarh',region:'Chandigarh',lon:76.7794,lat:30.7333},
  {name:'Srinagar',region:'Jammu and Kashmir',lon:74.7973,lat:34.0837},
  {name:'Jammu',region:'Jammu and Kashmir',lon:74.8570,lat:32.7266},
  {name:'Leh',region:'Ladakh',lon:77.5770,lat:34.1526},
  {name:'Panaji',region:'Goa',lon:73.8278,lat:15.4909},
  {name:'Kochi',region:'Kerala',lon:76.2673,lat:9.9312},
  {name:'Puducherry',region:'Puducherry',lon:79.8083,lat:11.9416},
  {name:'Sri Vijaya Puram',region:'Andaman and Nicobar Islands',lon:92.7265,lat:11.6234,aliases:['Port Blair']}
]);
export const PILOT_PROVENANCE = Object.freeze({
  category:'approximate pilot city centres',
  coverage:`${PILOT_PLACES.length} manually curated entries`,
  verification:'not survey-verified or licensed as an authoritative place database',
  intendedUse:'search, progressive rendering and interaction demonstration only'
});
export function pilotFeatureCollection(places=PILOT_PLACES){return {type:'FeatureCollection',features:places.map((p,i)=>({type:'Feature',id:i+1,properties:{name:p.name,region:p.region,pilot:true},geometry:{type:'Point',coordinates:[p.lon,p.lat]}}))};}
