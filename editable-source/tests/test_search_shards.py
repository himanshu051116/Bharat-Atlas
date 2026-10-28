import hashlib,json,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from build_search_shards import build
ROOT=Path(__file__).resolve().parents[1]
class IndexTests(unittest.TestCase):
 def test_public_domain_seed_and_tamper(self):
  with tempfile.TemporaryDirectory() as d:
   out=Path(d)/'index'
   result=build(ROOT/'data/gazetteer/places.geojson',ROOT/'docs/search_seed_source_review.json',out)
   self.assertEqual(result['recordCount'],71)
   self.assertGreater(len(result['shards']),50)
   k=next(iter(result['shards']))
   self.assertEqual(hashlib.sha256((out/result['shards'][k]['path']).read_bytes()).hexdigest(),result['shards'][k]['sha256'])
   with self.assertRaises(ValueError):build(ROOT/'data/gazetteer/places.geojson',ROOT/'docs/search_seed_source_review.json',out)
 def test_bad_rights_blocked(self):
  with tempfile.TemporaryDirectory() as d:
   d=Path(d);m=json.loads((ROOT/'docs/search_seed_source_review.json').read_text());m['redistributionReview']='not_reviewed';(d/'m.json').write_text(json.dumps(m))
   with self.assertRaises(ValueError):build(ROOT/'data/gazetteer/places.geojson',d/'m.json',d/'index')
if __name__=='__main__':unittest.main()
