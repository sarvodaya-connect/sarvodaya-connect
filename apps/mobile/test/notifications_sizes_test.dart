import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'test_helpers.dart';

const _sizes = <(String, Size, double)>[
  ('320x568', Size(320, 568), 1.0),
  ('320x568 with larger text', Size(320, 568), 1.6),
  ('390x844', Size(390, 844), 1.0),
  ('390x844 with larger text', Size(390, 844), 1.6),
];

void main() {
  for (final (name, size, scale) in _sizes) {
    testWidgets('M16 lays out without overflow at $name', (tester) async {
      // Sign in on the tall helper screen first: the sign-in form itself does
      // not fit 320x568 at large text, and it is not what this test checks.
      final store = await pumpApp(tester);
      await signInWithDemoAccount(tester);
      tester.view.physicalSize = size * 3;
      tester.view.devicePixelRatio = 3;
      tester.platformDispatcher.textScaleFactorTestValue = scale;
      addTearDown(tester.platformDispatcher.clearAllTestValues);
      await tester.pumpAndSettle();
      expect(find.byTooltip('Notifications'), findsOneWidget);
      expect(tester.takeException(), isNull);

      // Notifications with content.
      await tester.tap(find.byTooltip('Notifications'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);

      // Mark all read still works.
      await tester.tap(find.text('Mark all read'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.tap(find.byType(BackButton).first);
      await tester.pumpAndSettle();

      // Empty state.
      store.setDemoOptions(emptyRecords: true);
      await tester.pump();
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Notifications'));
      await tester.pumpAndSettle();
      expect(find.text('No Notifications'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.tap(find.text('Back to Home'));
      await tester.pumpAndSettle();

      // Error, then Try again.
      store.setDemoOptions(emptyRecords: false, failLoads: true);
      await tester.pump();
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Notifications'));
      await tester.pumpAndSettle();
      expect(find.text('Something Went Wrong'), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
      expect(tester.takeException(), isNull);
      store.failLoads = false;
      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();
      expect(find.text('Something Went Wrong'), findsNothing);
      expect(tester.takeException(), isNull);
    });
  }
}
