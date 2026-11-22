import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Issue #161: the installed release and its notes, embedded at build time by
/// the release workflows (`scripts/release_metadata.py`). The notes are the
/// same text sent to Google Play (and kept as TestFlight's What to Test).
///
/// They travel base64-encoded, so quotes, newlines and any script survive
/// the build tools exactly. Builds without them (local runs, tests) have no
/// release metadata, and the app works as before.
class ReleaseInfo {
  const ReleaseInfo({
    required this.version,
    required this.build,
    required this.notes,
  });

  /// Version name, for example "0.1.2".
  final String version;

  /// Build number (Android versionCode / iOS build).
  final int build;

  /// Plain text, never HTML; line breaks are kept.
  final String notes;

  /// Identifies the installed release: re-running the same build is the same id.
  String get id => '$version+$build';

  static final _version = RegExp(r'^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$');
  static final _build = RegExp(r'^[1-9]\d{0,9}$');
  static final _control = RegExp(
    r'[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]',
  );

  /// Release notes allowed by the workflows (1–500 characters).
  static const maxNoteCharacters = 500;

  /// Null when the build has no release metadata, or it is not valid. Never
  /// throws, so release metadata can never stop the app starting.
  static ReleaseInfo? parse({
    required String version,
    required String build,
    required String notesBase64,
  }) {
    if (!_version.hasMatch(version) || !_build.hasMatch(build)) return null;
    final code = int.tryParse(build);
    if (code == null || code > 2100000000) return null;
    final String notes;
    try {
      notes = utf8.decode(base64.decode(notesBase64)).trim();
    } on FormatException {
      return null;
    }
    if (notes.isEmpty || notes.runes.length > maxNoteCharacters) return null;
    // Plain text: line breaks and tabs, but no other control characters.
    if (_control.hasMatch(notes)) return null;
    return ReleaseInfo(version: version, build: code, notes: notes);
  }

  /// The metadata compiled into this build, if any.
  static ReleaseInfo? fromEnvironment() => parse(
    version: const String.fromEnvironment('SC_RELEASE_VERSION'),
    build: const String.fromEnvironment('SC_RELEASE_BUILD'),
    notesBase64: const String.fromEnvironment('SC_RELEASE_NOTES_B64'),
  );
}

/// The release whose notes were last acknowledged on this phone. It belongs
/// to the phone, not the account: signing out and in does not ask again.
abstract interface class WhatsNewPreference {
  String? acknowledged();
  void acknowledge(String releaseId);
}

/// Forgets on restart: for tests and screens pumped alone.
class MemoryWhatsNewPreference implements WhatsNewPreference {
  MemoryWhatsNewPreference([this._acknowledged]);

  String? _acknowledged;

  @override
  String? acknowledged() => _acknowledged;

  @override
  void acknowledge(String releaseId) => _acknowledged = releaseId;
}

class DeviceWhatsNewPreference implements WhatsNewPreference {
  DeviceWhatsNewPreference(this._preferences);

  static const _key = 'whatsNew.acknowledged';
  final SharedPreferences _preferences;

  @override
  String? acknowledged() => _preferences.getString(_key);

  @override
  void acknowledge(String releaseId) {
    _preferences.setString(_key, releaseId);
  }
}

/// Whether to show What's new for the installed [release] at the next safe
/// point.
///
/// - No (valid) release metadata: never.
/// - Already acknowledged for this release: no.
/// - Nothing acknowledged on a phone that has not been used before: a fresh
///   installation, so it is not an update (the caller records the release
///   as seen; the notes stay under More → What's new).
/// - Anything else is an update, however many versions were skipped: show
///   the installed release's notes once.
bool shouldShowWhatsNew({
  required ReleaseInfo? release,
  required String? acknowledged,
  required bool usedBefore,
}) {
  if (release == null || acknowledged == release.id) return false;
  if (acknowledged == null && !usedBefore) return false;
  return true;
}
