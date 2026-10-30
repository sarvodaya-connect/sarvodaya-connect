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

  for (final role in [
    UserRole.programmeCoordinator,
    UserRole.deputyDistrictManager,
    UserRole.districtManager,
    UserRole.hqAdmin,
  ]) {
    testWidgets(
      '${role.label} receives the V4 role home and scoped directory',
      (tester) async {
        final store = testStore()..switchDemoRole(role);
        await pumpApp(tester, store: store);
        expect(find.text('${role.label} home'), findsOneWidget);
        expect(find.text('Societies'), findsOneWidget);
        expect(find.text('Submit'), findsNothing);
        expect(find.text('Reviews'), findsNothing);
        if (role == UserRole.districtManager) {
          expect(find.text('Access'), findsOneWidget);
        }
        await tester.tap(find.text('Societies'));
        await tester.pumpAndSettle();
        expect(find.text('My societies'), findsOneWidget);
      },
    );
  }

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
    expect(find.text('Sign in with your Sarvodaya account'), findsOneWidget);
  });

  testWidgets('role home exposes the M26 empty state', (tester) async {
    final store = testStore();
    store.switchDemoRole(UserRole.hqAdmin);
    store.setDemoOptions(emptyRecords: true);
    await pumpApp(tester, store: store);

    expect(find.text('No records yet'), findsOneWidget);
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
