import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/screens/council_screen.dart';
import 'package:sarvodaya_connect_mobile/src/screens/replace_member_screen.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';

import 'test_helpers.dart';

Future<DemoStore> _pumpForm(WidgetTester tester) async {
  tester.view.physicalSize = const Size(412 * 3, 1400 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final store = testStore();
  await tester.pumpWidget(
    DemoScope(
      store: store,
      child: MaterialApp(
        theme: AppTheme.light(),
        home: const CouncilScreen(),
        routes: {
          '/replace': (_) =>
              const ReplaceMemberScreen(memberId: 'cm-treasurer'),
        },
      ),
    ),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.bySemanticsLabel('Replace K. Perera'));
  await tester.pumpAndSettle();
  return store;
}

void main() {
  testWidgets('shows required-field errors and keeps entered values', (
    tester,
  ) async {
    await _pumpForm(tester);

    await tester.enterText(
      find.widgetWithText(TextFormField, 'Full name *'),
      'S. Tharmalingam',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Phone *'),
      '12345',
    );
    await tester.tap(find.text('Save as draft'));
    await tester.pumpAndSettle();

    expect(find.text('Fix 2 fields before saving'), findsOneWidget);
    expect(
      find.text('Use a Sri Lankan number, for example +94 00 000 0001.'),
      findsOneWidget,
    );
    expect(find.text('Choose the start date.'), findsOneWidget);
    // Values the officer typed are still there after validation fails.
    expect(find.text('S. Tharmalingam'), findsOneWidget);
    expect(find.text('12345'), findsOneWidget);
  });

  testWidgets('checks the age against a Youth seat', (tester) async {
    await _pumpForm(tester);

    await tester.tap(find.text('Ordinary'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Youth (15–25)').last);
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'Age *'), '30');
    await tester.tap(find.text('Save as draft'));
    await tester.pumpAndSettle();

    expect(find.text('A Youth seat needs someone aged 15–25.'), findsOneWidget);
  });

  testWidgets(
    'a valid replacement is saved as a draft without changing the approved Council',
    (tester) async {
      final store = await _pumpForm(tester);

      await tester.enterText(
        find.widgetWithText(TextFormField, 'Full name *'),
        'S. Tharmalingam',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Phone *'),
        '+94 00 000 0040',
      );
      await tester.tap(find.widgetWithText(TextFormField, 'Start date *'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Save as draft'));
      await tester.pumpAndSettle();

      expect(store.draft?.fullName, 'S. Tharmalingam');
      expect(store.memberById('cm-treasurer')?.fullName, 'K. Perera');
      expect(find.text('Draft change, not sent yet'), findsOneWidget);
      expect(find.textContaining('Draft: S. Tharmalingam'), findsOneWidget);
      expect(find.text('Next: add supporting document'), findsOneWidget);
    },
  );
}
