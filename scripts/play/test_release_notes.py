"""Issue #161: release notes are checked once and embedded as plain data.

Run from the repository root:

    python3 -m unittest discover -s scripts/play -p 'test_*.py'
"""
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))

import prepare_release  # noqa: E402
import release_notes  # noqa: E402
from release_notes import ReleaseNotesError  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
TRICKY = (
    'Fixed "quotes", it\'s done & <b>not HTML</b>\r\n'
    '- $(touch /tmp/pwned) `whoami` ${HOME} \\n stays text\n'
    '- සිංහල, தமிழ், emoji 🌱'
)


class NormalizeNotesTest(unittest.TestCase):
    def test_keeps_quotes_unicode_and_inner_newlines(self):
        notes = release_notes.normalize_notes(f'  {TRICKY}\n\n')
        self.assertEqual(notes, TRICKY.replace('\r\n', '\n'))
        self.assertIn('"quotes"', notes)
        self.assertIn('$(touch /tmp/pwned)', notes)
        self.assertIn('🌱', notes)
        self.assertEqual(notes.count('\n'), 2)

    def test_line_endings_become_newlines(self):
        self.assertEqual(release_notes.normalize_notes('a\r\nb\rc'), 'a\nb\nc')

    def test_length_limits_match_google_play(self):
        self.assertEqual(len(release_notes.normalize_notes('x' * 500)), 500)
        for notes in ['', '   \n ', 'x' * 501]:
            with self.assertRaises(ReleaseNotesError):
                release_notes.normalize_notes(notes)

    def test_control_characters_are_refused(self):
        for notes in ['bell\a', 'nul\x00', 'escape\x1b[31m']:
            with self.assertRaises(ReleaseNotesError):
                release_notes.normalize_notes(notes)
        self.assertEqual(release_notes.normalize_notes('tab\there'), 'tab\there')

    def test_versions_and_codes(self):
        self.assertEqual(release_notes.validate_version('0.1.2'), '0.1.2')
        self.assertEqual(release_notes.validate_code('3'), 3)
        for version in ['1.2', '01.2.3', '1.2.3-beta', '1.2.3 ', '']:
            with self.assertRaises(ReleaseNotesError):
                release_notes.validate_version(version)
        for code in ['0', '-1', '2100000001', '1.5', 'abc', '']:
            with self.assertRaises(ReleaseNotesError):
                release_notes.validate_code(code)


