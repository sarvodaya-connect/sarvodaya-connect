import 'dart:convert';
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../models/user.dart';
import 'auth_service.dart';

class IdentityApi {
  IdentityApi({http.Client? client, String? baseUrl})
    : _client = client ?? http.Client(),
      baseUrl = baseUrl ?? defaultBaseUrl;
  static String get defaultBaseUrl {
    const configured = String.fromEnvironment('API_BASE_URL');
    if (configured.isNotEmpty) return configured;
    if (kIsWeb) return 'http://localhost:3001/api/v1';
    return defaultTargetPlatform == TargetPlatform.android
        ? 'http://10.0.2.2:3001/api/v1'
        : 'http://127.0.0.1:3001/api/v1';
  }

  final http.Client _client;
  final String baseUrl;
  String? token;
  VoidCallback? onUnauthorized;
  Future<dynamic> request(
    String path, {
    Map<String, dynamic>? body,
    String method = 'GET',
  }) async {
    final request = http.Request(method, Uri.parse('$baseUrl$path'));
    request.headers['Content-Type'] = 'application/json';
    if (token != null) request.headers['Authorization'] = 'Bearer $token';
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
      if (response.statusCode == 401 && token != null) {
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
  ApiAuthService(this.api);
  final IdentityApi api;
  @override
  Future<AuthSession?> signIn({
    required String username,
    required String password,
  }) async {
    try {
      final data = await api.request(
        '/identity/login',
        method: 'POST',
        body: {'username': username, 'password': password},
      );
      api.token = data['token'] as String;
      return AuthSession(
        user: AuthenticatedUser.fromJson(data['user'] as Map<String, dynamic>),
        requiresSetup: false,
      );
    } on IdentityError catch (e) {
      if (e.status == 401) return null;
      throw const AuthServiceException();
    }
  }
}
