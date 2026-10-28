import sys,tempfile,json,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from geometry_audit import audit

def poly(name,base):
 x,y=base
 return {'type':'Feature','properties':{'name':name},'geometry':{'type':'Polygon','coordinates':[[[x,y],[x+1,y],[x+1,y+1],[x,y+1],[x,y]]]}}
class GeometryAuditTests(unittest.TestCase):
 def report(self,features):
  with tempfile.TemporaryDirectory() as td:
   f=Path(td)/'test.geojson';f.write_text(json.dumps({'type':'FeatureCollection','features':features}))
   return audit(f)
 def test_detects_substantial_overlap(self):
  r=self.report([poly('Goa',(73,15)),poly('Karnataka',(73.5,15.5))])
  self.assertEqual(len(r['overlapsKm2']),1);self.assertGreater(r['overlapsKm2'][0]['areaKm2'],100)
 def test_adjacent_shapes_not_overlap(self):
  r=self.report([poly('Goa',(73,15)),poly('Karnataka',(74,15))]);self.assertEqual(r['overlapsKm2'],[])
 def test_invalid_self_crossing_ring(self):
  f=poly('Goa',(73,15));f['geometry']['coordinates']=[[[73,15],[74,16],[73,16],[74,15],[73,15]]]
  r=self.report([f]);self.assertTrue(r['invalidGeometry'])
 def test_report_never_claims_official_verification(self):
  r=self.report([poly('Goa',(73,15))]);self.assertFalse(r['officiallyVerified'])
if __name__=='__main__':unittest.main()
