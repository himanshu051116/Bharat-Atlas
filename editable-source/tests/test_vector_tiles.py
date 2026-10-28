"""Real static MVT encoding tests without a MapLibre renderer dependency."""
import hashlib, json, shutil, tempfile, unittest
from pathlib import Path
import sys
R=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(R/'scripts'))
from build_vector_tiles import make_pyramid, geometry_cmd, make_layer, box, read_input, tile_of

FIX=R/'tests/fixtures'

def varint(blob,pos):
    result=0;shift=0
    while True:
        byte=blob[pos];pos+=1;result|=(byte&127)<<shift
        if not byte&128:return result,pos
        shift+=7

def fields(blob):
    out=[];pos=0
    while pos<len(blob):
        fieldwire,pos=varint(blob,pos);num=fieldwire>>3;wire=fieldwire&7
        if wire==0:val,pos=varint(blob,pos)
        elif wire==2:
            size,pos=varint(blob,pos);val=blob[pos:pos+size];pos+=size
        else:raise AssertionError(f'unexpected protobuf wire type {wire}')
        out.append((num,val))
    return out

class TilesTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.dest=Path(self.tmp.name)/'tiles'
        self.inputs={k:str(FIX/f'{k}.geojson') for k in ['roads','rivers','settlements']}
    def tearDown(self):self.tmp.cleanup()
    def generated(self):
        return make_pyramid(self.inputs,FIX/'tile-source.json',self.dest,4,7)
    def test_creates_sparse_xyz_tiles_with_true_protobuf_layers(self):
        cat=self.generated();self.assertGreater(cat['tileCount'],0)
        self.assertEqual(set(cat['layers']),set(self.inputs))
        self.assertFalse(cat['officiallyVerified'])
        self.assertEqual(set(cat['tileLayerCounts']),set(cat['tileHashes']))
        from mvt_audit import decode_tile, audit_archive, MVTError
        for rel,counts in cat['tileLayerCounts'].items():
            decoded=decode_tile((self.dest/rel).read_bytes())
            self.assertEqual(counts,{k:len(v) for k,v in sorted(decoded.items())})
        from copy import deepcopy
        altered=deepcopy(cat)
        first=next(iter(altered['tileLayerCounts']))
        layer=next(iter(altered['tileLayerCounts'][first]))
        altered['tileLayerCounts'][first][layer]+=1
        (self.dest/'atlas-tiles.json').write_text(json.dumps(altered))
        with self.assertRaisesRegex(MVTError,'count mismatch'):
            audit_archive(self.dest)
        (self.dest/'atlas-tiles.json').write_text(json.dumps(cat))

        names=set()
        for p in self.dest.rglob('*.pbf'):
            bs=p.read_bytes();self.assertTrue(bs)
            for field,packet in fields(bs):
                self.assertEqual(field,3)
                messages=fields(packet)
                names.update(v.decode() for n,v in messages if n==1)
                versions=[v for n,v in messages if n==15];self.assertEqual(versions,[2])
                self.assertTrue(any(n==2 for n,_ in messages))
                self.assertEqual([v for n,v in messages if n==5],[4096])
        self.assertEqual(names,set(self.inputs))
        for rel,digest in cat['tileHashes'].items():
            self.assertEqual(hashlib.sha256((self.dest/rel).read_bytes()).hexdigest(),digest)
    def test_generation_is_byte_for_byte_deterministic(self):
        a=self.generated()
        raw={n:(self.dest/n).read_bytes() for n in a['tileHashes']}
        b=self.generated()
        self.assertEqual(a,b)
        self.assertEqual(raw,{n:(self.dest/n).read_bytes() for n in b['tileHashes']})
    def test_rejects_missing_provenance(self):
        bad=Path(self.tmp.name)/'source.json'
        bad.write_text(json.dumps({'sourceUrl':'https://example.com','licence':'X','attribution':'A','officiallyVerified':True}))
        with self.assertRaisesRegex(ValueError,'NOT officially verified'):
            make_pyramid(self.inputs,bad,self.dest,4,7)
    def test_never_deletes_a_source_directory(self):
        with self.assertRaisesRegex(ValueError,'Output must not contain input'):
            make_pyramid(self.inputs,FIX/'tile-source.json',FIX,4,7)
        self.assertTrue((FIX/'roads.geojson').is_file())
    def test_refuses_unrelated_existing_output(self):
        self.dest.mkdir();(self.dest/'user-file.txt').write_text('do not delete me')
        with self.assertRaisesRegex(ValueError,'unrelated directory'):
            self.generated()
        self.assertTrue((self.dest/'user-file.txt').exists())
    def test_rejects_out_of_bounds_line(self):
        broken=Path(self.tmp.name)/'roads.geojson'
        broken.write_text(json.dumps({'type':'FeatureCollection','features':[{'type':'Feature','properties':{'name':'broken'},'geometry':{'type':'LineString','coordinates':[[77.2,23.1],[99,100]]}}]}))
        with self.assertRaises(ValueError):read_input(broken,'roads')

