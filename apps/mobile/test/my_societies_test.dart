import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/screens/my_societies_screen.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';

import 'test_helpers.dart';

Future<void> _show(WidgetTester tester, DemoStore store) async {
  await tester.pumpWidget(
    DemoScope(
      store: store,
      child: const MaterialApp(home: MySocietiesScreen()),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('M20 limits Society Officers to their assigned society', (
    tester,
  ) async {
    final store = testStore()..switchDemoRole(UserRole.societyOfficer);
    await _show(tester, store);

    expect(find.bySemanticsLabel('1 society available to your role'), findsOneWidget);
    expect(find.text('Pahala Kosgama SSS'), findsOneWidget);
    expect(find.text('Mawathagama SSS'), findsNothing);
    expect(find.text('Wariyapola SSS'), findsNothing);
  });

  testWidgets('M20 limits District Managers to their assigned districts', (
    tester,
  ) async {
    final store = testStore()..switchDemoRole(UserRole.districtManager);
    await _show(tester, store);

    expect(find.bySemanticsLabel('2 societies available to your role'), findsOneWidget);
    expect(find.text('Pahala Kosgama SSS'), findsOneWidget);
    expect(find.text('Mawathagama SSS'), findsOneWidget);
    expect(find.text('Wariyapola SSS'), findsNothing);
  });

  testWidgets('M20 shows all societies to HQ Administrators', (tester) async {
    final store = testStore()..switchDemoRole(UserRole.hqAdmin);
    await _show(tester, store);

    expect(find.bySemanticsLabel('3 societies available to your role'), findsOneWidget);
    expect(find.text('Pahala Kosgama SSS'), findsOneWidget);
    expect(find.text('Mawathagama SSS'), findsOneWidget);
    expect(find.text('Wariyapola SSS'), findsOneWidget);
  });

  testWidgets('M20 denies access without an authorized user', (tester) async {
    await _show(tester, testStore());
    expect(find.text('No permission'), findsOneWidget);
    expect(find.text('Pahala Kosgama SSS'), findsNothing);
  });
}
