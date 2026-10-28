/* Small, progressive-enhancement-only explorer shortcuts; no boundary inference. */
'use strict';
(()=>{
 const search=document.getElementById('search-input');
 if(!search)return;
 for(const button of document.querySelectorAll('[data-atlas-search]')){
  button.addEventListener('click',()=>{
   search.value=button.dataset.atlasSearch;
   search.dispatchEvent(new Event('input',{bubbles:true}));
   const openSearch=document.getElementById('atlas-quick-search');
   if(openSearch)openSearch.click();else search.focus();
  });
 }
})();
