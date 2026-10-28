#!/usr/bin/env python3
"""Geographic QA illustration: public-domain Natural Earth city points over GSHHG land.
No state or national political borders are drawn, and no position is certified.
"""
import json,csv
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as MplPoly
from matplotlib.collections import PatchCollection
from shapely.geometry import shape
R=Path(__file__).resolve().parents[1]
land=json.loads((R/'data/landcover/land.geojson').read_text())
place=json.loads((R/'data/gazetteer/places.geojson').read_text())
rows={}
for line in (R/'source-data/natural-earth-50m-india-places.tsv').read_text(encoding='utf-8').splitlines():
 if line.startswith('#') or not line.strip():continue
 a=line.split('|');rows[a[1]]=int(a[5])
fig,ax=plt.subplots(figsize=(13,10),dpi=155)
fig.patch.set_facecolor('#f7f8f5');ax.set_facecolor('#e5f0f2')
patches=[]
for f in land['features']:
 p=shape(f['geometry'])
 patches.append(MplPoly(list(p.exterior.coords),closed=True))
landpatch=PatchCollection(patches,facecolor='#e3e9d3',edgecolor='#7ca798',linewidth=.37,zorder=2)
ax.add_collection(landpatch)
for f in land['features']:
 p=shape(f['geometry'])
 for h in p.interiors:
  ax.add_patch(MplPoly(list(h.coords),closed=True,facecolor='#e5f0f2',edgecolor='#93bac3',linewidth=.3,zorder=3))
for f in place['features']:
 lon,lat=f['geometry']['coordinates'];nm=f['properties']['name'];rank=rows[nm]
 ax.scatter(lon,lat,s=44 if rank<=2 else 13,c='#197261' if rank<=2 else '#ba6b43',edgecolors='white',linewidths=.7 if rank<=2 else .3,zorder=6)
 if rank<=2 and nm!='Delhi':
  ax.annotate(nm,(lon,lat),xytext=(4,4),textcoords='offset points',fontsize=7,fontweight='semibold',color='#21483b',zorder=7,bbox={'facecolor':'#f7f8f5','alpha':.65,'edgecolor':'none','pad':.2})
ax.set_xlim(68,99);ax.set_ylim(6,38);ax.set_aspect('equal',adjustable='box')
ax.set_xlabel('Longitude (degrees east) · WGS84',fontsize=10,color='#53756b')
ax.set_ylabel('Latitude (degrees north) · WGS84',fontsize=10,color='#53756b')
ax.tick_params(axis='both',labelsize=9,colors='#53756b')
for spine in ax.spines.values():spine.set_color('#b7cbc6')
ax.grid(color='#a2bbbe',linestyle='--',linewidth=.35,alpha=.6)
ax.set_title('Bharat Atlas  |  71 source-backed city points',loc='left',fontsize=20,color='#194536',weight='bold',pad=20)
fig.text(.12,.07,'Natural Earth 1:50m places (public domain) · GSHHG 2.3.6 physical land (LGPL-3.0-or-later) · India-focused study window',fontsize=9,color='#58776b')
fig.text(.12,.049,'Approximate historic cartographic points, incomplete coverage; includes neighbouring countries; NO political boundaries or sovereignty claims.',fontsize=8,color='#966044')
fig.tight_layout(rect=[.04,.087,.99,.95]);dest=R/'docs/V24_NATURAL_EARTH_CITY_REVIEW.png';fig.savefig(dest,dpi=155,facecolor=fig.get_facecolor());print(dest)
