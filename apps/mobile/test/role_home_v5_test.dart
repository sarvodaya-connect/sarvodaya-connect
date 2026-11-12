import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/home/home_api.dart';
import 'package:sarvodaya_connect_mobile/src/home/home_screens.dart';
import 'package:sarvodaya_connect_mobile/src/models/notification.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';

import 'test_helpers.dart';

Future<DemoStore> _pump(
  WidgetTester tester,
  Widget home, {
  required UserRole role,
  HomeApi? api,
  Size size = const Size(390, 2000),
}) async {
  tester.view.physicalSize = size * 3;
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
      child: MaterialApp(theme: AppTheme.light(), home: home),
    ),
  );
  await tester.pumpAndSettle();
  return store;
}

class _Refusing implements HomeApi {
  @override
  Future<RoleHome> fetchHome() async =>
      throw const HomeException('Forbidden', status: 403);

  @override
  Future<HomeSocietyList> fetchSocieties(HomeSocietyQuery query) async =>
      throw const HomeException('Forbidden', status: 403);

  @override
  Future<ScopedMembership> fetchMembership({bool district = false}) async =>
      throw const HomeException('Forbidden', status: 403);

  @override
  Future<ScopedAudits> fetchAudits({
    int? year,
    bool district = false,
    int page = 1,
  }) async => throw const HomeException('Forbidden', status: 403);
}

void main() {
  testWidgets('M05s: the SPC sees activities to approve and their societies', (
    tester,
  ) async {
    await _pump(
      tester,
      const RoleHomeScreen(),
      role: UserRole.programmeCoordinator,
    );
    expect(
      find.text('Society Program Coordinator (SPC) · Kurunegala'),
      findsOneWidget,
    );
    expect(
      find.text('Your access: 12 assigned societies · view and edit'),
      findsOneWidget,
    );
    expect(find.text('2 Activities to Approve'), findsOneWidget);
    expect(find.text('My Societies'), findsOneWidget);
    expect(find.text('Pahala Kosgama SSS'), findsOneWidget);
    expect(find.text('Grade request'), findsOneWidget);
    expect(find.text('90+ days'), findsOneWidget);
    // Not a district list: other societies are not shown.
    expect(find.text('Thalawa SSS'), findsNothing);
    expect(find.byType(LinearProgressIndicator), findsNothing);
  });

  testWidgets('M05d: the DDM sees three tiles and filters their societies', (
    tester,
  ) async {
    await _pump(
      tester,
      const RoleHomeScreen(),
      role: UserRole.deputyDistrictManager,
    );
    expect(find.text('Assigned'), findsOneWidget);
    expect(find.text('Grade Requests'), findsOneWidget);
    expect(find.text('Not Updated 90d'), findsOneWidget);

    await tester.tap(find.byTooltip('Filter Societies'));
    await tester.pumpAndSettle();
    expect(find.text('Filter Societies'), findsOneWidget);
    await tester.tap(find.text('Not Updated in 90 Days'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Show societies'));
    await tester.pumpAndSettle();
    expect(find.text('Hettipola SSS'), findsOneWidget);
    expect(find.text('Pahala Kosgama SSS'), findsNothing);

    await tester.enterText(find.byType(TextField), 'nothing like this');
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pumpAndSettle();
    expect(find.text('No Societies Match'), findsOneWidget);
    await tester.tap(find.text('Clear all filters'));
    await tester.pumpAndSettle();
    expect(find.text('Pahala Kosgama SSS'), findsOneWidget);
  });

  testWidgets(
    'M05m: the DM sees the district view only, and temporary access',
    (tester) async {
      await _pump(
        tester,
        const RoleHomeScreen(),
        role: UserRole.districtManager,
      );
      expect(
        find.text('Your access: all 106 Kurunegala societies · view only'),
        findsOneWidget,
      );
      expect(find.text('District Overview'), findsOneWidget);
      expect(find.text('9,412'), findsOneWidget);
      expect(find.text('Temporary Access for Your DDM'), findsOneWidget);
      expect(find.text('None active'), findsOneWidget);
      expect(find.text('Give temporary access'), findsOneWidget);
      expect(find.text('Needs Attention'), findsOneWidget);
      expect(find.text('Not updated for 234 days'), findsOneWidget);
    },
  );

  testWidgets('M20: the DM lists every district society', (tester) async {
    await _pump(
      tester,
      const DistrictSocietiesScreen(),
      role: UserRole.districtManager,
    );
    expect(find.text('Your district · view only'), findsOneWidget);
    expect(find.text('Thalawa SSS'), findsOneWidget);
    expect(find.text('Pahala Kosgama SSS'), findsOneWidget);
  });

  testWidgets('a refused home shows no access and names nothing', (
    tester,
  ) async {
    await _pump(
      tester,
      const RoleHomeScreen(),
      role: UserRole.programmeCoordinator,
      api: _Refusing(),
    );
    expect(find.text("You Don't Have Access to This"), findsOneWidget);
    expect(find.text('Pahala Kosgama SSS'), findsNothing);
  });

  testWidgets('the home lays out without overflow on a small phone', (
    tester,
  ) async {
    for (final role in [
      UserRole.programmeCoordinator,
      UserRole.deputyDistrictManager,
      UserRole.districtManager,
    ]) {
      await _pump(
        tester,
        const RoleHomeScreen(),
        role: role,
        size: const Size(320, 568),
      );
      expect(tester.takeException(), isNull);
    }
  });

  test('the demonstration home refuses HQ and Society Officers', () async {
    for (final role in [UserRole.hqAdmin, UserRole.societyOfficer]) {
      final store = DemoStore(loadDelay: Duration.zero)..switchDemoRole(role);
      await expectLater(store.home.fetchHome(), throwsA(isA<HomeException>()));
    }
  });

  test('notifications from the API keep their read state and topic', () {
    final note = AppNotification.fromApi({
      'id': 'n1',
      'category': 'REQUEST',
      'topic': 'INFORMATION_REQUEST',
      'title': 'HQ request: Signed AGM minutes',
      'body': 'Please respond by 30 Nov 2026.',
      'read': false,
      'createdAt': '2026-11-03T04:00:00.000Z',
    });
    expect(note.kind, NotificationKind.request);
    expect(note.read, isFalse);
    expect(note.opensItem, isFalse);
    final returned = AppNotification.fromApi({
      'id': 'n2',
      'category': 'RETURNED',
      'topic': 'ACTIVITY',
      'title': 'Activity sent back',
      'read': true,
      'createdAt': '2026-11-02T04:00:00.000Z',
    });
    expect(returned.kind, NotificationKind.returned);
    expect(returned.message, '');
  });
}
