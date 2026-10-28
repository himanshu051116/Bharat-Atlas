"""World geography contracts: real source hashes, known origin, no India admin-1 overlays."""
import hashlib,json,sys,tempfile,unittest
from pathlib import Path
R=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(R/'scripts'))
from import_world_natural_earth import import_world, component_hashes
from world_detail_contract import validate

class WorldDetailTest(unittest.TestCase):
    def test_admin1_excludes_India_and_verifies_checksum(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            features=[
                {'type':'Feature','geometry':{'type':'Polygon','coordinates':[[[80,26],[81,26],[81,27],[80,27],[80,26]]]},'properties':{'NAME':'Synthetic India division','ADM0_A3':'IND','admin':'India'}},
                {'type':'Feature','geometry':{'type':'Polygon','coordinates':[[[-94,34],[-92,34],[-92,36],[-94,36],[-94,34]]]},'properties':{'NAME':'Synthetic example province','ADM0_A3':'USA','admin':'United States'}}]
            src=root/'fixtures.geojson';src.write_text(json.dumps({'type':'FeatureCollection','features':features}))
            meta=root/'provenance.json';meta.write_text(json.dumps({'reviewed':True,'publisher':'Natural Earth','licence':'Public domain','sources':{'admin1':{'licence':'Public domain','sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'components':component_hashes(src),'url':'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/','version':'fixture validation only'}}}))
            out=root/'world-detail';m=import_world({'admin1':src},meta,out)
            self.assertEqual(m['layers']['admin1']['count'],1)
            self.assertEqual(m['layers']['admin1']['skipped'],1)
            self.assertEqual(validate(out)['layers']['admin1']['count'],1)
            self.assertNotIn('Synthetic India division',(out/'admin1.geojson').read_text())
            with self.assertRaises(ValueError):import_world({'admin1':src},meta,out)
            (out/'admin1.geojson').write_text('corrupted')
            with self.assertRaises(ValueError):validate(out)
    def test_missing_data_review_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp);data=p/'x.geojson';data.write_text('{"type":"FeatureCollection","features":[]}')
            metadata=p/'meta.json';metadata.write_text(json.dumps({'reviewed':False,'publisher':'Natural Earth','licence':'Public domain'}))
            with self.assertRaises(ValueError):import_world({'cities':data},metadata,p/'out')
if __name__=='__main__':unittest.main()
