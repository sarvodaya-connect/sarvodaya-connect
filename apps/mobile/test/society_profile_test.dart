import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/screens/society_profile_screen.dart';
import 'package:sarvodaya_connect_mobile/src/screens/village_profile_screen.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/widgets/state_views.dart';

import 'test_helpers.dart';

Future<DemoStore> _openVillageTab(
  WidgetTester tester, {
  DemoStore? store,
}) async {
  final demoStore = await pumpApp(tester, store: store);
  await signInWithDemoAccount(tester);
  await tester.tap(find.text('Society'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Village'));
  await tester.pumpAndSettle();
  return demoStore;
}

void main() {
  testWidgets('M06 shows a loading state before the profile is ready', (
    tester,
  ) async {
    final store = DemoStore(loadDelay: const Duration(milliseconds: 200))
      ..switchDemoRole(UserRole.societyOfficer);
    await tester.pumpWidget(
      DemoScope(
        store: store,
        child: const MaterialApp(home: SocietyProfileScreen()),
      ),
    );
    await tester.pump();
    expect(find.byType(LoadingSkeleton), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 200));
    await tester.pumpAndSettle();
    expect(find.text('Approved record · Verified'), findsOneWidget);
  });

  testWidgets('read-only roles do not see enabled M06 edit actions', (
    tester,
  ) async {
    final store = DemoStore(loadDelay: Duration.zero)
      ..switchDemoRole(UserRole.districtManager);
    await tester.pumpWidget(
      DemoScope(
        store: store,
        child: const MaterialApp(home: SocietyProfileScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Edit Profile'), findsNothing);
    expect(find.text('Update Committee'), findsNothing);
  });

  testWidgets('renders the approved society profile information', (
    tester,
  ) async {
    await pumpApp(tester);
    await signInWithDemoAccount(tester);

    await tester.tap(find.text('Society'));
    await tester.pumpAndSettle();

    expect(find.text('Approved record · Verified'), findsOneWidget);
    expect(find.text('Active'), findsOneWidget);
    expect(find.text('Pahala Kosgama SSS'), findsOneWidget);
    expect(find.text('SSS-104233'), findsOneWidget);
    expect(find.text('DEMO/KG/1979/042'), findsOneWidget);
    expect(find.text('Kurunegala'), findsOneWidget);
    expect(find.text('Kuliyapitiya East'), findsOneWidget);
    expect(find.text('Kosgama 1056'), findsOneWidget);

    await tester.scrollUntilVisible(
      find.text('Address and contact'),
      -300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.scrollUntilVisible(
      find.text('Secretary'),
      -300,
      scrollable: find.byType(Scrollable).first,
    );

    expect(find.text('No. 12, Temple Road'), findsOneWidget);
    expect(find.text('Pahala Kosgama'), findsOneWidget);
    expect(find.text('+94 00 000 0010'), findsOneWidget);
    expect(find.text('Missing'), findsOneWidget);
    expect(find.text('N. Wijesinghe · (Secretary)'), findsOneWidget);
  });

  testWidgets('M06b Village tab shows the annual village snapshot', (
    tester,
  ) async {
    await _openVillageTab(tester);

    expect(find.text('Village profile 2026 · Approved'), findsOneWidget);
    expect(find.text('People · Kosgama GN'), findsOneWidget);
    expect(find.text('2,540'), findsOneWidget);
    expect(find.text('680'), findsOneWidget);
    expect(find.text('108'), findsOneWidget);
    expect(find.text('Key statistics'), findsOneWidget);
    expect(find.text('58% of homes'), findsOneWidget);
    expect(find.text('Main income · households'), findsOneWidget);
    expect(find.text('Agriculture and livestock'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Priority issues'),
      -300,
      scrollable: find.byType(Scrollable).last,
    );
    expect(
      find.text('Reliable irrigation water through the dry season'),
      findsOneWidget,
    );
  });

  testWidgets('M06b exposes empty, offline and error states', (tester) async {
    final store = testStore()..setDemoOptions(emptyRecords: true);
    await _openVillageTab(tester, store: store);
    expect(find.text('Village profile not available'), findsOneWidget);

    store.setDemoOptions(emptyRecords: false, offline: true);
    await tester.pumpAndSettle();
    expect(
      find.text('Offline · your draft is saved on this phone'),
      findsOneWidget,
    );
    expect(
      find.text('Offline · your draft is saved on this phone'),
      findsOneWidget,
    );

    final errorStore = testStore()..setDemoOptions(failLoads: true);
    await tester.pumpWidget(
      DemoScope(
        store: errorStore,
        child: const MaterialApp(home: VillageProfileScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Something went wrong'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
  });

  testWidgets('opens the editable draft without changing approved values', (
    tester,
  ) async {
    final store = await pumpApp(tester);
    await signInWithDemoAccount(tester);
    await tester.tap(find.text('Society'));
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Edit Profile'),
      -300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Edit Profile'));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextFormField, 'Address *'),
      'A',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Village or town *'),
      'Village @ 1',
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Save draft'));
    await tester.pumpAndSettle();

    expect(
      find.text('Enter the full address, for example No. 12, Temple Road.'),
      findsOneWidget,
    );
    expect(
      find.text(
        'Use letters, numbers, spaces, commas, full stops or hyphens only.',
      ),
      findsOneWidget,
    );
    expect(find.text('A'), findsOneWidget);
    expect(find.text('Village @ 1'), findsOneWidget);
    expect(store.profileDraft, isNull);
    expect(store.society.address.addressLine, 'No. 12, Temple Road');
    expect(store.society.address.village, 'Pahala Kosgama');
  });
}
