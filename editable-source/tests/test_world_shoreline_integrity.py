"""A small contract test: bundled physical coast/water data must be authentic and separate."""
from pathlib import Path
import hashlib,json,unittest
R=Path(__file__).resolve().parents[1]
class WorldShorelineIntegrity(unittest.TestCase):
 def test_physical_source_provenance_and_count(self):
  source=R/'data/world/world-shorelines.json'
  raw=source.read_bytes();d=json.loads(raw)
  m=json.loads((R/'data/world/shoreline-manifest.json').read_text())
  self.assertEqual(m['sha256'],hashlib.sha256(raw).hexdigest())
  self.assertEqual(m['bytes'],len(raw))
  self.assertEqual((m['coastSegments'],m['inlandWaterParts']),(1150,650))
  self.assertEqual(d['coastSegments'],m['coastSegments'])
  self.assertEqual(d['inlandWaterParts'],m['inlandWaterParts'])
  self.assertIs(d['current'],False)
  self.assertIs(d['politicalAuthority'],False)
  self.assertIn('LGPL',m['licence'])
  self.assertTrue(d['coastPath'].startswith('M'))
  self.assertTrue(d['lakePath'].startswith('M'))
  self.assertFalse(any(x in d for x in ['IndianClaims','officialPoliticalGeometry']))
if __name__=='__main__':unittest.main()
