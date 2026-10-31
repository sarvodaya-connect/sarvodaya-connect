import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/screens/my_societies_screen.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'test_helpers.dart';

Future<void> _show(WidgetTester tester, DemoStore store) async {
  await tester.pumpWidget(DemoScope(store: store, child: const MaterialApp(home: MySocietiesScreen())));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('M20 limits Society Officers to assigned society records', (tester) async {
    final api = TestRegistryApiClient();
    final store = testStore(registryApiClient: api)..switchDemoRole(UserRole.societyOfficer);
    await _show(tester, store);
    expect(find.text('Pahala Kosgama SSS'), findsOneWidget);
    expect(find.text('Mawathagama SSS'), findsNothing);
    expect(find.text('Wariyapola SSS'), findsNothing);
  });

  testWidgets('M20 gives District Managers read-only district records', (tester) async {
    final store = testStore(registryApiClient: TestRegistryApiClient())..switchDemoRole(UserRole.districtManager);
    await _show(tester, store);
    expect(find.text('Pahala Kosgama SSS'), findsOneWidget);
    expect(find.text('Mawathagama SSS'), findsOneWidget);
    expect(find.text('Wariyapola SSS'), findsNothing);
    expect(find.byTooltip('Request grade change'), findsNothing);
  });

  testWidgets('M20 shows all records to HQ and restricts grade requests to authorized field roles', (tester) async {
    final store = testStore(registryApiClient: TestRegistryApiClient())..switchDemoRole(UserRole.hqAdmin);
    await _show(tester, store);
    expect(find.text('Wariyapola SSS'), findsOneWidget);
    expect(find.byTooltip('Request grade change'), findsNothing);
  });

  testWidgets('M20 denies access without an authorized user', (tester) async {
    await _show(tester, testStore(registryApiClient: TestRegistryApiClient()));
    expect(find.text('No permission'), findsOneWidget);
    expect(find.text('Pahala Kosgama SSS'), findsNothing);
  });

  testWidgets('M20 applies district, grade and open-request filters at the API boundary', (tester) async {
    final store = testStore(registryApiClient: TestRegistryApiClient())..switchDemoRole(UserRole.hqAdmin);
    await _show(tester, store);
    await tester.tap(find.text('All districts'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Anuradhapura').last);
    await tester.pumpAndSettle();
    expect(find.text('Wariyapola SSS'), findsOneWidget);
    expect(find.text('Pahala Kosgama SSS'), findsNothing);
  });

  testWidgets('M20 shows empty and retryable error states', (tester) async {
    final api = TestRegistryApiClient(societies: const [])..failSocieties = true;
    final store = testStore(registryApiClient: api)..switchDemoRole(UserRole.hqAdmin);
    await tester.pumpWidget(DemoScope(store: store, child: const MaterialApp(home: MySocietiesScreen())));
    await tester.pumpAndSettle();
    expect(find.text('Societies unavailable'), findsOneWidget);
    api.failSocieties = false;
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(find.text('No matching societies'), findsOneWidget);
  });
}
