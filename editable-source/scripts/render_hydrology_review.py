#!/usr/bin/env python3
"""Produce a visual QA preview of source hydrography only (no inferred political border)."""
import json,math,argparse
from pathlib import Path
from xml.sax.saxutils import escape

def render(source,output):
    fc=json.loads(Path(source).read_text(encoding='utf-8'))
    if fc.get('type')!='FeatureCollection':raise ValueError('Missing source river features')
    width,height=1200,1200
    x0,y0,x1,y1=68,6,99,38
    k=min((width-180)/((x1-x0)*.935),(height-225)/(y1-y0))
    dx=(width-(x1-x0)*.935*k)/2;dy=145
    def p(lon,lat):return (round(dx+(lon-x0)*.935*k,2),round(dy+(y1-lat)*k,2))
    pieces=[]
    for f in fc['features']:
        c=f['geometry']['coordinates']
        pieces.append('<path d="'+' '.join(('M' if i==0 else 'L')+f'{p(*xy)[0]},{p(*xy)[1]}' for i,xy in enumerate(c))+'"/>')
    graticules=[]
    for lon in range(70,100,5):
        a=p(lon,y0);b=p(lon,y1)
        graticules.append(f'<path d="M{a[0]},{a[1]} L{b[0]},{b[1]}"/><text x="{a[0]}" y="1160" text-anchor="middle">{lon}°E</text>')
    for lat in range(10,40,5):
        a=p(x0,lat);b=p(x1,lat)
        graticules.append(f'<path d="M{a[0]},{a[1]} L{b[0]},{b[1]}"/><text x="37" y="{a[1]+4}">{lat}°N</text>')
    result=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">
<title>GSHHG historic hydrology research visual audit, not a political map</title>
<rect width="100%" height="100%" fill="#f3f9f7"/>
<text x="50" y="62" font-family="Arial" font-weight="bold" font-size="37" fill="#204b42">Historical river traces</text>
<text x="50" y="95" font-family="Arial" font-size="18" fill="#557f73">GSHHG / WDBII 2.3.6 · India-focused study window, not India-only</text>
<g stroke="#b7cfc4" stroke-width="1" stroke-dasharray="4 9" fill="none">{''.join(graticules)}</g>
<g font-family="Arial" font-size="12" fill="#587569"></g>
<g fill="none" stroke="#318eac" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round" stroke-opacity=".72">{''.join(pieces)}</g>
<rect x="35" y="1078" width="1130" height="78" rx="9" fill="#fff8ec" stroke="#e5d0a9"/>
<text x="55" y="1104" font-family="Arial" font-weight="bold" font-size="15" fill="#955d35">GEOGRAPHIC REVIEW ONLY — NO VERIFIED INDIA BOUNDARY SHOWN</text>
<text x="55" y="1128" font-family="Arial" font-size="13" fill="#6b6a5f">1,723 unlabelled historical watercourse segments; includes neighbouring territories</text>
<text x="55" y="1147" font-family="Arial" font-size="12" fill="#6b6a5f">GSHHG/WDBII (NOAA/University of Hawai'i) via Basemap Data 2.0.0 · LGPL-3.0-or-later</text></svg>'''
    Path(output).write_text(result,encoding='utf-8')
    return len(fc['features']),len(result)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('output');a=p.parse_args();print(render(a.source,a.output))
