"""Real Fiona/GeoPandas round-trip tests; geometry is fictional test data."""
import json, tempfile, unittest, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from import_boundary_data import import_dataset
import geopandas as gpd
from shapely.geometry import Polygon

class GISImportTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
        geo=gpd.GeoDataFrame({'NAME':['Goa','Karnataka']},geometry=[
           Polygon([(73,15),(74,15),(74,16),(73,16)]),
           Polygon([(74,15),(75,15),(75,16),(74,16)])],crs='EPSG:4326')
        self.source=self.root/'fixture.gpkg';geo.to_file(self.source,driver='GPKG')
        self.options=dict(name_field='NAME',source_url='https://example.org/fixture',licence='Test data only',attribution='Synthetic test geometry',require_complete=False)
    def tearDown(self):self.tmp.cleanup()
    def test_gpkg_import_creates_candidate_and_flags_geography_unverified(self):
        dest=self.root/'candidate';r=import_dataset(self.source,dest,**self.options)
        self.assertTrue(dest.is_dir());self.assertEqual(r['regions'],2)
        self.assertFalse(r['officiallyVerified']);self.assertEqual(r['normalizedCrs'],'EPSG:4326')
        obj=json.loads((dest/'candidate.geojson').read_text())
        self.assertEqual(len(obj['features']),2)
        self.assertTrue((dest/'review-report.json').is_file())
    def test_reprojected_source_keeps_long_lat_geometry(self):
        projected=self.root/'projected.gpkg'
        gpd.read_file(self.source).to_crs('EPSG:3857').to_file(projected,driver='GPKG')
        r=import_dataset(projected,self.root/'candidate',**self.options)
        self.assertEqual(r['originalCrs'],'EPSG:3857')
        point=json.loads((self.root/'candidate/candidate.geojson').read_text())['features'][0]['geometry']['coordinates'][0][0]
        self.assertAlmostEqual(point[0],73,places=3)
    def test_shapefile_import_matches_original_geometry(self):
        shp=self.root/'input.shp'
        gpd.read_file(self.source).to_file(shp,driver='ESRI Shapefile')
        result=import_dataset(shp,self.root/'shapefile-candidate',**self.options)
        self.assertEqual(result['sourceType'],'.shp')
        self.assertEqual(result['regions'],2)
        self.assertTrue((self.root/'shapefile-candidate/review-report.json').exists())
    def test_reject_overlapping_polygons_and_preserve_existing_folder(self):
        changed=gpd.read_file(self.source)
        changed.at[1,'geometry']=Polygon([(73.5,15.5),(74.5,15.5),(74.5,16.5),(73.5,16.5)])
        altered=self.root/'overlap.gpkg';changed.to_file(altered,driver='GPKG')
        with self.assertRaisesRegex(ValueError,'topological audit'):
            import_dataset(altered,self.root/'candidate',**self.options)
        self.assertFalse((self.root/'candidate').exists())
        (self.root/'candidate').mkdir();(self.root/'candidate/marker.txt').write_text('safe')
        with self.assertRaises(FileExistsError):import_dataset(self.source,self.root/'candidate',**self.options)
        self.assertEqual((self.root/'candidate/marker.txt').read_text(),'safe')
    def test_requires_declared_crs_and_full_coverage_by_default(self):
        with self.assertRaisesRegex(ValueError,'Missing top-level regions'):
            import_dataset(self.source,self.root/'candidate',**{**self.options,'require_complete':True})
        with self.assertRaisesRegex(ValueError,'Missing administrative-name'):
            import_dataset(self.source,self.root/'candidate',**{**self.options,'name_field':'INVALID'})
if __name__=='__main__':unittest.main()
