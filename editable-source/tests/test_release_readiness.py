import unittest
from scripts.audit_release_readiness import audit
class PhaseReadinessTests(unittest.TestCase):
 def test_full_release_not_promoted(self):
  a=audit();self.assertFalse(a['productionReleasePermitted']);self.assertFalse(a['fullV2ProductComplete']);self.assertTrue(a['lastPhaseReachedInResearchCode'])
 def test_every_roadmap_phase_has_evidence_and_blockers(self):
  a=audit();self.assertEqual(len(a['phaseEvidence']),4)
  for data in a['phaseEvidence'].values():
   self.assertFalse(data['releaseReady']);self.assertTrue(data['implemented']);self.assertTrue(data['blocking'])
if __name__=='__main__':unittest.main()
