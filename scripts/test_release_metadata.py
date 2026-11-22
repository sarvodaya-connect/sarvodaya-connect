"""Run with: python3 -m unittest discover -s scripts -p 'test_*.py'"""
import base64
import json
import os
import tempfile
import unittest

from release_metadata import release_defines, repo_file, validated_notes

# The same text and base64 as apps/mobile/test/whats_new_test.dart.
TRICKY = (
    'First line with "quotes", \'apostrophes\', $HOME and `ticks` \\ done\n'
    '- සිංහල · தமிழ் · 🚀\n'
    '<b>not html</b> & <script>x</script>'
)
TRICKY_BASE64 = (
    'Rmlyc3QgbGluZSB3aXRoICJxdW90ZXMiLCAnYXBvc3Ryb3BoZXMnLCAkSE9NRSBhbmQgYHRpY2tzYCBcIGRvbmUKLSDgt4Pgt5LgtoLgt4Tgtr0gwrcg4K6k4K6u4K6/4K604K+NIMK3IPCfmoAKPGI+bm90IGh0bWw8L2I+ICYgPHNjcmlwdD54PC9zY3JpcHQ+'
)


class ReleaseMetadataTest(unittest.TestCase):
    def test_notes_reach_the_app_byte_for_byte(self):
        defines = release_defines('0.2.0', '7', validated_notes(TRICKY))
        self.assertEqual(defines['SC_RELEASE_NOTES_B64'], TRICKY_BASE64)
        self.assertEqual(base64.b64decode(defines['SC_RELEASE_NOTES_B64']).decode('utf-8'), TRICKY)
        # Only base64 characters reach the build tool's arguments.
        self.assertRegex(defines['SC_RELEASE_NOTES_B64'], r'^[A-Za-z0-9+/=]+$')
        # The define file stays valid JSON.
        self.assertEqual(json.loads(json.dumps(defines)), defines)

    def test_play_and_the_app_get_the_same_text(self):
        raw = '  Fixed the map.\nAdded offline saving.  \n'
        notes = validated_notes(raw)
        # publish_internal.py sends os.environ['RELEASE_NOTES'].strip() to Play.
        self.assertEqual(notes, raw.strip())
        decoded = base64.b64decode(release_defines('0.2.0', 7, notes)['SC_RELEASE_NOTES_B64']).decode('utf-8')
        self.assertEqual(decoded, raw.strip())

    def test_notes_must_be_1_to_500_plain_characters(self):
        for bad in ['', '   ', 'a' * 501, 'bell\x07', 'nul\x00']:
            with self.assertRaises(SystemExit, msg=repr(bad)):
                validated_notes(bad)
        self.assertEqual(validated_notes('a' * 500), 'a' * 500)
        self.assertEqual(validated_notes('tab\tand\nnew line'), 'tab\tand\nnew line')

    def test_identity_is_version_and_build(self):
        defines = release_defines('0.2.0', 7, 'x')
        self.assertEqual((defines['SC_RELEASE_VERSION'], defines['SC_RELEASE_BUILD']), ('0.2.0', '7'))


class RepoFileTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = os.path.realpath(os.path.join(self.tmp.name, 'repo'))
        os.makedirs(os.path.join(self.root, 'notes'))
        self.inside = os.path.join(self.root, 'notes', 'release.txt')
        self.outside = os.path.join(self.tmp.name, 'secret.txt')
        for path in (self.inside, self.outside):
            with open(path, 'w', encoding='utf-8') as stream:
                stream.write('x')

    def test_files_inside_the_repository_are_allowed(self):
        self.assertEqual(repo_file('notes/release.txt', self.root), self.inside)
        self.assertEqual(repo_file(self.inside, self.root), self.inside)

    def test_paths_outside_the_repository_are_rejected(self):
        os.symlink(self.outside, os.path.join(self.root, 'link.txt'))
        for bad in ['../secret.txt', 'notes/../../secret.txt', self.outside, 'link.txt', '/etc/passwd']:
            with self.assertRaises(SystemExit, msg=bad):
                repo_file(bad, self.root)

    def test_missing_files_and_directories_are_rejected(self):
        for bad in ['notes', 'missing.txt']:
            with self.assertRaises(SystemExit, msg=bad):
                repo_file(bad, self.root)


if __name__ == '__main__':
    unittest.main()
