#!/usr/bin/env python3
"""Unmocked browser WebGL capability diagnostic. Not a substitute for MapLibre proof."""
import json, argparse
from pathlib import Path
from datetime import datetime,timezone

def check(executable='/usr/bin/chromium'):
    from playwright.sync_api import sync_playwright
    report={'checkedUTC':datetime.now(timezone.utc).isoformat(),'actualWebGLContextCheck':True,
            'status':'unknown','platform':'chromium headless','devices':[]}
    with sync_playwright() as p:
        for flags in ([],['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu-sandbox']):
            name='default' if not flags else 'software-GL-flags'
            try:
                b=p.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox','--disable-dev-shm-usage']+flags)
                for k,viewport in [('desktop',{'width':1280,'height':860}),('mobile emulation',{'width':390,'height':844})]:
                    c=b.new_context(viewport=viewport,is_mobile=k!='desktop',has_touch=k!='desktop');page=c.new_page()
                    page.set_content('<canvas id="probe"></canvas>')
                    r=page.evaluate('''() => { const el=document.getElementById('probe');
                      const gl2=el.getContext('webgl2'); const gl=gl2||el.getContext('webgl');
                      return {webgl2:!!gl2,webgl:!!gl,renderer:gl?String(gl.getParameter(gl.RENDERER)):null,
                         version:gl?String(gl.getParameter(gl.VERSION)):null}; }''')
                    report['devices'].append({'browserMode':name,'device':k,**r});c.close()
                b.close()
            except Exception as e:report['devices'].append({'browserMode':name,'error':str(e)[:350]})
    report['status']='webgl2_available' if any(v.get('webgl2') for v in report['devices']) else 'webgl2_unavailable'
    return report

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',default='docs/real-webgl-evidence/environment-webgl.json');parser.add_argument('--chromium',default='/usr/bin/chromium');args=parser.parse_args()
    d=check(args.chromium);p=Path(args.output);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,indent=2)+'\n');print(d['status'],p)
