import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'auth_service.dart';

/// Amazon Cognito sign-in settings, from `--dart-define` values. The app
/// client is public: there is no client secret and no AWS credential in the
/// app. Only the user pool id and app client id are needed; neither is secret.
class CognitoSettings {
  const CognitoSettings({
    required this.region,
    required this.userPoolId,
    required this.clientId,
  });

  final String region;
  final String userPoolId;
  final String clientId;

  static const _provider = String.fromEnvironment('AUTH_PROVIDER');
  static const _pool = String.fromEnvironment('COGNITO_USER_POOL_ID');
  static const _client = String.fromEnvironment('COGNITO_CLIENT_ID');
  static const _region = String.fromEnvironment('COGNITO_REGION');

  static final _poolPattern = RegExp(
    r'^([a-z]{2}(?:-[a-z]+)+-\d)_[A-Za-z0-9]+$',
  );
  static final _clientPattern = RegExp(r'^[A-Za-z0-9]{1,128}$');

  /// AUTH_PROVIDER: Cognito by default in release builds; the API's local
  /// passwords by default in debug builds and tests.
  static bool useCognito({
    bool release = kReleaseMode,
    String provider = _provider,
  }) => provider.isEmpty ? release : provider.toLowerCase() == 'cognito';

  /// Why sign-in cannot work in this build, or null when it can. Release
  /// builds never use local passwords, and fail closed without Cognito ids.
  static String? configurationProblem({
    bool release = kReleaseMode,
    String provider = _provider,
    String userPoolId = _pool,
    String clientId = _client,
    String region = _region,
  }) {
    final mode = provider.toLowerCase();
    if (mode.isNotEmpty && mode != 'local' && mode != 'cognito') {
      return 'AUTH_PROVIDER must be "cognito" or "local".';
    }
    if (release && mode == 'local') {
      return 'This build uses development sign-in. Rebuild it with --dart-define=AUTH_PROVIDER=cognito and the Cognito ids.';
    }
    if (!useCognito(release: release, provider: provider)) return null;
    final poolRegion = _poolPattern.firstMatch(userPoolId)?.group(1);
    if (poolRegion == null || !_clientPattern.hasMatch(clientId)) {
      return 'This build has no sign-in settings. Rebuild it with --dart-define=COGNITO_USER_POOL_ID=… and --dart-define=COGNITO_CLIENT_ID=….';
    }
    if (region.isNotEmpty && region != poolRegion) {
      return 'COGNITO_REGION does not match COGNITO_USER_POOL_ID.';
    }
    return null;
  }

  /// The settings for this build, or null when it uses local sign-in.
  static CognitoSettings? fromEnvironment({
    bool release = kReleaseMode,
    String provider = _provider,
    String userPoolId = _pool,
    String clientId = _client,
  }) {
    if (!useCognito(release: release, provider: provider)) return null;
    final region = _poolPattern.firstMatch(userPoolId)?.group(1);
    if (region == null || !_clientPattern.hasMatch(clientId)) return null;
    return CognitoSettings(
      region: region,
      userPoolId: userPoolId,
      clientId: clientId,
    );
  }
}

class CognitoTokens {
  const CognitoTokens({
    required this.accessToken,
    required this.expiresIn,
    this.refreshToken,
  });
  final String accessToken;
  final Duration expiresIn;
  final String? refreshToken;
}

/// The username or password is wrong, or the refresh token no longer works.
class CognitoRefusedException implements Exception {
  const CognitoRefusedException();
}

/// Calls the Cognito user pool's public API (no AWS credentials) for sign-in,
/// refresh and sign-out. Tokens are kept in memory by the caller only.
class CognitoClient {
  CognitoClient(this.settings, {http.Client? client})
    : _client = client ?? http.Client();

  final CognitoSettings settings;
  final http.Client _client;

  Future<Map<String, dynamic>> _call(
    String target,
    Map<String, dynamic> body,
  ) async {
    http.Response response;
    try {
      response = await _client
          .post(
            Uri.parse('https://cognito-idp.${settings.region}.amazonaws.com/'),
            headers: {
              'Content-Type': 'application/x-amz-json-1.1',
              'X-Amz-Target': 'AWSCognitoIdentityProviderService.$target',
            },
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 20));
    } on http.ClientException {
      throw const AuthNetworkException();
    } on TimeoutException {
      throw const AuthNetworkException();
    }
    Map<String, dynamic> data;
    try {
      final decoded = jsonDecode(response.body);
      data = decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
    } on FormatException {
      data = <String, dynamic>{};
    }
    if (response.statusCode == 200) return data;
    final type = '${data['__type'] ?? ''}'.split('#').last;
    final message = '${data['message'] ?? ''}';
    if (type == 'NotAuthorizedException' &&
        message.toLowerCase().contains('attempts exceeded')) {
      throw const AuthLockedException();
    }
    if (type == 'NotAuthorizedException' || type == 'UserNotFoundException') {
      throw const CognitoRefusedException();
    }
    if (type == 'PasswordResetRequiredException' ||
        type == 'UserNotConfirmedException') {
      throw const AuthAccountNotReadyException();
    }
    throw const AuthServiceException();
  }

  CognitoTokens _tokens(Map<String, dynamic> data) {
    final result = data['AuthenticationResult'];
    if (result is! Map || result['AccessToken'] is! String) {
      // A challenge (for example a new password) means HQ did not finish the account.
      throw data['ChallengeName'] != null
          ? const AuthAccountNotReadyException()
          : const AuthServiceException();
    }
    return CognitoTokens(
      accessToken: result['AccessToken'] as String,
      expiresIn: Duration(
        seconds: (result['ExpiresIn'] as num?)?.toInt() ?? 3600,
      ),
      refreshToken: result['RefreshToken'] as String?,
    );
  }

  /// Username and password sign-in (USER_PASSWORD_AUTH on the app client).
  Future<CognitoTokens> signIn(String username, String password) async =>
      _tokens(
        await _call('InitiateAuth', {
          'AuthFlow': 'USER_PASSWORD_AUTH',
          'ClientId': settings.clientId,
          'AuthParameters': {'USERNAME': username, 'PASSWORD': password},
        }),
      );

  Future<CognitoTokens> refresh(String refreshToken) async => _tokens(
    await _call('InitiateAuth', {
      'AuthFlow': 'REFRESH_TOKEN_AUTH',
      'ClientId': settings.clientId,
      'AuthParameters': {'REFRESH_TOKEN': refreshToken},
    }),
  );

  Future<void> revoke(String refreshToken) async {
    await _call('RevokeToken', {
      'ClientId': settings.clientId,
      'Token': refreshToken,
    });
  }
}
