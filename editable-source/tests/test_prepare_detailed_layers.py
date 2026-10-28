import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from prepare_detailed_layers import prepare
from build_vector_tiles import make_pyramid

class DetailedLayerTest(unittest.TestCase):
    def input(self,base,features,**changes):
        source=base/'source.geojson';source.write_text(json.dumps({'type':'FeatureCollection','features':features}))
        metadata=base/'source-meta.json';details={
            'officiallyVerified':False,
            'redistributionReview':'approved_for_research_preview',
            'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
            'sourceUrl':'https://www.openstreetmap.org/copyright',
            'licence':'ODbL-1.0, external review required',
            'attribution':'© OpenStreetMap contributors (synthetic test fixtures)',
            'snapshotDate':'2026-10-24','coverageClaim':'local_sample'}
        details.update(changes);metadata.write_text(json.dumps(details))
        return source,metadata
    def feat(self,geom,props):return {'type':'Feature','properties':props,'geometry':geom}
    def test_prepare_four_layers_and_decode_tiles(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            source,meta=self.input(root,[
                self.feat({'type':'LineString','coordinates':[[77.1,23.1],[77.5,23.3]]},{'highway':'primary','name':'TEST ROAD'}),
                self.feat({'type':'LineString','coordinates':[[77.2,23.3],[77.4,23.5]]},{'railway':'rail','name':'TEST RAILWAY'}),
                self.feat({'type':'LineString','coordinates':[[77.2,23.3],[77.4,23.5]]},{'waterway':'river','name':'TEST RIVER'}),
                self.feat({'type':'Point','coordinates':[77.39,23.25]},{'place':'city','name':'TEST CITY'}),
                self.feat({'type':'Point','coordinates':[77.39,23.25]},{'amenity':'hospital','name':'OTHER'}),
            ])
            out=root/'prepared';report=prepare(source,meta,out)
            self.assertEqual(report['featureCounts'],{'roads':1,'railways':1,'rivers':1,'settlements':1,'pois':1})
            self.assertEqual(report['unclassified'],0)
            inputs={name:out/f'{name}.geojson' for name in report['featureCounts'] if report['featureCounts'][name]}
            result=make_pyramid(inputs,out/'tile-source.json',root/'tiles',3,4)
            self.assertEqual(sorted(result['layers']),sorted(inputs))
            self.assertGreater(result['tileCount'],0)
            self.assertFalse(result['officiallyVerified'])
            self.assertEqual(result['sourceLayers']['roads']['sourceSha256'],report['sourceSha256'])
    def test_tampered_source_and_absent_approval_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);f=self.feat({'type':'Point','coordinates':[77.2,23.2]},{'place':'town','name':'TEST'})
            source,meta=self.input(root,[f],redistributionReview='not_reviewed')
            with self.assertRaisesRegex(ValueError,'human redistribution review'):prepare(source,meta,root/'out')
            m=json.loads(meta.read_text());m['redistributionReview']='approved_for_research_preview';meta.write_text(json.dumps(m));source.write_text(source.read_text()+' ')
            with self.assertRaisesRegex(ValueError,'SHA-256'):prepare(source,meta,root/'out')
    def test_invalid_geometry_and_overwrite_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);bad=self.feat({'type':'LineString','coordinates':[[77,23],[float('nan'),23.4]]},{'highway':'primary'})
            source,meta=self.input(root,[bad])
            with self.assertRaisesRegex(ValueError,'Invalid geometry|Unparseable'):prepare(source,meta,root/'out')
            good=self.feat({'type':'Point','coordinates':[77.3,23.2]},{'place':'town','name':'TEST'})
            source,meta=self.input(root,[good]);dest=root/'out';dest.mkdir()
            with self.assertRaisesRegex(ValueError,'must not exist'):prepare(source,meta,dest)

if __name__=='__main__':unittest.main()
