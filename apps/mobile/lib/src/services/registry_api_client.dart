import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../models/notification.dart';
import '../models/society.dart';
import '../models/user.dart';

class RegistryApiException implements Exception {
  const RegistryApiException(this.message, {this.statusCode});
  final String message;
  final int? statusCode;
  @override
  String toString() => message;
}

class RegistryApiClient {
  RegistryApiClient({http.Client? client}) : _client = client ?? http.Client();
  final http.Client _client;
  static const _configuredBaseUrl = String.fromEnvironment('SC_API_BASE_URL');
  String get _baseUrl {
    if (_configuredBaseUrl.isNotEmpty) {
      return _configuredBaseUrl.replaceFirst(RegExp(r'/$'), '');
    }
    if (kIsWeb) {
      return 'http://localhost:3001/api/v1';
    }
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:3001/api/v1';
    }
    return 'http://127.0.0.1:3001/api/v1';
  }

  String _identity(UserRole role) => switch (role) {
    UserRole.societyOfficer => 'demo-officer-sunrise',
    UserRole.programmeCoordinator => 'demo-programme-coordinator',
    UserRole.deputyDistrictManager => 'demo-deputy-district-manager',
    UserRole.districtManager => 'demo-dm-north',
    UserRole.hqAdmin => 'demo-hq-admin',
  };
  Map<String, String> _headers(UserRole role) => {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Demo-User': _identity(role),
  };

  Future<List<SocietyDetails>> listSocieties(
    UserRole role, {
    Map<String, String> filters = const {},
  }) async {
    final societies = <SocietyDetails>[];
    var page = 1;
    var totalPages = 1;
    do {
      final query = <String, String>{
        'page': '$page',
        'pageSize': '100',
        ...filters,
      };
      final response = await _client.get(
        Uri.parse('$_baseUrl/societies').replace(queryParameters: query),
        headers: _headers(role),
      );
      final payload = _decode(response);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw RegistryApiException(
          _message(payload, 'Unable to load societies'),
          statusCode: response.statusCode,
        );
      }
      final rows = (payload['data'] as List<dynamic>? ?? const []);
      societies.addAll(
        rows.map((row) => _society(row as Map<String, dynamic>)),
      );
      final meta = payload['meta'] as Map<String, dynamic>? ?? const {};
      totalPages = meta['totalPages'] as int? ?? 1;
      page++;
    } while (page <= totalPages);
    return societies;
  }

  Future<List<AppNotification>> listNotifications(UserRole role) async {
    final response = await _client.get(
      Uri.parse('$_baseUrl/notifications?page=1&pageSize=100'),
      headers: _headers(role),
    );
    final payload = _decode(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw RegistryApiException(
        _message(payload, 'Unable to load notifications'),
        statusCode: response.statusCode,
      );
    }
    return (payload['data'] as List<dynamic>? ?? const [])
        .map((row) => _notification(row as Map<String, dynamic>))
        .toList();
  }

  Future<void> markRead(UserRole role, String id) =>
      _post(role, '/notifications/$id/read');
  Future<void> markAllRead(UserRole role) =>
      _post(role, '/notifications/read-all');

  Future<void> requestGradeChange(
    UserRole role,
    String id,
    String grade,
    String rationale,
  ) async {
    final response = await _client.post(
      Uri.parse('$_baseUrl/societies/$id/grade-change-requests'),
      headers: _headers(role),
      body: jsonEncode({'proposedGrade': grade, 'rationale': rationale}),
    );
    final payload = _decode(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw RegistryApiException(
        _message(payload, 'Unable to submit grade request'),
        statusCode: response.statusCode,
      );
    }
  }

  Future<void> _post(UserRole role, String path) async {
    final response = await _client.post(
      Uri.parse('$_baseUrl$path'),
      headers: _headers(role),
    );
    final payload = _decode(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw RegistryApiException(
        _message(payload, 'Unable to update notification'),
        statusCode: response.statusCode,
      );
    }
  }

  Map<String, dynamic> _decode(http.Response response) {
    if (response.body.isEmpty) return const {};
    try {
      return jsonDecode(response.body) as Map<String, dynamic>;
    } on FormatException {
      throw RegistryApiException(
        'The server returned an invalid response',
        statusCode: response.statusCode,
      );
    }
  }

  String _message(Map<String, dynamic> payload, String fallback) =>
      ((payload['error'] as Map<String, dynamic>?)?['message'] as String?) ??
      fallback;

  SocietyDetails _society(Map<String, dynamic> row) {
    final district = row['district'] as Map<String, dynamic>? ?? const {};
    final address = row['address'] as Map<String, dynamic>? ?? const {};
    final location = row['location'] as Map<String, dynamic>?;
    final status = switch (row['status'] as String? ?? 'ACTIVE') {
      'INACTIVE' => SocietyStatus.inactive,
      'UNDER_REVIEW' => SocietyStatus.underReview,
      'SUSPENDED' => SocietyStatus.suspended,
      _ => SocietyStatus.active,
    };
    return SocietyDetails(
      id: row['id'] as String,
      societyCode: row['societyCode'] as String? ?? '',
      nameEn: row['nameEn'] as String? ?? '',
      nameLocal: row['nameLocal'] as String?,
      district: DistrictRef(
        id: district['id'] as String? ?? '',
        code: district['code'] as String? ?? '',
        nameEn: district['nameEn'] as String? ?? '',
      ),
      status: status,
      verificationStatus: VerificationStatus.unverified,
      profileCompleteness: row['profileCompleteness'] as int? ?? 0,
      updatedAt:
          DateTime.tryParse(row['updatedAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      address: SocietyAddress(
        addressLine: address['addressLine'] as String?,
        village: address['village'] as String?,
        gnDivision: address['gnDivision'] as String?,
        dsDivision:
            address['dsDivision'] as String? ?? row['dsDivision'] as String?,
      ),
      location: location == null
          ? null
          : GeoLocation(
              latitude: (location['latitude'] as num).toDouble(),
              longitude: (location['longitude'] as num).toDouble(),
            ),
      contacts: const [],
      grade: row['grade'] as String?,
      dsDivision: row['dsDivision'] as String?,
      memberCount: row['memberCount'] as int?,
      spcName: row['spcName'] as String?,
      spcUserId: row['spcUserId'] as String?,
      hasOpenGradeRequest: row['hasOpenGradeRequest'] as bool? ?? false,
    );
  }

  AppNotification _notification(Map<String, dynamic> row) {
    final category = row['category'] as String? ?? 'SYSTEM';
    final title = row['title'] as String? ?? 'Notification';
    final body = row['body'] as String? ?? '';
    final link = row['linkPath'] as String? ?? '';
    final kind = switch (category) {
      'RETURNED' => NotificationKind.returned,
      'REQUEST' => NotificationKind.request,
      'APPROVAL' => NotificationKind.approved,
      'AUDIT' => NotificationKind.review,
      'STALE_DATA' => NotificationKind.reminder,
      'EMERGENCY' => NotificationKind.incident,
      _ => NotificationKind.notice,
    };
    return AppNotification(
      id: row['id'] as String,
      kind: kind,
      title: title,
      message: body,
      receivedAt:
          DateTime.tryParse(row['createdAt'] as String? ?? '') ??
          DateTime.now(),
      read: row['read'] as bool? ?? false,
      target: link.isEmpty
          ? NotificationTarget.none
          : NotificationTarget.societyProfile,
      targetId: row['societyId'] as String?,
    );
  }
}
