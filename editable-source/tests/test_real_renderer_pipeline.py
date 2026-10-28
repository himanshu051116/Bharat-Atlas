import base64, hashlib, importlib.util, io, json, tarfile, tempfile, unittest
from pathlib import Path
from subprocess import run
ROOT=Path(__file__).resolve().parents[1]
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
vendor=module('atlas_vendor',ROOT/'scripts/vendor_maplibre.py')
proof=module('atlas_proof',ROOT/'scripts/run_renderer_proof.py')
class RendererProofTest(unittest.TestCase):
    def test_valid_vendor_tarball(self):
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'maplibre-gl-5.13.0.tgz';target=Path(td)/'vendor'
            with tarfile.open(path,'w:gz') as t:
                for name,bytestr in {
                    'package/package.json':b'{"name":"maplibre-gl","version":"5.13.0"}',
                    'package/dist/maplibre-gl.js':b'x'*200100,
                    'package/dist/maplibre-gl.css':b'z'*4100,
                    'package/LICENSE.txt':b'Redistribution'+b'z'*5000
                }.items():
                    ti=tarfile.TarInfo(name);ti.size=len(bytestr);t.addfile(ti,io.BytesIO(bytestr))
            integrity='sha512-'+base64.b64encode(hashlib.sha512(path.read_bytes()).digest()).decode()
            vendor.install_tarball(path,target,npm_integrity=integrity)
            d=json.loads((target/'maplibre-provenance.json').read_text())
            self.assertEqual(d['version'],'5.13.0');self.assertEqual(d['sha256']['maplibre-gl.js'],hashlib.sha256(b'x'*200100).hexdigest())
    def test_root_licence_compatibility(self):
        with tempfile.TemporaryDirectory() as td:
            archive=Path(td)/'valid.tgz'
            entries={'package/package.json':b'{"name":"maplibre-gl","version":"5.13.0"}',
                'package/dist/maplibre-gl.js':b'x'*200100,
                'package/dist/maplibre-gl.css':b'z'*4100,
                'package/LICENSE.txt':b'Redistribution'+b'z'*5000}
            with tarfile.open(archive,'w:gz') as t:
                for name,data in entries.items():
                    ti=tarfile.TarInfo(name);ti.size=len(data);t.addfile(ti,io.BytesIO(data))
            integrity='sha512-'+base64.b64encode(hashlib.sha512(archive.read_bytes()).digest()).decode()
            vend=vendor.install_tarball(archive,Path(td)/'vendor',npm_integrity=integrity)
            self.assertIn(b'Redistribution',(vend/'MAPLIBRE-LICENSE.txt').read_bytes())
    def test_version_mismatch_fails(self):
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'wrong.tgz'
            with tarfile.open(path,'w:gz') as t:
                data=b'{"name":"maplibre-gl","version":"5.14.0"}';ti=tarfile.TarInfo('package/package.json');ti.size=len(data);t.addfile(ti,io.BytesIO(data))
            integrity='sha512-'+base64.b64encode(hashlib.sha512(path.read_bytes()).digest()).decode()
            with self.assertRaisesRegex(ValueError,'Expected maplibre-gl'):vendor.install_tarball(path,Path(td)/'vendor',npm_integrity=integrity)
    def test_untrusted_tarball_rejected_before_install(self):
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'fake.tgz';path.write_bytes(b'malicious fake archive')
            dest=Path(td)/'existing';dest.mkdir();(dest/'keep.txt').write_text('keep')
            with self.assertRaisesRegex(ValueError,'integrity is required'):
                vendor.install_tarball(path,dest)
            with self.assertRaisesRegex(ValueError,'integrity mismatch'):
                vendor.install_tarball(path,dest,'sha512-'+base64.b64encode(bytes(64)).decode())
            self.assertEqual((dest/'keep.txt').read_text(),'keep')

    def test_modified_dist_vendor_assets_are_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            dest=Path(td);(dest/'maplibre-gl.js').write_bytes(b'altered')
            (dest/'maplibre-provenance.json').write_text(json.dumps({'package':'maplibre-gl','version':'5.13.0','npmIntegrity':'sha512-'+base64.b64encode(bytes(64)).decode(),'sha256':{'maplibre-gl.js':'0'*64}}))
            with self.assertRaisesRegex(ValueError,'asset integrity failed'):
                proof.verify_vendor_bundle(dest)

    def test_missing_renderer_is_not_a_pass(self):
        with tempfile.TemporaryDirectory() as td:
            r=proof.perform(ROOT/'dist',Path(td))
            self.assertNotEqual(r['status'],'passed')
            self.assertTrue((Path(td)/'real-webgl-proof.json').exists())
    def test_proof_script_is_real_unmocked(self):
        src=(ROOT/'proof/renderer-proof.mjs').read_text()
        self.assertIn('new maplibregl.Map',src)
        self.assertIn('map.queryRenderedFeatures',src)
        self.assertIn('sparseTileHandler',src)
        self.assertIn('maplibregl.addProtocol',src)
        self.assertIn('renderedSettlements',src)
        self.assertIn('verifiedTileBytes',src)
        self.assertIn('navigationRoundTrip',src)
        self.assertIn("results.maplibreVersion!=='5.13.0'",src)
        self.assertNotIn('MockMap',src)
if __name__=='__main__':unittest.main()
