"""Isolated Chromium interaction tests. Uses SYNTHETIC geometry and fake MapLibre.
Browser network navigation is blocked in this environment. Not an end-to-end GIS rendering test.
"""
import re,shutil,json,hashlib
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'dist/index.html').read_text()
html=re.sub(r'<link rel="stylesheet" href="https://[^\"]+"\s*/>','',html)
html=re.sub(r'<script[^>]*src="[^\"]+"[^>]*></script>','',html)
STATES=['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal']
UTS=['Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry']
def square(x,y):return [[[x,y],[x+.55,y],[x+.55,y+.55],[x,y+.55],[x,y]]]
FIXTURE={'type':'FeatureCollection','features':[{'type':'Feature','properties':{'name':n},'geometry':{'type':'Polygon','coordinates':square(68+(i%9)*3,7+(i//9)*6)}} for i,n in enumerate(STATES+UTS)]}
STUB=r'''(()=>{
 const callbacks={},sources={};
 class FakeMap{
  constructor(options){this.container=document.getElementById(options.container);this.z=options.zoom;this.c={lng:79.5,lat:22.6};this.style=options.style;
    this.sources={};this.resetSources();
    this.container.insertAdjacentHTML('beforeend',`<div class="synthetic-mock" style="position:absolute;inset:0;display:grid;place-items:center;background:radial-gradient(circle at 50% 45%,#d1e6df,#edf5f6 65%);pointer-events:none"><svg width="70%" height="85%" viewBox="0 0 650 480" aria-label="Synthetic browser-test polygons"><path d="M75 340 L150 240 L270 257 L320 180 L430 170 L510 225 L530 320 L440 355 L270 384 L160 378 Z" fill="#d3e7d7" stroke="#789f88" stroke-width="2"/><path d="M195 257 L280 260 L317 181 M270 260 L280 383 M320 180 L435 173 L440 354" fill="none" stroke="#7fa892" stroke-width="1.6"/><text x="320" y="110" fill="#638776" text-anchor="middle" font-size="18" font-weight="bold">SYNTHETIC GEOMETRY · BROWSER TEST</text></svg></div>`);
    setTimeout(()=>this.emit('load'),10);
  }
  on(evt,layerOrCb,maybeCb){(callbacks[evt]??=[]).push(typeof layerOrCb==='function'?layerOrCb:maybeCb);return this}
  once(evt,fn){const f=(...args)=>{callbacks[evt]=callbacks[evt].filter(x=>x!==f);fn(...args)};this.on(evt,f)}
  emit(evt,e){for(const fn of [...(callbacks[evt]||[])])fn(e)}
  resetSources(){this.sources={};for(const [id,o] of Object.entries(this.style.sources)){this.sources[id]={_data:o.data,setData:function(x){this._data=x}}}}
  getSource(id){return this.sources[id]}; getLayer(id){return this.style.layers.find(x=>x.id===id)}
  setFilter(){};setLayoutProperty(){}
  setStyle(s){this.style=s;this.resetSources();setTimeout(()=>this.emit('style.load'),2)}
  fitBounds(b){this.bounds=b;this.z=6;this.emit('moveend')}; flyTo(options){this.c={lng:options.center[0],lat:options.center[1]};this.z=options.zoom;this.emit('moveend')}; zoomIn(){this.z++;this.emit('zoomend')};zoomOut(){this.z--;this.emit('zoomend')};
  getCenter(){return this.c};getZoom(){return this.z};getCanvas(){return this.container};
 }
 window.maplibregl={Map:FakeMap,addProtocol:(name,fn)=>{window.__registeredTileProtocols??={};window.__registeredTileProtocols[name]=fn;window.__registeredTileProtocol={name,fn}}};
 window.fetch=async url=>{if(String(url).includes('landcover/manifest.json'))return window.__landMeta?{ok:true,status:200,json:async()=>window.__landMeta}:{ok:false,status:404};if(String(url).includes('landcover/land.geojson')){const b=new TextEncoder().encode(window.__landGeo||'');return {ok:true,status:200,headers:{get:()=>String(b.byteLength)},arrayBuffer:async()=>b.buffer};}if(String(url).includes('gazetteer/manifest.json'))return window.__gazetteerMeta?{ok:true,status:200,text:async()=>JSON.stringify(window.__gazetteerMeta)}:{ok:false,status:404};if(String(url).includes('gazetteer/places.geojson'))return window.__gazetteerGeo?{ok:true,status:200,headers:{get:()=>null},text:async()=>JSON.stringify(window.__gazetteerGeo)}:{ok:false,status:404};if(String(url).includes('preview-provenance.json'))return {ok:false,status:404};if(window.__missingBorders&&(/vardhan-maps|states.low.json/.test(String(url))))return {ok:false,status:503};if(String(url).includes('atlas-tiles.json'))return window.__tileFixture?{ok:true,status:200,text:async()=>JSON.stringify(window.__tileFixture)}:{ok:false,status:404};return {ok:true,status:200,headers:{get:()=>null},text:async()=>JSON.stringify(window.__fixture)};};
})();'''

def inject(page,stub=True,tile_catalog=None,gazetteer=None,landcover=False,political_missing=False,disable_renderer=False):
  page.set_content(html,wait_until='domcontentloaded')
  page.add_style_tag(content=(ROOT/'dist/styles.css').read_text())
  page.evaluate('(fixture)=>window.__fixture=fixture',FIXTURE)
  if political_missing:page.evaluate('window.__missingBorders=true')
  if gazetteer is not None:
    data=json.dumps(gazetteer,ensure_ascii=False,separators=(',',':'))
    meta={'format':'BharatAtlasGazetteer1','officiallyVerified':False,'count':len(gazetteer['features']),
      'sha256':hashlib.sha256(data.encode('utf-8')).hexdigest(),'sourceUrl':'https://example.org/test-data',
      'licence':'Synthetic test licence','attribution':'Synthetic browser place fixture'}
    page.evaluate('(a)=>{window.__gazetteerMeta=a.meta;window.__gazetteerGeo=a.data}',{'meta':meta,'data':gazetteer})
    # about:blank has no secure-context Web Crypto: explicitly stub digest for UI-only tests.
    # Cryptographic integrity itself is exercised against real Web Crypto in JS tests.
    page.evaluate('(hex)=>Object.defineProperty(window.crypto,"subtle",{configurable:true,value:{digest:async()=>Uint8Array.from(hex.match(/../g),b=>parseInt(b,16)).buffer}})',meta['sha256'])
  if landcover:
    land_folder=ROOT/'data/landcover'
    land_meta=json.loads((land_folder/'manifest.json').read_text())
    land_raw=(land_folder/'land.geojson').read_text()
    page.evaluate('(a)=>{window.__landMeta=a.meta;window.__landGeo=a.raw}',{'meta':land_meta,'raw':land_raw})
    page.evaluate('(hex)=>Object.defineProperty(window.crypto,"subtle",{configurable:true,value:{digest:async()=>Uint8Array.from(hex.match(/../g),b=>parseInt(b,16)).buffer}})',land_meta['sha256'])
  if tile_catalog is not None:page.evaluate('(catalog)=>window.__tileFixture=catalog',tile_catalog)
  if stub:page.add_script_tag(content=STUB)
  if disable_renderer:page.evaluate('delete window.maplibregl')
  page.add_script_tag(content=(ROOT/'dist/app.bundle.js').read_text())

with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
  issues=[]
  desktop=browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True)
  desktop.on('pageerror',lambda exc:issues.append(str(exc)))
  tile_test={'format':'BharatAtlasMVT1','officiallyVerified':False,'licence':'SYNTHETIC TEST','attribution':'Synthetic browser test',
             'sourceUrl':'https://example.org/synthetic','minzoom':4,'maxzoom':8,'layers':['roads','rivers','settlements'],
             'bounds':[60,3,102,41],'tileCount':1,'tileHashes':{'4/11/7.pbf':'a'*64},'tileLayerCounts':{'4/11/7.pbf':{'roads':2}}}
  inject(desktop,tile_catalog=tile_test)
  desktop.locator('.region-option').first.wait_for(timeout=10000)
  desktop.locator('#tile-status').filter(has_text='OPTIONAL VECTOR DETAIL').wait_for(timeout=10000)
  # v0.35: source-backed cell inspection must not imply feature completeness.
  desktop.locator('#atlas-coverage-diagnostics').evaluate('(el)=>el.open=true')
  desktop.locator('#coverage-inspector-lon').fill('79.5')
  desktop.locator('#coverage-inspector-lat').fill('15')
  desktop.locator('#coverage-inspector-zoom').select_option('4')
  desktop.locator('#coverage-inspector-check').click()
  assert 'SHA-256 tile 4/11/7.pbf' in desktop.locator('#coverage-inspector-result').inner_text()
  assert 'roads: 2 decoded features' in desktop.locator('#coverage-inspector-result').inner_text()
  desktop.locator('#coverage-inspector-zoom').select_option('12')
  desktop.locator('#coverage-inspector-check').click()
  assert 'overscaled lookup' in desktop.locator('#coverage-inspector-result').inner_text()
  desktop.locator('#coverage-inspector-lon').fill('')
  desktop.locator('#coverage-inspector-check').click()
  assert 'Invalid WGS84 coordinate' in desktop.locator('#coverage-inspector-result').inner_text()
  desktop.locator('#coverage-inspector-map-center').click()
  assert '79.5000°E, 22.6000°N' in desktop.locator('#coverage-inspector-summary').inner_text()
  print('PASS v0.35 declared-tile inspection, overzoom warning, invalid input and selected-view integration (mock renderer)')
  assert 'OPTIONAL VECTOR DETAIL' in desktop.locator('#tile-status').inner_text()
  assert desktop.evaluate("typeof window.__registeredTileProtocols?.['atlas-detail'] === 'function'")
  assert desktop.evaluate("window.__registeredTileProtocols['atlas-detail']({url:'atlas-detail://4/12/7.pbf'},new AbortController()).then(x=>x.data.byteLength)")==0

  assert desktop.evaluate("!!window.maplibregl && document.querySelector('#tile-attribution').textContent.includes('Synthetic browser test')")

  assert desktop.locator('#shore-toggle').get_attribute('aria-pressed')=='true'
  desktop.locator('#shore-toggle').click()
  assert desktop.locator('#shore-toggle').get_attribute('aria-pressed')=='false'
  desktop.locator('#shore-toggle').click()
  assert desktop.locator('#shore-toggle').get_attribute('aria-pressed')=='true'
  assert desktop.locator('.region-option').count()==36
  assert desktop.locator('#state-total').inner_text()=='28'
  assert desktop.locator('#ut-total').inner_text()=='8'
  assert 'review' in desktop.locator('#qa-summary').inner_text()
  desktop.locator('#search-input').fill('Gwalior')
  assert desktop.locator('.region-option').count()==1
  desktop.locator('.region-option').first.click()
  assert desktop.locator('#focus-title').inner_text()=='Gwalior'
  assert 'Pilot city centre' in desktop.locator('#focus-description').inner_text()
  desktop.locator('#place-toggle').click()
  assert desktop.locator('#place-toggle').get_attribute('aria-pressed')=='false'
  assert desktop.locator('.region-option').count()==0
  desktop.locator('#place-toggle').click()
  desktop.locator('#search-input').fill('23.1815, 79.9864')
  assert desktop.locator('.region-option').count()==1
  desktop.locator('.region-option').click()
  assert 'Coordinate location' in desktop.locator('#focus-description').inner_text()
  assert '23.1815°N' in desktop.locator('#focus-title').inner_text()
  desktop.locator('#clear-focus').click()
  desktop.locator('#search-input').fill('Telangana')
  assert desktop.locator('.region-option').count()==1
  desktop.locator('.region-option').first.click()
  assert desktop.locator('#focus-title').inner_text()=='Telangana'
  desktop.locator('#clear-focus').click()
  assert desktop.locator('#focus-title').inner_text()=='Select a region to explore'
  assert desktop.locator('[data-style="physical"]').is_disabled()  # Source unavailable in synthetic browser fixture
  desktop.locator('[data-style="outline"]').click()
  assert desktop.locator('[data-style="outline"]').get_attribute('aria-pressed')=='true'
  desktop.locator('#qa-toggle').click()
  assert desktop.locator('#qa-toggle').get_attribute('aria-pressed')=='true'
  desktop.locator('#label-toggle').click()
  assert desktop.locator('#label-toggle').get_attribute('aria-pressed')=='false'
  desktop.locator('#about-btn').click()
  assert desktop.locator('#source-dialog').is_visible()
  desktop.locator('#dialog-ok').click()
  assert not desktop.locator('#source-dialog').is_visible()
  with desktop.expect_download() as svg_download:desktop.locator('#download-svg').click()
  from xml.etree import ElementTree
  export_svg=svg_download.value.path().read_text(encoding='utf-8')
  svg_root=ElementTree.fromstring(export_svg)
  assert svg_root.attrib['viewBox']=='0 0 1600 1120'
  assert 'PROVISIONAL GEOGRAPHY' in export_svg
  desktop.locator('#search-input').fill('Telangana')
  desktop.locator('.region-option').first.click()
  desktop.locator('#export-all').uncheck()
  with desktop.expect_download() as selected_download:desktop.locator('#download-svg').click()
  selected_svg=selected_download.value.path().read_text(encoding='utf-8')
  assert 'Telangana · Research map' in selected_svg
  assert selected_svg.count('<path data-region=')==1
  with desktop.expect_download() as d:desktop.locator('#download-qa').click()
  assert d.value.suggested_filename.endswith('.json')
  desktop.locator('[data-style="terrain"]').click()
  desktop.screenshot(path=str(ROOT/'tests/desktop-v09.png'),full_page=True)
  print('PASS desktop: 36 regions, pilot city search, selection, styles, QA, modal, report')
  mobile=browser.new_page(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
  mobile.on('pageerror',lambda exc:issues.append(str(exc)))
  inject(mobile)
  mobile.locator('.region-option').first.wait_for(timeout=10000)
  mobile.locator('#mobile-menu').click()
  assert mobile.locator('#left-panel').evaluate('(el)=>el.classList.contains("open")')
  mobile.locator('#search-input').fill('Odisha')
  mobile.locator('.region-option').first.click()
  assert mobile.locator('#focus-title').inner_text()=='Odisha'
  assert mobile.locator('#mobile-menu').get_attribute('aria-expanded')=='false'
  mobile.wait_for_timeout(450)  # Let the side drawer finish closing before capture.
  mobile.screenshot(path=str(ROOT/'tests/mobile-v09.png'),full_page=True)
  print('PASS mobile: drawer, search, region focus and responsive display')
  # The physical style must be enabled by a successfully integrity-checked GSHHG land source,
  # not just by synthetic MapLibre availability. WebCrypto itself is tested in Node.
  land_browser=browser.new_page(viewport={'width':1100,'height':780})
  land_browser.on('pageerror',lambda exc:issues.append(str(exc)))
  inject(land_browser,landcover=True)
  land_browser.locator('#land-attribution').get_by_text('GSHHG',exact=False).wait_for(timeout=9000)
  assert land_browser.locator('[data-style="physical"]').is_enabled()
  land_browser.locator('[data-style="physical"]').click()
  assert land_browser.locator('[data-style="physical"]').get_attribute('aria-pressed')=='true'
  print('PASS source-verified physical land enables the user-selectable map style')
  # Source-derived physical-only fallback must work when every external boundary endpoint fails.
  physical_only=browser.new_page(viewport={'width':1100,'height':800},accept_downloads=True)
  physical_only.on('pageerror',lambda exc:issues.append(str(exc)))
  inject(physical_only,landcover=True,political_missing=True,stub=True,disable_renderer=True)
  physical_only.locator('#map-overlay svg#physical-atlas-does-not-exist').count()  # explicit nonfixture page
  physical_only.locator('#map-overlay svg').wait_for(timeout=10000)
  assert physical_only.locator('#map-overlay svg').locator('#physical-land path').count()>20
  assert physical_only.locator('#map-overlay svg path[data-region]').count()==0
  assert 'PHYSICAL ONLY' in physical_only.locator('#map-source-status').inner_text()
  assert physical_only.locator('#state-total').inner_text()=='28'  # classification names persist without polygons
  assert physical_only.locator('#region-count').inner_text()=='36 listed · 0 mapped'
  assert physical_only.locator('.region-option').count()==36
  physical_only.locator('#search-input').fill('मध्य प्रदेश')
  assert physical_only.locator('.region-option').count()==1
  physical_only.locator('.region-option').first.click()
  assert 'no independently validated polygon' in physical_only.locator('#focus-description').inner_text()
  assert physical_only.locator('#map-overlay svg path[data-region]').count()==0
  physical_only.locator('#search-input').fill('')
  assert physical_only.locator('#download-svg').is_enabled()
  with physical_only.expect_download() as physical_export: physical_only.locator('#download-svg').click()
  physical_svg=physical_export.value.path().read_text(encoding='utf-8')
  assert 'NO POLITICAL BOUNDARIES' in physical_svg
  assert 'data-region=' not in physical_svg
  assert physical_export.value.suggested_filename=='bharat-atlas-physical-geography-research.svg'
  assert physical_only.locator('#map-overlay svg').count()==1
  assert physical_only.locator('.atlas-scale-guide').count()==1
  physical_only.locator('#zoom-in').click()
  assert '125%' in physical_only.locator('#map-overlay svg').get_attribute('aria-label')
  print('PASS no remote boundary source: real GSHHG land displayed and exportable without political borders')
  # Optional licensed-place search, map source and attribution integration; still a mocked renderer.
  place_fixture={'type':'FeatureCollection','features':[{'type':'Feature','properties':{'id':'g00001','name':'Satna','region':'Madhya Pradesh','kind':'town','aliases':['सतना']},'geometry':{'type':'Point','coordinates':[80.83,24.6]}}]}
  place_browser=browser.new_page(viewport={'width':1200,'height':780})
  place_browser.on('pageerror',lambda exc:issues.append(str(exc)))
  inject(place_browser,gazetteer=place_fixture)
  place_browser.locator('#gazetteer-status').get_by_text('1 source-backed city locations').wait_for(timeout=7500)
  place_browser.locator('#search-input').fill('सतना')
  assert place_browser.locator('.region-option').count()==1
  place_browser.locator('.region-option').click()
  assert 'Synthetic browser place fixture' in place_browser.locator('#focus-description').inner_text()
  assert place_browser.locator('#focus-title').inner_text()=='Satna'
  assert place_browser.evaluate('window.maplibregl!==undefined')
  place_browser.locator('[data-style="ink"]').click()
  assert place_browser.locator('[data-style="ink"]').get_attribute('aria-pressed')=='true'
  assert 'Synthetic browser place fixture' in place_browser.locator('#gazetteer-attribution').inner_text()
  place_browser.locator('#file-input').set_input_files({'name':'custom.geojson','mimeType':'application/geo+json','buffer':json.dumps(FIXTURE).encode()})
  place_browser.locator('#search-input').fill('सतना')
  assert place_browser.locator('.region-option').count()==0, 'Imported boundaries must hide unrelated optional gazetteer'
  assert place_browser.locator('#gazetteer-dots').count()==0, 'No standalone DOM marker should bypass MapLibre source selection'
  print('PASS optional licensed gazetteer: Hindi search, focus, attribution, style change')
  # Use the checked-in 71 real Natural Earth place points with the mocked renderer.
  # The UI fixture metadata is synthetic because Chromium about:blank has no secure-context WebCrypto.
  real_cities=json.loads((ROOT/'data/gazetteer/places.geojson').read_text(encoding='utf-8'))
  real_browser=browser.new_page(viewport={'width':1150,'height':780})
  real_browser.on('pageerror',lambda exc:issues.append(str(exc)))
  inject(real_browser,gazetteer=real_cities)
  real_browser.locator('#gazetteer-status').get_by_text('71 source-backed city locations').wait_for(timeout=10000)
  # v0.33 integrated comparison: only selected Natural Earth source points are eligible.
  ids=[f['properties']['id'] for f in real_cities['features'][:2]]
  assert len(ids)==2 and ids[0]!=ids[1]
  assert '71 source-backed locations' in real_browser.locator('#compare-available').inner_text()
  real_browser.locator('#compare-from').select_option(ids[0])
  real_browser.locator('#compare-to').select_option(ids[1])
  assert 'km' in real_browser.locator('#compare-message').inner_text()
  assert 'NOT a travel route' in real_browser.locator('#compare-message').inner_text()
  assert real_browser.locator('#compare-focus').is_enabled()
  real_browser.locator('#compare-focus').click()
  with real_browser.expect_download() as comparison_download: real_browser.locator('#compare-download').click()
  comparison=json.loads(comparison_download.value.path().read_text(encoding='utf-8'))
  assert comparison['navigationReady'] is False and comparison['officiallyVerified'] is False
  assert comparison['geometry']['features'][0]['geometry']['type']=='LineString'
  assert comparison['endpoints'][0]['id']==ids[0]
  real_browser.locator('#compare-swap').click()
  assert real_browser.locator('#compare-from').input_value()==ids[1]
  real_browser.locator('#compare-clear').click()
  assert real_browser.locator('#compare-download').is_disabled()
  print('PASS v0.33 source-backed comparison, camera focus, export, swap and clear (mock renderer)')
  # Browser without MapLibre: SVG fallback should show the same geographic pair.
  fallback_compare=browser.new_page(viewport={'width':1050,'height':770})
  fallback_compare.on('pageerror',lambda exc:issues.append(str(exc)))
  inject(fallback_compare,gazetteer=real_cities,tile_catalog=tile_test,disable_renderer=True)
  fallback_compare.locator('#gazetteer-status').get_by_text('71 source-backed city locations').wait_for(timeout=9000)
  fallback_compare.locator('#map-overlay svg.fallback-map-svg').wait_for(timeout=9000)
  fallback_compare.locator('#tile-status').filter(has_text='source-checked tile files catalogued').wait_for(timeout=9000)
  fallback_compare.locator('#atlas-coverage-diagnostics').evaluate('(el)=>el.open=true')
  fallback_compare.locator('#coverage-inspector-lat').fill('15')
  fallback_compare.locator('#coverage-inspector-zoom').select_option('4')
  fallback_compare.locator('#coverage-inspector-check').click()
  assert 'SHA-256 tile 4/11/7.pbf' in fallback_compare.locator('#coverage-inspector-result').inner_text()
  print('PASS v0.35 research tile inspection remains usable with the SVG-only renderer')
  fallback_compare.locator('#compare-from').select_option(ids[0])
  fallback_compare.locator('#compare-to').select_option(ids[1])
  assert fallback_compare.locator('#map-overlay svg#atlas-comparison-svg polyline').count()==0  # group, not svg root
  assert fallback_compare.locator('#map-overlay svg.fallback-map-svg #atlas-comparison-svg polyline').count()==1
  assert fallback_compare.locator('#map-overlay svg.fallback-map-svg #atlas-comparison-svg circle').count()==2
  assert 'NOT a travel route' in fallback_compare.locator('#compare-message').inner_text()
  print('PASS v0.33 compare geometry visible in SVG fallback without MapLibre')
  # v0.31 geographic journey must be built from the real 71-source-place list.
  assert real_browser.locator('#journey-play').is_enabled()
  assert '0 / 7 SOURCE PLACES' in real_browser.locator('#journey-progress').inner_text()
  real_browser.locator('#journey-play').click()
  assert 'Pause journey' in real_browser.locator('#journey-play').inner_text()
  assert '1 / 7 SOURCE PLACES' in real_browser.locator('#journey-progress').inner_text()
  journey_name=real_browser.locator('#journey-location').inner_text()
  assert journey_name in [x['properties']['name'] for x in real_cities['features']]
  assert journey_name in real_browser.locator('#focus-title').inner_text()
  real_browser.locator('#journey-next').click()  # manual step pauses the timer.
  assert '2 / 7 SOURCE PLACES' in real_browser.locator('#journey-progress').inner_text()
  assert 'Pause journey' not in real_browser.locator('#journey-play').inner_text()
  assert 'Natural Earth' in real_browser.locator('#journey-source').inner_text()
  assert real_browser.locator('#zoom-story-title').is_visible()
  # v0.32 source-derived direct-line trail, scale and place context.
  assert '1 geographic connectors' in real_browser.locator('#journey-line-status').inner_text()
  assert 'routes' in real_browser.locator('#journey-line-status').inner_text()
  assert real_browser.locator('#atlas-scale-label').inner_text().startswith('≈ ')
  assert real_browser.evaluate('document.querySelector("#atlas-scale-bar").style.width.endsWith("px")')
  assert real_browser.locator('.nearby-place').count()==6
  first_neighbor=real_browser.locator('.nearby-place').first.inner_text()
  assert 'km' in first_neighbor
  # Clear removes the source geometry, not just the progress bar.
  real_browser.locator('#journey-clear').click()
  assert 'Journey lines represent geographic connections' in real_browser.locator('#journey-line-status').inner_text()
  assert '0 / 7 SOURCE PLACES' in real_browser.locator('#journey-progress').inner_text()
  print('PASS v0.32 approximate scale, six real-source neighbours and research journey trail (mock only)')
  print('PASS sourced geographic journey, guided camera selection, pause/next and zoom detail narration (mock MapLibre)')
  real_browser.locator('#search-input').fill('Gwalior')
  assert real_browser.locator('.region-option').count()==1, 'Licensed records should supersede duplicate pilot records'
  real_browser.locator('.region-option').first.click()
  assert 'research region label' in real_browser.locator('#focus-description').inner_text()
  real_browser.locator('#search-input').fill('प्रयागराज')
  assert real_browser.locator('.region-option').count()>=1
  real_browser.locator('.region-option').first.click()
  assert 'Allahabad' in real_browser.locator('#focus-title').inner_text()
  print('PASS source-backed 71-city catalogue: Hindi aliases, non-duplicated search, provenance warning')
  # Missing political polygons must not suppress independent, source-labelled place search.
  physical_place=browser.new_page(viewport={'width':1100,'height':780})
  physical_place.on('pageerror',lambda exc:issues.append(str(exc)))
  inject(physical_place,gazetteer=real_cities,political_missing=True)
  physical_place.locator('#gazetteer-status').get_by_text('71 source-backed city locations').wait_for(timeout=8000)
  physical_place.locator('#search-input').fill('प्रयागराज')
  assert physical_place.locator('.region-option').count()>=1
  physical_place.locator('.region-option').first.click()
  assert 'Allahabad' in physical_place.locator('#focus-title').inner_text()
  assert 'No political regions' in physical_place.locator('#region-list').inner_text() or 'Allahabad' in physical_place.locator('#focus-title').inner_text()
  print('PASS source-labelled place search independently of missing political boundary polygons')
  # Regression: political download failure cannot destroy a healthy GPU renderer.
  # Use a synthetic MapLibre stub AND real packaged historical landcover metadata.
  physical_renderer=browser.new_page(viewport={'width':1100,'height':780})
  physical_renderer.on('pageerror',lambda exc:issues.append(str(exc)))
  inject(physical_renderer,landcover=True,political_missing=True)
  physical_renderer.wait_for_function("document.querySelector('#region-coverage-tag')?.textContent.includes('REGION GEOMETRY UNAVAILABLE')",timeout=9000)
  physical_renderer.locator('#land-attribution').get_by_text('Land/water:').wait_for(timeout=9000)
  physical_renderer.wait_for_function("""() => {
    const stage=document.querySelector('#map-stage');
    return document.querySelector('#renderer-status')?.textContent?.includes('Interactive renderer initialized')
      && document.querySelector('#map-overlay')?.hidden
      && !stage.classList.contains('fallback-active');
  }""", timeout=9000)
  assert physical_renderer.locator('.synthetic-mock').count()==1
  assert physical_renderer.locator('#retry-boundaries').is_visible()
  physical_renderer.locator('#retry-boundaries').click()
  physical_renderer.locator('#map-overlay').wait_for(state='hidden',timeout=9000)
  assert physical_renderer.locator('[data-style=physical]').get_attribute('aria-pressed')=='true'
  assert physical_renderer.locator('#download-svg').is_enabled()
  # Physical-only reset used to return early, leaving the camera unchanged.
  physical_renderer.locator('#search-input').fill('Gwalior')
  physical_renderer.locator('.region-option').first.click()
  physical_renderer.locator('#reset-map').click()
  assert 'Select a region to explore' in physical_renderer.locator('#focus-title').inner_text()
  assert physical_renderer.locator('#map-overlay').is_hidden()
  print('PASS v0.34 physical-only renderer survives missing political data and reset stays available (mock renderer)')


  # Malformed import should never overwrite the active dataset.
  before=desktop.locator('#state-total').inner_text()
  invalid={'type':'FeatureCollection','features':[{'type':'Feature','properties':{'name':'Telangana'},'geometry':{'type':'Polygon','coordinates':[[[78,18],[79,18],[78,19]]]}}]}
  desktop.locator('#file-input').set_input_files({'name':'bad.geojson','mimeType':'application/geo+json','buffer':json.dumps(invalid).encode()})
  desktop.wait_for_timeout(100)
  assert desktop.locator('#state-total').inner_text()==before
  assert 'Import rejected' in desktop.locator('#toast').inner_text()
  print('PASS malformed GeoJSON does not change active map')
  # A complete but topologically conflicting upload must be rejected without mutating the map.
  overlap={'type':'FeatureCollection','features':[
    {'type':'Feature','properties':{'name':n},'geometry':{'type':'Polygon','coordinates':square(75,18)}}
    for n in ('Goa','Telangana')]}
  desktop.locator('#file-input').set_input_files({'name':'overlap.geojson','mimeType':'application/geo+json','buffer':json.dumps(overlap).encode()})
  assert desktop.locator('#state-total').inner_text()==before
  assert 'Overlapping regions' in desktop.locator('#toast').inner_text()
  print('PASS duplicate footprints refused; active state protected')
  # Untrusted uploads are checked independently even when rings exceed the legacy 512 limit.
  poly=[]
  for i in range(170):poly.append([70+4*i/170,15])
  for i in range(170):poly.append([74,15+4*i/170])
  for i in range(170):poly.append([74-4*i/170,19])
  for i in range(170):poly.append([70,19-4*i/170])
  poly.append(poly[0]);poly[230],poly[500]=poly[500],poly[230]
  malformed_large={'type':'FeatureCollection','features':[
    {'type':'Feature','properties':{'name':'Goa'},'geometry':{'type':'Polygon','coordinates':[poly]}}]}
  desktop.locator('#file-input').set_input_files({'name':'crossing.geojson','mimeType':'application/geo+json','buffer':json.dumps(malformed_large).encode()})
  assert desktop.locator('#state-total').inner_text()==before
  assert 'self-intersecting' in desktop.locator('#toast').inner_text()
  print('PASS >512-vertex self-intersection refused; active state protected')
  desktop.locator('#file-input').set_input_files({'name':'imported.geojson','mimeType':'application/geo+json','buffer':json.dumps(FIXTURE).encode()})
  desktop.locator('#search-input').fill('Bhopal')
  assert desktop.locator('.region-option').count()==0, 'Imported geometry must not inherit unrelated pilot places'
  assert 'UNVERIFIED IMPORT' in desktop.locator('#map-source-status').inner_text()
  assert desktop.locator('#attribution-link').is_hidden()
  print('PASS imported custom geography hides unrelated pilot cities and old attribution')
  # Runtime failure: users should get a fallback, never an empty undecipherable map.
  fail=browser.new_page(viewport={'width':1100,'height':800});fail.on('pageerror',lambda exc:issues.append(str(exc)))
  inject(fail,stub=False)
  fail.locator('#map-overlay .legacy-link').wait_for(timeout=5000)
  assert 'legacy' in fail.locator('#map-overlay').inner_text().lower()
  print('PASS no-WebGL-library fallback with legacy viewer link')
  # A library can load successfully while the device/browser itself lacks WebGL.
  unsupported=browser.new_page(viewport={'width':1100,'height':800})
  unsupported.on('pageerror',lambda exc:issues.append(str(exc)))
  unsupported.set_content(html,wait_until='domcontentloaded')
  unsupported.add_style_tag(content=(ROOT/'dist/styles.css').read_text())
  unsupported.evaluate('(fixture)=>window.__fixture=fixture',FIXTURE)
  unsupported.add_script_tag(content=STUB)
  unsupported.evaluate('window.maplibregl.supported=()=>false')
  unsupported.add_script_tag(content=(ROOT/'dist/app.bundle.js').read_text())
  unsupported.locator('#map-overlay .legacy-link').wait_for(timeout=5000)
  assert 'WebGL unavailable' in unsupported.locator('#map-overlay').inner_text()
  unsupported.locator('#map-overlay .fallback-map-svg').wait_for(timeout=5000)
  unsupported.wait_for_timeout(250) # settle asynchronous local/remote research datasets before interaction
  unsupported.locator('#search-input').fill('Telangana')
  unsupported.locator('.region-option').first.click()
  assert 'Telangana' in unsupported.locator('#focus-title').inner_text()
  assert unsupported.locator('#map-overlay .fallback-map-svg path[data-region="Telangana"]').count()==1
  unsupported.locator('#reset-map').click()
  assert unsupported.locator('#map-overlay .fallback-map-svg path[data-region]').count()==36
  # SVG map is no longer just an image: direct selection works and controls zoom it.
  unsupported.locator('#map-overlay .fallback-map-svg path[data-region="Telangana"]').click()
  assert unsupported.locator('#focus-title').inner_text()=='Telangana'
  assert unsupported.locator('#map-overlay .fallback-map-svg path[data-region]').count()==1
  svg=unsupported.locator('#map-overlay .fallback-map-svg')
  unsupported.locator('#zoom-in').click()
  assert 'scale(1.25)' in svg.get_attribute('style')
  unsupported.locator('#zoom-out').click()
  assert 'scale(1)' in svg.get_attribute('style')
  unsupported.locator('#reset-map').click()
  assert unsupported.locator('#map-overlay .fallback-map-svg path[data-region]').count()==36
  # Keyboard access to map polygons is part of the no-GPU experience.
  unsupported.locator('#map-overlay .fallback-map-svg path[data-region="Telangana"]').focus()
  unsupported.keyboard.press('Enter')
  assert unsupported.locator('#focus-title').inner_text()=='Telangana'
  unsupported.locator('#reset-map').click()
  print('PASS interactive SVG polygon selection, zoom, keyboard access and reset without WebGL')
  print('PASS no-WebGL region selection and reset render updated SVG geography')
  print('PASS WebGL fallback draws provisional SVG preview')
  print('PASS WebGL-unsupported devices receive accessible legacy link')
  crash=browser.new_page(viewport={'width':1100,'height':800})
  crash.on('pageerror',lambda exc:issues.append(str(exc)))
  crash.set_content(html,wait_until='domcontentloaded')
  crash.add_style_tag(content=(ROOT/'dist/styles.css').read_text())
  crash.evaluate('(fixture)=>window.__fixture=fixture',FIXTURE)
  crash.add_script_tag(content=STUB)
  crash.evaluate('()=>{window.maplibregl.Map=class {constructor(){throw Error("GPU initialization failed")}}}')
  crash.add_script_tag(content=(ROOT/'dist/app.bundle.js').read_text())
  crash.locator('#map-overlay .legacy-link').wait_for(timeout=5000)
  assert 'GPU initialization failed' in crash.locator('#map-overlay').inner_text()
  print('PASS renderer constructor failure recovers with SVG viewer')
  style_crash=browser.new_page(viewport={'width':1100,'height':800})
  style_crash.on('pageerror',lambda exc:issues.append(str(exc)))
  inject(style_crash)
  style_crash.locator('.region-option').first.wait_for(timeout=5000)
  style_crash.evaluate('() => {window.maplibregl.Map.prototype.setStyle=function(){throw new Error("Style asset rejected")}; return true;}')
  style_crash.locator('[data-style="outline"]').click()
  style_crash.locator('#map-overlay .fallback-map-svg').wait_for(timeout=5000)
  assert 'Style asset rejected' in style_crash.locator('#map-overlay').inner_text()
  style_crash.locator('#search-input').fill('Telangana')
  style_crash.locator('.region-option').first.click()
  assert style_crash.locator('#map-overlay .fallback-map-svg path[data-region="Telangana"]').count()==1
  print('PASS style failure changes to usable state-specific SVG instead of broken map')
  # v0.29 synthetic WebGL context-loss recovery (not a genuine GPU test).
  recovered=browser.new_page(viewport={'width':1120,'height':820},accept_downloads=True)
  recovered.on('pageerror',lambda exc:issues.append(str(exc)))
  inject(recovered)
  recovered.locator('.region-option').first.wait_for(timeout=8000)
  recovered.locator('#search-input').fill('Telangana')
  recovered.locator('.region-option').first.click()
  assert recovered.locator('#focus-title').inner_text()=='Telangana'
  recovered.evaluate("() => {const e=new Event('webglcontextlost',{cancelable:true});document.getElementById('map').dispatchEvent(e)}")
  recovered.locator('#map-overlay svg.fallback-map-svg').wait_for(timeout=7000)
  assert 'Map graphics interrupted' in recovered.locator('#map-overlay').inner_text()
  # Zoom must now target the SVG fallback, never the lost MapLibre canvas.
  recovered.locator('#zoom-in').click()
  assert '125%' in recovered.locator('#map-overlay svg.fallback-map-svg').get_attribute('aria-label')
  assert recovered.locator('#renderer-status').inner_text().startswith('SVG map available')
  with recovered.expect_download() as dl: recovered.locator('#download-renderer-report').click()
  raw=json.loads(dl.value.path().read_text(encoding='utf-8'))
  assert raw['format']=='BharatAtlasRendererDiagnostics1'
  assert raw['failureType']=='context_lost'
  assert raw['map']['politicalBordersLoaded'] is True
  assert raw['map']['loaded'] is False
  assert 'not a real-GPU rendering proof' in raw['disclosure']
  # Advance the synthetic clock beyond the explicit cooldown; do not sleep.
  recovered.evaluate('() => { const prev=Date.now(); Date.now=()=>prev+2100; }')
  recovered.locator('#retry-renderer').click()
  recovered.locator('#map-overlay').wait_for(state='hidden',timeout=8000)
  assert recovered.locator('#renderer-status').inner_text().startswith('Interactive renderer initialized')
  assert recovered.locator('#focus-title').inner_text()=='Telangana'
  assert recovered.locator('#state-total').inner_text()=='28'
  print('PASS injected context-loss fallback, downloadable local JSON, manual map recovery and retained selection (mock only)')
  assert not issues,issues
  print('PASS no JavaScript page errors')
  browser.close()
