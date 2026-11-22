"""Release notes and version for the app's What's new screen (issue #161).

The release workflows pass these to `flutter build` through the dart-define
JSON file, so the notes entered once in the workflow are the ones Google Play
(and TestFlight's What to Test) shows and the ones the installed app shows.

The notes are plain text. They are base64-encoded for the build, so quotes,
newlines and any script reach the app byte for byte; they are never placed in
shell code or read as markup.
"""
import base64
import os
import re

MAX_NOTE_CHARACTERS = 500
REPO_ROOT = os.path.realpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir))
_CONTROL = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]')


def validated_notes(raw):
    """The notes as both Play and the app use them: stripped, 1-500 characters."""
    notes = raw.strip()
    if not notes or len(notes) > MAX_NOTE_CHARACTERS:
        raise SystemExit('Release notes must contain 1-500 characters.')
    if _CONTROL.search(notes):
        raise SystemExit('Release notes must be plain text: no control characters other than line breaks and tabs.')
    return notes


def repo_file(path, root=REPO_ROOT):
    """The real path of a file inside the repository; anything outside it is rejected.

    Symlinks and '..' are resolved first, so neither can point the script outside the checkout.
    """
    root = os.path.realpath(root)
    resolved = os.path.realpath(os.path.join(root, path))
    if os.path.commonpath([root, resolved]) != root:
        raise SystemExit(f'--notes-file must be inside the repository ({root}).')
    if not os.path.isfile(resolved):
        raise SystemExit(f'--notes-file is not a file: {path}')
    return resolved


def release_defines(version, build, notes):
    """Dart defines for the installed release (read by ReleaseInfo.fromEnvironment)."""
    return {
        'SC_RELEASE_VERSION': version,
        'SC_RELEASE_BUILD': str(build),
        'SC_RELEASE_NOTES_B64': base64.b64encode(notes.encode('utf-8')).decode('ascii'),
    }


def main(argv=None):
    """Write a dart-define file to preview What's new locally:

    python3 scripts/release_metadata.py --version 0.2.0 --build 7 \\
        --notes-file notes.txt > /tmp/whats-new.json

    The notes file must be inside the repository; a relative path is read from the repository root.
    flutter run --dart-define-from-file=/tmp/whats-new.json
    """
    import argparse
    import json
    import sys

    parser = argparse.ArgumentParser(description=main.__doc__)
    parser.add_argument('--version', required=True)
    parser.add_argument('--build', required=True, type=int)
    parser.add_argument('--notes-file', required=True)
    args = parser.parse_args(argv)
    with open(repo_file(args.notes_file), encoding='utf-8') as stream:
        notes = validated_notes(stream.read())
    json.dump(release_defines(args.version, args.build, notes), sys.stdout)
    sys.stdout.write('\n')


if __name__ == '__main__':
    main()
