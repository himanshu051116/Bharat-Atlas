"""Independent build-release geographic safety tests using synthetic features."""
import json
import tempfile
import unittest
from pathlib import Path
from scripts.boundary_gate import screen_file
from scripts.import_boundary_data import EXPECTED


def sample_regions():
    fs = []
    for i, name in enumerate(sorted(EXPECTED)):
        x, y = 62 + (i % 9) * 1.7, 5 + (i // 9) * 2
        ring = [[x,y],[x+.6,y],[x+.6,y+.6],[x,y+.6],[x,y]]
        fs.append({'type':'Feature','properties':{'name':name},'geometry':{'type':'Polygon','coordinates':[ring]}})
    return {'type':'FeatureCollection','features':fs}

class BoundaryGateTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.path=Path(self.temp.name)/'boundaries.geojson'
        self.geo=sample_regions()
    def tearDown(self):
        self.temp.cleanup()
    def screen(self):
        self.path.write_text(json.dumps(self.geo),encoding='utf-8')
        return screen_file(self.path)
    def test_valid_synthetic_topology_not_promoted_to_official(self):
        result=self.screen()
        self.assertEqual(result['regionCount'],36)
        self.assertTrue(result['topologyScreenPassed'])
        self.assertFalse(result['officialGeometryVerified'])
        self.assertTrue(result['failedSamples'])
    def test_missing_region_rejected(self):
        self.geo['features'].pop()
        with self.assertRaisesRegex(ValueError,'36 region'):
            self.screen()
    def test_duplicate_region_rejected(self):
        self.geo['features'][0]['properties']['name']=self.geo['features'][1]['properties']['name']
        with self.assertRaisesRegex(ValueError,'identities'):
            self.screen()
    def test_rehashed_bow_tie_rejected(self):
        f=self.geo['features'][0]
        x,y=f['geometry']['coordinates'][0][0]
        f['geometry']['coordinates']=[[[x,y],[x+.6,y+.6],[x,y+.6],[x+.6,y],[x,y]]]
        with self.assertRaisesRegex(ValueError,'Unsafe geographic dataset'):
            self.screen()
    def test_unexpected_overlap_rejected(self):
        self.geo['features'][1]['geometry']=self.geo['features'][0]['geometry']
        with self.assertRaisesRegex(ValueError,'Unsafe geographic dataset'):
            self.screen()
    def test_longitude_range_rejected(self):
        f=self.geo['features'][0]
        f['geometry']['coordinates'][0][1][0]=112
        with self.assertRaisesRegex(ValueError,'WGS84'):
            self.screen()
    def test_reject_nan(self):
        f=self.geo['features'][0]
        f['geometry']['coordinates'][0][1][0]=float('nan')
        with self.assertRaisesRegex(ValueError,'finite WGS84'):
            self.screen()

if __name__=='__main__':unittest.main()
