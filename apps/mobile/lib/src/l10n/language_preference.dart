import 'package:shared_preferences/shared_preferences.dart';

import '../models/app_language.dart';

/// Keeps the language on this device, before and after sign-in. Sign-out and
/// restarting the app leave it in place.
abstract interface class LanguagePreference {
  AppLanguage? load();
  void save(AppLanguage language);
}

/// Forgets on restart: for tests and screens pumped alone.
class MemoryLanguagePreference implements LanguagePreference {
  MemoryLanguagePreference([this._language]);

  AppLanguage? _language;

  @override
  AppLanguage? load() => _language;

  @override
  void save(AppLanguage language) => _language = language;
}

class DeviceLanguagePreference implements LanguagePreference {
  DeviceLanguagePreference(this._preferences);

  static const _key = 'language';
  final SharedPreferences _preferences;

  static Future<DeviceLanguagePreference> open() async =>
      DeviceLanguagePreference(await SharedPreferences.getInstance());

  @override
  AppLanguage? load() {
    final saved = _preferences.getString(_key);
    for (final language in AppLanguage.values) {
      if (language.code == saved) return language;
    }
    return null;
  }

  @override
  void save(AppLanguage language) {
    _preferences.setString(_key, language.code);
  }
}
