import 'package:flutter/material.dart';

import 'src/app.dart';
import 'src/l10n/language_preference.dart';
import 'src/release/whats_new.dart';
import 'src/state/demo_store.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final store = DemoStore(
    languagePreference: await DeviceLanguagePreference.open(),
    // Issue #161: read before anything is saved this launch, so a fresh
    // installation is told apart from an update. Never stops startup.
    whatsNew: await WhatsNew.load(),
  );
  runApp(SarvodayaConnectApp(store: store));
}
