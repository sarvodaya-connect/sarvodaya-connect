# Google Play internal releases from GitHub

Status: workflow prepared; Google Cloud trust, Play access and GitHub environment
settings must be configured before the first run. A merged workflow does not itself
connect the accounts or publish a release.

## What the release owner does each time

1. Merge reviewed mobile changes into `main`. Wait for normal CI; make sure the TEST
   API and any database migrations required by that app have already been deployed.
2. In **Actions -> Android internal release -> Run workflow**, select **main**.
3. Enter a version name such as `0.1.1`, a new integer version code such as `2`
   (only if higher than every previous Play upload), and 1-500 characters of notes.
4. Leave Publish off for a signed build artifact only, or turn it on to distribute
   through the existing **internal testing** track. Enable translation review only
   when internal testers should see unreviewed Sinhala/Tamil.
5. Approve the `play-internal` environment deployment if a reviewer is configured.
6. Check the workflow summary and Play Console. Testers receive the update through
   Google Play after processing, according to their Play update settings. A new
   release does not force an immediate update on every phone.

There is no push-to-main publication, production-track option, Apple/TestFlight
upload, or API/database deployment. The source commit, requested version and bundle
checksum are recorded. Versions are passed to Flutter at build time; this does not
change `pubspec.yaml` or create a GitHub tag/release automatically.

## Existing app and key

- Package: `org.sarvodayaconnect.sarvodaya_connect_mobile` (keep unchanged).
- Existing Play App Signing enrollment and upload key must be reused.
- First owner-confirmed upload was `0.1.0` / code `1`. Check Play Console for the
  latest uploaded code, including other tracks/drafts, before choosing the next one.
- Do not regenerate the upload key. The workflow verifies its certificate fingerprint.
- Keep the original keystore and password in Sarvodaya-controlled backup storage.
  GitHub Secrets are not the backup; they cannot be read back in plaintext via GitHub.

## One-time Google Cloud setup (owner, in Google Cloud Shell)

Project already created by the owner:

- ID: `sarvodaya-connect-releases`
- Number: `684695981135`
- Proposed service account: `github-play-release@sarvodaya-connect-releases.iam.gserviceaccount.com`

Check what already exists before creating resources. No billing trial or runtime
hosting needs to be provisioned merely to host the application in this project;
this project is for publishing identity/API access, not a replacement for AWS.

Enable the APIs:

```bash
gcloud services enable androidpublisher.googleapis.com iam.googleapis.com \
  iamcredentials.googleapis.com sts.googleapis.com \
  --project=sarvodaya-connect-releases
```

Create the service account only if missing (no Owner/Editor project role):

```bash
gcloud iam service-accounts create github-play-release \
  --display-name='GitHub Play Release' \
  --project=sarvodaya-connect-releases
```

Use Workload Identity Federation; do not generate a service-account JSON key.
GitHub numeric identities checked on 13 Nov 2026:

- Repository ID: `1400137463`
- Organization ID: `336569133`

Create a dedicated pool/provider only if missing:

```bash
gcloud iam workload-identity-pools create github-play \
  --project=sarvodaya-connect-releases --location=global \
  --display-name='GitHub Play Releases'

gcloud iam workload-identity-pools providers create-oidc github-main \
  --project=sarvodaya-connect-releases --location=global \
  --workload-identity-pool=github-play \
  --issuer-uri='https://token.actions.githubusercontent.com' \
  --attribute-mapping='google.subject=assertion.sub,attribute.repository_id=assertion.repository_id' \
  --attribute-condition="assertion.repository_owner_id == '336569133' && assertion.repository_id == '1400137463' && assertion.ref == 'refs/heads/main' && assertion.sub == 'repo:sarvodaya-connect/sarvodaya-connect:environment:play-internal' && assertion.workflow_ref == 'sarvodaya-connect/sarvodaya-connect/.github/workflows/play-internal-release.yml@refs/heads/main'"

gcloud iam service-accounts add-iam-policy-binding \
  github-play-release@sarvodaya-connect-releases.iam.gserviceaccount.com \
  --project=sarvodaya-connect-releases \
  --role=roles/iam.workloadIdentityUser \
  --member='principalSet://iam.googleapis.com/projects/684695981135/locations/global/workloadIdentityPools/github-play/attribute.repository_id/1400137463'
```

This restricts token exchange to this repository, owner, main branch, workflow path
and environment. Do not weaken it to all GitHub repositories if authentication
fails. A renamed repository/workflow requires an intentional trust-policy update.

Provider resource name for GitHub:

`projects/684695981135/locations/global/workloadIdentityPools/github-play/providers/github-main`

## One-time Play Console permissions

