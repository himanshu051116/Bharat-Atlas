"""Verify every proposed public research vector tile has approved per-layer provenance."""
import unittest,sys,json,hashlib,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from build_research_multisource_tiles import make_multisource
from mvt_audit import decode_tile,audit_archive

class MultisourceTiles(unittest.TestCase):
    def test_regenerated_tiles_source_and_labels(self):
        catalogue=json.loads((ROOT/'data/tiles/atlas-tiles.json').read_text())
        self.assertEqual(set(catalogue['layers']),{'coastlines','lakes','rivers','settlements'})
        docs=catalogue['sourceLayers']
        self.assertEqual(set(docs),set(catalogue['layers']))
        self.assertIn('Natural Earth',docs['settlements']['attribution'])
        self.assertIn('Public Domain',docs['settlements']['licence'])
        self.assertIn('GSHHG',docs['rivers']['attribution'])
        self.assertGreater(catalogue['featureOccurrences']['settlements'],70)
        self.assertEqual(catalogue['tileCount'],608)
        report=audit_archive(ROOT/'data/tiles')
        self.assertTrue(report)
        self.assertTrue(any('settlements' in decode_tile(file.read_bytes()) for file in (ROOT/'data/tiles').rglob('*.pbf')))
    def test_nonexistent_transport_not_fabricated(self):
        catalogue=json.loads((ROOT/'data/tiles/atlas-tiles.json').read_text())
        self.assertNotIn('roads',catalogue['layers'])
        self.assertNotIn('railways',catalogue['layers'])
    def test_changed_source_cannot_replace_existing_archive(self):
        with tempfile.TemporaryDirectory() as t:
            dest=Path(t)/'previous-tiles';dest.mkdir()
            (dest/'stable.txt').write_text('last approved bytes')
            root=Path(t)/'source'
            import shutil
            shutil.copytree(ROOT/'data',root/'data')
            p=root/'data/gazetteer/places.geojson';p.write_bytes(p.read_bytes()+b' ')
            with self.assertRaisesRegex(ValueError,'gazetteer identity'):make_multisource(root,dest)
            self.assertEqual((dest/'stable.txt').read_text(),'last approved bytes')

if __name__=='__main__':unittest.main()