class AssetTest(unittest.TestCase):
    def test_written_asset_reads_back_exactly(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'release' / 'release_notes.json'
            written = release_notes.write_release_metadata(path, '0.1.2', '3', TRICKY)
            raw = path.read_text(encoding='utf-8')
            # Plain ASCII JSON: nothing in the notes can end the string early.
            self.assertTrue(raw.isascii())
            self.assertEqual(json.loads(raw), written)
            self.assertEqual(release_notes.read_release_metadata(path), written)
            self.assertEqual(written['notes'], release_notes.normalize_notes(TRICKY))
            self.assertEqual(written['versionCode'], 3)
            self.assertEqual(written['language'], 'en')

    def test_development_fallback_is_not_a_release(self):
        fallback = REPO / 'apps/mobile/assets/release/release_notes.json'
        data = json.loads(fallback.read_text(encoding='utf-8'))
        self.assertNotIn('versionName', data)
        with self.assertRaises(ReleaseNotesError):
            release_notes.read_release_metadata(fallback)

    def test_tampered_or_missing_assets_are_refused(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'release_notes.json'
            with self.assertRaises(ReleaseNotesError):
                release_notes.read_release_metadata(path)
            path.write_text('{not json', encoding='utf-8')
            with self.assertRaises(ReleaseNotesError):
                release_notes.read_release_metadata(path)
            release_notes.write_release_metadata(path, '0.1.2', 3, 'Notes')
            data = json.loads(path.read_text(encoding='utf-8'))
            data['notes'] = '  padded  '
            path.write_text(json.dumps(data), encoding='utf-8')
            with self.assertRaises(ReleaseNotesError):
                release_notes.read_release_metadata(path)

    def test_preview_command_writes_from_a_file(self):
        with tempfile.TemporaryDirectory() as folder:
            notes = Path(folder) / 'notes.txt'
            notes.write_text(TRICKY, encoding='utf-8')
            output = Path(folder) / 'out.json'
            with redirect_stdout(io.StringIO()):
                release_notes.main(['--version', '0.2.0', '--code', '9',
                                    '--notes-file', str(notes), '--output', str(output)])
            self.assertEqual(release_notes.read_release_metadata(output)['notes'],
                             release_notes.normalize_notes(TRICKY))


class PrepareReleaseTest(unittest.TestCase):
    """The workflow's preparation step embeds exactly the typed notes."""

    def run_prepare(self, folder, notes):
        temp = Path(folder) / 'runner'
        temp.mkdir()
        checkout = Path(folder) / 'checkout'
        (checkout / 'apps/mobile/android').mkdir(parents=True)
        env = {
            'GITHUB_REF': 'refs/heads/main',
            'GITHUB_REPOSITORY': 'sarvodaya-connect/sarvodaya-connect',
            'VERSION_NAME': '0.1.2',
            'VERSION_CODE': '3',
            'RELEASE_NOTES': notes,
            'API_BASE_URL': 'https://api.example.invalid/api/v1',
            'COGNITO_USER_POOL_ID': 'ap-southeast-1_Fictional1',
            'COGNITO_CLIENT_ID': 'fictionalclient',
            # Fictional test values, not a real keystore or password.
            'ANDROID_KEYSTORE_BASE64': 'QUFB' * 40,
            'ANDROID_STORE_PASSWORD': 'fictional-store',
            'ANDROID_KEY_PASSWORD': 'fictional-key',
            'RUNNER_TEMP': str(temp),
        }
        cwd = os.getcwd()
        os.chdir(checkout)
        try:
            with mock.patch.dict(os.environ, env, clear=True), redirect_stdout(io.StringIO()):
                prepare_release.main()
        finally:
            os.chdir(cwd)
        return checkout / release_notes.ASSET

    def test_embeds_the_workflow_notes(self):
        with tempfile.TemporaryDirectory() as folder:
            asset = self.run_prepare(folder, f'\n{TRICKY}\n')
            metadata = release_notes.read_release_metadata(asset)
            self.assertEqual(metadata['versionName'], '0.1.2')
            self.assertEqual(metadata['versionCode'], 3)
            self.assertEqual(metadata['notes'], release_notes.normalize_notes(TRICKY))

    def test_invalid_notes_stop_before_anything_is_written(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(SystemExit):
                self.run_prepare(folder, 'x' * 501)
            self.assertFalse((Path(folder) / 'checkout' / release_notes.ASSET).exists())
            self.assertFalse((Path(folder) / 'checkout/apps/mobile/android/key.properties').exists())


class WorkflowTest(unittest.TestCase):
    def test_notes_never_reach_shell_code(self):
        workflow = (REPO / '.github/workflows/play-internal-release.yml').read_text(encoding='utf-8')
        # Only the env mapping may expand the input; run blocks read $RELEASE_NOTES.
        self.assertEqual(workflow.count('inputs.release_notes'), 1)
        self.assertIn('RELEASE_NOTES: ${{ inputs.release_notes }}', workflow)

    def test_preview_command_runs_as_a_script(self):
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / 'out.json'
            subprocess.run(
                [sys.executable, str(REPO / 'scripts/play/release_notes.py'), '--version', '0.1.2',
                 '--code', '3', '--notes', '"; rm -rf / #', '--output', str(output)],
                check=True, capture_output=True,
            )
            self.assertEqual(release_notes.read_release_metadata(output)['notes'], '"; rm -rf / #')


if __name__ == '__main__':
    unittest.main()
