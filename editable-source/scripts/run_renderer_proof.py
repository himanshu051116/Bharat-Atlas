#!/usr/bin/env python3
"""Run genuine MapLibre GPU proof on local static build, never with a mock renderer.

Produces a machine-readable, fail-closed report and desktop/mobile screenshots only
when MapLibre is truly vendored. Exit 0 ONLY if both hardware-accelerated render
scenarios passed. Does not deploy, modify system settings or silently fall back.
"""
import argparse, hashlib, json, re, sys, threading
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
    def end_headers(self):
        self.send_header('Cache-Control','no-store')
        super().end_headers()

def verify_vendor_bundle(dist):
    # Refuse missing or tampered MapLibre assets before browser launch.
    detail=json.loads((dist/'maplibre-provenance.json').read_text(encoding='utf-8'))
    if detail.get('package')!='maplibre-gl' or detail.get('version')!='5.13.0':
        raise ValueError('Incorrect MapLibre vendor identity')
    from base64 import b64decode
    integrity=detail.get('npmIntegrity','')
    if not re.fullmatch(r'sha512-[A-Za-z0-9+/]{86}==', integrity):
        raise ValueError('Missing npm SHA-512 vendor provenance')
    if len(b64decode(integrity.removeprefix('sha512-'),validate=True))!=64:
        raise ValueError('Invalid npm integrity length')
    for name in ('maplibre-gl.js','maplibre-gl.css','MAPLIBRE-LICENSE.txt'):
        expected=detail.get('sha256',{}).get(name)
        if not expected or hashlib.sha256((dist/name).read_bytes()).hexdigest()!=expected:
            raise ValueError('MapLibre asset integrity failed: '+name)


