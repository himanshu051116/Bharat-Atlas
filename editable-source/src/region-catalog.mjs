/** Bharat Atlas 1.0: region-name catalogue only; NEVER polygon or boundary evidence.
 * English region classification aligned to National Portal of India IGOD directory
 * https://www.india.gov.in/directory/web-directory/state-uts
 * Hindi names are interface aliases, not formal authoritative translations.
 */
import {normalizeQuery} from './search.mjs';
export const ATLAS_REGIONS=Object.freeze([
  {
    "name": "Andhra Pradesh",
    "hindi": "आंध्र प्रदेश",
    "kind": "State"
  },
  {
    "name": "Arunachal Pradesh",
    "hindi": "अरुणाचल प्रदेश",
    "kind": "State"
  },
  {
    "name": "Assam",
    "hindi": "असम",
    "kind": "State"
  },
  {
    "name": "Bihar",
    "hindi": "बिहार",
    "kind": "State"
  },
  {
    "name": "Chhattisgarh",
    "hindi": "छत्तीसगढ़",
    "kind": "State"
  },
  {
    "name": "Goa",
    "hindi": "गोवा",
    "kind": "State"
  },
  {
    "name": "Gujarat",
    "hindi": "गुजरात",
    "kind": "State"
  },
  {
    "name": "Haryana",
    "hindi": "हरियाणा",
    "kind": "State"
  },
  {
    "name": "Himachal Pradesh",
    "hindi": "हिमाचल प्रदेश",
    "kind": "State"
  },
  {
    "name": "Jharkhand",
    "hindi": "झारखंड",
    "kind": "State"
  },
  {
    "name": "Karnataka",
    "hindi": "कर्नाटक",
    "kind": "State"
  },
  {
    "name": "Kerala",
    "hindi": "केरल",
    "kind": "State"
  },
  {
    "name": "Madhya Pradesh",
    "hindi": "मध्य प्रदेश",
    "kind": "State"
  },
  {
    "name": "Maharashtra",
    "hindi": "महाराष्ट्र",
    "kind": "State"
  },
  {
    "name": "Manipur",
    "hindi": "मणिपुर",
    "kind": "State"
  },
  {
    "name": "Meghalaya",
    "hindi": "मेघालय",
    "kind": "State"
  },
  {
    "name": "Mizoram",
    "hindi": "मिजोरम",
    "kind": "State"
  },
  {
    "name": "Nagaland",
    "hindi": "नागालैंड",
    "kind": "State"
  },
  {
    "name": "Odisha",
    "hindi": "ओडिशा",
    "kind": "State"
  },
  {
    "name": "Punjab",
    "hindi": "पंजाब",
    "kind": "State"
  },
  {
    "name": "Rajasthan",
    "hindi": "राजस्थान",
    "kind": "State"
  },
  {
    "name": "Sikkim",
    "hindi": "सिक्किम",
    "kind": "State"
  },
  {
    "name": "Tamil Nadu",
    "hindi": "तमिलनाडु",
    "kind": "State"
  },
  {
    "name": "Telangana",
    "hindi": "तेलंगाना",
    "kind": "State"
  },
  {
    "name": "Tripura",
    "hindi": "त्रिपुरा",
    "kind": "State"
  },
  {
    "name": "Uttar Pradesh",
    "hindi": "उत्तर प्रदेश",
    "kind": "State"
  },
  {
    "name": "Uttarakhand",
    "hindi": "उत्तराखंड",
    "kind": "State"
  },
  {
    "name": "West Bengal",
    "hindi": "पश्चिम बंगाल",
    "kind": "State"
  },
  {
    "name": "Andaman and Nicobar Islands",
    "hindi": "अंडमान और निकोबार द्वीपसमूह",
    "kind": "Union territory"
  },
  {
    "name": "Chandigarh",
    "hindi": "चंडीगढ़",
    "kind": "Union territory"
  },
  {
    "name": "Dadra and Nagar Haveli and Daman and Diu",
    "hindi": "दादरा और नगर हवेली और दमन और दीव",
    "kind": "Union territory"
  },
  {
    "name": "Delhi",
    "hindi": "दिल्ली",
    "kind": "Union territory"
  },
  {
    "name": "Jammu and Kashmir",
    "hindi": "जम्मू और कश्मीर",
    "kind": "Union territory"
  },
  {
    "name": "Ladakh",
    "hindi": "लद्दाख",
    "kind": "Union territory"
  },
  {
    "name": "Lakshadweep",
    "hindi": "लक्षद्वीप",
    "kind": "Union territory"
  },
  {
    "name": "Puducherry",
    "hindi": "पुदुचेरी",
    "kind": "Union territory"
  }
].map(x=>Object.freeze(x)));
export function atlasRegionCatalogueSearch(query='', filter='all', availableNames=[]){
 const normalized=normalizeQuery(query);const available=new Set(availableNames.map(normalizeQuery));
 return ATLAS_REGIONS.filter(x=>(filter==='all'||x.kind===filter)&&!available.has(normalizeQuery(x.name)))
  .map(x=>{const terms=[x.name,x.hindi];const rank=normalized ? Math.min(...terms.map(t=>{const n=normalizeQuery(t);return n===normalized?0:n.startsWith(normalized)?1:n.includes(normalized)?2:99})) : 0;return {kind:'region-catalog',name:x.name,subtitle:`${x.hindi} · ${x.kind} · name catalogue, no verified polygon`,entry:x,rank};})
  .filter(x=>x.rank!==99)
  .sort((a,b)=>a.rank-b.rank||a.name.localeCompare(b.name));
}
export function atlasCatalogueSummary(){return {states:ATLAS_REGIONS.filter(x=>x.kind==='State').length,unionTerritories:ATLAS_REGIONS.filter(x=>x.kind==='Union territory').length,verifiedPolygons:0,source:'National Portal of India (IGOD) — names only, no geometry'}};
