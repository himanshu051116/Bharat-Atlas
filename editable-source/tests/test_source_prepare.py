"""No user files overwritten, and topology checks execute before bundling."""
import json,tempfile,unittest,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import prepare_local_source as module
from import_boundary_data import EXPECTED


def fixture(invalid=False):
    data=[]
    for idx,name in enumerate(sorted(EXPECTED)):
        x,y=62+(idx%9)*.5,5+(idx//9)*.5
        ring=[[x,y],[x+.4,y],[x+.4,y+.4],[x,y+.4],[x,y]]
        if invalid and idx==0:ring=[[x,y],[x+.4,y+.4],[x,y+.4],[x+.4,y],[x,y]]
        data.append({'type':'Feature','properties':{'name':name},'geometry':{'type':'Polygon','coordinates':[ring]}})
    return {'type':'FeatureCollection','features':data}
class PrepTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.original=module.R
        module.R=Path(self.tmp.name);(module.R/'data').mkdir()
        self.source=module.R/'input.geojson'
        self.opts=('https://example.org/boundary-source','ODbL 1.0','© Contributors')
    def tearDown(self):
        module.R=self.original;self.tmp.cleanup()
    def test_screened_candidate_bundles_without_approval_claim(self):
        self.source.write_text(json.dumps(fixture()))
        record=module.prepare(self.source,*self.opts)
        self.assertFalse(record['officiallyVerified']);self.assertFalse(record['allFourSamplePointsPass'])
        self.assertTrue((module.R/'data/states.provisional.geojson').is_file())
        self.assertTrue((module.R/'data/preview-provenance.json').is_file())
        with self.assertRaises(FileExistsError):module.prepare(self.source,*self.opts)
    def test_rejected_topology_never_installs_files(self):
        self.source.write_text(json.dumps(fixture(invalid=True)))
        with self.assertRaisesRegex(ValueError,'topology audit'):
            module.prepare(self.source,*self.opts)
        self.assertFalse((module.R/'data/states.provisional.geojson').exists())
        self.assertFalse((module.R/'data/preview-provenance.json').exists())
if __name__=='__main__':unittest.main()
