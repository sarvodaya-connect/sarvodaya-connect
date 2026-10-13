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

The Society Officer demonstration flow from [SC-25 Mobile Society Profile Flow](../../docs/mobile-society-profile-flow.md) is implemented (SC-26), following Screen Catalogue v2:

Sign in → Home → Society profile → Executive Council → Replace Treasurer → Documents → Review and submit → Submitted → Tracker → Changes Requested → Correct → Resubmit → Approved.

- All data is fictional and held in memory (`lib/src/data/demo_data.dart`, `lib/src/state/demo_store.dart`). Nothing is written to a backend, and closing the app resets the demo.
- Sign in with **Use demo account** on the sign-in screen. Production sign-in will use WSO2 Identity Server in a later task.
- On a submission's tracker page, the **Demo: District Manager actions** buttons (Start review, Return start date, Approve) stand in for the reviewer, whose real actions happen on the web dashboard.
- The **Demo options** button (sliders icon on Home) switches on offline mode, a loading error or an empty tracker to show those states.
- The document chooser lists demonstration files, including one that is too large and one with a type that is not accepted, to show the upload errors.

### Code structure

- `lib/src/models` — Dart versions of the shared API contracts in `packages/api-contracts`
- `lib/src/screens` — one file per screen
- `lib/src/widgets` — reusable widgets (status chips, cards, loading, empty, error, offline and locked states)
- `lib/src/validation` — form validation rules
- `lib/src/theme` — the village-green theme shared with the dashboard

## Security

Do not commit passwords, API keys, access tokens, client information or local environment files.
