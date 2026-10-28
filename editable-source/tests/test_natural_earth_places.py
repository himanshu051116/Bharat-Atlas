"""Source-backed Natural Earth research city subset and build integrity."""
import hashlib,json,shutil,tempfile,unittest
from pathlib import Path
from scripts.prepare_natural_earth_places import prepare,SOURCE_BLOB_SHA
from scripts.build import build
ROOT=Path(__file__).resolve().parents[1]

class NaturalEarthCityChecks(unittest.TestCase):
    def test_pinned_subset_names_and_provenance(self):
        d=ROOT/'data/gazetteer';m=json.loads((d/'manifest.json').read_text());g=json.loads((d/'places.geojson').read_text())
        self.assertEqual(m['count'],71)
        self.assertEqual(m['pinnedGitBlobSha'],SOURCE_BLOB_SHA)
        self.assertEqual(hashlib.sha256((d/'places.geojson').read_bytes()).hexdigest(),m['sha256'])
        self.assertEqual(m['officiallyVerified'],False)
        self.assertEqual(m['licence'],'Public Domain (Natural Earth)')
        self.assertTrue(all(next(f['properties']['region'] for f in g['features'] if f['properties']['name']==city)=='Gujarat' for city in ['Ahmedabad','Rajkot','Surat','Vadodara']))
        self.assertTrue(all(next(f['properties']['region'] for f in g['features'] if f['properties']['name']==city)=='Odisha' for city in ['Bhubaneswar','Cuttack']))
        self.assertIn('प्रयागराज', next(f['properties']['aliases'] for f in g['features'] if f['properties']['name']=='Allahabad'))
        self.assertTrue(all(f['properties']['kind']=='city' for f in g['features']))

    def test_rebuild_is_repeatable_and_non_destructive(self):
        with tempfile.TemporaryDirectory() as t:
            dest=Path(t)/'generated'
            m=prepare(ROOT/'source-data/natural-earth-50m-india-places.tsv',dest)
            self.assertEqual(m['sha256'],json.loads((ROOT/'data/gazetteer/manifest.json').read_text())['sha256'])
            with self.assertRaises(FileExistsError):prepare(ROOT/'source-data/natural-earth-50m-india-places.tsv',dest)

    def test_reject_duplicate_source_id(self):
        with tempfile.TemporaryDirectory() as t:
            original=ROOT/'source-data/natural-earth-50m-india-places.tsv';copy=Path(t)/'broken.tsv'
            text=original.read_text();row=next(ln for ln in text.splitlines() if ln and not ln.startswith('#'))
            copy.write_text(text+'\n'+row+'\n')
            with self.assertRaisesRegex(ValueError,'Duplicate'):prepare(copy,Path(t)/'candidate')

    def test_build_rejects_tampered_source_without_replacing_good_build(self):
        with tempfile.TemporaryDirectory() as t:
            root=Path(t)/'project'
            shutil.copytree(ROOT,root,ignore=shutil.ignore_patterns('dist','.dist-*','__pycache__','*.pyc'))
            stable,meta=build(root);self.assertEqual(meta['naturalEarthPlaceCount'],71)
            data_before=(stable/'data/gazetteer/places.geojson').read_bytes()
            with (root/'source-data/natural-earth-50m-india-places.tsv').open('a') as f:f.write('# tampered\n')
            with self.assertRaisesRegex(ValueError,'Pinned Natural Earth'):build(root)
            self.assertEqual((stable/'data/gazetteer/places.geojson').read_bytes(),data_before)

if __name__=='__main__': unittest.main()
