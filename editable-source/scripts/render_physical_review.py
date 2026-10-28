#!/usr/bin/env python3
"""Generate only a source-derived physical geography visual QA figure.

No political boundary is generated or inferred. Review figure ≠ map certification.
"""
from __future__ import annotations
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
R=Path(__file__).resolve().parents[1]

def layer(path):
    fs=json.loads(path.read_text())['features']
    return [f['geometry']['coordinates'] for f in fs]

def render(dest):
    rivers=layer(R/'data/hydrography/rivers.geojson')
    coast=layer(R/'data/shorelines/coastlines.geojson')
    lakes=layer(R/'data/shorelines/lakes.geojson')
    plt.rcParams['font.family']='DejaVu Sans'
    fig,ax=plt.subplots(figsize=(14,11),dpi=170)
    fig.patch.set_facecolor('#f8fbfa');ax.set_facecolor('#eef6f7')
    ax.add_collection(LineCollection(coast,colors='#1d7569',linewidths=1.05,zorder=4,label='GSHHG coastlines'))
    ax.add_collection(LineCollection(lakes,colors='#428eb6',linewidths=.8,zorder=3,label='GSHHG inland-water shores'))
    ax.add_collection(LineCollection(rivers,colors='#8ab9d4',linewidths=.55,alpha=.83,zorder=2,label='WDBII historical waterways'))
    ax.set_xlim(68,99);ax.set_ylim(6,38);ax.set_aspect('equal',adjustable='box')
    ax.set_xticks([70,75,80,85,90,95]);ax.set_yticks([10,15,20,25,30,35]);ax.grid(color='#c9dbd8',linewidth=.5,alpha=.72)
    for s in ax.spines.values():s.set_color('#a1c4b8')
    ax.set_xlabel('Longitude (°E)');ax.set_ylabel('Latitude (°N)')
    ax.set_title('Bharat Atlas | Physical geography source review',fontsize=18,weight='bold',color='#214b40',pad=15)
    ax.text(.5,1.01,'Source-derived coastline, lake and river traces · GSHHG 2.3.6 / WDBII · source vintage 2016',
            transform=ax.transAxes,ha='center',fontsize=9,color='#526c6a')
    ax.legend(loc='lower left',fontsize=10,frameon=True,facecolor='white',edgecolor='#cbddd4')
    fig.text(.5,.025,'Study area includes neighbouring countries. No political, state, or sovereignty borders shown. Generalized and historic; not for navigation.',ha='center',fontsize=9,color='#9c5546')
    fig.text(.5,.009,'GSHHG/WDBII · basemap-data 2.0.0 · LGPL-3.0-or-later · derived by Bharat Atlas · geographic review only',ha='center',fontsize=8,color='#627a75')
    dest.parent.mkdir(parents=True,exist_ok=True)
    fig.savefig(dest,dpi=170,bbox_inches='tight',facecolor=fig.get_facecolor())
    plt.close(fig)
    return {'coastlines':len(coast),'lakes':len(lakes),'rivers':len(rivers)}
if __name__=='__main__':
    print(render(R/'docs/V21_PHYSICAL_GEOGRAPHY_REVIEW.png'))
