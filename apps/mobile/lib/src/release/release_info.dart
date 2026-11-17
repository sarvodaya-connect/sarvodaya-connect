import 'dart:convert';

import 'package:flutter/services.dart';

/// Issue #161: the release installed on this phone and its notes.
///
/// The Android internal release workflow writes [releaseNotesAsset] before
/// Flutter compiles the bundle (`scripts/play/release_notes.py`), with the
/// same notes it sends to Google Play. Local and iOS builds keep the
/// development file, which holds no release.
const releaseNotesAsset = 'assets/release/release_notes.json';

/// The same limits as the release workflow and Google Play.
const maxReleaseNotes = 500;
const maxVersionCode = 2100000000;
final _versionName = RegExp(r'^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$');

class ReleaseInfo {
  const ReleaseInfo({
    required this.versionName,
    required this.versionCode,
    required this.notes,
    this.language = 'en',
  });

  final String versionName;
  final int versionCode;

  /// Plain text, exactly as entered in the release workflow.
  final String notes;

  /// The language the notes are written in. The workflow takes English only.
  final String language;

  /// Identifies the installed release: re-running the same build keeps it.
  String get id => '$versionName+$versionCode';

  /// The notes as lines for display. A line starting with "-", "*" or "•"
  /// is a list item; others are paragraphs. Nothing is interpreted as markup.
  List<({String text, bool bullet})> get lines => [
    for (final raw in notes.split('\n'))
      if (raw.trim().isNotEmpty)
        switch (RegExp(r'^\s*[-*•]\s+').firstMatch(raw)) {
          final marker? => (
            text: raw.substring(marker.end).trim(),
            bullet: true,
          ),
          null => (text: raw.trim(), bullet: false),
        },
  ];

  /// Null for anything the workflow would not have written: a missing
  /// version, a bad code, empty or over-long notes, or another schema.
  static ReleaseInfo? tryParse(Object? json) {
    if (json is! Map || json['schemaVersion'] != 1) return null;
    final name = json['versionName'];
    final code = json['versionCode'];
    final notes = json['notes'];
    final language = json['language'] ?? 'en';
    if (name is! String || name.length > 30 || !_versionName.hasMatch(name)) {
      return null;
    }
    if (code is! int || code < 1 || code > maxVersionCode) return null;
    if (notes is! String || language is! String) return null;
    // Counted in characters, as the workflow (Python) and Play count them.
    final length = notes.runes.length;
    if (notes.trim() != notes || length == 0 || length > maxReleaseNotes) {
      return null;
    }
    return ReleaseInfo(
      versionName: name,
      versionCode: code,
      notes: notes,
      language: language,
    );
  }
}

/// Reads the embedded release. Never throws: missing or invalid metadata
/// means "no release notes", and the app starts as usual.
Future<ReleaseInfo?> loadReleaseInfo([AssetBundle? bundle]) async {
  try {
    final text = await (bundle ?? rootBundle).loadString(releaseNotesAsset);
    return ReleaseInfo.tryParse(jsonDecode(text));
  } on Object {
    return null;
  }
}
