"""End-to-end regional fixture build; never publish these synthetic features."""
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from build_regional_pack import build_pack
from mvt_audit import audit_archive


class RegionalPackTest(unittest.TestCase):
    def source(self,root):
        raw={'type':'FeatureCollection','features':[
          {'type':'Feature','properties':{'highway':'primary','name':'SYNTHETIC RESEARCH ROAD'},'geometry':{'type':'LineString','coordinates':[[77.2,23.2],[77.35,23.35]]}},
          {'type':'Feature','properties':{'railway':'rail','name':'SYNTHETIC RESEARCH RAIL'},'geometry':{'type':'LineString','coordinates':[[77.25,23.25],[77.3,23.32]]}},
          {'type':'Feature','properties':{'place':'town','name':'SYNTHETIC TOWN'},'geometry':{'type':'Point','coordinates':[77.28,23.3]}}
        ]}
        geo=root/'input.geojson';geo.write_text(json.dumps(raw))
        source={'officiallyVerified':False,'redistributionReview':'approved_for_research_preview',
            'sourceSha256':hashlib.sha256(geo.read_bytes()).hexdigest(),
            'sourceUrl':'https://example.org/synthetic-geographic-fixture',
            'licence':'Synthetic fixture only, not for production','attribution':'Synthetic fixture',
            'snapshotDate':'2026-10-24','coverageClaim':'local_sample'}
        meta=root/'metadata.json';meta.write_text(json.dumps(source));return geo,meta
    def test_builds_independently_decoded_regional_pack_and_preserves_source(self):
        with tempfile.TemporaryDirectory() as temp:
            base=Path(temp);src,meta=self.source(base)
            folder=base/'region';report=build_pack(src,meta,folder,minzoom=4,maxzoom=7)
            self.assertEqual(report['layers'],['railways','roads','settlements'])
            self.assertTrue(report['tileLayerCountsPresent'])
            self.assertEqual(report['featureCounts']['rivers'],0)
            self.assertEqual(report['tileCount'],audit_archive(folder)['tiles'])
            self.assertTrue(src.exists())
            with self.assertRaisesRegex(ValueError,'already exists'):
                build_pack(src,meta,folder)
    def test_rejects_unreviewed_source_without_partial_output(self):
        with tempfile.TemporaryDirectory() as temp:
            base=Path(temp);src,meta=self.source(base)
            data=json.loads(meta.read_text());data['redistributionReview']='not-reviewed';meta.write_text(json.dumps(data))
            folder=base/'region'
            with self.assertRaisesRegex(ValueError,'review'):
                build_pack(src,meta,folder)
            self.assertFalse(folder.exists())
            self.assertEqual(set(x.name for x in base.iterdir()),{'input.geojson','metadata.json'})

if __name__=='__main__': unittest.main()
