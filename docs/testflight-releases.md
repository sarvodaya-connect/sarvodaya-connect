# Internal iOS releases from GitHub

For signed builds that use the production API and the public store submission process, see [Production launch](production-launch.md).

The **iOS internal release** workflow builds Sarvodaya Connect against the TEST API. It uses the selected commit on `main`, the submitted version and build number, and the organization's Apple Distribution identity. It retains the signed IPA and a `What to Test.txt` file for seven days. Upload is optional, and uploaded builds are limited to internal TestFlight.

## One-time Apple setup

1. In the Apple Developer account, select Sarvodaya's organization. Open **Membership details** and copy the Team ID. In **Certificates, IDs & Profiles → Identifiers**, reuse the explicit iOS App ID for `org.sarvodayaconnect.sarvodayaConnectMobile` or register it once if missing. Confirm this bundle ID with the release owner before registering it. [Register an App ID](https://developer.apple.com/help/account/identifiers/register-an-app-id/)
2. In **App Store Connect → Apps**, open the existing Sarvodaya Connect app or add an iOS app record using the exact registered bundle ID. [Add a new app](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/)
3. Use an existing **Apple Distribution** identity for this team if its private key is available, or have an authorized team member create one. In Xcode account settings or Keychain Access, export the certificate **with its private key** as a password-protected `.p12`. In the developer portal under **Profiles**, download an **App Store Connect** provisioning profile for the same App ID and distribution certificate. Renew these credentials as they expire. [Create an App Store Connect provisioning profile](https://developer.apple.com/help/account/provisioning-profiles/create-an-app-store-provisioning-profile/)
4. For automated uploads, have an Account Holder or Admin create a dedicated **Developer** team key in **App Store Connect → Users and Access → Integrations → App Store Connect API → Team Keys**. Save the Key ID and Issuer ID and download the `.p8` when Apple offers it. A team key can access the team's apps within its role. [App Store Connect API keys](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-api/)
5. In the app's **TestFlight → Internal Testing** tab, create a group for the intended App Store Connect users. Choose automatic distribution under that group if its testers should receive every processed eligible build. [Add internal testers](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/)

## GitHub environment

Open the repository's **Settings → Environments → testflight-internal**. The environment is restricted to the `main` branch. Configure these values as **environment variables**.

| Variable | Value |
| --- | --- |
| `API_BASE_URL` | Existing HTTPS TEST API base ending in `/api/v1` |
| `COGNITO_USER_POOL_ID` | TEST Cognito user pool ID |
| `COGNITO_CLIENT_ID` | TEST public mobile client ID |
| `APPLE_TEAM_ID` | Apple Developer Team ID from Membership details |
| `APP_STORE_CONNECT_KEY_ID` | Key ID shown in App Store Connect, for uploads |
| `APP_STORE_CONNECT_ISSUER_ID` | Team Issuer ID shown in App Store Connect, for uploads |

Set these **environment secrets**. Keep the originals in Sarvodaya-controlled storage.

| Secret | Value |
| --- | --- |
| `APPLE_DISTRIBUTION_P12_BASE64` | Base64 of the Apple Distribution certificate and private key export |
| `APPLE_DISTRIBUTION_P12_PASSWORD` | Password set when exporting the `.p12` |
| `APPLE_PROVISIONING_PROFILE_BASE64` | Base64 of the App Store Connect `.mobileprovision` file |
| `APP_STORE_CONNECT_PRIVATE_KEY` | Entire downloaded `.p8` file for uploads, including header and footer |
| `MAPBOX_TOKEN` | Optional public Mapbox token authorized for this mobile TEST build |

You can set file-backed secrets from a Mac with an authenticated GitHub CLI. Use paths outside the repository.

```sh
base64 -i /path/to/distribution.p12 | gh secret set APPLE_DISTRIBUTION_P12_BASE64 --env testflight-internal
base64 -i /path/to/distribution.mobileprovision | gh secret set APPLE_PROVISIONING_PROFILE_BASE64 --env testflight-internal
gh secret set APP_STORE_CONNECT_PRIVATE_KEY --env testflight-internal < /path/to/AuthKey.p8
gh secret set APPLE_DISTRIBUTION_P12_PASSWORD --env testflight-internal
```

## Release an update

1. Merge the app changes into `main` and confirm that any API or database changes the build needs have reached TEST.
2. Open **Actions → iOS internal release → Run workflow** on `main`. Enter a version such as `0.1.0`, a build number higher than the previous iOS uploads, and short tester notes. Version and build number are independent of Android. Start with **Publish** off for the first signing check.
3. Download the run's signed IPA if needed. To deliver to Apple, run with **Publish** on. If Apple has already accepted an upload with this version and build number, use a new build number for the next upload.
4. After Apple processes the build, check **TestFlight** for export compliance questions or provisioning errors. Copy the run's `What to Test.txt` into the build's TestFlight details and assign the build to your internal group if automatic distribution is off. Install through TestFlight and verify sign-in and the changed workflows on an iPhone.

Public App Store updates use a separate release build with Sarvodaya's approved production API and Cognito settings, followed by App Review from the app record. This TEST workflow does not submit for App Review. [Submit an app](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app)
