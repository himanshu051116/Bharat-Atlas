"""Prove build gates cannot be bypassed by rehashing corrupt geographic data."""
import hashlib
import json
import shutil
import tempfile
import unittest
from pathlib import Path
from scripts.build import build
from tests.test_boundary_gate import sample_regions

ROOT = Path(__file__).resolve().parents[1]

class BoundaryBuildIntegrationTests(unittest.TestCase):
    def test_orphaned_geography_or_provenance_rejected(self):
        for orphan in ('preview-provenance.json','states.provisional.geojson'):
            with self.subTest(orphan=orphan), tempfile.TemporaryDirectory() as temp:
                root=Path(temp)/'atlas'
                shutil.copytree(ROOT,root,ignore=shutil.ignore_patterns('dist','.dist-*','__pycache__','*.pyc','.git'))
                (root/'data'/orphan).write_text('{}',encoding='utf-8')
                with self.assertRaisesRegex(ValueError,'must be provided together'):
                    build(root)
                self.assertFalse((root/'dist').exists())
                self.assertFalse((root/'.dist-staging').exists())
    def test_topology_gate_with_valid_hash_and_atomic_rollback(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)/'atlas'
            shutil.copytree(ROOT,root,ignore=shutil.ignore_patterns('dist','.dist-*','__pycache__','*.pyc','.git'))
            source=root/'data/states.provisional.geojson'
            provenance=root/'data/preview-provenance.json'
            def write(geo):
                raw=json.dumps(geo,separators=(',',':')).encode('utf-8')
                source.write_bytes(raw)
                provenance.write_text(json.dumps({
                    'officiallyVerified':False,'licence':'Synthetic testing only',
                    'attribution':'Synthetic geometry','sourceUrl':'https://example.org/synthetic-geometry',
                    'sha256':hashlib.sha256(raw).hexdigest()
                }),encoding='utf-8')
            geo=sample_regions();write(geo)
            built,meta=build(root)
            self.assertTrue(meta['bundledProvisionalMap'])
            self.assertEqual(meta['boundaryTopologyScreening'],'passed')
            self.assertTrue(meta['boundarySampleFailures'])
            report=json.loads((built/'data/boundary-screen.json').read_text())
            self.assertFalse(report['officialGeometryVerified'])
            self.assertEqual(report['regionCount'],36)
            before=(built/'app.bundle.js').read_bytes()
            # This source is now invalid, but its checksum is recomputed to appear valid.
            f=geo['features'][0]
            x,y=f['geometry']['coordinates'][0][0]
            f['geometry']['coordinates']=[[[x,y],[x+.6,y+.6],[x,y+.6],[x+.6,y],[x,y]]]
            write(geo)
            with self.assertRaisesRegex(ValueError,'Unsafe geographic dataset'):
                build(root)
            self.assertEqual((built/'app.bundle.js').read_bytes(),before)
            self.assertTrue((built/'data/boundary-screen.json').is_file())
            self.assertFalse((root/'.dist-staging').exists())

if __name__=='__main__':unittest.main()
