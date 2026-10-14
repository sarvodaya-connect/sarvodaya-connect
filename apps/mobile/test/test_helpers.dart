import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/app.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';

/// Fixed demo clock so dates in tests do not depend on the day they run.
final demoNow = DateTime(2026, 10, 13, 10, 15);

DemoStore testStore() =>
    DemoStore(loadDelay: Duration.zero, clock: () => demoNow);

/// Pumps the app on a tall phone-width screen so long screens need less scrolling.
Future<DemoStore> pumpApp(WidgetTester tester, {DemoStore? store}) async {
  tester.view.physicalSize = const Size(412 * 3, 1400 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final demoStore = store ?? testStore();
  await tester.pumpWidget(SarvodayaConnectApp(store: demoStore));
  await tester.pumpAndSettle();
  return demoStore;
}

Future<void> signInWithDemoAccount(WidgetTester tester) async {
  await tester.tap(find.text('Use demo account'));
  await tester.pump();
  await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
  await tester.pumpAndSettle();
}

Future<void> tapVisible(WidgetTester tester, Finder finder) async {
  // Clear confirmation snackbars so they cannot cover the button being tapped.
  tester
      .state<ScaffoldMessengerState>(find.byType(ScaffoldMessenger).first)
      .clearSnackBars();
  await tester.pumpAndSettle();
  if (finder.evaluate().isEmpty) {
    // Lists build rows lazily; scroll until the target has been built.
    await tester.scrollUntilVisible(
      finder,
      300,
      scrollable: find.byType(Scrollable).first,
    );
  }
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}
