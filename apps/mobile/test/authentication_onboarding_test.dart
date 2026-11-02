import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/app.dart';
import 'package:sarvodaya_connect_mobile/src/models/app_language.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';

import 'test_helpers.dart';

void main() {
  testWidgets('first run goes M01 to M03 and opens the assigned home', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(412 * 3, 1000 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    final store = DemoStore(loadDelay: Duration.zero, clock: () => demoNow);
    await tester.pumpWidget(SarvodayaConnectApp(store: store));

    expect(find.bySemanticsLabel('Sarvodaya Connect'), findsOneWidget);
    expect(find.text('Village societies, connected.'), findsOneWidget);
    final scaffold = tester.widget<Scaffold>(find.byType(Scaffold));
    expect(scaffold.backgroundColor, AppColors.splash);

    await tester.pump(const Duration(milliseconds: 901));
    await tester.pumpAndSettle();
    expect(find.text('Choose your language'), findsOneWidget);

    await tester.tap(find.text('English').first);
    await tester.pump();
    await tester.tap(find.widgetWithText(FilledButton, 'Continue'));
    await tester.pumpAndSettle();
    expect(store.selectedLanguage, AppLanguage.english);
    expect(
      find.text(
        'Use the username and password for your Sarvodaya Connect account.',
      ),
      findsOneWidget,
    );

    // V5 has no activation or setup step: HQ already set the password.
    await signInWithDemoAccount(tester);
    expect(find.text('Your account is ready'), findsNothing);
    expect(find.textContaining('Nimali'), findsOneWidget);
    expect(find.text('Profile completeness'), findsOneWidget);
  });

  testWidgets('the chosen language is saved on continue', (tester) async {
    final store = DemoStore(loadDelay: Duration.zero, showSplash: false);
    await tester.pumpWidget(SarvodayaConnectApp(store: store));
    await tester.pumpAndSettle();

    await tester.tap(find.text('தமிழ்'));
    await tester.pump();
    await tester.tap(find.widgetWithText(FilledButton, 'Continue'));
    await tester.pumpAndSettle();
    expect(store.selectedLanguage, AppLanguage.tamil);
  });
}
