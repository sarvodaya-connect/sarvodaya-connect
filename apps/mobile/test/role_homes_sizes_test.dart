import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/home/home_screens.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';

import 'test_helpers.dart';

const _sizes = <(String, Size, double)>[
  ('320x568', Size(320, 568), 1.0),
  ('320x568 larger text', Size(320, 568), 1.6),
  ('390x844', Size(390, 844), 1.0),
  ('390x844 larger text', Size(390, 844), 1.6),
];

Future<void> _pump(
  WidgetTester tester,
  Widget home,
  UserRole role,
  Size size,
  double scale,
) async {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  tester.platformDispatcher.textScaleFactorTestValue = scale;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearAllTestValues);
  final store = DemoStore(loadDelay: Duration.zero, clock: () => demoNow)
    ..switchDemoRole(role);
  await tester.pumpWidget(
    DemoScope(
      store: store,
      child: MaterialApp(theme: AppTheme.light(), home: home),
    ),
  );
  await tester.pumpAndSettle();
}

/// The main page must scroll up and down only, never sideways.
void _expectNoSidewaysPage(WidgetTester tester) {
  final page = tester.widget<Scrollable>(find.byType(Scrollable).first);
  expect(
    page.axisDirection == AxisDirection.down ||
        page.axisDirection == AxisDirection.up,
    isTrue,
    reason: 'the main page scrolls sideways',
  );
}

Future<void> _scrollToEnd(WidgetTester tester) async {
  await tester.drag(find.byType(Scrollable).first, const Offset(0, -3000));
  await tester.pumpAndSettle();
}

/// A ListView only builds items near the screen, so scroll until it exists.
Future<void> _see(WidgetTester tester, Finder finder) async {
  await tester.scrollUntilVisible(
    finder,
    200,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.pumpAndSettle();
}

void main() {
  for (final (name, size, scale) in _sizes) {
    testWidgets('M05s SPC home at $name', (tester) async {
      await _pump(
        tester,
        const RoleHomeScreen(),
        UserRole.programmeCoordinator,
        size,
        scale,
      );
      expect(tester.takeException(), isNull);
      _expectNoSidewaysPage(tester);
      await _see(tester, find.text('2 Activities to Approve'));
      expect(find.text('2 Activities to Approve'), findsOneWidget);
      await _scrollToEnd(tester);
      expect(tester.takeException(), isNull);
    });

    testWidgets('M05d DDM home, tiles and filters at $name', (tester) async {
      await _pump(
        tester,
        const RoleHomeScreen(),
        UserRole.deputyDistrictManager,
        size,
        scale,
      );
      expect(tester.takeException(), isNull);
      _expectNoSidewaysPage(tester);
      await _see(tester, find.text('Assigned'));
      expect(find.text('Assigned'), findsOneWidget);
      await _see(tester, find.text('Grade Requests'));
      expect(find.text('Grade Requests'), findsOneWidget);
      await _see(tester, find.text('Not Updated 90d'));
      expect(find.text('Not Updated 90d'), findsOneWidget);

      await _see(tester, find.byTooltip('Filter Societies'));
      await tester.tap(find.byTooltip('Filter Societies'));
      await tester.pumpAndSettle();
      expect(find.text('Filter Societies'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.ensureVisible(find.text('Not Updated in 90 Days'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Not Updated in 90 Days'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Show societies'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Show societies'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);

      await _see(tester, find.byType(TextField));
      await tester.enterText(find.byType(TextField), 'nothing like this');
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();
      await _scrollToEnd(tester);
      expect(find.text('No Societies Match'), findsOneWidget);
      expect(find.text('Clear all filters'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.ensureVisible(find.text('Clear all filters'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Clear all filters'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });

    testWidgets('M05m DM home at $name', (tester) async {
      await _pump(
        tester,
        const RoleHomeScreen(),
        UserRole.districtManager,
        size,
        scale,
      );
      expect(tester.takeException(), isNull);
      _expectNoSidewaysPage(tester);
      await _see(tester, find.text('District Overview'));
      expect(find.text('District Overview'), findsOneWidget);
      await _scrollToEnd(tester);
      expect(tester.takeException(), isNull);
      expect(find.text('Needs Attention'), findsOneWidget);
    });

    testWidgets('M20 DM societies list (view only) at $name', (tester) async {
      await _pump(
        tester,
        const DistrictSocietiesScreen(),
        UserRole.districtManager,
        size,
        scale,
      );
      expect(tester.takeException(), isNull);
      _expectNoSidewaysPage(tester);
      expect(find.text('Your district · view only'), findsOneWidget);
    });
  }
}
