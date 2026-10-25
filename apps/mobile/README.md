# Sarvodaya Connect Mobile

The Flutter mobile application for the Sarvodaya Connect platform.

## Technology

- Flutter
- Dart
- Material Design

## Supported Platforms

- Android
- iOS

Android development and physical-device testing are configured. iOS build verification requires Xcode and will be completed separately.

## Requirements

- Flutter stable SDK
- Android Studio and Android SDK
- Xcode for iOS development
- A connected device or configured emulator

## Setup

From this directory, install dependencies with `flutter pub get`.

Check the development environment with `flutter doctor -v`.

## Quality Checks

Analyze the Dart source code with `flutter analyze`.

Run the automated tests with `flutter test`.

## Running the Application

List available devices with `flutter devices`.

Run the application with `flutter run -d DEVICE_ID`, replacing `DEVICE_ID` with an identifier shown by `flutter devices`.

## Current Status

The Society Officer flow follows the approved Screen Catalogue v3. SC-38 adds the M01-M04 first-run journey:

Splash → Choose Sinhala, Tamil or English → Sign in → Confirm society and role → Home.

The splash and reusable brand mark use the client-approved Sarvodaya Connect logo on the requested white background. Sign-in uses an injected authentication service, with fictional credentials locally and a boundary ready for Amazon Cognito.

The society-profile demonstration flow from [SC-25 Mobile Society Profile Flow](../../docs/mobile-society-profile-flow.md) remains available:

Sign in → Home → Society profile → Executive Council → Replace Treasurer → Documents → Review and submit → Submitted → Tracker → Changes Requested → Correct → Resubmit → Approved.

The officer can also edit the society profile: **Society → Edit Profile** (address, village or town, society phone, society email and GPS location) → **Check profile changes** → **Submit to District**. Edits are saved as a draft and shown as "Draft: …" next to the approved values, which do not change until the District Centre approves the update.

SC-47 adds the Society Officer's audit, document and notification screens:

- **M12 Audit** (Home → **Audit FY 2025/26**, or **Documents → Annual audit checklist**): the required audit steps for the current financial year with their status (Complete, In progress, Not started, Overdue), how late the report is, **Upload audit report**, and last year's approved audit. Uploading the audit report completes the report steps and marks the audit as waiting for District review.
- **M13 Documents** (**Submit** tab): the four Registrar documents, then the document library with each file's type, status, uploader and upload date, filtered by type. Choosing one of the fictional files records it in the library on the phone. A failed upload keeps the chosen type and file and offers **Retry upload**. If the sheet is closed, the file stays under **Not uploaded** with **Retry** and **Remove**.
- **M16 Notifications** (bell on Home, with the unread count): Today and Earlier groups, unread items tinted, bold and marked with a dot (and "Unread" for screen readers), and **Mark all read**. Tapping a notification marks it read and opens its item: the Submit tab, the audit checklist, a submission in Requests or the society profile. Returning or approving a Council update with the demo District Manager actions adds a notification.

SC-39 adds role-aware mobile homes and navigation:

- **M05 / M05i Society Officer Home:** society identity, profile completeness with a completion action, attention items, quick actions and Tamil home/navigation labels.
- **District Manager Home:** assigned-society totals, pending reviews, incomplete profiles, overdue work and district progress. Its navigation exposes Societies, Reviews and Alerts, but not Society Officer submission actions.
- **HQ Administrator Home:** national society totals, verification and Registrar completion indicators, plus Societies, Reports and Alerts. District review actions and Society Officer submission actions are hidden.
- **M17 More:** signed-in identity and role, items waiting to send, language selection, help, notifications where permitted and sign out.
- **M26 states:** role homes and work areas use the shared loading, empty, offline and error states. Existing workflows continue to use success and named locked-during-review states.
- Use **Demo options → Preview role home** to switch between the three fictional roles when reviewing the UI. Production roles will come from Amazon Cognito claims.

- Most demonstration data is held in memory (`lib/src/data/demo_data.dart`, `lib/src/state/demo_store.dart`); emergency response is the exception described below.
- Emergency response (M22–M25) is connected to the local NestJS API. Rapid assessments are saved in a device-local retry queue so they survive app restarts and sync with stable mutation IDs when online. The queued store is not encrypted; use fictional data only until device encryption and production identity are implemented.
- Sign in with **Use demo account** on the sign-in screen. Production authentication will be connected through Amazon Cognito.
- On a submission's tracker page, the **Demo: District Manager actions** buttons (Start review, Return start date, Approve) stand in for the reviewer, whose real actions happen on the web dashboard.
- The document chooser lists demonstration files, including one that is too large and one with a type that is not accepted, to show the upload errors. Uploads go through `DocumentUploadService` (`lib/src/services`); the demo implementation, `DemoDocumentUploadService`, never sends files anywhere and is the boundary to replace when document storage is connected.

### Demonstration states

Open **Demo options** (sliders icon on Home) to show these states during a demonstration. Nothing on the device is changed and no real permission is requested.

| State | How to show it |
| --- | --- |
| Loading | Shown briefly whenever a screen loads (including Audit, Documents and Notifications), and again after changing a demo option |
| Offline | Turn on **Offline**. Screens show the offline state with Try again; sending and uploading keep the draft on the phone |
| General error | Turn on **Loading error**. Screens, including Audit, Documents and Notifications, show "Something went wrong" with Try again |
| Empty tracker | Turn on **No submissions yet**, then open **Requests** |
| Empty documents, audit and notifications | Turn on **New society with no records**, then open **Submit**, **Audit** or **Notifications** |
| Failed upload and retry | Turn on **Next upload fails**, then upload a document. The upload fails once and shows **Retry upload**; close the sheet to see it under **Not uploaded** with **Retry** |
| Validation | Save a form with empty or invalid fields (for example phone `12345` or email `society@`). Inline errors and a summary appear and typed values are kept |
| Location permission denied | Turn on **Location permission denied**, then **Society → Edit Profile → Use my location**. Shows **Open Settings** (explains what would happen on a phone) and **Place Pin Manually** (tap the map or type coordinates) |
| Conflicting update | Start editing the profile (or save a profile draft), then tap **Simulate a newer society record**. The draft is blocked from saving or sending until **Reload Record**, which keeps the officer's edits and takes the newer values for everything else |
| Locked during review | Submit the Council update, then use **Start review** on its tracker page |
| Changes requested | After **Start review**, use **Return start date** |

### Code structure

- `lib/src/models` — Dart versions of the shared API contracts in `packages/api-contracts`; `audit.dart` and `notification.dart` are UI models until audits and notifications are added to the contracts
- `lib/src/auth` — identity-provider boundary and fictional local implementation
- `lib/src/services` — document-upload boundary and its local demo implementation
- `lib/src/screens` — one file per screen
- `lib/src/widgets` — reusable widgets (status chips, cards, loading, empty, error, offline and locked states)
- `lib/src/validation` — form validation rules (names, Sri Lankan phone, email, address, coordinates, Council ages and dates)
- `lib/src/theme` — the village-green theme shared with the dashboard

## Security

Do not commit passwords, API keys, access tokens, client information or local environment files.
