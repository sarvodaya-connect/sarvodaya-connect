import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/data/demo_data.dart';
import 'package:sarvodaya_connect_mobile/src/screens/membership_screen.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';

import 'test_helpers.dart';

void main() {
  test('membership category and gender totals calculate consistently', () {
    for (final category in demoMembership.categories) {
      expect(category.total, category.female + category.male);
    }

    final categoryTotal = demoMembership.categories.fold<int>(
      0,
      (sum, category) => sum + category.total,
    );
    expect(demoMembership.femaleTotal, 232);
    expect(demoMembership.maleTotal, 180);
    expect(demoMembership.overallTotal, 412);
    expect(demoMembership.overallTotal, categoryTotal);
  });

  testWidgets('M08 shows all categories, gender totals and overall total', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(412 * 3, 1400 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final store = testStore();
    await tester.pumpWidget(
      DemoScope(
        store: store,
        child: const MaterialApp(home: MembershipScreen()),
      ),
    );
    await tester.pumpAndSettle();

    for (final category in ['Child', 'Youth', 'Ordinary', 'Life', 'Invited']) {
      expect(find.text(category), findsOneWidget);
    }
    expect(find.text('Female'), findsOneWidget);
    expect(find.text('Male'), findsOneWidget);
    expect(find.text('412'), findsOneWidget);
    expect(find.text('+14 since Apr–Jun'), findsOneWidget);

    // Counts can be adjusted with the steppers; the total follows.
    await tester.tap(find.byTooltip('Increase Child female'));
    await tester.pump();
    expect(find.text('31'), findsOneWidget);
    expect(find.text('413'), findsOneWidget);
  });

  testWidgets('M08 has an empty state for societies with no records', (
    tester,
  ) async {
    final store = testStore()..setDemoOptions(emptyRecords: true);
    await tester.pumpWidget(
      DemoScope(
        store: store,
        child: const MaterialApp(home: MembershipScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Membership not available'), findsOneWidget);
  });
}
