"""Protect the concatenation build from silently shadowing function declarations."""
import tempfile
import unittest
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from build import check_module_function_names

class BundleNameTests(unittest.TestCase):
    def test_source_modules_have_no_duplicate_top_level_function_names(self):
        self.assertGreater(check_module_function_names(),20)

    def test_rejects_shadowed_function_declaration(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            (root/'first.mjs').write_text('function projector() {}\n')
            (root/'second.mjs').write_text('export function projector() {}\n')
            with self.assertRaisesRegex(ValueError,'Function declaration collision: projector'):
                check_module_function_names(root,['first.mjs','second.mjs'])

    def test_different_names_allowed(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            (root/'first.mjs').write_text('function sourceOnly() {}\n')
            (root/'second.mjs').write_text('export async function targetOnly() {}\n')
            self.assertEqual(check_module_function_names(root,['first.mjs','second.mjs']),2)
