"""GSHHG land-water geometry and local build contract, including failed-build rollback."""
import hashlib,json,unittest,sys
from pathlib import Path
from shapely.geometry import shape,box
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from build import build
class LandcoverBuildTests(unittest.TestCase):
 def test_landcover_is_geometrically_consistent_and_discloses_licence(self):
  folder=ROOT/'data/landcover';m=json.loads((folder/'manifest.json').read_text());raw=(folder/'land.geojson').read_bytes();fc=json.loads(raw)
  self.assertFalse(m['officiallyVerified']);self.assertFalse(m['administrativeBoundaries'])
  self.assertEqual(hashlib.sha256(raw).hexdigest(),m['sha256']);self.assertEqual(len(fc['features']),m['featureCount'])
  self.assertGreater(len(fc['features']),30)
  self.assertTrue(all(shape(f['geometry']).is_valid and box(68,6,99,38).buffer(1e-5).covers(shape(f['geometry'])) for f in fc['features']))
  self.assertTrue(any(len(f['geometry']['coordinates'])>1 for f in fc['features']))
  self.assertTrue((folder/'COPYING.LESSER').is_file())
 def test_landcover_public_build_packs_complete_source_and_module(self):
  dist,m=build(ROOT)
  self.assertTrue(m['bundledPhysicalLand'])
  self.assertTrue((dist/'data/landcover/land.geojson').is_file())
  self.assertIn('/* src/landcover.mjs */',(dist/'app.bundle.js').read_text())
 def test_modified_mask_even_with_rehashed_manifest_fails_topology_and_preserves_stable_build(self):
  dist,m=build(ROOT);unchanged=(dist/'build-manifest.json').read_bytes()
  geom=ROOT/'data/landcover/land.geojson';manifest=ROOT/'data/landcover/manifest.json';original=geom.read_bytes();original_meta=manifest.read_bytes()
  try:
   fc=json.loads(original);fc['features'][0]['geometry']['coordinates'][0][0]=[200,200]
   changed=(json.dumps(fc,separators=(',',':'))+'\n').encode();geom.write_bytes(changed)
   info=json.loads(original_meta);info['sha256']=hashlib.sha256(changed).hexdigest();info['bytes']=len(changed);manifest.write_text(json.dumps(info))
   with self.assertRaisesRegex(ValueError,'topology invalid'):build(ROOT)
   self.assertEqual((dist/'build-manifest.json').read_bytes(),unchanged)
  finally:
   geom.write_bytes(original);manifest.write_bytes(original_meta)
if __name__=='__main__':unittest.main()
