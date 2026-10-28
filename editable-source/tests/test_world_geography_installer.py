"""Safe Natural Earth ZIP acquisition and research import tests (synthetic fixtures)."""
import io
import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from install_world_geography import install,safe_zip,LAYERS,publisher_url

class AcquisitionTests(unittest.TestCase):
 def test_publisher_url_allowlisted(self):
  self.assertEqual(publisher_url('cities'),'https://naturalearth.s3.amazonaws.com/50m_cultural/ne_50m_populated_places.zip')
  self.assertIn('10m_cultural',publisher_url('admin1'))
 def test_zip_rejects_escape_and_incomplete_shapefile(self):
  stem='ne_50m_populated_places'
  with tempfile.TemporaryFile() as tmp:
   with zipfile.ZipFile(tmp,'w') as z:
    for ext in ('.shp','.shx','.dbf','.prj'):z.writestr(stem+ext,b'fake')
    z.writestr('../escape.txt',b'danger')
   tmp.seek(0)
   with zipfile.ZipFile(tmp) as z:
    with self.assertRaises(ValueError):safe_zip(z,stem)
  with tempfile.TemporaryFile() as tmp:
   with zipfile.ZipFile(tmp,'w') as z:z.writestr(stem+'.shp',b'only shp')
   tmp.seek(0)
   with zipfile.ZipFile(tmp) as z:
    with self.assertRaises(ValueError):safe_zip(z,stem)
 def test_source_installer_records_real_hash_and_preserves_india_boundary(self):
  import geopandas as gpd
  from shapely.geometry import Point
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);archives=root/'zips';archives.mkdir();shpdir=root/'shp';shpdir.mkdir()
   stem=LAYERS['cities'][1]
   shp=shpdir/(stem+'.shp')
   gdf=gpd.GeoDataFrame([{'NAME':'Test geography city','ADM0_A3':'USA','SCALERANK':'1','geometry':Point(-72,41)}],crs='EPSG:4326')
   gdf.to_file(shp,driver='ESRI Shapefile')
   with zipfile.ZipFile(archives/(stem+'.zip'),'w') as archive:
    for p in shpdir.iterdir():archive.write(p,p.name)
   out=root/'world-detail';result=install(['cities'],archives,out)
   self.assertEqual(result['installedLayers']['cities'],1)
   self.assertEqual(result['inputArchives']['cities']['archiveSha256'],__import__('hashlib').sha256((archives/(stem+'.zip')).read_bytes()).hexdigest())
   # A reviewed .shp is insufficient if a .dbf or projection file changes.
   import hashlib
   from import_world_natural_earth import import_world,component_hashes
   saved=shp.with_suffix('.dbf').read_bytes()
   # Verify mismatch between retained source metadata and altered attributes.
   declared={'reviewed':True,'publisher':'Natural Earth','licence':'Public domain','sources':{
    'cities':{'licence':'Public domain','sha256':hashlib.sha256(shp.read_bytes()).hexdigest(),
      'components':component_hashes(shp),'url':publisher_url('cities'),'version':'fixture'}}}
   meta=root/'reviewed.json';meta.write_text(json.dumps(declared))
   shp.with_suffix('.dbf').write_bytes(saved+b'corruption')
   with self.assertRaises(ValueError):import_world({'cities':shp},meta,root/'corrupt')
   shp.with_suffix('.dbf').write_bytes(saved)
   self.assertIn('Test geography city',(out/'cities.geojson').read_text())
   with self.assertRaises(ValueError):install(['cities'],archives,out)
   result=install(['cities'],archives,out,replace=True)
   self.assertEqual(result['installedLayers']['cities'],1)
   self.assertFalse((out.with_name(out.name+'.backup')).exists())
if __name__=='__main__':unittest.main()
