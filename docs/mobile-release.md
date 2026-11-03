# Phone app: internal testing release (Google Play and TestFlight)

How to build the Flutter app (`apps/mobile`) for **internal testing** only: Google Play internal testing and Apple TestFlight. Nothing in this repository uploads, submits or publishes the app, and no signing keys, certificates, profiles or store credentials are kept here. Checked for V5 PR 10 on 3 Nov 2026.

## Build settings

The app reads two compile-time values (`--dart-define`):

| Value | Kind | Release default | Purpose |
|---|---|---|---|
| `API_BASE_URL` | Config | **none** | The API, e.g. `https://<api-id>.execute-api.ap-southeast-1.amazonaws.com/api/v1`. A release build without it, or with an address that is not `https://`, opens a "This app is not set up yet" screen and never signs in. |
| `SC_DEMO_MODE` | Config | `false` | Fictional demonstration data and the demo account. On by default only in debug builds and tests. Never set it to `true` for a store build. |
| `AUTH_PROVIDER` | Config | `cognito` | `cognito` signs in with the Sarvodaya user pool. `local` (the API's development passwords) is the debug default and is refused in release builds. |
| `COGNITO_USER_POOL_ID` | Config | **none** | e.g. `ap-southeast-1_AbC123xyZ`. Without it, or `COGNITO_CLIENT_ID`, a release build opens "This app is not set up yet". |
| `COGNITO_CLIENT_ID` | Config | **none** | The phone's public app client (no client secret). |
| `COGNITO_REGION` | Config | from the pool id | Optional check. |

There are no secrets in the app: users sign in with their own account, and the app holds that sign-in's Cognito tokens in memory only. See `cognito-setup.md`.

## What the app collects (for the store privacy forms)

Fill in Google Play's **Data safety** form and App Store Connect's **App Privacy** questionnaire from this list. The answers are the release owner's to give; this is what the code does:

- **Account:** username and password at sign-in (sent to Amazon Cognito over HTTPS, not stored on the phone); the tokens are kept in memory only.
- **Society records** the user is allowed to edit: society details, Exco members' names, positions, phone numbers and, for authorised roles, NICs (sent to the API over HTTPS; NICs are stored encrypted by the API and shown one record at a time to authorised viewers).
- **Yearly total profit and total expenses**, activities, disaster assessments (counts only, no personal details) and documents or photos the user chooses to upload (PDF, JPG or PNG, up to 10 MB). Files go straight to private storage through short-lived links.
- **Not collected:** location (the map uses society coordinates typed into the record), contacts, camera or microphone access (files come from the system picker), advertising identifiers, analytics or crash reporting SDKs, and no tracking across apps.
- Data is linked to the user's account and used only to run the service. It is not sold or shared with third parties. Deletion and retention terms, the privacy policy URL and the contact address must come from Sarvodaya.

## Permissions

- **Android:** `INTERNET` only. Documents are chosen with the system file picker, which needs no storage permission. Cleartext HTTP is off (default for API 28+).
- **iOS:** no camera, photo library, location or contacts usage strings, because the app does not request them. `NSAllowsLocalNetworking` and `NSLocalNetworkUsageDescription` let a **development** build reach a test server on the developer's own network; release builds use HTTPS and never show that prompt. Remove both before the first App Store review if Sarvodaya prefers.

## Identifiers and versions

| | Android | iOS |
|---|---|---|
| App name | Sarvodaya Connect | Sarvodaya Connect |
| Id | `org.sarvodayaconnect.sarvodaya_connect_mobile` | `org.sarvodayaconnect.sarvodayaConnectMobile` |
| Minimum OS | Android 7.0 (API 24) | iOS 15.0 |
| Target | API 36 (Google Play requires API 36 for new apps and updates from 31 Aug 2026) | Built with Xcode 26 or later and the iOS 26 SDK (required for App Store Connect uploads since 28 Apr 2026) |
| Version | `pubspec.yaml` `version: 0.1.0+1` (name + build number; raise the build number for every upload) | same |

**To Confirm before the first upload:** the ids above are permanent once an app is created in either console. Sarvodaya should confirm them (and that it controls the `sarvodayaconnect.org` name they imply), or choose new ones first.

## Build commands

Android App Bundle for Play internal testing:

```
cd apps/mobile
flutter test
flutter build appbundle --release --dart-define=API_BASE_URL=https://<api>/api/v1 \
  --dart-define=COGNITO_USER_POOL_ID=<pool id> --dart-define=COGNITO_CLIENT_ID=<phone app client id>
```

Signing: create the upload keystore outside the repository and an `apps/mobile/android/key.properties` file (git-ignored) with `storeFile`, `storePassword`, `keyAlias` and `keyPassword`. Without it the bundle is built **unsigned** (it is never signed with the debug key) and Play will not accept it. Use Play App Signing; keep the upload key in Sarvodaya's password manager.

iOS for TestFlight (on a Mac with Xcode 26 or later):

```
cd apps/mobile
flutter build ipa --release --dart-define=API_BASE_URL=https://<api>/api/v1 \
  --dart-define=COGNITO_USER_POOL_ID=<pool id> --dart-define=COGNITO_CLIENT_ID=<phone app client id>
```

Signing uses Xcode automatic signing with Sarvodaya's Apple Developer team: set the team on the Runner target (or pass `--export-options-plist`). Then upload `build/ios/ipa/*.ipa` with Xcode Organizer or Transporter, and add internal testers in App Store Connect → TestFlight. Before the first upload, run **Product → Archive → Generate Privacy Report** in Xcode to confirm the Flutter engine's and plugins' privacy manifests are included.

## Results on the PR 10 machine (3 Nov 2026)

- `flutter analyze`: no issues. `flutter test`: 170 tests passed.
- `flutter build appbundle --release`: **built** `app-release.aab` (56.5 MB), **unsigned** (no upload key on this machine; `jarsigner -verify` reports "jar is unsigned").
- `flutter build ios --release --no-codesign`: the Flutter command stopped with "Exited with status code 255" in Xcode 27.1's "Prepare Flutter Framework Script" step (the same failure seen in PR 8, also outside the sandbox). Building the same Release configuration directly with `xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner -configuration Release -sdk iphoneos CODE_SIGNING_ALLOWED=NO build` **succeeded**: an unsigned `Runner.app` (19 MB), display name "Sarvodaya Connect", minimum iOS 15.0. A signed archive and `flutter build ipa` were not possible without a team and certificates. CocoaPods is not installed on this machine; the plugins build through Swift Package Manager.

## Items only the owner can provide

1. Google Play Console account, the app entry, Play App Signing, the upload keystore and `key.properties`, the internal testing track and tester list.
2. Apple Developer Program team, the App ID for the bundle id, signing certificates and provisioning (or automatic signing), the App Store Connect app record and TestFlight internal testers.
3. Confirmation of both app ids (permanent once used).
4. Privacy policy URL, support contact, data deletion terms, and the answers to the Data safety and App Privacy forms.
5. The production `API_BASE_URL` (HTTPS) once the API is deployed.
6. A launcher icon that reads well at small sizes: the current icon is the full "sarvodaya connect" wordmark on white, which becomes small at home-screen size (To Confirm with Sarvodaya's brand owner).
7. The Cognito user pool id and the phone's app client id (see `cognito-setup.md`). Release builds sign in with Cognito and refuse the API's development passwords. Sign-in against a real user pool has not been tested yet; see the checklist at the end of `cognito-setup.md`. Do not work around a missing pool by running a hosted API in development mode: that mode also accepts the demonstration user header and is for local machines only.
