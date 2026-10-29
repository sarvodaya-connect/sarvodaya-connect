import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sarvodaya_connect_mobile/src/auth/api_auth_service.dart';
import 'package:sarvodaya_connect_mobile/src/auth/auth_service.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';

void main() {
  test(
    'API sign-in maps the DDM role and stores only an opaque session',
    () async {
      final api = IdentityApi(
        baseUrl: 'http://test.invalid',
        client: MockClient((r) async {
          expect(r.url.path, '/identity/login');
          return http.Response(
            jsonEncode({
              'token': 'fictional-token',
              'user': {
                'id': 'u',
                'displayName': 'Test DDM',
                'roles': ['DEPUTY_DISTRICT_MANAGER'],
                'districtIds': ['d'],
                'societyIds': ['s'],
              },
            }),
            200,
          );
        }),
      );
      final session = await ApiAuthService(api)
          .signIn(username: 'test.ddm', password: 'fictional-password');
      expect(session!.user.primaryRole, UserRole.deputyDistrictManager);
      expect(api.token, 'fictional-token');
      expect(session.requiresSetup, isFalse);
    },
  );
  test('expired session is cleared and calls the sign-out boundary', () async {
    var signedOut = 0;
    final api =
        IdentityApi(
            baseUrl: 'http://test.invalid',
            client: MockClient((r) async {
              expect(r.headers['Authorization'], 'Bearer fictional-token');
              return http.Response(
                jsonEncode({
                  'error': {'message': 'Sign in to continue'},
                }),
                401,
              );
            }),
          )
          ..token = 'fictional-token'
          ..onUnauthorized = () => signedOut++;
    await expectLater(
      api.request('/identity/me'),
      throwsA(isA<IdentityError>()),
    );
    expect(api.token, isNull);
    expect(signedOut, 1);
  });
  test(
    'non-JSON service failure becomes an authentication service error',
    () async {
      final api = IdentityApi(
        baseUrl: 'http://test.invalid',
        client: MockClient(
          (r) async => http.Response('<html>Unavailable</html>', 503),
        ),
      );
      await expectLater(
        ApiAuthService(api).signIn(username: 'test', password: 'fictional'),
        throwsA(isA<AuthServiceException>()),
      );
    },
  );
}