In **Play Console -> Users and permissions**, invite the service-account email.
Grant access to **this app only**, with the permissions needed to view app information
and release apps to testing tracks. Do not grant production release, administrator,
financial or subscription/order-management rights. This workflow does not edit testers
or store listings. Keep the existing internal testers list and opt-in link.

Google no longer requires linking the Play developer account to a Cloud project in
an old API-access screen. Enabling the API and granting Play permissions to the
service account are still required. Verify the exact available permission labels
in the current Console.

## One-time GitHub environment configuration

Create **Settings -> Environments -> play-internal**:

- Allow deployment from **main only** (selected branch policy).
- Add required reviewers where the repository's GitHub plan supports them. Keep
  existing branch protection and human approval for merges.
- Limit which maintainers can trigger publishing; review workflow changes carefully.

Environment **secrets** (values never committed or printed):

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Base64 of the existing upload `.jks`; base64 is not encryption |
| `ANDROID_STORE_PASSWORD` | Existing keystore password |
| `ANDROID_KEY_PASSWORD` | Existing upload-key password |

Environment **variables**:

| Variable | Value |
| --- | --- |
| `ANDROID_KEY_ALIAS` | `upload` |
| `ANDROID_UPLOAD_CERT_SHA256` | SHA-256 fingerprint of the existing Play upload certificate |
| `API_BASE_URL` | Existing HTTPS TEST API base ending in `/api/v1` |
| `COGNITO_USER_POOL_ID` | Existing TEST user pool |
| `COGNITO_CLIENT_ID` | Existing public mobile client ID, without a client secret |
| `MAPBOX_TOKEN` | Optional public Mapbox token; omit if not configured |
| `GOOGLE_WIF_PROVIDER` | Provider resource name above |
| `GOOGLE_PLAY_SERVICE_ACCOUNT` | Service-account email above |

The owner-confirmed existing upload certificate fingerprint is:

`99:EF:06:C8:8D:1D:4B:4F:95:5F:D7:0F:39:E7:87:F1:F5:CD:A1:C2:E1:0F:A6:10:6B:61:26:6C:80:60:8A:4E`

Compare with Play Console's **upload certificate**, not Google's app-signing
certificate, before setting it. Changes to the key require a deliberate Play
upload-key reset, not changing this variable to make a failed build pass.

A trusted release administrator can use `gh secret set --env play-internal --body`
with input supplied directly from a local process/file, without placing values in
shell arguments, committing them, or pasting them into chat. Restrict local signing
files and preserve backups. Never put the keystore in an Actions artifact.

## Workflow safeguards and limitations

- Manual dispatch on main only; exact selected SHA is built. New commits landing
  during a build do not change its source. Serialized runs do not cancel a release
  mid-upload, although GitHub may replace a pending run with a newer pending run.
- Pinned Action commits, Flutter version matching current CI, Java 17, enforced
  lockfile, analyze and mobile tests before signing/upload.
- Temporary keystore/properties are removed even when a later step fails. Only the
  signed AAB is retained as a seven-day artifact. Google access tokens are minted
  after the build with the Android Publisher scope and a 30-minute lifetime.
- The upload script checks known uploaded/active version codes, checks returned
  bundle code/checksum, updates only `internal`, validates the edit and commits.
  Google Play remains authoritative for all historical version-code restrictions.
- Commit uses `ERROR_IF_IN_REVIEW` so it does not cancel an unrelated ongoing
  review. If Play requires different review handling, resolve it in Console;
  the workflow does not silently retry or bypass review requirements.
- Play edits can include pending changes made by other tools/Console users. Avoid
  editing listings/releases in Console while this workflow runs, and inspect
  pending changes before the first release. This workflow changes only the internal
  track, but Play's edit/commit lifecycle still applies at app level.
- Mutations are not automatically retried. A lost response after upload/commit can
  leave an uncertain result or consume a version code. Inspect Console before
  rerunning; use a new version code where required.
- Existing testers must have opted in with the correct Google account. Store
  processing, policy checks and distribution delay remain outside GitHub's control.
- New app features requiring backend migrations are not fixed by releasing the
  mobile app. Check API compatibility before ticking Publish.
- This setup has not been exercised against Google Play until the one-time identity,
  permissions and secrets are configured. A workflow PR alone is not a completed
  account connection or a successful published update.

## Official references

- [Google Play Developer API setup](https://developers.google.com/android-publisher/getting_started)
- [Google WIF for deployment pipelines](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)
- [Google GitHub authentication action](https://github.com/google-github-actions/auth)
- [Bundle upload](https://developers.google.com/android-publisher/api-ref/rest/v3/edits.bundles/upload)
- [Track releases](https://developers.google.com/android-publisher/api-ref/rest/v3/edits.tracks)
- [Edit commit and review behaviour](https://developers.google.com/android-publisher/api-ref/rest/v3/edits/commit)
