"""Genuine but explicitly partial Natural Earth publisher-extract regression checks."""
import json,unittest,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from world_detail_contract import validate

class PublisherSourceSubsetTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest=validate(ROOT/'data/world-detail')
    def test_installed_counts(self):
        layers=self.manifest['layers']
        self.assertEqual(layers['cities']['count'],226)
        self.assertEqual(layers['peaks']['count'],81)
        self.assertTrue(layers['cities']['curatedSubsetNotFullDataset'])
        self.assertEqual(layers['cities']['publisherFileFeatureCount'],1251)
        self.assertEqual(layers['peaks']['publisherFileFeatureCount'],86)
        self.assertNotIn('admin1',layers)
        self.assertNotIn('rivers',layers)
    def test_real_world_names_and_coordinates(self):
        feats=json.loads((ROOT/'data/world-detail/cities.geojson').read_text())['features']
        places={f['properties']['name']:f['geometry']['coordinates'] for f in feats}
        for name,rectangle in {'Tokyo':(130,145,32,40),'Nairobi':(34,40,-3,1),'Buenos Aires':(-62,-56,-36,-33),'Amaravati':(78,83,14,19)}.items():
            self.assertIn(name,places)
            x,y=places[name]
            self.assertTrue(rectangle[0]<=x<=rectangle[1] and rectangle[2]<=y<=rectangle[3])
    def test_elevation_is_not_made_up(self):
        feats=json.loads((ROOT/'data/world-detail/peaks.geojson').read_text())['features']
        data={f['properties']['name']:f for f in feats}
        self.assertIn('Mount Everest',data)
        self.assertIn('K2',data)
        self.assertIn('Nanda Devi',data)
        self.assertEqual(data['Mount Everest']['properties']['elevation'],'8848')
        self.assertEqual(data['K2']['properties']['elevation'],'8611')
    def test_clear_source_limits(self):
        for layer in ('cities','peaks'):
            source=self.manifest['layers'][layer]
            self.assertIn('github.com/nvkelso/natural-earth-vector',source['sourceUrl'])
            self.assertTrue(source['curatedSubsetNotFullDataset'])
            self.assertEqual(len(source['sourceGitBlobSHA1']),40)
if __name__=='__main__':unittest.main()
