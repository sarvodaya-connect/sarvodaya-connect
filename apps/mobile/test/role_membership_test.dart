import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/data/demo_data.dart';
import 'package:sarvodaya_connect_mobile/src/home/home_api.dart';
import 'package:sarvodaya_connect_mobile/src/home/home_screens.dart';
import 'package:sarvodaya_connect_mobile/src/l10n/generated/app_localizations.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/national/national_screens.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';

import 'test_helpers.dart';

/// Issue #118: Membership for DMs, DDMs and SPCs on the phone. Everyone and
/// every society here is fictional; the Sinhala and Tamil are unreviewed drafts.

AuthenticatedUser _ddm(List<DistrictAccessGrant> grants) => AuthenticatedUser(
  id: demoDdm.id,
  displayName: demoDdm.displayName,
  roles: demoDdm.roles,
  districtIds: demoDdm.districtIds,
  societyIds: demoDdm.societyIds,
  delegatedDistrictAccess: grants,
);

DistrictAccessGrant _grant(Duration startOffset, Duration endOffset) =>
    DistrictAccessGrant(
      grantId: 'grant-1',
      districtId: 'district-kurunegala',
      startsAt: demoNow.add(startOffset),
      expiresAt: demoNow.add(endOffset),
    );

Future<void> _pump(
  WidgetTester tester, {
  required UserRole role,
  HomeApi? api,
  String code = 'en',
  Widget home = const RoleMembershipScreen(),
}) async {
  tester.view.physicalSize = const Size(360, 2400) * 3;
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

DemoHomeApi _api(AuthenticatedUser user, {bool empty = false}) => DemoHomeApi(
  user: () => user,
  clock: () => demoNow,
  delay: Duration.zero,
  empty: () => empty,
);

void main() {
  testWidgets('the DM sees their district with the HQ cards', (tester) async {
    await _pump(tester, role: UserRole.districtManager);
    expect(
      find.text('All societies in Kurunegala · counts only'),
      findsOneWidget,
    );
    expect(find.text('Total Members'), findsOneWidget);
    expect(find.text('Societies Reported'), findsOneWidget);
    expect(find.text('79 of 106'), findsOneWidget);
    expect(find.text('By Category · Female / Male'), findsOneWidget);
    expect(find.text('Members in Each District'), findsOneWidget);
    expect(find.text('Society Profile Member Counts'), findsOneWidget);
    expect(find.byType(SegmentedButton<bool>), findsNothing);
  });

  testWidgets('the SPC sees only their assigned societies', (tester) async {
    await _pump(tester, role: UserRole.programmeCoordinator);
    expect(
      find.text('Your 12 assigned societies · counts only'),
      findsOneWidget,
    );
    expect(find.text('9 of 12'), findsOneWidget);
  });

  testWidgets('a DDM gets the district tab only while the grant is valid', (
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
        // A new screen each time, so the earlier result is not reused.
        home: RoleMembershipScreen(key: ValueKey(grant.startsAt)),
      );
      expect(
        find.byType(SegmentedButton<bool>),
        shown ? findsOneWidget : findsNothing,
      );
      expect(
        find.text('Your 18 assigned societies · counts only'),
        findsOneWidget,
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
    await tester.tap(find.text('District · view only'));
    await tester.pumpAndSettle();
    expect(find.text('All Kurunegala societies · view only'), findsOneWidget);
    expect(find.text('79 of 106'), findsOneWidget);
  });

  test(
    'the demo API refuses the district view without a valid grant',
    () async {
      final api = _api(
        _ddm([_grant(const Duration(days: -3), const Duration(minutes: -1))]),
      );
      await expectLater(
        api.fetchMembership(district: true),
        throwsA(isA<HomeException>().having((e) => e.status, 'status', 403)),
      );
    },
  );

  testWidgets('says when there are no active societies', (tester) async {
    await _pump(
      tester,
      role: UserRole.programmeCoordinator,
      api: _api(demoDdm, empty: true),
    );
    expect(find.text('No Active Societies'), findsOneWidget);
    expect(find.text('Members in Each District'), findsNothing);
  });

  testWidgets('each role home opens Membership', (tester) async {
    for (final role in [
      UserRole.programmeCoordinator,
      UserRole.deputyDistrictManager,
      UserRole.districtManager,
    ]) {
      await _pump(tester, role: role, home: const RoleHomeScreen());
      final link = find.text(
        'Members by category in your societies · counts only',
      );
      expect(link, findsOneWidget);
    }
    await tester.ensureVisible(
      find.text('Members by category in your societies · counts only'),
    );
    await tester.tap(
      find.text('Members by category in your societies · counts only'),
    );
    await tester.pumpAndSettle();
    expect(find.byType(RoleMembershipScreen), findsOneWidget);
  });

  for (final code in ['si', 'ta']) {
    testWidgets('fits a phone in $code with large text', (tester) async {
      tester.platformDispatcher.textScaleFactorTestValue = 1.3;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      await _pump(tester, role: UserRole.districtManager, code: code);
      expect(tester.takeException(), isNull);
      expect(find.text('Total Members'), findsNothing);
      expect(find.text('Kurunegala'), findsOneWidget);
    });
  }
}
