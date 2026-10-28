import json,sys,tempfile,unittest,zipfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from build_offline_research_pack import package
ROOT=Path(__file__).resolve().parents[1]
class OfflineTests(unittest.TestCase):
 def test_offline_pack_checksums_and_licence_gates(self):
  with tempfile.TemporaryDirectory() as d:
   dest=Path(d)/'offline.zip';result=package(ROOT/'dist',dest)
   self.assertTrue(result['researchOnly']);self.assertFalse(result['mapLibreAvailableOffline'])
   with zipfile.ZipFile(dest) as z:
    self.assertIn('OFFLINE_PACK_NOTE.txt',z.namelist())
    self.assertIn('data/search-index/manifest.json',z.namelist())
   with self.assertRaises(ValueError):package(ROOT/'dist',dest)
if __name__=='__main__':unittest.main()
