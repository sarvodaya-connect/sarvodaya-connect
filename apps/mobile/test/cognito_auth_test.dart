import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sarvodaya_connect_mobile/src/auth/api_auth_service.dart';
import 'package:sarvodaya_connect_mobile/src/auth/auth_service.dart';
import 'package:sarvodaya_connect_mobile/src/auth/cognito_auth.dart';
import 'package:sarvodaya_connect_mobile/src/app.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';

/// Cognito sign-in on the phone. Every request goes to a MockClient: nothing
/// contacts AWS or the API, and every value is fictional.
const pool = 'ap-southeast-1_Fictional1';
const settings = CognitoSettings(
  region: 'ap-southeast-1',
  userPoolId: pool,
  clientId: 'fictionalclient1',
);

http.Response json(Object body, [int status = 200]) =>
    http.Response(jsonEncode(body), status);

final signedIn = {
  'AuthenticationResult': {
    'AccessToken': 'access.token.one',
    'ExpiresIn': 3600,
    'RefreshToken': 'fictional-refresh',
  },
};
final dmUser = {
  'id': 'u1',
  'displayName': 'Fictional DM',
  'roles': ['DISTRICT_MANAGER'],
  'districtIds': ['d1'],
  'societyIds': <String>[],
};

bool isCognito(http.BaseRequest r) => r.url.host.startsWith('cognito-idp.');
String target(http.Request r) => r.headers['X-Amz-Target']!.split('.').last;

