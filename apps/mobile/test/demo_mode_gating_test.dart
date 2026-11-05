import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sarvodaya_connect_mobile/src/auth/api_auth_service.dart';
import 'package:sarvodaya_connect_mobile/src/auth/auth_service.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/screens/more_screen.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';
import 'package:sarvodaya_connect_mobile/src/widgets/demo_options_sheet.dart';

/// Issue #98: with SC_DEMO_MODE=false, the app uses the authenticated account
/// and the demonstration tools are gone. All the people here are fictional.
const _account = AuthenticatedUser(
  id: 'fictional-hq',
  displayName: 'Fictional Admin',
  roles: [UserRole.hqAdmin],
  societyIds: [],
);

const _officerAccount = AuthenticatedUser(
  id: 'fictional-officer',
  displayName: 'Fictional Officer',
  roles: [UserRole.societyOfficer],
  societyIds: ['society-1', 'society-2'],
);

class _SignedIn implements AuthService {
  _SignedIn(this.user);

  final AuthenticatedUser user;

  @override
  Future<AuthSession?> signIn({
    required String username,
    required String password,
  }) async => AuthSession(user: user);
}

Future<DemoStore> _signedIn({
  bool demo = false,
  AuthenticatedUser user = _account,
}) async {
  final store = DemoStore(
    demo: demo,
    loadDelay: Duration.zero,
    authService: _SignedIn(user),
    identityApi: IdentityApi(
      baseUrl: 'http://fictional.invalid/api/v1',
      client: MockClient(
        (_) async => http.Response(
          '{"data":[],"meta":{"unreadCount":0}}',
          200,
          headers: {'content-type': 'application/json'},
        ),
      ),
    ),
    showSplash: false,
    languageChosen: true,
  );
  await store.signIn('fictional', 'not-a-real-password');
  return store;
}

Future<void> _pumpMore(WidgetTester tester, DemoStore store) async {
  tester.view.physicalSize = const Size(390, 1600) * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    DemoScope(
      store: store,
      child: MaterialApp(theme: AppTheme.light(), home: const MoreScreen()),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  test('the store follows SC_DEMO_MODE unless told otherwise', () {
    expect(DemoStore(loadDelay: Duration.zero).isDemo, DemoStore.demoMode);
    expect(DemoStore(loadDelay: Duration.zero, demo: true).isDemo, isTrue);
    expect(DemoStore(loadDelay: Duration.zero, demo: false).isDemo, isFalse);
  });

  group('with demo mode off', () {
    testWidgets('More has no way into the demo controls', (tester) async {
      await _pumpMore(tester, (await tester.runAsync(_signedIn))!);
      expect(find.byTooltip('Demo options'), findsNothing);
      expect(find.byIcon(Icons.tune), findsNothing);
      expect(find.text('Fictional Admin'), findsOneWidget);
    });

    testWidgets('opening the controls directly shows nothing', (tester) async {
      await _pumpMore(tester, (await tester.runAsync(_signedIn))!);
      await showDemoOptions(tester.element(find.byType(MoreScreen)));
      await tester.pumpAndSettle();
      expect(find.text('Demo options'), findsNothing);
      expect(find.text('Preview role home'), findsNothing);
      expect(find.byType(BottomSheet), findsNothing);
    });

    test('a role switch cannot change the authenticated account', () async {
      final store = await _signedIn();
      var notified = 0;
      store.addListener(() => notified++);
      for (final role in UserRole.values) {
        store.switchDemoRole(role);
      }
      expect(store.user, same(_account));
      expect(store.activeRole, UserRole.hqAdmin);
      expect(notified, 0);
    });

    test('a role switch cannot sign anyone in', () {
      final store = DemoStore(loadDelay: Duration.zero, demo: false);
      store.switchDemoRole(UserRole.hqAdmin);
      expect(store.user, isNull);
    });

    test('simulated offline, loading and upload failures stay off', () async {
      final store = await _signedIn();
      store.setDemoOptions(
        offline: true,
        failLoads: true,
        emptyTracker: true,
        emptyRecords: true,
        failNextUpload: true,
        locationPermissionDenied: true,
      );
      expect(store.offline, isFalse);
      expect(store.failLoads, isFalse);
      expect(store.emptyTracker, isFalse);
      expect(store.emptyRecords, isFalse);
      expect(store.failNextUpload, isFalse);
      expect(store.locationPermissionDenied, isFalse);
      expect(store.optionsVersion, 0);
    });

    test('a simulated newer record does nothing', () async {
      final store = await _signedIn();
      final version = store.recordVersion;
      store.demoNewerRecord();
      expect(store.recordVersion, version);
    });

    testWidgets('a Society Officer sees their own assignment, not a sample', (
      tester,
    ) async {
      final store = (await tester.runAsync(
        () => _signedIn(user: _officerAccount),
      ))!;
      await _pumpMore(tester, store);
      expect(find.text('Society Officer · 2 societies'), findsOneWidget);
      expect(find.textContaining(store.society.nameEn), findsNothing);
    });

    test('starts with no sample notifications', () async {
      final store = await _signedIn();
      expect(store.notifications, isEmpty);
      expect(store.unreadNotificationCount, 0);
    });
  });

  group('in a demo build', () {
    testWidgets('the demo controls are still there', (tester) async {
      final store = (await tester.runAsync(() => _signedIn(demo: true)))!;
      await _pumpMore(tester, store);
      await tester.tap(find.byTooltip('Demo options'));
      await tester.pumpAndSettle();
      expect(find.text('Demo options'), findsOneWidget);
      expect(find.text('Preview role home'), findsOneWidget);
      expect(find.text('Next upload fails'), findsOneWidget);
    });

    test('the role switch and simulated states still work', () async {
      final store = await _signedIn(demo: true);
      store.switchDemoRole(UserRole.districtManager);
      expect(store.activeRole, UserRole.districtManager);
      store.setDemoOptions(offline: true);
      expect(store.offline, isTrue);
    });
  });
}
