import json,shutil,tempfile,unittest
from pathlib import Path
from scripts.verify_preview import verify
ROOT=Path(__file__).resolve().parents[1]

class AtlasLabsBuildTests(unittest.TestCase):
    def test_real_labs_pages_in_verified_build(self):
        x=verify(ROOT/'dist')
        self.assertEqual(x['version'],'1.11')
        html=(ROOT/'dist/atlas-labs.html').read_text()
        self.assertIn('data-lab-tab="stories"',html)
        self.assertIn('src="./atlas-labs.mjs"',html)
        self.assertIn('atlas-labs.html',(ROOT/'dist/index.html').read_text())
    def test_labs_module_and_css_published(self):
        manifest=json.loads((ROOT/'dist/build-manifest.json').read_text())
        entries={row['path'] for row in manifest['assets']}
        for file in ('atlas-labs.html','atlas-labs.css','atlas-labs.mjs'):
            self.assertIn(file,entries)
    def test_explicit_research_gates(self):
        manifest=json.loads((ROOT/'dist/build-manifest.json').read_text())
        self.assertFalse(manifest['officialGeometryVerified'])
        self.assertTrue(manifest['atlasLabsResearchOnly'])
        self.assertEqual(len(manifest['atlasLabsModules']),5)
    def test_tampered_lab_module_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            target=Path(td)/'dist';shutil.copytree(ROOT/'dist',target)
            module=target/'atlas-labs.mjs';module.write_text('broken code')
            with self.assertRaisesRegex(ValueError,'Tampered|Missing or truncated'):
                verify(target)

if __name__=='__main__':unittest.main()
