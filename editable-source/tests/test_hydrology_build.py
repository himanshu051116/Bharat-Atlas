"""Hydrology source provenance and source/build parity."""
import hashlib,json,unittest
from pathlib import Path
from shapely.geometry import shape,box
R=Path(__file__).resolve().parents[1]
class HydrologyContract(unittest.TestCase):
    def test_real_geographic_input_license_and_integrity(self):
        folder=R/'data/hydrography';metadata=json.loads((folder/'manifest.json').read_text())
        river=folder/'rivers.geojson';raw=river.read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(),metadata['sha256'])
        self.assertEqual(metadata['officiallyVerified'],False)
        self.assertEqual(metadata['licence'],'LGPL-3.0-or-later')
        self.assertFalse(metadata['riverNamesVerified'])
        self.assertTrue((folder/'COPYING.LESSER').exists());self.assertTrue((folder/'COPYING.GPL').exists())
        fs=json.loads(raw)['features'];self.assertEqual(len(fs),metadata['featureCount'])
        self.assertEqual(len(fs),1723)
        self.assertTrue(all(box(68,6,99,38).covers(shape(f['geometry'])) for f in fs))
    def test_tiles_use_real_hydrology_not_synthetic_fixture(self):
        cat=json.loads((R/'data/tiles/atlas-tiles.json').read_text())
        self.assertEqual(set(cat['layers']),{'rivers','coastlines','lakes','settlements'});self.assertIn('LGPL-3.0-or-later',cat['licence']);self.assertIn('Public Domain',cat['licence'])
        self.assertFalse(cat['officiallyVerified']);self.assertGreater(cat['tileCount'],500)
        self.assertIn('GSHHG',cat['attribution'])
    def test_static_site_includes_real_tiles_and_rights(self):
        # Build can also be run in isolation; the test suite's build task must have run first.
        from importlib.util import spec_from_file_location,module_from_spec
        spec=spec_from_file_location('geo_build',R/'scripts/build.py');module=module_from_spec(spec);spec.loader.exec_module(module)
        out,manifest=module.build(R)
        self.assertTrue(manifest['bundledHistoricRivers'])
        self.assertTrue(manifest['bundledLocalVectorTiles'])
        self.assertTrue((out/'data/hydrography/COPYING.LESSER').exists())
        self.assertEqual(hashlib.sha256((out/'data/hydrography/rivers.geojson').read_bytes()).hexdigest(),
                         json.loads((out/'data/hydrography/manifest.json').read_text())['sha256'])
if __name__=='__main__': unittest.main()
