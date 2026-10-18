import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'test_helpers.dart';

void main() {
  testWidgets('renders the approved society profile information', (
    tester,
  ) async {
    await pumpApp(tester);
    await signInWithDemoAccount(tester);

    await tester.tap(find.text('Society'));
    await tester.pumpAndSettle();

    expect(find.text('Approved record · Verified'), findsOneWidget);
    expect(find.text('Pahala Kosgama SSS'), findsOneWidget);
    expect(find.text('SSS-104233'), findsOneWidget);
    expect(find.text('DEMO/KG/1979/042'), findsOneWidget);
    expect(find.text('Kurunegala'), findsOneWidget);
    expect(find.text('Kuliyapitiya East'), findsOneWidget);
    expect(find.text('Kosgama 1056'), findsOneWidget);

    await tester.scrollUntilVisible(
      find.text('Address and contact'),
      -300,
      scrollable: find.byType(Scrollable).first,
    );

    expect(find.text('No. 12, Temple Road'), findsOneWidget);
    expect(find.text('Pahala Kosgama'), findsOneWidget);
    expect(find.text('+94 00 000 0010'), findsOneWidget);
    expect(find.text('Missing'), findsOneWidget);
    expect(find.text('N. Wijesinghe (Secretary)'), findsOneWidget);
  });

  testWidgets('opens the editable draft without changing approved values', (
    tester,
  ) async {
    final store = await pumpApp(tester);
    await signInWithDemoAccount(tester);
    await tester.tap(find.text('Society'));
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Edit Profile'),
      -300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Edit Profile'));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextFormField, 'Address *'),
      'A',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Village or town *'),
      'Village @ 1',
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Save draft'));
    await tester.pumpAndSettle();

    expect(
      find.text('Enter the full address, for example No. 12, Temple Road.'),
      findsOneWidget,
    );
    expect(
      find.text(
        'Use letters, numbers, spaces, commas, full stops or hyphens only.',
      ),
      findsOneWidget,
    );
    expect(find.text('A'), findsOneWidget);
    expect(find.text('Village @ 1'), findsOneWidget);
    expect(store.profileDraft, isNull);
    expect(store.society.address.addressLine, 'No. 12, Temple Road');
    expect(store.society.address.village, 'Pahala Kosgama');
  });
}
