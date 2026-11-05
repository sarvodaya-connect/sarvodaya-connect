import 'dart:convert';
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../models/user.dart';
import 'auth_service.dart';
import 'cognito_auth.dart';

class IdentityApi {
  IdentityApi({
    http.Client? client,
    String? baseUrl,
    DateTime Function()? clock,
  }) : _client = client ?? http.Client(),
       _clock = clock ?? DateTime.now,
       baseUrl = baseUrl ?? defaultBaseUrl;
  static const _configuredBaseUrl = String.fromEnvironment('API_BASE_URL');

  /// V5 PR 10: why a release build cannot reach the API, or null when it can.
  /// Release builds need `--dart-define=API_BASE_URL=https://…/api/v1`; they
  /// never fall back to a developer machine, and never use plain HTTP.
  static String? configurationProblem({
    bool release = kReleaseMode,
    String configured = _configuredBaseUrl,
  }) {
    if (!release) return null;
    if (configured.isEmpty) {
      return 'This build has no server address. Rebuild it with --dart-define=API_BASE_URL=https://<api>/api/v1.';
    }
    final uri = Uri.tryParse(configured);
    if (uri == null || uri.scheme != 'https' || uri.host.isEmpty) {
      return 'The server address must start with https://.';
    }
    return null;
  }

  static String get defaultBaseUrl {
    const configured = _configuredBaseUrl;
    if (configured.isNotEmpty) return configured;
    if (kIsWeb) return 'http://localhost:3001/api/v1';
    return defaultTargetPlatform == TargetPlatform.android
        ? 'http://10.0.2.2:3001/api/v1'
        : 'http://127.0.0.1:3001/api/v1';
  }

  final http.Client _client;
  final DateTime Function() _clock;
  final String baseUrl;
  String? token;
  VoidCallback? onUnauthorized;

  /// Cognito: when the access token expires, and how to get a new one
  /// (false when the sign-in has ended). Null with local sessions.
  DateTime? tokenExpiresAt;

  /// The clock used for token expiry (replaceable in tests).
  DateTime now() => _clock();
  Future<bool> Function()? refreshSession;

  /// Gets a new access token a minute before the current one expires.
  Future<void> _freshToken() async {
    final expires = tokenExpiresAt;
    final refresh = refreshSession;
    if (token == null || expires == null || refresh == null) return;
    if (_clock().isBefore(expires.subtract(const Duration(minutes: 1)))) {
      return;
    }
    final refreshing = token;
    if (!await refresh()) {
      // Another account may have signed in while this was on its way.
      if (token == refreshing) {
        token = null;
        onUnauthorized?.call();
      }
      throw const IdentityError(401, 'Sign in to continue');
    }
  }

  Future<dynamic> request(
    String path, {
    Map<String, dynamic>? body,
    String method = 'GET',

    /// Sign-in only: the new token being checked, before it is kept.
    String? bearer,
  }) async {
    if (bearer == null) await _freshToken();
    final request = http.Request(method, Uri.parse('$baseUrl$path'));
    request.headers['Content-Type'] = 'application/json';
    final authorization = bearer ?? token;
    if (authorization != null) {
      request.headers['Authorization'] = 'Bearer $authorization';
    }
    if (body != null) request.body = jsonEncode(body);
    try {
      final response = await http.Response.fromStream(
        await _client.send(request).timeout(const Duration(seconds: 20)),
      );
      dynamic data;
      try {
        data = jsonDecode(response.body);
      } on FormatException {
        throw const AuthServiceException();
      }
      // A refusal ends the session only if it is for the token still in use,
      // not one from an account that has since signed out.
      if (response.statusCode == 401 &&
          bearer == null &&
          token != null &&
          token == authorization) {
        token = null;
        onUnauthorized?.call();
      }
      if (response.statusCode >= 400) {
        throw IdentityError(
          response.statusCode,
          data is Map &&
                  (data['error']?['message'] ?? data['message']) is String
              ? (data['error']?['message'] ?? data['message']) as String
              : 'Please check your details and try again.',
        );
      }
      return data;
    } on http.ClientException {
      throw const AuthNetworkException();
    } on TimeoutException {
      throw const AuthNetworkException();
    }
  }
}

