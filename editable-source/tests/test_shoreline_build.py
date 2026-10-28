"""Physical shorelines are source-labeled, safe, and independent of boundaries."""
import hashlib,json,unittest,sys,tempfile,shutil
from pathlib import Path
from shapely.geometry import shape,box
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from build import build
from extract_gshhg_shores import on_frame_edge,split_frame_edges
class ShorelineBuild(unittest.TestCase):
 def test_geographic_extraction_and_no_artificial_frame(self):
  m=json.loads((ROOT/'data/shorelines/manifest.json').read_text())
  self.assertFalse(m['officiallyVerified']);self.assertFalse(m['namesVerified']);self.assertEqual(m['licence'],'LGPL-3.0-or-later')
  for name in ('coastlines','lakes'):
   data=(ROOT/f'data/shorelines/{name}.geojson').read_bytes();fs=json.loads(data)['features']
   self.assertEqual(hashlib.sha256(data).hexdigest(),m['layers'][name]['sha256'])
   self.assertEqual(len(fs),m['layers'][name]['count'])
   self.assertTrue(all(box(68,6,99,38).covers(shape(f['geometry'])) for f in fs))
   self.assertTrue(all(not on_frame_edge(a,b) for f in fs for a,b in zip(f['geometry']['coordinates'],f['geometry']['coordinates'][1:])))
  self.assertEqual(list(split_frame_edges([(68,6),(68,7),(69,8),(70,9)])),[[(68,7),(69,8),(70,9)]])
 def test_complete_build_integrates_both_shoreline_sources(self):
  site,manifest=build(ROOT)
  self.assertTrue(manifest['bundledPhysicalShorelines'])
  self.assertTrue((site/'data/shorelines/COPYING.LESSER').exists())
  self.assertEqual(set(json.loads((site/'data/tiles/atlas-tiles.json').read_text())['layers']),{'rivers','coastlines','lakes','settlements'})
 def test_tampering_cannot_replace_last_good_build(self):
  site,manifest=build(ROOT)
  before=(site/'build-manifest.json').read_bytes()
  path=ROOT/'data/shorelines/lakes.geojson';orig=path.read_bytes()
  try:
   path.write_bytes(orig+b' ')
   with self.assertRaisesRegex(ValueError,'not verified'):build(ROOT)
   self.assertEqual((site/'build-manifest.json').read_bytes(),before)
  finally:path.write_bytes(orig)
if __name__=='__main__':unittest.main()
