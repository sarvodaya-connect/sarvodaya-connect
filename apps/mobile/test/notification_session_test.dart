import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sarvodaya_connect_mobile/src/auth/api_auth_service.dart';
import 'package:sarvodaya_connect_mobile/src/auth/auth_service.dart';
import 'package:sarvodaya_connect_mobile/src/auth/cognito_auth.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';

/// A notification request belongs to the session that started it: nothing from
/// an earlier account may reach the next one. Every response here is held back
/// until the test releases it. All accounts and values are fictional, and
/// nothing contacts a real API or AWS.
const _password = 'not-a-real-password';

Map<String, dynamic> _userJson(String name) => {
  'id': 'fictional-$name',
  'displayName': 'Fictional $name',
  'roles': ['DISTRICT_MANAGER'],
  'districtIds': ['d1'],
  'societyIds': <String>[],
};

http.Response _json(Object body, [int status = 200]) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json'},
);

/// One page of notifications, each titled after the account it belongs to.
http.Response _page(String account, {int onPage = 2, int? unread}) => _json({
  'data': [
    for (var i = 0; i < onPage; i++)
      {
        'id': '$account-$i',
        'category': 'REQUEST',
        'title': 'For $account $i',
        'read': false,
        'createdAt': '2026-11-03T04:00:00.000Z',
      },
  ],
  'meta': {'unreadCount': unread ?? onPage},
});

/// `GET /notifications` that has reached the server and is waiting for a reply.
class _Load {
  _Load(this.request);

  final http.Request request;
  final _reply = Completer<http.Response>();

  String? get bearer => request.headers['Authorization'];
  void reply(http.Response response) => _reply.complete(response);
  void fail(Object error) => _reply.completeError(error);
}

/// The API, using the real [IdentityApi] and [ApiAuthService] over a mock
/// connection, so tokens and 401 handling behave as they do in the app.
class _Server {
  final loads = <_Load>[];
  final logouts = <http.Request>[];
  Completer<void>? holdLogout;

  late final client = MockClient((request) async {
    final path = request.url.path;
    if (path.endsWith('/identity/login')) {
      final name = (jsonDecode(request.body) as Map)['username'] as String;
      return _json({'token': 'token-$name', 'user': _userJson(name)});
    }
    if (path.endsWith('/identity/logout')) {
      logouts.add(request);
      await holdLogout?.future;
      return _json({});
    }
    if (path.endsWith('/notifications')) return holdNotifications(request);
    return _json({});
  });

  Future<http.Response> holdNotifications(http.Request request) {
    final load = _Load(request);
    loads.add(load);
    return load._reply.future;
  }
}

