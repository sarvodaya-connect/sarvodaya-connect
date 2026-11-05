import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sarvodaya_connect_mobile/src/auth/api_auth_service.dart';
import 'package:sarvodaya_connect_mobile/src/auth/auth_service.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/national/demo_national_api.dart';
import 'package:sarvodaya_connect_mobile/src/national/national_screens.dart';
import 'package:sarvodaya_connect_mobile/src/sarvoai/sarvoai_screen.dart';
import 'package:sarvodaya_connect_mobile/src/screens/notifications_screen.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';
import 'package:sarvodaya_connect_mobile/src/widgets/brand.dart';
import 'package:sarvodaya_connect_mobile/src/widgets/masthead.dart';

/// Issue #98: the HQ masthead (M05h). Everyone here is fictional.
const _account = AuthenticatedUser(
  id: 'fictional-hq',
  displayName: 'Nadeesha Fictional',
  roles: [UserRole.hqAdmin],
  societyIds: [],
);

class _SignedIn implements AuthService {
  @override
  Future<AuthSession?> signIn({
    required String username,
    required String password,
  }) async => const AuthSession(user: _account);
}

Map<String, dynamic> _note(int index) => {
  'id': 'n$index',
  'category': 'REQUEST',
  'title': 'Fictional notification $index',
  'read': false,
  'createdAt': '2026-11-03T04:00:00.000Z',
};

/// The API as it answers `GET /notifications`: one page, and the true total.
http.Response _page({required int unread, required int onPage}) =>
    http.Response(
      jsonEncode({
        'data': [for (var i = 0; i < onPage; i++) _note(i)],
        'meta': {'unreadCount': unread},
      }),
      200,
      headers: {'content-type': 'application/json'},
    );

Future<DemoStore> _live(
  WidgetTester tester, {
  required Future<http.Response> Function(http.Request) server,
  Size size = const Size(390, 844),
  double textScale = 1,
  EdgeInsets safeArea = EdgeInsets.zero,
  DateTime? now,
}) async {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final store = DemoStore(
    demo: false,
    loadDelay: Duration.zero,
    clock: () => now ?? DateTime(2026, 11, 5, 9),
    authService: _SignedIn(),
    identityApi: IdentityApi(
      baseUrl: 'http://fictional.invalid/api/v1',
      client: MockClient(server),
    ),
    nationalApi: DemoNationalApi(user: () => _account, delay: Duration.zero),
  );
  await tester.runAsync(() => store.signIn('fictional', 'not-a-real-password'));
  await tester.pumpWidget(
    DemoScope(
      store: store,
      child: MaterialApp(
        theme: AppTheme.light(),
        home: MediaQuery(
          data: MediaQueryData(
            size: size,
            padding: safeArea,
            viewPadding: safeArea,
            textScaler: TextScaler.linear(textScale),
          ),
          child: const NationalDashboardScreen(),
        ),
      ),
    ),
  );
  await tester.runAsync(() => Future<void>.delayed(Duration.zero));
  await tester.pumpAndSettle();
  return store;
}

String _badge(WidgetTester tester) {
  final badge = tester.widget<Badge>(
    find.descendant(
      of: find.byType(NotificationsButton),
      matching: find.byType(Badge),
    ),
  );
  return badge.isLabelVisible ? (badge.label! as Text).data! : 'hidden';
}

