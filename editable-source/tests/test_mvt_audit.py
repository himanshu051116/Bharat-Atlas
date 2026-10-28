"""Independent decoder, interrupted tile pipeline and adversarial binary regression tests."""
import hashlib,json,tempfile,sys,unittest
from pathlib import Path
from unittest.mock import patch
from shapely.geometry import GeometryCollection, LineString, Point
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from build_vector_tiles import make_pyramid,make_layer,geometry_cmd
from mvt_audit import decode_tile,decode_geometry,audit_archive,MVTError
FIX=ROOT/'tests/fixtures'

class DecodeTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.dest=Path(self.tmp.name)/'tiles'
        self.inputs={k:str(FIX/f'{k}.geojson') for k in ['roads','rivers','settlements']}
    def create(self):return make_pyramid(self.inputs,FIX/'tile-source.json',self.dest,4,7)
    def test_decodes_all_real_protobuf_geometry_commands_and_properties(self):
        result=self.create()
        decoded=audit_archive(self.dest)
        self.assertEqual(decoded['tiles'],result['tileCount'])
        self.assertEqual(set(decoded['layers']),set(self.inputs))
        for p in self.dest.rglob('*.pbf'):
            d=decode_tile(p.read_bytes())
            for layer,features in d.items():
                for f in features:
                    self.assertEqual(f['properties']['kind'],layer)
                    self.assertTrue(f['parts'])
    def test_preserves_lines_nested_in_mixed_geometry_collection(self):
        feature=GeometryCollection([Point(13,14),GeometryCollection([LineString([(20,30),(40,50)]),Point(1,2)])])
        blob=geometry_cmd(feature,2)
        self.assertEqual(decode_geometry(blob,2,4096),[[(20,30),(40,50)]])
    def test_rejects_protobuf_corruption_even_if_checksum_was_updated(self):
        cat=self.create()
        path=next(iter(cat['tileHashes']))
        (self.dest/path).write_bytes(b'\xff'*100)
        cat['tileHashes'][path]=hashlib.sha256((self.dest/path).read_bytes()).hexdigest()
        (self.dest/'atlas-tiles.json').write_text(json.dumps(cat))
        with self.assertRaises(MVTError):audit_archive(self.dest)
    def test_failed_new_generation_keeps_previous_complete_archive(self):
        self.create()
        before={f.relative_to(self.dest):hashlib.sha256(f.read_bytes()).hexdigest() for f in self.dest.rglob('*') if f.is_file()}
        import build_vector_tiles
        with patch.object(build_vector_tiles,'MAX_TILES',1):
            with self.assertRaisesRegex(ValueError,'Tile count exceeds safety budget'):
                self.create()
        after={f.relative_to(self.dest):hashlib.sha256(f.read_bytes()).hexdigest() for f in self.dest.rglob('*') if f.is_file()}
        self.assertEqual(before,after)
        self.assertFalse(list(self.dest.parent.glob('.tiles-building-*')))
    def test_rejects_invalid_line_commands(self):
        with self.assertRaisesRegex(MVTError,'Unexpected LineTo'):
            # LineTo, count=1, with two zero-deltas
            decode_geometry(bytes([10,0,0]),2,4096)
        with self.assertRaisesRegex(MVTError,'Truncated'):
            decode_geometry(bytes([9,0]),2,4096)
        with self.assertRaisesRegex(MVTError,'coordinate|Coordinate'):
            # MoveTo count 1, x 10000, y 0: zigzag 20000 -> a0 9c 01
            decode_geometry(bytes([9,0xa0,0x9c,0x01,0]),1,4096)