class IdentityError implements Exception {
  const IdentityError(this.status, this.message);
  final int status;
  final String message;
}

class ApiAuthService implements AuthService {
  ApiAuthService(this.api, {this.cognito});
  final IdentityApi api;

  /// Set when this build signs in with Amazon Cognito; null for local sessions.
  final CognitoClient? cognito;
  String? _refreshToken;

  @override
  Future<AuthSession?> signIn({
    required String username,
    required String password,
  }) async {
    final cognito = this.cognito;
    if (cognito != null) return _cognitoSignIn(cognito, username, password);
    try {
      final data = await api.request(
        '/identity/login',
        method: 'POST',
        body: {'username': username, 'password': password},
      );
      api.token = data['token'] as String;
      return AuthSession(
        user: AuthenticatedUser.fromJson(data['user'] as Map<String, dynamic>),
      );
    } on IdentityError catch (e) {
      if (e.status == 401 && e.message.startsWith('Too many attempts')) {
        throw const AuthLockedException();
      }
      if (e.status == 401) return null;
      throw const AuthServiceException();
    }
  }

  /// Cognito checks the password; the API then says who this is, with the
  /// role and scope from its own records. Tokens are kept in memory only.
  Future<AuthSession?> _cognitoSignIn(
    CognitoClient cognito,
    String username,
    String password,
  ) async {
    final CognitoTokens tokens;
    try {
      tokens = await cognito.signIn(username.trim().toLowerCase(), password);
    } on CognitoRefusedException {
      return null;
    }
    dynamic me;
    try {
      me = await api.request('/identity/me', bearer: tokens.accessToken);
    } on IdentityError catch (e) {
      // A Cognito user with no active account here (unlinked or disabled).
      if (tokens.refreshToken != null) {
        await cognito.revoke(tokens.refreshToken!).catchError((Object _) {});
      }
      if (e.status == 401 || e.status == 403) {
        throw const AuthAccountNotReadyException();
      }
      throw const AuthServiceException();
    }
    _keep(tokens);
    _refreshToken = tokens.refreshToken;
    api.refreshSession = _refresh;
    return AuthSession(
      user: AuthenticatedUser.fromJson(me as Map<String, dynamic>),
    );
  }

  void _keep(CognitoTokens tokens) {
    api.token = tokens.accessToken;
    api.tokenExpiresAt = api.now().add(tokens.expiresIn);
  }

  Future<bool> _refresh() async {
    final cognito = this.cognito;
    final refreshToken = _refreshToken;
    if (cognito == null || refreshToken == null) return false;
    try {
      final tokens = await cognito.refresh(refreshToken);
      // Signed out while this was on its way: the session it renews has ended.
      if (_refreshToken != refreshToken) return false;
      _keep(tokens);
      return true;
    } on CognitoRefusedException {
      // Signed out elsewhere, password reset by HQ, disabled, or too old.
      if (_refreshToken == refreshToken) _refreshToken = null;
      return false;
    }
  }

  /// Ends the sign-in on the server too, then forgets every token.
  Future<void> signOut() async {
    final refreshToken = _refreshToken;
    final signingOut = api.token;
    final hadToken = signingOut != null;
    _refreshToken = null;
    api.refreshSession = null;
    api.tokenExpiresAt = null;
    try {
      if (cognito != null && refreshToken != null) {
        await cognito!.revoke(refreshToken);
      } else if (cognito == null && hadToken) {
        await api.request('/identity/logout', method: 'POST');
      }
    } catch (_) {
      // Signing out on the phone still works without a connection.
    } finally {
      // The next account may have signed in by now; its token stays.
      if (api.token == signingOut) api.token = null;
    }
  }
}