def perform(dist, out, executable=None, timeout_ms=30000):
    dist,out=Path(dist),Path(out);out.mkdir(parents=True,exist_ok=True)
    report={'version':'0.30','timestampUTC':datetime.now(timezone.utc).isoformat(),
            'testType':'genuine MapLibre/WebGL2; no mocks','status':'blocked','reasons':[],
            'contexts':[],'externalBoundaryVerified':False,
            'vectorData':'GSHHG/WDBII 2.3.6, generalized historical physical geography',
            'productionApproved':False}
    for path in ('maplibre-gl.js','maplibre-gl.css','maplibre-provenance.json','proof/renderer-proof.html',
                 'proof/renderer-proof.mjs','data/tiles/atlas-tiles.json'):
        if not (dist/path).is_file():report['reasons'].append('Missing local asset: '+path)
    if not report['reasons']:
        try:verify_vendor_bundle(dist)
        except Exception as e:report['reasons'].append('Unverified MapLibre package: '+str(e))
    if report['reasons']:
        report['status']='blocked_missing_local_renderer'
        return _save(out,report)
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        report['status']='blocked_playwright_missing';report['reasons'].append('pip install playwright');return _save(out,report)
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(dist)))
    worker=threading.Thread(target=server.serve_forever,daemon=True);worker.start()
    try:
        with sync_playwright() as p:
            args=['--no-sandbox','--disable-dev-shm-usage']
            try:
                fallback='/usr/bin/chromium' if Path('/usr/bin/chromium').is_file() else None
                browser=p.chromium.launch(headless=True,executable_path=executable or fallback,args=args)
            except Exception as e:
                report['status']='blocked_browser_launch';report['reasons'].append(str(e)[:600]);return _save(out,report)
            try:
                for kind in ('desktop','mobile'):
                    is_mobile=kind=='mobile'
                    context=browser.new_context(viewport={'width':390,'height':844} if is_mobile else {'width':1280,'height':860},
                                                device_scale_factor=2 if is_mobile else 1,is_mobile=is_mobile,
                                                has_touch=is_mobile,java_script_enabled=True)
                    page=context.new_page()
                    errors=[];responses=[]
                    page.on('pageerror',lambda e:errors.append(str(e)))
                    page.on('response',lambda r:responses.append({'url':r.url,'status':r.status}) if r.status>=400 else None)
                    url=f'http://127.0.0.1:{server.server_address[1]}/proof/renderer-proof.html'
                    item={'device':kind,'url':url,'passed':False,'browserErrors':errors}
                    try:
                        page.goto(url,wait_until='domcontentloaded',timeout=timeout_ms)
                        page.wait_for_function('''() => !!window.__atlasRealRendererProof && ['rendered','failed'].includes(window.__atlasRealRendererProof.status)''',timeout=timeout_ms)
                        # Real user-input events: mouse or mobile touch pan and wheel/pinch-equivalent zoom.
                        # A scripted jumpTo() alone does not constitute navigation verification.
                        initial=page.evaluate('''() => ({center:window.__atlasRealMap?.getCenter()?.toArray(),zoom:window.__atlasRealMap?.getZoom()})''')
                        if initial.get('center') and page.evaluate('window.__atlasRealRendererProof.status')=='rendered':
                            if is_mobile:
                                # CDP dispatch creates actual Chromium input events; constructing
                                # JS TouchEvent objects does not reliably exercise MapLibre gestures.
                                bounds=page.locator('#map').bounding_box()
                                x=bounds['x']+bounds['width']/2;y=bounds['y']+bounds['height']/2
                                cdp=context.new_cdp_session(page)
                                cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':1}]})
                                for step in range(1,9):
                                    cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+10*step,'y':y+5*step,'id':1}]})
                                    page.wait_for_timeout(35)
                                cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
                                cdp.detach()
                            else:
                                bounds=page.locator('#map').bounding_box()
                                x=bounds['x']+bounds['width']/2;y=bounds['y']+bounds['height']/2
                                page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+95,y+44,steps=8);page.mouse.up()
                            page.wait_for_timeout(900)
                            afterpan=page.evaluate('''() => ({center:window.__atlasRealMap.getCenter().toArray(),zoom:window.__atlasRealMap.getZoom()})''')
                            # Trigger a zoom via real browser wheel on both viewport configurations.
                            bounds=page.locator('#map').bounding_box()
                            page.mouse.move(bounds['x']+bounds['width']/2,bounds['y']+bounds['height']/2)
                            page.mouse.wheel(0,-450)
                            page.wait_for_timeout(950)
                            afterzoom=page.evaluate('''() => ({center:window.__atlasRealMap.getCenter().toArray(),zoom:window.__atlasRealMap.getZoom()})''')
                            pan_changed=abs(afterpan['center'][0]-initial['center'][0])+abs(afterpan['center'][1]-initial['center'][1])>0.01
                            zoom_changed=afterzoom['zoom']>initial['zoom']+0.05
                            page.evaluate('''baseline => window.__atlasRealMap.jumpTo({center:baseline.center,zoom:baseline.zoom})''',initial)
                            page.wait_for_timeout(500)
                            returned=page.evaluate('''baseline => {const m=window.__atlasRealMap;const c=m.getCenter().toArray();return Math.abs(c[0]-baseline.center[0])+Math.abs(c[1]-baseline.center[1])<0.05&&Math.abs(m.getZoom()-baseline.zoom)<0.05}''',initial)
                            page.evaluate('''passed => {window.__atlasRealRendererProof.navigationRoundTrip=passed;window.__atlasRealRendererProof.status=passed?'passed':'failed'}''',bool(pan_changed and zoom_changed and returned))
                        values=page.evaluate('''() => ({...window.__atlasRealRendererProof})''')
                        item.update(values)
                        # An unmocked proof must draw >0 actual vector features loaded from actual verified tile bytes.
                        item['passed']=bool(values.get('status')=='passed' and values.get('webgl2')
                            and values.get('vectorRenderedFeatures',0)>0 and values.get('renderedSettlements',0)>0
                            and values.get('verifiedTileBytes',0)>0 and values.get('realTileRequests',0)>0
                            and values.get('glPixelsVerified') and values.get('styleLoaded') and values.get('navigationRoundTrip')
                            and values.get('maplibreVersion')=='5.13.0' and not values.get('errors'))
                        item['maplibreConstructorPresent']=page.evaluate('''() => !!window.maplibregl && typeof window.maplibregl.Map==='function' ''')
                        item['canvasPresent']=page.locator('#map canvas').count()>0
                        item['passed']=bool(item['passed'] and item['canvasPresent'] and item['maplibreConstructorPresent'])
                        item['rendererClassification']=('software' if any(t in str(values.get('renderer','')).lower() for t in ('swiftshader','llvmpipe','software','softpipe')) else 'hardware-or-unknown')
                        # Software GL is a real WebGL context but not evidence of GPU hardware.
                        if item['rendererClassification']=='software':item['passed']=False
                        if item['passed']:
                            file=out/f'{kind}-real-maplibre.png';page.screenshot(path=str(file),full_page=True)
                            item['screenshot']=str(file.name);item['screenshotSHA256']=hashlib.sha256(file.read_bytes()).hexdigest()
                    except Exception as e:
                        item['status']='blocked_or_failed';item['details']=str(e)[:700]
                    item['httpErrors']=responses[:15]
                    report['contexts'].append(item)
                    context.close()
            finally:browser.close()
    except Exception as e:
        report['status']='blocked_environment';report['reasons'].append(str(e)[:600]);return _save(out,report)
    finally:
        server.shutdown();server.server_close()
    report['status']='passed' if len(report['contexts'])==2 and all(x['passed'] for x in report['contexts']) else 'failed'
    if report['status']!='passed':report['reasons'].append('Desktop and mobile genuine WebGL tile rendering not both confirmed')
    return _save(out,report)

def _save(out,report):
    path=out/'real-webgl-proof.json';path.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(f"{report['status']} — {path}")
    return report

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--dist',type=Path,default=ROOT/'dist')
    ap.add_argument('--output',type=Path,default=ROOT/'docs/real-webgl-evidence')
    ap.add_argument('--chrome-executable',default=None)
    args=ap.parse_args()
    r=perform(args.dist,args.output,args.chrome_executable)
    sys.exit(0 if r['status']=='passed' else 2)