void main() {
  testWidgets('shows the logo, buttons, heading and the account’s own name', (
    tester,
  ) async {
    await _live(tester, server: (_) async => _page(unread: 0, onPage: 0));
    expect(find.byType(BrandMark), findsOneWidget);
    expect(find.byTooltip('Search societies'), findsOneWidget);
    expect(find.byTooltip('Notifications'), findsOneWidget);
    expect(find.text('National Dashboard'), findsOneWidget);
    expect(find.text('Good morning, Nadeesha · HQ · National'), findsOneWidget);
    expect(
      find.textContaining('Ask Sarvo', findRichText: true),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: find.byType(Stack),
        matching: find.byWidgetPredicate(
          (widget) => widget is CustomPaint && widget.painter is HillsPainter,
        ),
      ),
      findsOneWidget,
    );
  });

  testWidgets('keeps HQ only at the right edge at normal text size', (
    tester,
  ) async {
    await _live(tester, server: (_) async => _page(unread: 0, onPage: 0));
    expect(tester.getTopRight(find.text('HQ only')).dx, greaterThan(340));
  });

  testWidgets('the badge shows the server’s true total, not one page', (
    tester,
  ) async {
    await _live(tester, server: (_) async => _page(unread: 73, onPage: 50));
    expect(_badge(tester), '73');
  });

  testWidgets('no unread notifications means no badge', (tester) async {
    await _live(tester, server: (_) async => _page(unread: 0, onPage: 0));
    expect(_badge(tester), 'hidden');
  });

  testWidgets('a failed load invents no count', (tester) async {
    final store = await _live(
      tester,
      server: (_) async => http.Response('{}', 500),
    );
    expect(_badge(tester), 'hidden');
    expect(store.notificationsError, isNotNull);
    expect(tester.takeException(), isNull);
  });

  testWidgets('reading a notification lowers the badge', (tester) async {
    final store = await _live(
      tester,
      server: (request) async => request.method == 'POST'
          ? http.Response('{}', 200)
          : _page(unread: 73, onPage: 50),
    );
    store.markNotificationRead('n1');
    await tester.pump();
    expect(_badge(tester), '72');
    store.markAllNotificationsRead();
    await tester.pump();
    expect(_badge(tester), 'hidden');
  });

  test('signing out forgets the account’s notifications', () async {
    final store = DemoStore(
      demo: false,
      loadDelay: Duration.zero,
      authService: _SignedIn(),
      identityApi: IdentityApi(
        baseUrl: 'http://fictional.invalid/api/v1',
        client: MockClient((_) async => _page(unread: 9, onPage: 9)),
      ),
    );
    await store.loadNotifications();
    expect(store.unreadNotificationCount, 9);
    store.signOut();
    expect(store.unreadNotificationCount, 0);
    expect(store.notifications, isEmpty);
  });

  test('simultaneous loads share one request', () async {
    var requests = 0;
    final store = DemoStore(
      demo: false,
      loadDelay: Duration.zero,
      authService: _SignedIn(),
      identityApi: IdentityApi(
        baseUrl: 'http://fictional.invalid/api/v1',
        client: MockClient((_) async {
          requests++;
          return _page(unread: 1, onPage: 1);
        }),
      ),
    );
    await Future.wait([store.loadNotifications(), store.loadNotifications()]);
    expect(requests, 1);
    await store.loadNotifications();
    expect(requests, 2);
  });

  testWidgets('the bell opens Notifications', (tester) async {
    await _live(tester, server: (_) async => _page(unread: 2, onPage: 2));
    await tester.tap(find.byTooltip('Notifications'));
    await tester.runAsync(() => Future<void>.delayed(Duration.zero));
    await tester.pumpAndSettle();
    expect(find.byType(NotificationsScreen), findsOneWidget);
  });

  testWidgets('search opens the Societies search, ready to type', (
    tester,
  ) async {
    await _live(tester, server: (_) async => _page(unread: 0, onPage: 0));
    await tester.tap(find.byTooltip('Search societies'));
    await tester.pumpAndSettle();
    expect(find.byType(NationalSocietiesScreen), findsOneWidget);
    final field = tester.widget<TextField>(find.byType(TextField));
    expect(field.autofocus, isTrue);
    expect(field.decoration?.hintText, 'Name or S number');
  });

  testWidgets('Ask SarvoAI still opens SarvoAI', (tester) async {
    await _live(tester, server: (_) async => _page(unread: 0, onPage: 0));
    await tester.tap(find.textContaining('Ask Sarvo', findRichText: true));
    await tester.pumpAndSettle();
    expect(find.byType(SarvoAiScreen), findsOneWidget);
  });

  testWidgets('stays below the iPhone notch', (tester) async {
    await _live(
      tester,
      server: (_) async => _page(unread: 0, onPage: 0),
      safeArea: const EdgeInsets.only(top: 59, bottom: 34),
    );
    expect(
      tester.getTopLeft(find.byType(BrandMark)).dy,
      greaterThanOrEqualTo(59),
    );
  });

  for (final (name, size, scale) in [
    ('a small phone', const Size(320, 568), 1.0),
    ('a small phone with larger text', const Size(320, 568), 1.6),
    ('a small phone with the largest text', const Size(320, 568), 3.1),
    ('a large phone with the largest text', const Size(430, 932), 3.1),
  ]) {
    testWidgets('lays out without overflow on $name', (tester) async {
      await _live(
        tester,
        server: (_) async => _page(unread: 128, onPage: 50),
        size: size,
        textScale: scale,
      );
      expect(tester.takeException(), isNull);
      expect(find.text('National Dashboard'), findsOneWidget);
      expect(find.byTooltip('Notifications'), findsOneWidget);
    });
  }
}
