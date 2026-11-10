import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/district_access/district_access_api.dart';
import 'package:sarvodaya_connect_mobile/src/district_access/district_access_screens.dart';
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
  final store = DemoStore(
    loadDelay: Duration.zero,
    clock: () => demoNow,
    districtAccessApi: DemoDistrictAccessApi(clock: () => demoNow),
  )..switchDemoRole(role);
  await tester.pumpWidget(
    DemoScope(
      store: store,
      child: MaterialApp(theme: AppTheme.light(), home: home),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  for (final (name, size, scale) in _sizes) {
    testWidgets('M30 to M32 DM temporary access has no overflow at $name', (
      tester,
    ) async {
      await _pump(
        tester,
        const DistrictAccessScreen(),
        UserRole.districtManager,
        size,
        scale,
      );
      expect(find.text('Give temporary access'), findsOneWidget);
      expect(tester.takeException(), isNull);

      await tester.ensureVisible(find.text('Give temporary access'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Give temporary access'));
      await tester.pumpAndSettle();
      expect(find.text('Continue'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}
