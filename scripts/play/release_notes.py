"""Release notes shared by Google Play and the phone's What's New screen.

The release owner writes the notes once, in the Android internal release
workflow. `prepare_release.py` checks them and writes them, with the version
name and code, into the app's bundled asset before Flutter compiles it.
`publish_internal.py` sends Play the notes from that same file, so both say
exactly the same thing.

The notes are data only: they are read from an environment variable or a
file, written with `json.dump` and shown by the app as plain text. They are
never placed in shell code or rendered as HTML.

Preview locally (then restore the file with `git checkout`):

    python3 scripts/play/release_notes.py --version 0.1.2 --code 3 \
        --notes-file my-notes.txt
"""
import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

ASSET = Path('apps/mobile/assets/release/release_notes.json')
SCHEMA_VERSION = 1
MAX_NOTES = 500
MAX_CODE = 2100000000
VERSION_PATTERN = re.compile(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)')
CODE_PATTERN = re.compile(r'[1-9]\d{0,9}')


class ReleaseNotesError(ValueError):
    """Release metadata that must not be built or published."""


def validate_version(version):
    if not isinstance(version, str) or len(version) > 30 or not VERSION_PATTERN.fullmatch(version):
        raise ReleaseNotesError('Version name must be major.minor.patch, e.g. 0.1.1.')
    return version


def validate_code(code):
    text = str(code)
    if not CODE_PATTERN.fullmatch(text) or int(text) > MAX_CODE:
        raise ReleaseNotesError(f'Version code must be an integer from 1 to {MAX_CODE}.')
    return int(text)


def normalize_notes(notes):
    """The exact text both Play and the app show.

    Line endings become `\\n` and outer whitespace is removed. Quotes, Unicode
    and inner newlines are kept as typed. Control characters other than
    newline and tab are refused, because neither Play nor the screen can show
    them honestly.
    """
    if not isinstance(notes, str):
        raise ReleaseNotesError('Release notes must be text.')
    text = notes.replace('\r\n', '\n').replace('\r', '\n').strip()
    if not text or len(text) > MAX_NOTES:
        raise ReleaseNotesError(f'Release notes must contain 1-{MAX_NOTES} characters.')
    for char in text:
        if char not in '\n\t' and unicodedata.category(char) in ('Cc', 'Cs'):
            raise ReleaseNotesError('Release notes contain a control character; use plain text.')
    return text


def release_metadata(version, code, notes):
    return {
        'schemaVersion': SCHEMA_VERSION,
        'versionName': validate_version(version),
        'versionCode': validate_code(code),
        # The workflow takes one set of notes, in English. The app says so
        # when another language is chosen rather than calling it translated.
        'language': 'en',
        'notes': normalize_notes(notes),
    }


def write_release_metadata(path, version, code, notes):
    """Writes the asset the app bundles. JSON escaping keeps any quotes,
    backslashes, newlines and Unicode in the notes as data."""
    metadata = release_metadata(version, code, notes)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8', newline='\n') as stream:
        json.dump(metadata, stream, ensure_ascii=True, indent=2, sort_keys=True)
        stream.write('\n')
    return metadata


def read_release_metadata(path):
    """Reads and re-checks the asset, refusing anything it would not write."""
    try:
        with Path(path).open(encoding='utf-8') as stream:
            data = json.load(stream)
    except (OSError, ValueError) as error:
        raise ReleaseNotesError(f'Release notes asset is missing or not JSON: {error}') from None
    if not isinstance(data, dict) or data.get('schemaVersion') != SCHEMA_VERSION:
        raise ReleaseNotesError('Release notes asset has no release in it.')
    metadata = release_metadata(data.get('versionName'), data.get('versionCode'), data.get('notes'))
    if metadata['notes'] != data.get('notes') or data.get('language') != 'en':
        raise ReleaseNotesError('Release notes asset was not written by this script.')
    return metadata


def main(argv=None):
    parser = argparse.ArgumentParser(description='Write the phone release notes asset for a local preview build.')
    parser.add_argument('--version', required=True, help='Version name, e.g. 0.1.2')
    parser.add_argument('--code', required=True, help='Version code (build number), e.g. 3')
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--notes', help='The notes as one argument')
    source.add_argument('--notes-file', help='A UTF-8 text file holding the notes')
    parser.add_argument('--output', default=str(ASSET), help=f'Default: {ASSET}')
    args = parser.parse_args(argv)
    notes = args.notes
    if args.notes_file:
        notes = Path(args.notes_file).read_text(encoding='utf-8')
    try:
        metadata = write_release_metadata(args.output, args.version, args.code, notes)
    except ReleaseNotesError as error:
        raise SystemExit(str(error)) from None
    print(f"Wrote {metadata['versionName']} ({metadata['versionCode']}) notes to {args.output}. "
          'Restore the development file with git checkout before committing.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
