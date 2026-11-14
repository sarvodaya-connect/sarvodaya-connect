"""Publish a signed AAB to this app's internal track using a short-lived token.

Uses only Python's standard library and Google's official Android Publisher API.
No service-account key JSON, third-party uploader, automatic retries or production track.
"""
import hashlib
import json
import os
from pathlib import Path
import urllib.error
import urllib.request

PACKAGE = 'org.sarvodayaconnect.sarvodaya_connect_mobile'
BASE = f'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{PACKAGE}'
UPLOAD = f'https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/{PACKAGE}'


def request(token, method, url, body=None, media=False):
    headers = {'Authorization': f'Bearer {token}'}
    if body is not None:
        if media:
            headers['Content-Type'] = 'application/octet-stream'
        else:
            headers['Content-Type'] = 'application/json; charset=utf-8'
            body = json.dumps(body).encode()
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    # Do not follow a redirect with the Authorization header or retry a mutation.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None
    try:
        with urllib.request.build_opener(NoRedirect).open(req, timeout=300) as response:
            data = response.read()
            return json.loads(data) if data else {}
    except urllib.error.HTTPError as error:
        try:
            message = json.loads(error.read()).get('error', {}).get('message', 'Request rejected')
        except (ValueError, AttributeError):
            message = 'Request rejected'
        message = str(message).replace(token, '[REDACTED]')
        raise RuntimeError(f'Google Play HTTP {error.code}: {message}') from None


def main():
    if os.environ.get('GITHUB_REF') != 'refs/heads/main' or os.environ.get('GITHUB_REPOSITORY') != 'sarvodaya-connect/sarvodaya-connect':
        raise SystemExit('Publishing is restricted to the original repository on main.')
    token = os.environ.get('GOOGLE_PLAY_ACCESS_TOKEN', '')
    if not token:
        raise SystemExit('Missing short-lived Google Play access token.')
    version = os.environ['VERSION_NAME']
    code = int(os.environ['VERSION_CODE'])
    notes = os.environ['RELEASE_NOTES'].strip()
    bundle = Path('apps/mobile/build/app/outputs/bundle/release/app-release.aab')
    if not bundle.is_file() or not 0 < len(notes) <= 500:
        raise SystemExit('Missing bundle or invalid release notes.')
    edit_id = None
    committed = False
    commit_started = False
    try:
        edit_id = request(token, 'POST', f'{BASE}/edits', {})['id']
        edit = f'{BASE}/edits/{edit_id}'
        # Best-effort early guard; Play also enforces historical version-code uniqueness.
        seen = []
        for resource, key in [('bundles', 'bundles'), ('apks', 'apks')]:
            records = request(token, 'GET', f'{edit}/{resource}').get(key, [])
            seen.extend(int(item['versionCode']) for item in records)
        tracks = request(token, 'GET', f'{edit}/tracks').get('tracks', [])
        for track in tracks:
            for release in track.get('releases', []):
                seen.extend(int(value) for value in release.get('versionCodes', []))
        if seen and code <= max(seen):
            raise RuntimeError(f'Choose a version code above {max(seen)}. Version names can repeat; codes cannot.')
        uploaded = request(token, 'POST', f'{UPLOAD}/edits/{edit_id}/bundles?uploadType=media', bundle.read_bytes(), media=True)
        if int(uploaded['versionCode']) != code:
            raise RuntimeError('Uploaded version code differs from the requested release; refusing to publish.')
        # Upload hash is returned by Play; compare when provided.
        digest = hashlib.sha256(bundle.read_bytes()).hexdigest()
        if uploaded.get('sha256') and uploaded['sha256'].lower() != digest:
            raise RuntimeError('Uploaded bundle checksum did not match.')
        request(token, 'PUT', f'{edit}/tracks/internal', {
            'track': 'internal',
            'releases': [{
                'name': f'{version} ({code})',
                'versionCodes': [str(code)],
                'status': 'completed',
                'releaseNotes': [{'language': 'en-GB', 'text': notes}],
            }],
        })
        request(token, 'POST', f'{edit}:validate')
        # Do not cancel an unrelated Play review. An in-review conflict must be resolved by the owner.
        commit_started = True
        request(token, 'POST', f'{edit}:commit?changesInReviewBehavior=ERROR_IF_IN_REVIEW')
        committed = True
        summary = f'Published {version} ({code}) to **internal testing**.\n\nSource: `{os.environ["GITHUB_SHA"]}`\n\nBundle SHA-256: `{digest}`\n'
        print(f'Published {version} ({code}) to internal testing.')
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as stream:
            stream.write(summary)
    finally:
        if edit_id and not committed:
            if commit_started:
                print('Commit was attempted. Check Play Console before retrying; the outcome may be uncertain. No automatic retry is made.')
            else:
                try:
                    request(token, 'DELETE', f'{BASE}/edits/{edit_id}')
                except Exception:
                    print('Could not discard the uncommitted edit; inspect Play Console before retrying.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        raise SystemExit(f'Publishing stopped: {error}') from None
