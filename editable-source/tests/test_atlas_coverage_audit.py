import sys,unittest
from pathlib import Path
R=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(R/'scripts'))
from atlas_coverage_audit import audit
class CoverageTest(unittest.TestCase):
 def test_source_coverage_is_truthful(self):
  report=audit(R)
  self.assertEqual(report['physicalMVT']['tiles'],608)
  self.assertEqual(set(report['physicalMVT']['sourceLayers']),{'coastlines','lakes','rivers','settlements'})
  self.assertEqual(report['settlementCoverage']['selectedPoints'],71)
  self.assertFalse(report['transport']['roads'])
  self.assertFalse(report['transport']['railways'])
  self.assertFalse(report['politicalGeography']['officiallyVerified'])
  self.assertEqual(report['politicalGeography']['northernTerritoryReview']['Shaksgam'],'unresolved')
  self.assertFalse(report['coreV1Ready'])
if __name__=='__main__':unittest.main()
