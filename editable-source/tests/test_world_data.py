from pathlib import Path
import json,hashlib,sys,tempfile,shutil,unittest
R=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(R/'scripts'))
from build_world_data import make
class WorldDatasetTest(unittest.TestCase):
 def test_source_and_output_both_hashed(self):
  src=R/'data/world/world-countries.geojson';out=R/'data/world/world-boundaries.json'
  manifest=json.loads((R/'data/world/manifest.json').read_text())
  data=json.loads(out.read_text());geo=json.loads(src.read_text())
  self.assertEqual(len(data['features']),177)
  self.assertEqual(len(geo['features']),177)
  self.assertEqual(manifest['count'],177)
  self.assertEqual(manifest['outputSha256'],hashlib.sha256(out.read_bytes()).hexdigest())
  self.assertEqual(manifest['inputSha256'],hashlib.sha256(src.read_bytes()).hexdigest())
  self.assertFalse(manifest['officiallyVerified'])
  self.assertFalse(manifest['suitableForLegalBoundaryDecisions'])
  self.assertIn('India',{x['name'] for x in data['features']})
  self.assertGreaterEqual(len({x['continent'] for x in data['features']}),7)
  self.assertTrue(all(x['path'].startswith('M') for x in data['features']))
  self.assertTrue(all(0<=x['areaKm2'] for x in data['features']))
 def test_deterministic_transform(self):
  with tempfile.TemporaryDirectory() as tmp:
   src=R/'data/world/world-countries.geojson';out=Path(tmp)/'world-boundaries.json'
   regenerated=make(src,out)
   self.assertEqual(regenerated,json.loads((R/'data/world/world-boundaries.json').read_text()))
 def test_reject_malformed_source(self):
  with tempfile.TemporaryDirectory() as tmp:
   d=Path(tmp);src=d/'input.geojson';out=d/'world-boundaries.json';src.write_text('{"type":"FeatureCollection","features":[]}')
   with self.assertRaises(ValueError):make(src,out)
if __name__=='__main__':unittest.main()
