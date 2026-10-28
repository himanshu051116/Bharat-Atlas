#!/usr/bin/env python3
"""Private spatial-difference review of supplied licensed candidate boundaries.

NEVER automatically certifies a political boundary or releases governmental
geometry. Compare only externally acquired rights-reviewed WGS84 GeoJSON files.
Territorial claim, line of control and de-facto administration are separate.
"""
import argparse,hashlib,json,math
from pathlib import Path
from shapely.geometry import shape
from shapely.ops import unary_union,transform
from pyproj import Transformer

CHECKPOINTS={'Shaksgam Valley research checkpoint':[76.41987,36.11126],
             'Aksai Chin sample checkpoint':[79.95,35.25],
             'Ladakh sample checkpoint':[77.5,34.2]}

def load_polygon(path):
 path=Path(path)
 if not path.is_file() or path.stat().st_size>50_000_000:raise ValueError('Missing or over-limit candidate reference')
 raw=path.read_bytes();fc=json.loads(raw)
 if fc.get('type')!='FeatureCollection' or not isinstance(fc.get('features'),list) or not 1<=len(fc['features'])<=20000:raise ValueError('Expected polygon FeatureCollection')
 polys=[]
 for f in fc['features']:
  g=shape(f.get('geometry'))
  if g.geom_type not in ('Polygon','MultiPolygon') or not g.is_valid or g.is_empty:raise ValueError('Invalid boundary polygon')
  if not all(math.isfinite(v) for v in g.bounds):raise ValueError('Invalid boundary position')
  if g.bounds[0]<58 or g.bounds[2]>105 or g.bounds[1]<1 or g.bounds[3]>42:raise ValueError('Boundary outside declared India study envelope')
  polys.append(g)
 return unary_union(polys),hashlib.sha256(raw).hexdigest()

def compare(candidate,reference,reference_rights):
 a,ah=load_polygon(candidate);b,bh=load_polygon(reference)
 m=json.loads(Path(reference_rights).read_text(encoding='utf-8'))
 if m.get('sha256')!=bh or not m.get('sourceUrl','').startswith('https://') or not m.get('edition') or not m.get('licence') or m.get('rightsReview')!='cleared_for_private_spatial_comparison':
  raise ValueError('Reference rights, edition or SHA not verified for private comparison')
 projected=Transformer.from_crs('EPSG:4326','EPSG:6933',always_xy=True).transform
 ap=transform(projected,a);bp=transform(projected,b)
 symmetric=ap.symmetric_difference(bp)
 # These checkpoints are reference samples ONLY; area truth is neither inferred nor certified.
 from shapely.geometry import Point
 samples={name:{'candidateContains':bool(a.covers(Point(x,y))),'referenceContains':bool(b.covers(Point(x,y))),'needsHumanReview':True} for name,(x,y) in CHECKPOINTS.items()}
 return {'format':'BharatAtlasBoundaryDifference1','candidateSha256':ah,'referenceSha256':bh,'referenceEdition':m['edition'],
  'symmetricDifferenceKm2':round(symmetric.area/1e6,3),'candidateAreaKm2':round(ap.area/1e6,3),'referenceAreaKm2':round(bp.area/1e6,3),
  'sampleCheckpoints':samples,'officiallyCertified':False,'redistributionAuthorized':False,'mayBePublished':False,
  'reviewStatus':'requires independent GIS/legal review, rights clearance and checks of claim/control distinctions'}
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--candidate',required=True,type=Path);p.add_argument('--reference',required=True,type=Path);p.add_argument('--reference-rights',required=True,type=Path)
 a=p.parse_args();print(json.dumps(compare(a.candidate,a.reference,a.reference_rights),indent=2))
