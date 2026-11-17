import 'package:shared_preferences/shared_preferences.dart';

import 'release_info.dart';

/// Issue #161: which release this phone last acknowledged in What's New.
/// Kept on the device, not per account, so signing out and back in does not
/// show the notes again.
abstract interface class ReleaseAcknowledgement {
  /// The last acknowledged [ReleaseInfo.id], if any.
  String? load();
  void save(String releaseId);

  /// Whether this app had been used on the phone before this launch. With
  /// nothing acknowledged yet, it tells an update from a fresh installation.
  bool get usedBefore;
}

/// Forgets on restart: for tests and demonstrations.
class MemoryReleaseAcknowledgement implements ReleaseAcknowledgement {
  MemoryReleaseAcknowledgement({this.acknowledged, this.usedBefore = false});

  /// The last acknowledged release id, as a test can inspect it.
  String? acknowledged;

  @override
  final bool usedBefore;

  @override
  String? load() => acknowledged;

  @override
  void save(String releaseId) => acknowledged = releaseId;
}

class DeviceReleaseAcknowledgement implements ReleaseAcknowledgement {
  DeviceReleaseAcknowledgement(this._preferences)
    // Anything saved earlier (the chosen language, or an earlier
    // acknowledgement) means the app has been used here before.
    : usedBefore = _preferences.getKeys().isNotEmpty;

  static const key = 'whatsNew.acknowledgedRelease';
  final SharedPreferences _preferences;

  @override
  final bool usedBefore;

  static Future<DeviceReleaseAcknowledgement?> open() async {
    try {
      return DeviceReleaseAcknowledgement(
        await SharedPreferences.getInstance(),
      );
    } on Object {
      // Storage that cannot be read must not stop the app from starting.
      return null;
    }
  }

  @override
  String? load() => _preferences.getString(key);

  @override
  void save(String releaseId) {
    // Fire and forget; a failed write only means the notes may show again.
    _preferences.setString(key, releaseId).ignore();
  }
}

/// Decides once per launch whether to show What's New, and records the
/// acknowledgement.
class WhatsNew {
  WhatsNew({required this.release, ReleaseAcknowledgement? acknowledgement})
    : _acknowledgement = acknowledgement {
    final release = this.release;
    final store = acknowledgement;
    if (release == null || store == null) return;
    final acknowledged = store.load();
    if (acknowledged == release.id) return;
    if (acknowledged == null && !store.usedBefore) {
      // A fresh installation is not an update: nothing to announce, and
      // onboarding is not blocked. The notes stay in More → What's New.
      store.save(release.id);
      return;
    }
    // An update, from the release before or from several releases back:
    // only the installed release's notes are shown.
    _pending = true;
  }

  /// No embedded release: nothing is shown after startup.
  WhatsNew.none() : release = null, _acknowledgement = null;

  /// The installed release, or null when this build has no valid notes.
  final ReleaseInfo? release;
  final ReleaseAcknowledgement? _acknowledgement;
  bool _pending = false;

  /// Whether the notes should be shown at the next safe point.
  bool get pending => _pending;

  /// Set while the screen is open, so it is never pushed twice.
  bool showing = false;

  /// Records that the installed release's notes were seen.
  void acknowledge() {
    final release = this.release;
    showing = false;
    if (release == null || !_pending) return;
    _pending = false;
    _acknowledgement?.save(release.id);
  }

  static Future<WhatsNew> load() async {
    final release = await loadReleaseInfo();
    if (release == null) return WhatsNew.none();
    return WhatsNew(
      release: release,
      acknowledgement: await DeviceReleaseAcknowledgement.open(),
    );
  }
}