void main() {
  group('CognitoSettings', () {
    test('release builds use Cognito; debug builds use local sign-in', () {
      expect(CognitoSettings.useCognito(release: true, provider: ''), isTrue);
      expect(CognitoSettings.useCognito(release: false, provider: ''), isFalse);
      expect(
        CognitoSettings.useCognito(release: false, provider: 'cognito'),
        isTrue,
      );
    });

    test('a release build fails closed without valid Cognito ids', () {
      String? problem({
        String provider = '',
        String userPoolId = pool,
        String clientId = 'fictionalclient1',
        String region = '',
      }) => CognitoSettings.configurationProblem(
        release: true,
        provider: provider,
        userPoolId: userPoolId,
        clientId: clientId,
        region: region,
      );
      expect(problem(), isNull);
      expect(problem(userPoolId: ''), contains('COGNITO_USER_POOL_ID'));
      expect(problem(clientId: ''), contains('COGNITO_CLIENT_ID'));
      expect(problem(userPoolId: 'not-a-pool'), isNotNull);
      expect(problem(region: 'us-east-1'), contains('does not match'));
      expect(problem(provider: 'local'), contains('development sign-in'));
      expect(problem(provider: 'saml'), contains('AUTH_PROVIDER'));
      expect(
        CognitoSettings.configurationProblem(
          release: false,
          provider: '',
          userPoolId: '',
          clientId: '',
          region: '',
        ),
        isNull,
      );
      expect(
        CognitoSettings.fromEnvironment(
          release: true,
          provider: '',
          userPoolId: pool,
          clientId: 'fictionalclient1',
        )?.region,
        'ap-southeast-1',
      );
    });
  });

  group('Cognito sign-in', () {
    late List<http.Request> calls;
    late List<http.Response> cognitoReplies;
    late http.Response Function(http.Request) apiReply;
    late IdentityApi api;
    late ApiAuthService auth;
    var now = DateTime(2026, 11, 3, 9);

    setUp(() {
      calls = [];
      cognitoReplies = [];
      apiReply = (_) => json(dmUser);
      final client = MockClient((r) async {
        calls.add(r);
        return isCognito(r) ? cognitoReplies.removeAt(0) : apiReply(r);
      });
      api = IdentityApi(
        baseUrl: 'https://api.invalid/api/v1',
        client: client,
        clock: () => now,
      );
      auth = ApiAuthService(
        api,
        cognito: CognitoClient(settings, client: client),
      );
    });

    test(
      'signs in with Cognito, then the API gives the role; no client secret',
      () async {
        cognitoReplies.add(json(signedIn));
        final session = await auth.signIn(
          username: ' Fictional.DM ',
          password: 'fictional-pass-1',
        );
        expect(session!.user.primaryRole, UserRole.districtManager);
        expect(api.token, 'access.token.one');
        final cognitoCall = calls.first;
        expect(
          cognitoCall.url.toString(),
          'https://cognito-idp.ap-southeast-1.amazonaws.com/',
        );
        expect(target(cognitoCall), 'InitiateAuth');
        final body = jsonDecode(cognitoCall.body) as Map<String, dynamic>;
        expect(body['AuthFlow'], 'USER_PASSWORD_AUTH');
        expect(body['ClientId'], 'fictionalclient1');
        expect(body['AuthParameters'], {
          'USERNAME': 'fictional.dm',
          'PASSWORD': 'fictional-pass-1',
        });
        expect(calls[1].url.path, '/api/v1/identity/me');
        expect(calls[1].headers['Authorization'], 'Bearer access.token.one');
        expect(calls.where((r) => r.url.path.endsWith('/login')), isEmpty);
      },
    );

    test('a wrong password is a plain refusal; too many is locked', () async {
      cognitoReplies.add(
        json({
          '__type': 'NotAuthorizedException',
          'message': 'Incorrect username or password.',
        }, 400),
      );
      expect(
        await auth.signIn(username: 'someone', password: 'wrong-pass-1'),
        isNull,
      );
      cognitoReplies.add(
        json({
          '__type': 'NotAuthorizedException',
          'message': 'Password attempts exceeded',
        }, 400),
      );
      await expectLater(
        auth.signIn(username: 'someone', password: 'wrong-pass-1'),
        throwsA(isA<AuthLockedException>()),
      );
      expect(api.token, isNull);
    });

    test(
      'an account the API refuses (unlinked or disabled) is signed out again',
      () async {
        cognitoReplies
          ..add(json(signedIn))
          ..add(json({}));
        apiReply = (_) => json({
          'error': {'message': 'Sign in to continue'},
        }, 401);
        await expectLater(
          auth.signIn(username: 'fictional.gone', password: 'fictional-1'),
          throwsA(isA<AuthAccountNotReadyException>()),
        );
        expect(target(calls.last), 'RevokeToken');
        expect(api.token, isNull);
      },
    );

    test('a challenge or an outage gives a safe error', () async {
      cognitoReplies.add(json({'ChallengeName': 'NEW_PASSWORD_REQUIRED'}));
      await expectLater(
        auth.signIn(username: 'fictional.new', password: 'fictional-1'),
        throwsA(isA<AuthAccountNotReadyException>()),
      );
      cognitoReplies.add(http.Response('<html>Unavailable</html>', 503));
      await expectLater(
        auth.signIn(username: 'fictional.new', password: 'fictional-1'),
        throwsA(isA<AuthServiceException>()),
      );
    });

    test('refreshes the access token before it expires, and signs out when Cognito refuses', () async {
      var signedOut = 0;
      api.onUnauthorized = () => signedOut++;
      cognitoReplies.add(json(signedIn));
      await auth.signIn(username: 'fictional.dm', password: 'fictional-1');

      now = now.add(const Duration(minutes: 59, seconds: 30));
      cognitoReplies.add(
        json({
          'AuthenticationResult': {
            'AccessToken': 'access.token.two',
            'ExpiresIn': 3600,
          },
        }),
      );
      await api.request('/home');
      final refresh = calls[calls.length - 2];
      expect(
        (jsonDecode(refresh.body) as Map)['AuthFlow'],
        'REFRESH_TOKEN_AUTH',
      );
      expect(calls.last.headers['Authorization'], 'Bearer access.token.two');

      // HQ reset the password: Cognito no longer accepts the refresh token.
      now = now.add(const Duration(hours: 1));
      cognitoReplies.add(
        json({
          '__type': 'NotAuthorizedException',
          'message': 'Refresh Token has been revoked',
        }, 400),
      );
      await expectLater(api.request('/home'), throwsA(isA<IdentityError>()));
      expect(api.token, isNull);
      expect(signedOut, 1);
    });

    test('sign-out revokes the refresh token and forgets the tokens', () async {
      cognitoReplies.add(json(signedIn));
      await auth.signIn(username: 'fictional.dm', password: 'fictional-1');
      cognitoReplies.add(json({}));
      await auth.signOut();
      expect(target(calls.last), 'RevokeToken');
      expect(jsonDecode(calls.last.body), {
        'ClientId': 'fictionalclient1',
        'Token': 'fictional-refresh',
      });
      expect(api.token, isNull);
      expect(api.tokenExpiresAt, isNull);
    });
  });

  testWidgets('M03: an account HQ has not finished gets a clear message', (
    tester,
  ) async {
    final store = DemoStore(
      loadDelay: Duration.zero,
      showSplash: false,
      languageChosen: true,
      authService: _NotReady(),
    );
    await tester.pumpWidget(SarvodayaConnectApp(store: store));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).first, 'fictional.new');
    await tester.enterText(find.byType(TextFormField).last, 'fictional-pass-1');
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.pumpAndSettle();
    expect(
      find.text('This account cannot sign in yet. Ask HQ to check it.'),
      findsOneWidget,
    );
    expect(find.text('fictional-pass-1'), findsNothing);
    expect(store.user, isNull);
  });
}

class _NotReady implements AuthService {
  @override
  Future<AuthSession?> signIn({
    required String username,
    required String password,
  }) async => throw const AuthAccountNotReadyException();
}
