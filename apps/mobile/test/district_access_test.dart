import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/district_access/access_format.dart';
import 'package:sarvodaya_connect_mobile/src/district_access/district_access_api.dart';
import 'package:sarvodaya_connect_mobile/src/district_access/district_access_screens.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/home/home_screens.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';

import 'test_helpers.dart';

Future<DemoStore> _pump(WidgetTester tester, Widget home, UserRole role) async {
  tester.view.physicalSize = const Size(412 * 3, 1600 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
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
  return store;
}

Future<void> _tap(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

void main() {
  test('time left is words, never a bar (V5 DD02, M05t, M32)', () {
    final now = DateTime.utc(2026, 10, 27, 2, 30);
    expect(
      accessTimeLeft(DateTime.utc(2026, 10, 31, 12, 30), now),
      '4 days left',
    );
    expect(
      accessTimeLeft(DateTime.utc(2026, 10, 30, 10, 30), now),
      '3 days 8 hours left',
    );
    expect(
      accessTimeLeft(DateTime.utc(2026, 10, 27, 7, 30), now),
      '5 hours left',
    );
    expect(accessTimeLeft(DateTime.utc(2026, 10, 27, 2), now), 'Ended');
    expect(
      accessEnds(DateTime.utc(2026, 10, 31, 12, 30)),
      'Sat 31 Oct, 6:00 p.m.',
    );
    expect(
      accessLength(
        DateTime.utc(2026, 10, 27, 2, 30),
        DateTime.utc(2026, 10, 31, 12, 30),
      ),
      '4 days 10 hours',
    );
  });

  test(
    'demo access keeps the API rules: one grant at a time, within the maximum',
    () async {
      final api = DemoDistrictAccessApi(clock: () => demoNow, maxDays: 7);
      expect(
        () => api.give(
          deputyId: 'ddm-p-dissanayake',
          districtId: 'district-kurunegala',
          startsAt: demoNow,
          expiresAt: demoNow.add(const Duration(days: 8)),
        ),
        throwsA(isA<DistrictAccessException>()),
      );
      await api.give(
        deputyId: 'ddm-p-dissanayake',
        districtId: 'district-kurunegala',
        startsAt: demoNow,
        expiresAt: demoNow.add(const Duration(days: 4)),
      );
      expect(
        () => api.give(
          deputyId: 'ddm-p-dissanayake',
          districtId: 'district-kurunegala',
          startsAt: demoNow,
          expiresAt: demoNow.add(const Duration(days: 2)),
        ),
        throwsA(
          isA<DistrictAccessException>().having(
            (e) => e.message,
            'message',
            contains('already has temporary access'),
          ),
        ),
      );
    },
  );

  testWidgets(
    'M30 → M31 → M32: the DM gives access, sees it, then ends it early',
    (tester) async {
      await _pump(
        tester,
        const DistrictAccessScreen(),
        UserRole.districtManager,
      );

      // Only an earlier, ended grant: nothing current yet.
      expect(find.text('Give temporary access'), findsOneWidget);
      expect(
        find.text('Ended on its own'),
        findsNothing,
      ); // shown is the history of the latest
      await _tap(tester, find.text('Give temporary access'));

      // M30
      expect(
        find.text('Only DDMs in your district are listed.'),
        findsOneWidget,
      );
      expect(
        find.text('View only · all societies in your district'),
        findsOneWidget,
      );
      final cont = find.widgetWithText(FilledButton, 'Continue');
      expect(tester.widget<FilledButton>(cont).onPressed, isNull);
      await _tap(tester, find.byType(DropdownButtonFormField<String>));
      await _tap(tester, find.text('P. Dissanayake').last);
      await tester.enterText(
        find.widgetWithText(TextField, 'Reason (optional)'),
        'Annual leave',
      );
      await _tap(tester, cont);

      // M31
      expect(find.text('Check and Confirm'), findsOneWidget);
      expect(find.text('P. Dissanayake Will Be Able To'), findsOneWidget);
      expect(find.text('Give access to anyone else'), findsOneWidget);
      expect(find.text('4 days'), findsOneWidget);
      expect(find.text('Annual leave'), findsOneWidget);
      await _tap(tester, find.widgetWithText(FilledButton, 'Give access'));

      // M32
      expect(find.text('Temporary view-only access given.'), findsOneWidget);
      expect(find.text('P. Dissanayake · DDM'), findsOneWidget);
      expect(find.text('3 days 23 hours left'), findsNothing);
      expect(find.textContaining('days left'), findsOneWidget);
      expect(find.text('Access given · view only'), findsOneWidget);
      expect(find.byType(LinearProgressIndicator), findsNothing);

      await _tap(tester, find.text('End access now'));
      expect(find.text("End P. Dissanayake's Access Now?"), findsOneWidget);
      await _tap(tester, find.widgetWithText(FilledButton, 'End access now'));
      expect(
        find.text('Access ended. The DDM no longer sees the district.'),
        findsOneWidget,
      );
      expect(find.text('Access ended early'), findsOneWidget);
      expect(find.text('Give temporary access'), findsOneWidget);
    },
  );

  testWidgets('M05t: the DDM sees the district-wide view with the time left', (
    tester,
  ) async {
    final grant = DistrictAccessGrant(
      districtId: 'district-kurunegala',
      startsAt: demoNow.subtract(const Duration(hours: 1)),
      expiresAt: demoNow.add(const Duration(days: 4, hours: 3)),
      grantedByName: 'R. Fernando',
    );
    await _pump(
      tester,
      Scaffold(
        body: TemporaryViewCard(grant: grant, now: demoNow),
      ),
      UserRole.deputyDistrictManager,
    );
    expect(find.text('Temporary District-Wide View'), findsOneWidget);
    expect(
      find.text(
        'All societies in your district · view only. Granted by R. Fernando (DM).',
      ),
      findsOneWidget,
    );
    expect(find.textContaining('· 4 days left'), findsOneWidget);
    expect(find.text('Browse district societies'), findsOneWidget);
  });
}
