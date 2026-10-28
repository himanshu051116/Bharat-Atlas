import hashlib,json,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from compare_boundary_candidates import compare

def polygon(points):return {'type':'FeatureCollection','features':[{'type':'Feature','properties':{'name':'SYNTHETIC FIXTURE NOT INDIA BOUNDARY'},'geometry':{'type':'Polygon','coordinates':[points]}}]}
class BoundaryComparisonTests(unittest.TestCase):
 def test_identical_synthetic_polygons_still_not_certified(self):
  with tempfile.TemporaryDirectory() as d:
   d=Path(d);g=polygon([[77,23],[78,23],[78,24],[77,24],[77,23]]);raw=json.dumps(g).encode();a=d/'candidate.geojson';b=d/'reference.geojson';a.write_bytes(raw);b.write_bytes(raw)
   m={'sha256':hashlib.sha256(raw).hexdigest(),'sourceUrl':'https://example.org/synthetic-fixture','edition':'synthetic test only','licence':'test fixture','rightsReview':'cleared_for_private_spatial_comparison'}
   meta=d/'review.json';meta.write_text(json.dumps(m));report=compare(a,b,meta)
   self.assertEqual(report['symmetricDifferenceKm2'],0)
   self.assertFalse(report['officiallyCertified']);self.assertFalse(report['mayBePublished'])
 def test_missing_rights_refused(self):
  with tempfile.TemporaryDirectory() as d:
   d=Path(d);g=polygon([[77,23],[78,23],[78,24],[77,24],[77,23]]);raw=json.dumps(g).encode();a=d/'a.json';a.write_bytes(raw);m=d/'m.json';m.write_text('{}')
   with self.assertRaises(ValueError):compare(a,a,m)
if __name__=='__main__':unittest.main()
