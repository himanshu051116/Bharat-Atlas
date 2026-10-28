#!/usr/bin/env python3
"""Generate a neutral physical-geography visual audit without political boundaries."""
from pathlib import Path
import json
from shapely.geometry import shape
import geopandas as gpd
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
ROOT=Path(__file__).resolve().parents[1]
fc=json.loads((ROOT/'data/landcover/land.geojson').read_text())
land=gpd.GeoSeries([shape(f['geometry']) for f in fc['features']],crs='EPSG:4326')
rivers=json.loads((ROOT/'data/hydrography/rivers.geojson').read_text())
water=gpd.GeoSeries([shape(f['geometry']) for f in rivers['features']],crs='EPSG:4326')
fig,ax=plt.subplots(figsize=(13.7,10.3),dpi=145)
fig.patch.set_facecolor('#fcfaf6');ax.set_facecolor('#edf4f5')
ax.add_patch(Rectangle((68,6),31,32,facecolor='#edf4f5',edgecolor='none'))
land.plot(ax=ax,color='#d0dfc9',edgecolor='#729b84',linewidth=.35,zorder=2)
water.plot(ax=ax,color='#66a5bc',linewidth=.30,alpha=.85,zorder=3)
ax.set_xlim(68,99);ax.set_ylim(6,38);ax.set_aspect('equal',adjustable='box')
ax.set_xticks([70,75,80,85,90,95]);ax.set_yticks([10,15,20,25,30,35]);ax.tick_params(colors='#819489',labelsize=8)
for spine in ax.spines.values():spine.set_color('#aec4b6')
ax.grid(alpha=.11,linewidth=.5,zorder=1)
ax.set_title('BHARAT ATLAS / PHYSICAL GEOGRAPHY STUDY',fontsize=16,fontweight='bold',color='#265344',loc='left',pad=26)
ax.text(68.5,38.6,'GSHHG land / inland-water geometry and historical WDBII waterways · no political borders',color='#596e65',fontsize=9)
fig.text(.11,.055,'RESEARCH / UNVERIFIED · GSHHG 2.3.6 / WDBII via basemap-data 2.0.0 · LGPL-3.0-or-later',fontsize=9,color='#95613f',weight='bold')
fig.text(.11,.035,'Includes neighbouring countries. Generalized historical physical data; not for sovereign borders, navigation or current coastline claims.',fontsize=8,color='#60786f')
fig.subplots_adjust(top=.91,bottom=.12,left=.10,right=.92)
path=ROOT/'docs/V22_PHYSICAL_LAND_REVIEW.png';fig.savefig(path,dpi=145,facecolor=fig.get_facecolor());plt.close(fig)
print(path)
