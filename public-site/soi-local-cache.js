/* Bharat Atlas opt-in, same-origin, on-device Survey of India geometry cache.
 * Stores converted feature collections, never the original government archive.
 * No fetch, telemetry or network APIs are used in this module.
 */
(function(root){
  'use strict';
  const NAME='bharat-atlas-soi-local-v1';
  const STORE='datasets';
  const VERSION=1;
  const EXPECTED=Object.freeze({
    states:'b8325e5d9dd0f04a6663d775363fe38cd2f23bd9dbae3fb7118b4e6e0ce0bcb7',
    outline:'bf48477f01fe8addd6384490fc6f8decc9643110331ffef2c3f17e5cccd53b88'
  });
  function available(){return Boolean(root.indexedDB);}
  function open(){
    return new Promise((resolve,reject)=>{
      if(!available()){reject(Error('This browser does not support IndexedDB'));return}
      const request=root.indexedDB.open(NAME,VERSION);
      request.onupgradeneeded=()=>{
        if(!request.result.objectStoreNames.contains(STORE))
          request.result.createObjectStore(STORE,{keyPath:'type'});
      };
      request.onerror=()=>reject(request.error||Error('Unable to open local database'));
      request.onblocked=()=>reject(Error('Local database is blocked by another open tab'));
      request.onsuccess=()=>resolve(request.result);
    });
  }
  async function transaction(mode,operation){
    const db=await open();
    try{
      return await new Promise((resolve,reject)=>{
        let result;
        const tx=db.transaction(STORE,mode);
        const store=tx.objectStore(STORE);
        tx.oncomplete=()=>resolve(result);
        tx.onerror=()=>reject(tx.error||Error('Local boundary storage failed'));
        tx.onabort=()=>reject(tx.error||Error('Local boundary transaction aborted'));
        try{
          const request=operation(store);
          if(request){request.onsuccess=()=>{result=request.result};request.onerror=()=>reject(request.error||Error('Local boundary request failed'))}
        }catch(error){reject(error);tx.abort()}
      });
    }finally{db.close()}
  }
  function validate(record){
    if(!record||!Object.hasOwn(EXPECTED,record.type))return false;
    if(record.details?.hash!==EXPECTED[record.type]||record.details?.verifiedOfficial!==true)return false;
    if(record.data?.type!=='FeatureCollection'||!Array.isArray(record.data.features))return false;
    const count=record.data.features.length;
    if(record.type==='states'&&(count<28||count>65))return false;
    if(record.type==='outline'&&count!==1)return false;
    return record.data.features.every(f=>f?.type==='Feature'&&
      ['Polygon','MultiPolygon'].includes(f.geometry?.type)&&Array.isArray(f.geometry?.coordinates));
  }
  async function save(data,details){
    const type=details?.type;
    const record={type,data,details,savedAt:Date.now()};
    if(!validate(record))throw Error('Only a validated, pinned Survey of India source may be remembered');
    return transaction('readwrite',store=>store.put(record));
  }
  async function load(){
    const records=await transaction('readonly',store=>store.getAll());
    return records.filter(validate);
  }
  async function clear(){return transaction('readwrite',store=>store.clear())}
  root.BharatAtlasLocalBoundaries={available,save,load,clear,expectedHashes:EXPECTED};
})(window);

