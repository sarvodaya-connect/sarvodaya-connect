import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/models/app_language.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';

import 'test_helpers.dart';

void main() {
  testWidgets(
    'Society Officer receives M05 navigation and incomplete profile action',
    (tester) async {
      final store = testStore();
      store.switchDemoRole(UserRole.societyOfficer);
      await pumpApp(tester, store: store);

      expect(find.text('Profile completeness'), findsOneWidget);
      expect(find.text('Complete profile'), findsOneWidget);
      expect(find.text('Home'), findsOneWidget);
      expect(find.bySemanticsLabel('Sarvodaya Connect'), findsOneWidget);
      expect(find.text('Society'), findsOneWidget);
      expect(find.text('Submit'), findsOneWidget);
      expect(find.text('Requests'), findsOneWidget);
      expect(find.text('More'), findsOneWidget);
    },
  );

  testWidgets('M05i shows Tamil home copy and navigation', (tester) async {
    final store = testStore();
    store.switchDemoRole(UserRole.societyOfficer);
    store.chooseLanguage(AppLanguage.tamil);
    await pumpApp(tester, store: store);

    expect(find.text('உங்கள் கவனம் தேவை'), findsOneWidget);
    expect(find.text('விரைவு செயல்கள்'), findsOneWidget);
    expect(find.text('முகப்பு'), findsWidgets);
    expect(find.text('மேலும்'), findsOneWidget);
  });

  testWidgets('District Manager receives district-only home and work areas', (
    tester,
  ) async {
    final store = testStore();
    store.switchDemoRole(UserRole.districtManager);
    await pumpApp(tester, store: store);

    expect(find.textContaining('Kurunegala District'), findsOneWidget);
    expect(find.text('Pending reviews'), findsOneWidget);
    expect(find.text('Reviews'), findsOneWidget);
    expect(find.text('Submit'), findsNothing);

    await tester.tap(find.text('Reviews'));
    await tester.pumpAndSettle();
    expect(find.text('Review queue'), findsOneWidget);
    expect(find.text('Council update'), findsOneWidget);
  });

  testWidgets('HQ Administrator receives national home and reports', (
    tester,
  ) async {
    final store = testStore();
    store.switchDemoRole(UserRole.hqAdmin);
    await pumpApp(tester, store: store);

    expect(find.text('National overview'), findsOneWidget);
    expect(find.text('Registered societies'), findsOneWidget);
    expect(find.text('Reports'), findsOneWidget);
    expect(find.text('Reviews'), findsNothing);

    await tester.tap(find.text('Reports'));
    await tester.pumpAndSettle();
    expect(find.text('Activities by sector'), findsOneWidget);
  });

  testWidgets('M17 More changes language and signs out', (tester) async {
    final store = testStore();
    store.switchDemoRole(UserRole.societyOfficer);
    await pumpApp(tester, store: store);

    await tester.tap(find.text('More'));
    await tester.pumpAndSettle();
    expect(find.text('Waiting to send (0)'), findsOneWidget);
    expect(find.text('Language'), findsOneWidget);

    await tester.tap(find.text('Sign out'));
    await tester.pumpAndSettle();
    expect(find.text('Sign in with your Sarvodaya account'), findsOneWidget);
  });

  testWidgets('role home exposes the M26 empty state', (tester) async {
    final store = testStore();
    store.switchDemoRole(UserRole.hqAdmin);
    store.setDemoOptions(emptyRecords: true);
    await pumpApp(tester, store: store);

    expect(find.text('No national records yet'), findsOneWidget);
  });

  testWidgets('role home exposes the M26 error state', (tester) async {
    final store = testStore();
    store.switchDemoRole(UserRole.hqAdmin);
    store.setDemoOptions(failLoads: true);
    await pumpApp(tester, store: store);

    expect(find.text('Something went wrong'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
  });
}
