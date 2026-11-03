import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/models/app_language.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';

import 'test_helpers.dart';

void main() {
  testWidgets(
    'Society Officer receives the V5 M05 home and Nav, in demo mode too',
    (tester) async {
      final store = testStore();
      store.switchDemoRole(UserRole.societyOfficer);
      await pumpApp(tester, store: store);

      expect(find.textContaining('Good '), findsOneWidget);
      expect(find.text('UPDATE YOUR SOCIETY'), findsOneWidget);
      for (final tab in ['Home', 'Society', 'Exco', 'Work plan', 'More']) {
        expect(navTab(tab), findsOneWidget);
      }
      expect(find.text('Incident'), findsOneWidget);
      // V5 PR 10: the V3 Submit and Requests tabs are gone.
      expect(find.text('Submit'), findsNothing);
      expect(find.text('Requests'), findsNothing);
    },
  );

  testWidgets('M05i keeps the Tamil names on the Society Officer Nav', (
    tester,
  ) async {
    final store = testStore();
    store.switchDemoRole(UserRole.societyOfficer);
    store.chooseLanguage(AppLanguage.tamil);
    await pumpApp(tester, store: store);

    expect(navTab('முகப்பு'), findsOneWidget);
    expect(navTab('சங்கம்'), findsOneWidget);
    expect(navTab('மேலும்'), findsOneWidget);
  });

  for (final (role, tabs) in [
    (UserRole.programmeCoordinator, ['Home', 'Alerts', 'More']),
    (UserRole.deputyDistrictManager, ['Home', 'Alerts', 'More']),
    (
      UserRole.districtManager,
      ['Home', 'Societies', 'Access', 'Alerts', 'More'],
    ),
  ]) {
    testWidgets('${role.label} receives the V5 home and tabs', (tester) async {
      final store = testStore()..switchDemoRole(role);
      await pumpApp(tester, store: store);
      expect(find.textContaining('Good '), findsOneWidget);
      for (final tab in tabs) {
        expect(navTab(tab), findsOneWidget);
      }
      expect(navTab('Disasters'), findsNothing);
      expect(find.text('Submit'), findsNothing);
      if (role == UserRole.districtManager) {
        expect(find.text('District overview'), findsOneWidget);
        await tester.tap(navTab('Societies'));
        await tester.pumpAndSettle();
        expect(find.text('Your district · view only'), findsOneWidget);
      } else {
        expect(find.text('Pahala Kosgama SSS'), findsOneWidget);
      }
    });
  }

  testWidgets('HQ receives the V5 National Dashboard and HQ tabs', (
    tester,
  ) async {
    final store = testStore()..switchDemoRole(UserRole.hqAdmin);
    await pumpApp(tester, store: store);
    expect(find.text('National Dashboard'), findsOneWidget);
    for (final tab in [
      'Overview',
      'Districts',
      'Societies',
      'Alerts',
      'More',
    ]) {
      expect(navTab(tab), findsOneWidget);
    }
    await tester.tap(navTab('Districts'));
    await tester.pumpAndSettle();
    expect(find.text('Alphabetical, never ranked'), findsOneWidget);
  });

  testWidgets('M17 More changes language and signs out', (tester) async {
    final store = testStore();
    store.switchDemoRole(UserRole.societyOfficer);
    await pumpApp(tester, store: store);

    await tester.tap(find.text('More'));
    await tester.pumpAndSettle();
    expect(find.text('Waiting to send (0)'), findsNothing);
    expect(find.text('Language'), findsOneWidget);

    await tester.tap(find.text('Sign out'));
    await tester.pumpAndSettle();
    expect(
      find.text(
        'Use the username and password for your Sarvodaya Connect account.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('role home exposes the M26 empty state', (tester) async {
    final store = testStore();
    store.switchDemoRole(UserRole.programmeCoordinator);
    store.setDemoOptions(emptyRecords: true);
    await pumpApp(tester, store: store);

    expect(find.text('No societies match'), findsOneWidget);
  });

  testWidgets('role home exposes the M26 error state', (tester) async {
    final store = testStore();
    store.switchDemoRole(UserRole.programmeCoordinator);
    store.setDemoOptions(failLoads: true);
    await pumpApp(tester, store: store);

    expect(find.text('Something went wrong'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
  });
}
