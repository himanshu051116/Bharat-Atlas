/* Batch expensive map overlays until the camera settles. Pure and testable. */
'use strict';
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BharatCameraScheduler=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 function create({onSettle,onMoving=()=>{},idleMs=95,setDelay=setTimeout,clearDelay=clearTimeout}={}){
  if(typeof onSettle!=='function')throw new TypeError('onSettle is required');
  let timer=null,moving=false;
  function flush(){
   if(timer!==null){clearDelay(timer);timer=null}
   if(!moving)return false;
   moving=false;onSettle();return true;
  }
  function defer(){
   if(!moving){moving=true;onMoving()}
   if(timer!==null)clearDelay(timer);
   timer=setDelay(()=>{timer=null;flush()},idleMs);
  }
  function dispose(){if(timer!==null){clearDelay(timer);timer=null}moving=false}
  return {defer,flush,dispose,isMoving:()=>moving};
 }
 return {create};
});
