import hashlib
import json
import shutil
import tempfile
import unittest
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from build import build, MODULES
from verify_preview import verify

class PreviewContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        build()
    def test_full_modular_preview(self):
        result=verify(ROOT/'dist')
        self.assertEqual(result['modules'],len(MODULES))
        self.assertEqual(json.loads((ROOT/'dist/build-manifest.json').read_text())['naturalEarthPlaceCount'],71)
        self.assertFalse(result['officialGeometryVerified'])
    def test_rejects_tampered_bundle(self):
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)
            shutil.copytree(ROOT/'dist',path/'dist')
            copy=path/'dist'
            (copy/'app.bundle.js').write_text('malicious shortened preview',encoding='utf-8')
            with self.assertRaisesRegex(ValueError,'Missing or truncated|Tampered'):
                verify(copy)
    def test_rejects_forged_manifest_claim(self):
        with tempfile.TemporaryDirectory() as td:
            copy=Path(td)/'dist'
            shutil.copytree(ROOT/'dist',copy)
            m=copy/'build-manifest.json'
            o=json.loads(m.read_text())
            o['officialGeometryVerified']=True
            m.write_text(json.dumps(o))
            with self.assertRaisesRegex(ValueError,'Unsupported official-data'):
                verify(copy)
    def test_rejects_single_page_preview_even_with_updated_hashes(self):
        with tempfile.TemporaryDirectory() as td:
            copy=Path(td)/'dist'
            shutil.copytree(ROOT/'dist',copy)
            js=copy/'app.bundle.js'
            js.write_text('// simplified deployment')
            m=copy/'build-manifest.json'
            o=json.loads(m.read_text())
            for a in o['assets']:
                if a['path']=='app.bundle.js':
                    a['bytes']=js.stat().st_size
                    a['sha256']=hashlib.sha256(js.read_bytes()).hexdigest()
            m.write_text(json.dumps(o))
            with self.assertRaisesRegex(ValueError,'missing module'):
                verify(copy)

if __name__=='__main__':unittest.main()
