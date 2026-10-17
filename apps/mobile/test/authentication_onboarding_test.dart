import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/app.dart';
import 'package:sarvodaya_connect_mobile/src/models/app_language.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';

import 'test_helpers.dart';

void main() {
  testWidgets('first run completes M01 to M04 and opens the assigned home', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(412 * 3, 1000 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    final store = DemoStore(loadDelay: Duration.zero, clock: () => demoNow);
    await tester.pumpWidget(SarvodayaConnectApp(store: store));

    expect(find.bySemanticsLabel('Sarvodaya Connect'), findsOneWidget);
    final scaffold = tester.widget<Scaffold>(find.byType(Scaffold));
    expect(scaffold.backgroundColor, Colors.white);

    await tester.pump(const Duration(milliseconds: 901));
    await tester.pumpAndSettle();
    expect(find.text('Choose your language'), findsOneWidget);

    await tester.tap(find.text('English').first);
    await tester.pump();
    await tester.tap(find.widgetWithText(FilledButton, 'Continue'));
    await tester.pumpAndSettle();
    expect(store.selectedLanguage, AppLanguage.english);
    expect(find.text('Sign in with your Sarvodaya account'), findsOneWidget);

    await signInWithDemoAccount(tester);
    expect(find.text('Set up your account'), findsOneWidget);
    expect(find.text('Pahala Kosgama SSS'), findsOneWidget);
    expect(find.text('Society Officer'), findsOneWidget);

    final finishButton = find.widgetWithText(FilledButton, 'Finish setup');
    expect(tester.widget<FilledButton>(finishButton).onPressed, isNull);

    await tester.tap(find.byType(Checkbox).at(0));
    await tester.pump();
    await tester.tap(find.byType(Checkbox).at(1));
    await tester.pump();
    expect(tester.widget<FilledButton>(finishButton).onPressed, isNotNull);

    await tester.tap(finishButton);
    await tester.pumpAndSettle();
    expect(find.textContaining('Nimali'), findsOneWidget);
    expect(find.text('Profile completeness'), findsOneWidget);
  });

  testWidgets('language must be selected before continuing', (tester) async {
    final store = DemoStore(loadDelay: Duration.zero, showSplash: false);
    await tester.pumpWidget(SarvodayaConnectApp(store: store));
    await tester.pumpAndSettle();

    final button = find.widgetWithText(FilledButton, 'Continue');
    expect(tester.widget<FilledButton>(button).onPressed, isNull);

    await tester.tap(find.text('தமிழ்'));
    await tester.pump();
    expect(tester.widget<FilledButton>(button).onPressed, isNotNull);
  });
}
