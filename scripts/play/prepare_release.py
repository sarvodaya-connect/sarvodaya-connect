"""Validate release inputs and materialize ephemeral signing/build files in CI."""
import base64
import json
import os
import re
from pathlib import Path
from urllib.parse import urlparse


def required(name):
    value = os.environ.get(name, '')
    if not value:
        raise SystemExit(f'Missing {name}; see docs/google-play-releases.md')
    return value


def properties_escape(value):
    # java.util.Properties uses ISO-8859-1 and backslash escapes.
    result = ''
    for char in value:
        if char in '\\:=#! ':
            result += '\\' + char
        elif char in '\n\r\t':
            result += {'\n': '\\n', '\r': '\\r', '\t': '\\t'}[char]
        elif ord(char) > 126:
            for offset in range(0, len(char.encode('utf-16-be')), 2):
                result += '\\u' + char.encode('utf-16-be')[offset:offset + 2].hex()
        else:
            result += char
    return result


def main():
    if required('GITHUB_REF') != 'refs/heads/main':
        raise SystemExit('Releases must run from main.')
    if required('GITHUB_REPOSITORY') != 'sarvodaya-connect/sarvodaya-connect':
        raise SystemExit('This workflow is restricted to the Sarvodaya repository.')
    version = required('VERSION_NAME')
    code = required('VERSION_CODE')
    if not re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', version) or len(version) > 30:
        raise SystemExit('Version name must be major.minor.patch, e.g. 0.1.1.')
    if not re.fullmatch(r'[1-9]\d{0,9}', code) or int(code) > 2100000000:
        raise SystemExit('Version code must be an integer from 1 to 2100000000.')
    notes = required('RELEASE_NOTES').strip()
    if not notes or len(notes) > 500:
        raise SystemExit('Release notes must contain 1-500 characters.')
    url = required('API_BASE_URL')
    parsed = urlparse(url)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
        raise SystemExit('API_BASE_URL must be an HTTPS API URL without credentials.')
    pool = required('COGNITO_USER_POOL_ID')
    client = required('COGNITO_CLIENT_ID')
    if not re.fullmatch(r'[a-z]{2}-[a-z]+-\d_[A-Za-z0-9]+', pool):
        raise SystemExit('Invalid Cognito user pool ID.')
    if not re.fullmatch(r'[a-z0-9]+', client):
        raise SystemExit('Invalid public Cognito client ID.')
    if os.environ.get('PUBLISH') == 'true':
        required('GOOGLE_WIF_PROVIDER')
        required('GOOGLE_PLAY_SERVICE_ACCOUNT')
    temp = Path(required('RUNNER_TEMP'))
    keystore = temp / 'sarvodaya-upload.jks'
    key_properties = Path('apps/mobile/android/key.properties')
    build_config = temp / 'sarvodaya-release-defines.json'
    for path in (keystore, key_properties, build_config):
        if path.exists():
            raise SystemExit(f'Refusing to overwrite existing release material: {path.name}')
    data = base64.b64decode(required('ANDROID_KEYSTORE_BASE64'), validate=True)
    if len(data) < 100:
        raise SystemExit('Upload keystore is unexpectedly small.')
    with keystore.open('xb') as stream:
        stream.write(data)
    keystore.chmod(0o600)
    props = {
        'storeFile': str(keystore),
        'storePassword': required('ANDROID_STORE_PASSWORD'),
        'keyPassword': required('ANDROID_KEY_PASSWORD'),
        'keyAlias': os.environ.get('ANDROID_KEY_ALIAS') or 'upload',
    }
    with key_properties.open('x', encoding='ascii') as stream:
        stream.write('\n'.join(f'{key}={properties_escape(value)}' for key, value in props.items()) + '\n')
    key_properties.chmod(0o600)
    config = {
        'API_BASE_URL': url,
        'AUTH_PROVIDER': 'cognito',
        'COGNITO_USER_POOL_ID': pool,
        'COGNITO_CLIENT_ID': client,
        'SC_DEMO_MODE': 'false',
        'SC_SHOW_UNREVIEWED_TRANSLATIONS': os.environ.get('TRANSLATION_REVIEW', 'false'),
    }
    if os.environ.get('MAPBOX_TOKEN'):
        config['MAPBOX_TOKEN'] = os.environ['MAPBOX_TOKEN']
    with build_config.open('x') as stream:
        json.dump(config, stream)
    build_config.chmod(0o600)
    print('Release inputs validated; ephemeral signing files prepared (values withheld).')


if __name__ == '__main__':
    main()