/// Lets requests reach the server, and replies reach the store.
Future<void> _settle() async {
  for (var i = 0; i < 10; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

({DemoStore store, IdentityApi api}) _liveStore(_Server server) {
  final api = IdentityApi(
    baseUrl: 'http://fictional.invalid/api/v1',
    client: server.client,
  );
  return (
    store: DemoStore(
      demo: false,
      loadDelay: Duration.zero,
      authService: ApiAuthService(api),
      identityApi: api,
    ),
    api: api,
  );
}

void _expectOnlyB(DemoStore store, IdentityApi api) {
  expect(store.notifications.map((note) => note.title), ['For B 0', 'For B 1']);
  expect(store.unreadNotificationCount, 5);
  expect(store.notificationsError, isNull);
  expect(store.user?.id, 'fictional-B');
  expect(api.token, 'token-B');
}

void _expectNothingLoadedYet(DemoStore store, IdentityApi api) {
  expect(store.notifications, isEmpty);
  expect(store.unreadNotificationCount, 0);
  expect(store.notificationsError, isNull);
  expect(store.user?.id, 'fictional-B');
  expect(api.token, 'token-B');
}

/// Every way account A's request can end after A has gone.
final _staleOutcomes = <String, void Function(_Load)>{
  'notifications': (load) => load.reply(_page('A', onPage: 9, unread: 99)),
  'a server error': (load) => load.reply(_json({}, 500)),
  'an expired session (401)': (load) => load.reply(
    _json({
      'error': {'message': 'Sign in to continue'},
    }, 401),
  ),
  'a lost connection': (load) => load.fail(http.ClientException('fictional')),
  'an unreadable reply': (load) =>
      load.reply(http.Response('<html>Bad gateway</html>', 502)),
};

void main() {
  late _Server server;
  late DemoStore store;
  late IdentityApi api;

  setUp(() {
    server = _Server();
    final live = _liveStore(server);
    store = live.store;
    api = live.api;
  });

  /// A signs in and starts loading, A signs out, B signs in and starts loading.
  /// Both requests are left waiting on the server.
  Future<({_Load a, _Load b})> switchAccountsWithAInFlight() async {
    await store.signIn('A', _password);
    unawaited(store.loadNotifications());
    await _settle();
    store.signOut();
    await store.signIn('B', _password);
    unawaited(store.loadNotifications());
    await _settle();
    expect(server.loads, hasLength(2), reason: 'B needs its own request');
    return (a: server.loads[0], b: server.loads[1]);
  }

  group('requests are tied to the session', () {
    test('B makes its own request, with its own token', () async {
      final loads = await switchAccountsWithAInFlight();
      expect(loads.a.bearer, 'Bearer token-A');
      expect(loads.b.bearer, 'Bearer token-B');
      _expectNothingLoadedYet(store, api);
    });

    test('signing out with nobody next ignores the late reply', () async {
      await store.signIn('A', _password);
      unawaited(store.loadNotifications());
      await _settle();
      store.signOut();

      var notified = 0;
      store.addListener(() => notified++);
      server.loads.single.reply(_page('A', onPage: 9, unread: 99));
      await _settle();

      expect(store.notifications, isEmpty);
      expect(store.unreadNotificationCount, 0);
      expect(notified, 0, reason: 'a stale reply changes nothing to redraw');
    });

    test('changing account without signing out also invalidates', () async {
      await store.signIn('A', _password);
      unawaited(store.loadNotifications());
      await _settle();
      await store.signIn('B', _password);
      unawaited(store.loadNotifications());
      await _settle();
      expect(server.loads, hasLength(2));

      server.loads[0].reply(_page('A', onPage: 9, unread: 99));
      await _settle();
      _expectNothingLoadedYet(store, api);

      server.loads[1].reply(_page('B', unread: 5));
      await _settle();
      _expectOnlyB(store, api);
    });

    test('signing back in as A still ignores the earlier session', () async {
      await store.signIn('A', _password);
      unawaited(store.loadNotifications());
      await _settle();
      store.signOut();
      await store.signIn('A', _password);
      unawaited(store.loadNotifications());
      await _settle();
      expect(server.loads, hasLength(2));

      server.loads[0].reply(_page('old', onPage: 9, unread: 99));
      await _settle();
      expect(store.notifications, isEmpty);

      server.loads[1].reply(_page('A', unread: 2));
      await _settle();
      expect(store.notifications.first.title, startsWith('For A'));
      expect(store.unreadNotificationCount, 2);
    });
  });

  group('a stale result is ignored', () {
    for (final MapEntry(key: outcome, value: finish)
        in _staleOutcomes.entries) {
      test('A ending in $outcome before B completes', () async {
        final loads = await switchAccountsWithAInFlight();
        var notified = 0;
        store.addListener(() => notified++);

        finish(loads.a);
        await _settle();
        _expectNothingLoadedYet(store, api);
        expect(notified, 0);

        loads.b.reply(_page('B', unread: 5));
        await _settle();
        _expectOnlyB(store, api);
      });

      test('A ending in $outcome after B completes', () async {
        final loads = await switchAccountsWithAInFlight();

        loads.b.reply(_page('B', unread: 5));
        await _settle();
        _expectOnlyB(store, api);
        var notified = 0;
        store.addListener(() => notified++);

        finish(loads.a);
        await _settle();
        _expectOnlyB(store, api);
        expect(notified, 0);
      });
    }

    test('A’s success cannot clear B’s own error', () async {
      final loads = await switchAccountsWithAInFlight();
      loads.b.reply(_json({}, 500));
      await _settle();
      expect(store.notificationsError, isNotNull);

      loads.a.reply(_page('A', onPage: 9, unread: 99));
      await _settle();
      expect(store.notificationsError, isNotNull);
      expect(store.notifications, isEmpty);
      expect(store.unreadNotificationCount, 0);
    });

    test('B’s own failure is still reported', () async {
      final loads = await switchAccountsWithAInFlight();
      loads.a.reply(_json({}, 500));
      await _settle();
      expect(store.notificationsError, isNull);

      loads.b.reply(_json({}, 500));
      await _settle();
      expect(store.notificationsError, isNotNull);
    });
  });

  group('the old request’s cleanup leaves B’s request alone', () {
    test('B’s pending request is still shared after A completes', () async {
      final loads = await switchAccountsWithAInFlight();
      final pending = store.loadNotifications();

      loads.a.reply(_page('A'));
      await _settle();

      expect(identical(store.loadNotifications(), pending), isTrue);
      await _settle();
      expect(server.loads, hasLength(2), reason: 'no third request');

      loads.b.reply(_page('B', unread: 5));
      await pending;
      _expectOnlyB(store, api);
    });

    test('a load after B’s completes makes a new request', () async {
      final loads = await switchAccountsWithAInFlight();
      loads.b.reply(_page('B', unread: 5));
      await _settle();
      loads.a.reply(_page('A'));
      await _settle();

      unawaited(store.loadNotifications());
      await _settle();
      expect(server.loads, hasLength(3));
      expect(server.loads[2].bearer, 'Bearer token-B');
      server.loads[2].reply(_page('B', unread: 5));
      await _settle();
      _expectOnlyB(store, api);
    });

    test('A’s waiting callers finish, and change nothing', () async {
      await store.signIn('A', _password);
      final forA = store.loadNotifications();
      await _settle();
      store.signOut();
      server.loads.single.reply(_json({}, 500));
      await expectLater(forA, completes);
      expect(store.notificationsError, isNull);
    });
  });

  group('within one session', () {
    test('simultaneous loads share one request', () async {
      await store.signIn('A', _password);
      final first = store.loadNotifications();
      final second = store.loadNotifications();
      expect(identical(first, second), isTrue);
      await _settle();
      final third = store.loadNotifications();
      expect(identical(first, third), isTrue);
      await _settle();
      expect(server.loads, hasLength(1));

      server.loads.single.reply(_page('A', unread: 2));
      await Future.wait([first, second, third]);
      expect(store.notifications, hasLength(2));
      expect(store.unreadNotificationCount, 2);

      unawaited(store.loadNotifications());
      await _settle();
      expect(server.loads, hasLength(2), reason: 'finished loads are not kept');
      server.loads.last.reply(_page('A', unread: 2));
      await _settle();
    });

    test('its own 401 signs out, and leaves no error for the next', () async {
      await store.signIn('A', _password);
      unawaited(store.loadNotifications());
      await _settle();
      server.loads.single.reply(
        _json({
          'error': {'message': 'Sign in to continue'},
        }, 401),
      );
      await _settle();
      expect(store.user, isNull);
      expect(api.token, isNull);
      expect(store.notificationsError, isNull);
    });
  });

  group('signing out', () {
    test('clears the list, the count and the error', () async {
      await store.signIn('A', _password);
      unawaited(store.loadNotifications());
      await _settle();
      server.loads[0].reply(_page('A', unread: 7));
      await _settle();
      expect(store.unreadNotificationCount, 7);

      unawaited(store.loadNotifications());
      await _settle();
      server.loads[1].reply(_json({}, 500));
      await _settle();
      expect(store.notificationsError, isNotNull);

      store.signOut();
      expect(store.notifications, isEmpty);
      expect(store.unreadNotificationCount, 0);
      expect(store.notificationsError, isNull);
    });

    test('A’s logout finishing late keeps B’s token', () async {
      server.holdLogout = Completer<void>();
      await store.signIn('A', _password);
      store.signOut();
      await _settle();
      expect(server.logouts, hasLength(1));
      await store.signIn('B', _password);

      server.holdLogout!.complete();
      await _settle();
      expect(api.token, 'token-B');
      expect(store.user?.id, 'fictional-B');
    });
  });

  group('with Cognito', () {
    final refreshes = <Completer<http.Response>>[];
    final refreshTokens = <String>[];
    late DateTime now;

    setUp(() {
      refreshes.clear();
      refreshTokens.clear();
      now = DateTime(2026, 11, 5, 9);
      final client = MockClient((request) async {
        if (request.url.host.startsWith('cognito-idp.')) {
          final body = jsonDecode(request.body) as Map<String, dynamic>;
          if (request.headers['X-Amz-Target']!.endsWith('RevokeToken')) {
            return _json({});
          }
          final parameters = body['AuthParameters'] as Map<String, dynamic>;
          if (body['AuthFlow'] == 'REFRESH_TOKEN_AUTH') {
            refreshTokens.add(parameters['REFRESH_TOKEN'] as String);
            final reply = Completer<http.Response>();
            refreshes.add(reply);
            return reply.future;
          }
          final name = parameters['USERNAME'] as String;
          return _json({
            'AuthenticationResult': {
              'AccessToken': 'access-$name',
              'ExpiresIn': 3600,
              'RefreshToken': 'refresh-$name',
            },
          });
        }
        if (request.url.path.endsWith('/identity/me')) {
          final name = request.headers['Authorization']!.split('-').last;
          return _json(_userJson(name.toUpperCase()));
        }
        if (request.url.path.endsWith('/notifications')) {
          return server.holdNotifications(request);
        }
        return _json({});
      });
      api = IdentityApi(
        baseUrl: 'https://fictional.invalid/api/v1',
        client: client,
        clock: () => now,
      );
      store = DemoStore(
        demo: false,
        loadDelay: Duration.zero,
        identityApi: api,
        authService: ApiAuthService(
          api,
          cognito: CognitoClient(
            const CognitoSettings(
              region: 'ap-southeast-1',
              userPoolId: 'ap-southeast-1_Fictional1',
              clientId: 'fictionalclient1',
            ),
            client: client,
          ),
        ),
      );
    });

    /// A's token is about to expire, so A's load first waits on a refresh. A
    /// signs out and B signs in while that refresh is still with Cognito.
    Future<void> switchAccountsDuringRefresh() async {
      await store.signIn('a', _password);
      now = now.add(const Duration(minutes: 59, seconds: 30));
      unawaited(store.loadNotifications());
      await _settle();
      expect(refreshes, hasLength(1));
      store.signOut();
      await store.signIn('b', _password);
      expect(api.token, 'access-b');
    }

    test('A’s refresh finishing late cannot replace B’s token', () async {
      await switchAccountsDuringRefresh();
      refreshes.single.complete(
        _json({
          'AuthenticationResult': {
            'AccessToken': 'access-a-renewed',
            'ExpiresIn': 3600,
          },
        }),
      );
      await _settle();
      expect(api.token, 'access-b');
      expect(store.user?.id, 'fictional-B');
      expect(store.notifications, isEmpty);
      expect(store.notificationsError, isNull);
      expect(server.loads, isEmpty, reason: 'A’s load must not go out as B');
    });

    test('A’s refused refresh cannot sign B out', () async {
      await switchAccountsDuringRefresh();
      refreshes.single.complete(
        _json({
          '__type': 'NotAuthorizedException',
          'message': 'Refresh Token has been revoked',
        }, 400),
      );
      await _settle();
      expect(api.token, 'access-b');
      expect(store.user?.id, 'fictional-B');
      expect(store.notificationsError, isNull);

      // B's own refresh token is still the one kept.
      now = now.add(const Duration(minutes: 59, seconds: 30));
      unawaited(store.loadNotifications());
      await _settle();
      expect(refreshTokens, ['refresh-a', 'refresh-b']);
      refreshes.last.complete(
        _json({
          'AuthenticationResult': {
            'AccessToken': 'access-b-renewed',
            'ExpiresIn': 3600,
          },
        }),
      );
      await _settle();
      expect(api.token, 'access-b-renewed');
      expect(server.loads.single.bearer, 'Bearer access-b-renewed');
      server.loads.single.reply(_page('B', unread: 5));
      await _settle();
      expect(store.notifications.first.title, startsWith('For B'));
    });
  });

  group('in a demo build', () {
    test('notifications are fictional and survive signing out', () async {
      var requests = 0;
      final demo = DemoStore(
        demo: true,
        loadDelay: Duration.zero,
        authService: _SignedIn(),
        identityApi: IdentityApi(
          baseUrl: 'http://fictional.invalid/api/v1',
          client: MockClient((_) async {
            requests++;
            return _json({});
          }),
        ),
      );
      await demo.signIn('fictional', _password);
      final shown = demo.notifications.length;
      final unread = demo.unreadNotificationCount;
      expect(shown, greaterThan(0));

      final loading = demo.loadNotifications();
      demo.signOut();
      await loading;
      await demo.signIn('fictional', _password);
      await demo.loadNotifications();

      expect(requests, 0, reason: 'a demo build never calls the API for these');
      expect(demo.notifications, hasLength(shown));
      expect(demo.unreadNotificationCount, unread);
      expect(demo.notificationsError, isNull);

      demo.markAllNotificationsRead();
      expect(demo.unreadNotificationCount, 0);
    });

    test('simultaneous loads still share one future', () async {
      final demo = DemoStore(demo: true, loadDelay: Duration.zero);
      final first = demo.loadNotifications();
      expect(identical(demo.loadNotifications(), first), isTrue);
      await first;
    });
  });
}

class _SignedIn implements AuthService {
  @override
  Future<AuthSession?> signIn({
    required String username,
    required String password,
  }) async => const AuthSession(
    user: AuthenticatedUser(
      id: 'fictional-demo',
      displayName: 'Fictional Demo',
      roles: [UserRole.societyOfficer],
      societyIds: ['society-1'],
    ),
  );
}
