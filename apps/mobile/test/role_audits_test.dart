import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/data/demo_data.dart';
import 'package:sarvodaya_connect_mobile/src/home/home_api.dart';
import 'package:sarvodaya_connect_mobile/src/home/home_screens.dart';
import 'package:sarvodaya_connect_mobile/src/l10n/generated/app_localizations.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/national/national_screens.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_screen.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';

import 'test_helpers.dart';

/// Issue #119: Audits & AGM for DMs, DDMs and SPCs on the phone. Everyone and
/// every society here is fictional; the Sinhala and Tamil are unreviewed drafts.

AuthenticatedUser _ddm(List<DistrictAccessGrant> grants) => AuthenticatedUser(
  id: demoDdm.id,
  displayName: demoDdm.displayName,
  roles: demoDdm.roles,
  districtIds: demoDdm.districtIds,
  societyIds: demoDdm.societyIds,
  delegatedDistrictAccess: grants,
);

DistrictAccessGrant _grant(Duration start, Duration end) => DistrictAccessGrant(
  districtId: 'district-kurunegala',
  startsAt: demoNow.add(start),
  expiresAt: demoNow.add(end),
);

DemoHomeApi _api(AuthenticatedUser user, {bool empty = false}) => DemoHomeApi(
  user: () => user,
  clock: () => demoNow,
  delay: Duration.zero,
  empty: () => empty,
);

Future<void> _pump(
  WidgetTester tester, {
  required UserRole role,
  HomeApi? api,
  String code = 'en',
  Widget home = const RoleAuditsScreen(),
}) async {
  tester.view.physicalSize = const Size(360, 2600) * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final store = DemoStore(
    loadDelay: Duration.zero,
    clock: () => demoNow,
    homeApi: api,
  )..switchDemoRole(role);
  await tester.pumpWidget(
    DemoScope(
      store: store,
      child: MaterialApp(
        theme: AppTheme.light(),
        locale: Locale(code),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        home: home,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'the DM sees their district with HQ figures and the API due date',
    (tester) async {
      await _pump(tester, role: UserRole.districtManager);
      expect(find.text('All societies in your district'), findsOneWidget);
      // The headline and the Audit Report row.
      expect(find.text('77%'), findsNWidgets(2));
      expect(
        find.text(
          '82 of 106 active societies have uploaded an audit report for FY 2025/26.',
        ),
        findsOneWidget,
      );
      // The test clock is 13 Oct 2026, after the FY 2025/26 due date of 30 September.
      expect(find.text('Past due date'), findsWidgets);
      expect(find.text('Due 30 Sep 2026'), findsOneWidget);
      expect(find.text('4 Registrar Documents · FY 2025/26'), findsOneWidget);
      expect(
        find.text('The signed members list opens only for DMs and HQ.'),
        findsOneWidget,
      );
    },
  );

  testWidgets('the SPC sees only their assigned societies', (tester) async {
    await _pump(tester, role: UserRole.programmeCoordinator);
    expect(find.text('Your 12 assigned societies'), findsOneWidget);
    expect(find.text('Thalawa SSS'), findsNothing);
  });

  testWidgets('a DDM gets the district only while the grant is valid', (
    tester,
  ) async {
    for (final (grant, shown) in [
      (_grant(const Duration(hours: 2), const Duration(days: 2)), false),
      (_grant(const Duration(hours: -2), const Duration(days: 2)), true),
      (_grant(const Duration(days: -3), const Duration(minutes: -1)), false),
    ]) {
      await _pump(
        tester,
        role: UserRole.deputyDistrictManager,
        api: _api(_ddm([grant])),
        home: RoleAuditsScreen(key: ValueKey(grant.startsAt)),
      );
      expect(
        find.byType(SegmentedButton<bool>),
        shown ? findsOneWidget : findsNothing,
      );
    }
  });

  testWidgets('a DDM switches to the district while access is valid', (
    tester,
  ) async {
    await _pump(
      tester,
      role: UserRole.deputyDistrictManager,
      api: _api(
        _ddm([_grant(const Duration(hours: -2), const Duration(days: 2))]),
      ),
    );
    expect(find.text('Your 18 assigned societies'), findsOneWidget);
    await tester.tap(find.text('District · view only'));
    await tester.pumpAndSettle();
    expect(find.text('All district societies · view only'), findsOneWidget);
  });

  test('the demo API refuses the district without a valid grant', () async {
    final api = _api(
      _ddm([_grant(const Duration(days: -3), const Duration(minutes: -1))]),
    );
    await expectLater(
      api.fetchAudits(district: true),
      throwsA(isA<HomeException>().having((e) => e.status, 'status', 403)),
    );
  });

  testWidgets('changes the financial year', (tester) async {
    await _pump(tester, role: UserRole.districtManager);
    await tester.ensureVisible(find.text('FY 2023/24'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('FY 2023/24'));
    await tester.pumpAndSettle();
    expect(find.text('4 Registrar Documents · FY 2023/24'), findsOneWidget);
    expect(find.text('Past due date'), findsWidgets);
  });

  testWidgets('opens a society on its Documents tab', (tester) async {
    await _pump(tester, role: UserRole.programmeCoordinator);
    final row = find.text('Pahala Kosgama SSS');
    await tester.ensureVisible(row);
    await tester.tap(row);
    await tester.pumpAndSettle();
    final screen = tester.widget<SocietyRecordScreen>(
      find.byType(SocietyRecordScreen),
    );
    expect(screen.initialTab, RecordTab.documents);
  });

  testWidgets('says when there are no active societies', (tester) async {
    await _pump(
      tester,
      role: UserRole.programmeCoordinator,
      api: _api(demoDdm, empty: true),
    );
    expect(find.text('No Active Societies'), findsOneWidget);
    expect(find.text('Needs Follow-Up'), findsNothing);
  });

  testWidgets('each role home opens Audits & AGM', (tester) async {
    for (final role in [
      UserRole.programmeCoordinator,
      UserRole.deputyDistrictManager,
      UserRole.districtManager,
    ]) {
      await _pump(tester, role: role, home: const RoleHomeScreen());
      expect(
        find.text('Audit reports and Registrar documents in your societies'),
        findsOneWidget,
      );
    }
    final link = find.text(
      'Audit reports and Registrar documents in your societies',
    );
    await tester.ensureVisible(link);
    await tester.tap(link);
    await tester.pumpAndSettle();
    expect(find.byType(RoleAuditsScreen), findsOneWidget);
  });

  for (final code in ['si', 'ta']) {
    testWidgets('fits a phone in $code with large text', (tester) async {
      tester.platformDispatcher.textScaleFactorTestValue = 1.3;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      await _pump(tester, role: UserRole.districtManager, code: code);
      expect(tester.takeException(), isNull);
      expect(find.text('Needs Follow-Up'), findsNothing);
      // The headline and the Audit Report row.
      expect(find.text('77%'), findsNWidgets(2));
    });
  }
}
