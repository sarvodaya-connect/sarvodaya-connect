import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/data/demo_data.dart';

import 'test_helpers.dart';

void main() {
  testWidgets('opens on the demo sign-in screen', (tester) async {
    await pumpApp(tester);

    expect(find.text('Sign in with your Sarvodaya account'), findsOneWidget);
    expect(find.textContaining('Amazon Cognito'), findsOneWidget);
  });

  testWidgets('requires both credentials', (tester) async {
    await pumpApp(tester);

    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.pumpAndSettle();

    expect(find.text('Enter the username or email.'), findsOneWidget);
    expect(find.text('Enter the password.'), findsOneWidget);
  });

  testWidgets('keeps the username when the password is wrong', (tester) async {
    await pumpApp(tester);

    await tester.enterText(
      find.widgetWithText(TextFormField, 'Username or email'),
      DemoAccount.username,
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Password'),
      'not-the-password',
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.pumpAndSettle();

    expect(
      find.textContaining('username or password is not correct'),
      findsOneWidget,
    );
    expect(find.text(DemoAccount.username), findsOneWidget);
  });

  testWidgets('demo sign-in opens the assigned society home', (tester) async {
    await pumpApp(tester);
    await signInWithDemoAccount(tester);

    expect(find.textContaining('Nimali'), findsOneWidget);
    expect(find.text('Pahala Kosgama SSS'), findsOneWidget);
    expect(find.text('Profile completeness'), findsOneWidget);
  });

  testWidgets('offline sign-in explains that internet is needed', (
    tester,
  ) async {
    final store = testStore()..setDemoOptions(offline: true);
    await pumpApp(tester, store: store);
    await signInWithDemoAccount(tester);

    expect(find.textContaining('You need internet to sign in'), findsOneWidget);
  });

  testWidgets('temporary authentication failure offers a retry', (
    tester,
  ) async {
    final store = testStore()..setDemoOptions(failLoads: true);
    await pumpApp(tester, store: store);
    await signInWithDemoAccount(tester);

    expect(
      find.textContaining('Authentication is temporarily unavailable'),
      findsOneWidget,
    );
    expect(find.text('Try again'), findsOneWidget);
  });
}
