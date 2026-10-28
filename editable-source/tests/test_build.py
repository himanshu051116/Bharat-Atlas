import json,hashlib,subprocess,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class BuildChecks(unittest.TestCase):
    def test_build_official_claim_block(self):
        subprocess.run(['python',str(ROOT/'scripts/build.py')],check=True,stdout=subprocess.DEVNULL)
        m=json.loads((ROOT/'dist/build-manifest.json').read_text())
        self.assertFalse(m['officialGeometryVerified'])
        self.assertFalse(m['hasAuthoritativeData'])
        self.assertTrue(m['noProductionPromotion'])
        self.assertTrue(m['externalMapLibreDependency'])
        self.assertFalse(m['usesRemoteGlyphService'])
        self.assertFalse(m['cityDataSurveyVerified'])
        self.assertEqual(m['pilotPlaceCount'],25)
        self.assertEqual(m['version'],'1.11')
    def test_bundle_is_current(self):
        for f in json.loads((ROOT/'dist/build-manifest.json').read_text())['assets']:
            data=(ROOT/'dist'/f['path']).read_bytes()
            self.assertEqual(hashlib.sha256(data).hexdigest(),f['sha256'])
    def test_preview_security_and_cache_headers(self):
        config=json.loads((ROOT/'dist/vercel.json').read_text())
        rules=config['headers']
        self.assertTrue(any(h['source']=='/data/(.*)' and
            any(x['key']=='Cache-Control' for x in h['headers']) for h in rules))
        common=next(x for x in rules if x['source']=='/(.*)')
        headers={h['key']:h['value'] for h in common['headers']}
        self.assertEqual(headers['X-Robots-Tag'],'noindex, nofollow')
        self.assertEqual(headers['X-Content-Type-Options'],'nosniff')
    def test_legacy_preserved(self):
        self.assertTrue((ROOT/'dist/legacy/index.html').is_file())
        self.assertTrue((ROOT/'dist/legacy/app.js').is_file())
        self.assertTrue((ROOT/'dist/legacy/styles.css').is_file())
        self.assertFalse((ROOT/'dist/legacy/scripts').exists())
if __name__=='__main__':unittest.main()
