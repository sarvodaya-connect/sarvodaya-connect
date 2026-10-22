import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/models/activity_draft.dart';
import 'package:sarvodaya_connect_mobile/src/screens/activity_form_screen.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';

import 'test_helpers.dart';

void main() {
  Future<DemoStore> openActivity(WidgetTester tester) async {
    tester.view.physicalSize = const Size(412 * 3, 1000 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final store = testStore()..switchDemoRole(UserRole.societyOfficer);
    await tester.pumpWidget(
      DemoScope(
        store: store,
        child: const MaterialApp(home: ActivityFormScreen()),
      ),
    );
    await tester.pumpAndSettle();
    return store;
  }

  testWidgets('invalid first step keeps input and displays errors', (
    tester,
  ) async {
    await openActivity(tester);
    await tester.enterText(
      find.byKey(const ValueKey('activity-title')),
      'Demo clean up',
    );
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(find.text('Enter an activity location.'), findsNothing);
    expect(find.text('Enter the activity location.'), findsOneWidget);
    expect(find.text('Demo clean up'), findsOneWidget);
  });

  testWidgets('draft survives step navigation and invalid counts', (
    tester,
  ) async {
    final store = await openActivity(tester);
    await tester.enterText(
      find.byKey(const ValueKey('activity-title')),
      'Demo clean up',
    );
    await tester.enterText(
      find.byKey(const ValueKey('activity-date')),
      '2026-10-12',
    );
    await tester.enterText(
      find.byKey(const ValueKey('activity-location')),
      'Demo village',
    );
    await tester.enterText(
      find.byKey(const ValueKey('activity-activityType')),
      'Work camp',
    );
    await tester.enterText(
      find.byKey(const ValueKey('activity-gpsLocation')),
      '7.4891 N, 80.3612 E',
    );
    await tester.enterText(
      find.byKey(const ValueKey('activity-description')),
      'Community clean-up',
    );
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('activity-sector')),
      'Demo sector',
    );
    await tester.tap(find.text('Social'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const ValueKey('activity-female')), '-2');
    await tester.enterText(find.byKey(const ValueKey('activity-male')), '5');
    await tester.enterText(
      find.byKey(const ValueKey('activity-outcomes')),
      'Fictional result',
    );
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(
      find.text('Enter a whole number from 0 to 1,000,000.'),
      findsOneWidget,
    );
    expect(ActivityDraftRegistry.forStore(store).title, 'Demo clean up');
    expect(ActivityDraftRegistry.forStore(store).femaleParticipants, '-2');
  });
  testWidgets('invalid GPS shows a field error and keeps input', (
    tester,
  ) async {
    await openActivity(tester);
    await tester.enterText(
      find.byKey(const ValueKey('activity-gpsLocation')),
      '95.55, 181',
    );
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Use latitude, longitude'), findsOneWidget);
    expect(find.text('95.55, 181'), findsOneWidget);
  });
}
