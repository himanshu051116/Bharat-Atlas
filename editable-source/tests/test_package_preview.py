import json
import shutil
import tempfile
import unittest
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from build import build
from package_preview import package_preview

class PackagePreviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):build()

    def test_deterministic_package_contains_only_verified_dist(self):
        with tempfile.TemporaryDirectory() as path:
            a=Path(path)/'a.zip';b=Path(path)/'b.zip'
            report_a=package_preview(ROOT/'dist',a)
            report_b=package_preview(ROOT/'dist',b)
            self.assertEqual(a.read_bytes(),b.read_bytes())
            self.assertEqual(report_a,report_b)
            self.assertFalse(report_a['readyForProduction'])

    def test_refuses_tampered_preview_even_if_local_dist_is_present(self):
        with tempfile.TemporaryDirectory() as path:
            d=Path(path)/'dist';shutil.copytree(ROOT/'dist',d)
            with (d/'app.bundle.js').open('a') as out:out.write('// surprise')
            with self.assertRaisesRegex(ValueError,'Missing or truncated|Tampered'):
                package_preview(d,Path(path)/'no.zip')

if __name__=='__main__':unittest.main()
