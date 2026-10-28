from pathlib import Path
R=Path(__file__).resolve().parents[1]
html=(R/'world.html').read_text()
html=html.replace('<g id="official-india-layer"', '<g id="world-physical-layer" aria-label="Historical world waterways"></g><g id="world-fine-boundary-layer" aria-label="Optional more detailed country outlines"></g><g id="world-admin1-layer" aria-label="Source-labelled non-Indian state and province boundaries"></g><g id="official-india-layer"')
html=html.replace('<g id="capital-markers"', '<g id="world-city-layer" aria-label="Source-backed city and mountain markers"></g><g id="capital-markers"')
html=html.replace(' <div class="capital-status" id="capital-status"', ''' <details class="world-detail-controls" id="world-detail-controls"><summary>More map detail · rivers, cities, states &amp; terrain</summary>
 <div class="world-detail-toggles" role="group" aria-label="Optional geography layers">
 <button type="button" id="world-waterways-toggle" aria-pressed="true" disabled>World rivers</button>
 <button type="button" id="world-cities-toggle" aria-pressed="false" disabled>Major cities</button>
 <button type="button" id="world-admin1-toggle" aria-pressed="false" disabled>States / provinces</button>
 <button type="button" id="world-lakes-toggle" aria-pressed="false" disabled>Lakes</button>
 <button type="button" id="world-peaks-toggle" aria-pressed="false" disabled>Mountain peaks</button>
 <button type="button" id="world-fine-toggle" aria-pressed="false" disabled>Detailed country lines</button>
 </div><p id="world-detail-status" role="status" aria-live="polite">Loading optional local world geography. Some layers may not be installed.</p>
 <div id="world-city-results" class="world-city-results" aria-label="Matching source-listed cities"></div>
 </details>
 <div class="capital-status" id="capital-status"''')
html=html.replace('<script defer src="./world.js"></script>', '<script defer src="./world.js"></script><script defer src="./world-detail.js"></script>')
(R/'world.html').write_text(html)
js=(R/'world.js').read_text()
js=js.replace("function setView(v){", "function setView(v){")
js=js.replace('updateLabels();renderCapitals()}','updateLabels();renderCapitals();window.dispatchEvent(new CustomEvent("bharat-world-camera",{detail:{view:state.view}}))}',1)
js=js.replace('function choose(c,focus=false){state.selected=c.id;', 'function choose(c,focus=false){state.selected=c.id;window.dispatchEvent(new CustomEvent("bharat-world-country",{detail:{iso3:c.iso3,name:c.name}}));',1)
js=js.replace('renderGrid();load().then(async()=>', '''window.BharatWorldBridge={
 view:()=>({...state.view}),
 selectedCountry:()=>state.byId.get(state.selected)||null,
 findCountry:iso=>state.countries.find(c=>c.iso3===iso)||null,
 chooseIso:(iso,focus=false)=>{const c=state.countries.find(v=>v.iso3===iso);if(c)choose(c,focus);return Boolean(c)},
 focusPoint:(lon,lat)=>{const west=Math.max(-180,lon-5),east=Math.min(180,lon+5);gotoExtent([west,Math.max(-85,lat-5),east,Math.min(85,lat+5)],75)}
};
renderGrid();load().then(async()=>''')
(R/'world.js').write_text(js)
css=(R/'world.css').read_text()
css+='''\n/* World detail layers are source-backed and independently switchable. */
.world-detail-controls{border:1px solid #d7e7d9;background:#f9fcf8;border-radius:12px;margin:13px 0;padding:12px 14px}
.world-detail-controls summary{cursor:pointer;font-size:12px;font-weight:800;color:#285b49;min-height:24px}
.world-detail-toggles{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0}
.world-detail-toggles button{border:1px solid #c8dfd0;color:#285844;background:#fff;border-radius:18px;padding:8px 11px;font-weight:700;font-size:11px;cursor:pointer}
.world-detail-toggles button[aria-pressed="true"]{background:#256950;color:#fff;border-color:#256950}
.world-detail-toggles button:disabled{opacity:.42;cursor:not-allowed}
#world-detail-status{font-size:11px;color:#617b6b;line-height:1.6;margin:8px 0}
#world-physical-layer,#world-fine-boundary-layer,#world-admin1-layer{pointer-events:none}
#world-physical-layer path{stroke:#66a6b5;stroke-width:1.1;vector-effect:non-scaling-stroke;fill:none;opacity:.7}
#world-fine-boundary-layer path{stroke:#7c9988;stroke-width:.9;vector-effect:non-scaling-stroke;fill:none;opacity:.8}
#world-admin1-layer path{stroke:#44745c;stroke-width:1;stroke-dasharray:2 2;vector-effect:non-scaling-stroke;fill:none;opacity:.95}
#world-city-layer .detail-city{fill:#e9934d;stroke:#fff;stroke-width:1.4;vector-effect:non-scaling-stroke;cursor:pointer}
#world-city-layer .detail-peak{fill:#7e7461;stroke:#fff;stroke-width:1.2;vector-effect:non-scaling-stroke;pointer-events:none}
.world-city-results{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.world-city-results button{font-size:11px;background:white;border:1px solid #d3e4d5;color:#24654b;border-radius:20px;padding:6px 10px;cursor:pointer}
.world-city-results:empty{display:none}
@media(max-width:680px){.world-detail-controls{padding:10px;margin:10px 0}.world-detail-toggles button{padding:7px 9px;font-size:10px}}
'''
(R/'world.css').write_text(css)
print('patched',len(js))