if __name__=='__main__':unittest.main()

class PackagedTileTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.project=Path(self.tmp.name)/'atlas'
        shutil.copytree(R,self.project,ignore=shutil.ignore_patterns('dist','__pycache__','*.pyc','generated','desktop-v08.png','mobile-v08.png','desktop-v09.png','mobile-v09.png'))
        self.tiledir=self.project/'data/tiles'
        make_pyramid({k:str(FIX/f'{k}.geojson') for k in ['roads','rivers','settlements']},
                     FIX/'tile-source.json',self.tiledir,4,7)
    def tearDown(self):self.tmp.cleanup()
    def test_build_includes_only_checksum_verified_tiles(self):
        from importlib.util import spec_from_file_location,module_from_spec
        spec=spec_from_file_location('local_atlas_build',str(R/'scripts/build.py'))
        module=module_from_spec(spec);spec.loader.exec_module(module)
        dist,manifest=module.build(self.project)
        self.assertTrue(manifest['bundledLocalVectorTiles'])
        hashes=json.loads((self.tiledir/'atlas-tiles.json').read_text())['tileHashes']
        for rel,digest in hashes.items():
            self.assertEqual(hashlib.sha256((dist/'data/tiles'/rel).read_bytes()).hexdigest(),digest)
        self.assertTrue((dist/'app.bundle.js').is_file())
        self.assertFalse(manifest['officialGeometryVerified'])
    def test_build_refuses_rehashed_but_invalid_protobuf(self):
        from importlib.util import spec_from_file_location,module_from_spec
        spec=spec_from_file_location('mvt_build_semantic',str(R/'scripts/build.py'))
        module=module_from_spec(spec);spec.loader.exec_module(module)
        manifest_path=self.tiledir/'atlas-tiles.json'
        cat=json.loads(manifest_path.read_text())
        rel=next(iter(cat['tileHashes']))
        corrupt=self.tiledir/rel;corrupt.write_bytes(b'\xff'*40)
        cat['tileHashes'][rel]=hashlib.sha256(corrupt.read_bytes()).hexdigest()
        manifest_path.write_text(json.dumps(cat))
        with self.assertRaisesRegex(ValueError,'protobuf|wire|varint|Truncated|Overflowing'):
            module.build(self.project)

    def test_build_refuses_tampered_tile(self):
        from importlib.util import spec_from_file_location,module_from_spec
        spec=spec_from_file_location('local_atlas_build_2',str(R/'scripts/build.py'))
        module=module_from_spec(spec);spec.loader.exec_module(module)
        bad=next(self.tiledir.rglob('*.pbf'))
        bad.write_bytes(bad.read_bytes()+b'bad')
        with self.assertRaisesRegex(ValueError,'Corrupt/missing tile'):
            module.build(self.project)

class AtomicBuildTest(unittest.TestCase):
    def test_failed_build_preserves_previous_static_site(self):
        import importlib.util
        spec=importlib.util.spec_from_file_location('atomic_build',str(R/'scripts/build.py'))
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as d:
            target=Path(d)/'atlas'
            shutil.copytree(R,target,ignore=shutil.ignore_patterns('dist','.dist-staging','__pycache__','*.pyc','generated','desktop-v09.png','mobile-v09.png'))
            prev,m=module.build(target)
            old=hashlib.sha256((prev/'app.bundle.js').read_bytes()).hexdigest()
            # Corrupt an existing real hydrology catalogue without deleting the previous successful build.
            (target/'data/tiles/atlas-tiles.json').write_text('{}')
            with self.assertRaisesRegex(ValueError,'Invalid or unlicensed tile catalogue'):
                module.build(target)
            self.assertEqual(hashlib.sha256((prev/'app.bundle.js').read_bytes()).hexdigest(),old)
            self.assertFalse((target/'.dist-staging').exists())
            self.assertFalse((target/'.dist-previous').exists())
