"""Prepare the TEST build configuration and validate Apple signing inputs."""
import base64
import binascii
import json
import os
import plistlib
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from release_metadata import release_defines, validated_notes  # noqa: E402

BUNDLE_ID = 'org.sarvodayaconnect.sarvodayaConnectMobile'


def required(name):
    value = os.environ.get(name, '')
    if not value:
        raise SystemExit(f'Missing {name}. See docs/testflight-releases.md.')
    return value


def write_base64(path, name):
    try:
        path.write_bytes(base64.b64decode(''.join(required(name).split()), validate=True))
    except binascii.Error:
        raise SystemExit(f'{name} must contain a base64-encoded file.') from None


def prepare_build(directory):
    version = required('VERSION_NAME')
    number = required('BUILD_NUMBER')
    notes = validated_notes(required('RELEASE_NOTES'))
    if not re.fullmatch(r'(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)', version) or len(version) > 30:
        raise SystemExit('Version must be major.minor.patch, e.g. 0.1.1.')
    if not re.fullmatch(r'[1-9][0-9]{0,3}', number):
        raise SystemExit('Build number must be a positive integer of up to four digits.')
    url = required('API_BASE_URL')
    parsed = urlsplit(url)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise SystemExit('API_BASE_URL must be an HTTPS API URL without credentials, query or fragment.')
    pool = required('COGNITO_USER_POOL_ID')
    client = required('COGNITO_CLIENT_ID')
    if not re.fullmatch(r'[a-z]{2}-[a-z]+-[0-9]_[A-Za-z0-9]+', pool):
        raise SystemExit('Invalid Cognito user pool ID.')
    if not re.fullmatch(r'[a-z0-9]+', client):
        raise SystemExit('Invalid public Cognito client ID.')
    config = {
        'API_BASE_URL': url,
        'AUTH_PROVIDER': 'cognito',
        'COGNITO_USER_POOL_ID': pool,
        'COGNITO_CLIENT_ID': client,
        'SC_DEMO_MODE': 'false',
        'SC_SHOW_UNREVIEWED_TRANSLATIONS': required('TRANSLATION_REVIEW'),
        # Issue #161: the same notes as What to Test, shown once in the app.
        **release_defines(version, number, notes),
    }
    if os.environ.get('MAPBOX_TOKEN'):
        config['MAPBOX_TOKEN'] = os.environ['MAPBOX_TOKEN']
    (directory / 'defines.json').write_text(json.dumps(config), encoding='utf-8')
    (directory / 'What to Test.txt').write_text(notes + '\n', encoding='utf-8')


def prepare_signing(directory):
    team = required('APPLE_TEAM_ID')
    if not re.fullmatch(r'[A-Z0-9]{10}', team):
        raise SystemExit('APPLE_TEAM_ID must be the 10-character Apple Developer Team ID.')

    write_base64(directory / 'distribution.p12', 'APPLE_DISTRIBUTION_P12_BASE64')
    profile_path = directory / 'distribution.mobileprovision'
    write_base64(profile_path, 'APPLE_PROVISIONING_PROFILE_BASE64')
    profile = plistlib.loads(subprocess.check_output(['security', 'cms', '-D', '-i', str(profile_path)]))
    entitlements = profile.get('Entitlements', {})
    application_ids = {
        f'{prefix}.{BUNDLE_ID}' for prefix in profile.get('ApplicationIdentifierPrefix', ())
    }
    if (team not in profile.get('TeamIdentifier', ())
            or entitlements.get('com.apple.developer.team-identifier') != team
            or entitlements.get('application-identifier') not in application_ids
            or entitlements.get('get-task-allow') is not False
            or 'ProvisionedDevices' in profile
            or profile.get('ProvisionsAllDevices')):
        raise SystemExit('Use an App Store Connect profile for the configured team and bundle ID.')
    if profile['ExpirationDate'].replace(tzinfo=timezone.utc) <= datetime.now(timezone.utc):
        raise SystemExit('The App Store Connect provisioning profile has expired.')
    uuid = profile['UUID']
    if not re.fullmatch(r'[A-Fa-f0-9-]{36}', uuid):
        raise SystemExit('Unexpected provisioning profile UUID.')

    profile_dir = Path.home() / 'Library/Developer/Xcode/UserData/Provisioning Profiles'
    profile_dir.mkdir(parents=True, exist_ok=True)
    (profile_dir / f'{uuid}.mobileprovision').write_bytes(profile_path.read_bytes())
    (directory / 'profile-uuid').write_text(uuid, encoding='ascii')

    with Path('apps/mobile/ios/Flutter/Release.xcconfig').open('a', encoding='utf-8') as config:
        config.write(
            '\nCODE_SIGN_STYLE = Manual\n'
            f'DEVELOPMENT_TEAM = {team}\n'
            'CODE_SIGN_IDENTITY[sdk=iphoneos*] = Apple Distribution\n'
            f'PROVISIONING_PROFILE_SPECIFIER = {uuid}\n'
        )

    options = {
        'method': 'app-store-connect',
        'signingStyle': 'manual',
        'teamID': team,
        'signingCertificate': 'Apple Distribution',
        'provisioningProfiles': {BUNDLE_ID: uuid},
        'manageAppVersionAndBuildNumber': False,
        'testFlightInternalTestingOnly': True,
    }
    for destination in ('export', 'upload'):
        (directory / f'{destination}.plist').write_bytes(plistlib.dumps({**options, 'destination': destination}))


if __name__ == '__main__':
    os.umask(0o077)
    release_dir = Path(required('RUNNER_TEMP')) / 'sarvodaya-ios-release'
    if sys.argv[1:] == ['build']:
        release_dir.mkdir()
        prepare_build(release_dir)
    elif sys.argv[1:] == ['signing']:
        prepare_signing(release_dir)
    else:
        raise SystemExit('Usage: prepare_release.py {build|signing}')
