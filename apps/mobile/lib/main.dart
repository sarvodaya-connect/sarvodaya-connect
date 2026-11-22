import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'src/app.dart';
import 'src/l10n/language_preference.dart';
import 'src/release/release_notes.dart';
import 'src/state/demo_store.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final preferences = await SharedPreferences.getInstance();
  final store = DemoStore(
    languagePreference: DeviceLanguagePreference(preferences),
    // Issue #161: anything saved before this launch means the app was used
    // before, so a new release is an update rather than a fresh install.
    usedBefore: preferences.getKeys().isNotEmpty,
    whatsNewPreference: DeviceWhatsNewPreference(preferences),
  );
  runApp(SarvodayaConnectApp(store: store));
}
