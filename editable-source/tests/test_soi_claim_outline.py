"""No official SoI geometry is bundled in these tests; polygons here are synthetic only."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from scripts.prepare_soi_claim_outline import prepare,OFFICIAL_OUTLINE
from scripts.build import build

class SoiClaimTests(unittest.TestCase):
    def test_source_and_rights_fail_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'synthetic.geojson';out=Path(tmp)/'official-india'
            coords=[[68,6],[98,6],[98,38],[68,38],[68,6]]
            p.write_text(json.dumps({'type':'FeatureCollection','features':[{'type':'Feature','properties':{},'geometry':{'type':'Polygon','coordinates':[coords]}}]}))
            with self.assertRaisesRegex(ValueError,'Confirm non-commercial'):
                prepare(p,out)
            with self.assertRaisesRegex(ValueError,'Only a Survey'):
                prepare(p,out,noncommercial_ack=True,source_url='https://example.org/data')
            m=prepare(p,out,noncommercial_ack=True,source_url=OFFICIAL_OUTLINE)
            self.assertFalse(m['politicalMap2026GeometryMatched'])
            self.assertFalse(m['administrativeControlVerified'])
            self.assertTrue(m['claimOnly'])
            self.assertEqual(m['sourcePolygonParts'],m['webPolygonParts'])
            self.assertLessEqual(m['relativeSymmetricDifference'],0.0001)
            self.assertGreater(m['webVertexCount'],3)
            self.assertEqual(m['outlineSha256'],hashlib.sha256((out/'india-claim.geojson').read_bytes()).hexdigest())
            with self.assertRaises(FileExistsError):
                prepare(p,out,noncommercial_ack=True)

    def test_build_includes_source_backed_outline_without_approval_claim(self):
        import shutil
        root=Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as tmp:
            dest=Path(tmp)/'atlas'
            shutil.copytree(root,dest,ignore=shutil.ignore_patterns('dist','.dist-staging','.dist-previous','__pycache__','*.pyc','official-india'))
            geometry={'type':'FeatureCollection','features':[{'type':'Feature','properties':{},'geometry':{'type':'Polygon','coordinates':[[[68,6],[98,6],[98,38],[68,38],[68,6]]]}}]}
            p=Path(tmp)/'synthetic.geojson';p.write_text(json.dumps(geometry))
            result=prepare(p,dest/'data/official-india',noncommercial_ack=True)
            built,info=build(dest)
            self.assertTrue((built/'data/official-india/india-claim.geojson').is_file())
            self.assertFalse(info['officialGeometryVerified'])
            self.assertFalse(info['hasAuthoritativeData'])
            self.assertFalse(info['noProductionPromotion'] is False)
            # Tampering the outline with a checksum unchanged must block the build.
            (dest/'data/official-india/india-claim.geojson').write_text('{}')
            with self.assertRaisesRegex(ValueError,'checksum|provenance|source checks'):
                build(dest)

if __name__=='__main__':unittest.main()
