import json
import tempfile
import shutil
import unittest
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from verify_hosted_preview import verify_hosted
from build import build

class HostedParityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        build()

    def fake_get(self, tamper=None):
        def get(url,limit):
            path=url.split('.example/')[-1]
            item=ROOT/'dist'/path
            raw=item.read_bytes()
            if path==tamper:raw=b'corrupted'+raw
            return raw
        return get

    def test_approved_static_preview_matches_exactly(self):
        report=verify_hosted(ROOT/'dist','https://atlas.example/',getter=self.fake_get())
        self.assertTrue(report['remoteMatchesLocalArtifact'])
        self.assertGreater(report['verifiedPublicAssets'],5)
        self.assertFalse(report['productionReady'])

    def test_catches_rehashed_simplified_remote_bundle(self):
        with self.assertRaisesRegex(ValueError,'Hosted file mismatches'):
            verify_hosted(ROOT/'dist','https://atlas.example',getter=self.fake_get('app.bundle.js'))

    def test_catches_remote_manifest_mismatch(self):
        with self.assertRaisesRegex(ValueError,'Hosted build-manifest.json differs'):
            verify_hosted(ROOT/'dist','https://atlas.example',getter=self.fake_get('build-manifest.json'))

    def test_rejects_unsafe_non_https_urls(self):
        for url in ('http://atlas.example','https://atlas.example/path','https://atlas.example?ref=x','https://foo:secret@atlas.example'):
            with self.subTest(url=url),self.assertRaisesRegex(ValueError,'HTTPS|site root'):
                verify_hosted(ROOT/'dist',url,getter=self.fake_get())

if __name__=='__main__':unittest.main()
