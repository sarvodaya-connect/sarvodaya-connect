import 'package:flutter/material.dart';

import 'src/app.dart';
import 'src/l10n/language_preference.dart';
import 'src/state/demo_store.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final store = DemoStore(
    languagePreference: await DeviceLanguagePreference.open(),
  );
  runApp(SarvodayaConnectApp(store: store));
}
