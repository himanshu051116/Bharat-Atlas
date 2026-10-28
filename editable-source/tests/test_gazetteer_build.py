import unittest, tempfile, json, csv, shutil
from pathlib import Path
from scripts.import_gazetteer import convert
from scripts.build import build
ROOT=Path(__file__).resolve().parents[1]

class GazetteerBuildTests(unittest.TestCase):
 def test_build_bundles_only_valid_locally_supplied_places(self):
  with tempfile.TemporaryDirectory() as t:
   root=Path(t)/'project'
   shutil.copytree(ROOT,root,ignore=shutil.ignore_patterns('dist','.dist-*','__pycache__','*.pyc','.git'))
   source=Path(t)/'sample.csv'
   source.write_text('name,region,kind,longitude,latitude,aliases\nTest Town,Madhya Pradesh,town,79,23,टेस्ट नगर\n',encoding='utf-8')
   dest=root/'data/gazetteer'
   shutil.rmtree(dest,ignore_errors=True)
   convert(source,dest,source_url='https://example.org/synthetic',licence='Synthetic test licence',attribution='Fixture')
   built,meta=build(root)
   self.assertTrue(meta['bundledGazetteer']);self.assertTrue((built/'data/gazetteer/places.geojson').exists())
   original=(built/'data/gazetteer/places.geojson').read_bytes()
   (dest/'places.geojson').write_bytes(b'garbled')
   with self.assertRaisesRegex(ValueError,'checksum'):
    build(root)
   self.assertEqual((built/'data/gazetteer/places.geojson').read_bytes(),original)
 def test_build_rejects_catalogue_claiming_official_verified(self):
  with tempfile.TemporaryDirectory() as t:
   root=Path(t)/'project';shutil.copytree(ROOT,root,ignore=shutil.ignore_patterns('dist','.dist-*','__pycache__','*.pyc','.git'))
   source=Path(t)/'sample.csv';source.write_text('name,region,kind,longitude,latitude\nX,Delhi,city,77,28\n')
   dest=root/'data/gazetteer';shutil.rmtree(dest,ignore_errors=True);convert(source,dest,source_url='https://example.org/test',licence='Testing',attribution='Synthetic')
   meta=json.loads((dest/'manifest.json').read_text());meta['officiallyVerified']=True;(dest/'manifest.json').write_text(json.dumps(meta))
   with self.assertRaisesRegex(ValueError,'provenance'):build(root)

if __name__=='__main__':unittest.main()
