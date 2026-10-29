import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../models/user.dart';

const demoNorthDistrictId = '29000000-0000-4000-8000-000000000001';
const demoSunriseSocietyId = '29000000-0000-4000-8000-000000000101';

class EmergencyApiException implements Exception {
  const EmergencyApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  bool get isConflict => statusCode == 409;

  @override
  String toString() => message;
}

class EmergencyIncident {
  const EmergencyIncident({
    required this.id,
    required this.title,
    required this.type,
    required this.severity,
    required this.status,
    required this.description,
    required this.location,
    required this.district,
    required this.activatedAt,
    required this.assessmentCount,
    required this.actionCount,
    required this.reportCount,
  });

  final String id;
  final String title;
  final String type;
  final String severity;
  final String status;
  final String description;
  final String location;
  final String district;
  final DateTime activatedAt;
  final int assessmentCount;
  final int actionCount;
  final int reportCount;

  factory EmergencyIncident.fromJson(Map<String, dynamic> json) {
    final counts = json['_count'] as Map<String, dynamic>? ?? const {};
    final district = json['district'] as Map<String, dynamic>? ?? const {};
    return EmergencyIncident(
      id: json['id'] as String,
      title: json['title'] as String,
      type: json['type'] as String,
      severity: json['severity'] as String,
      status: json['status'] as String,
      description: json['description'] as String,
      location: json['location'] as String,
      district: district['nameEn'] as String? ?? '',
      activatedAt: DateTime.parse(json['activatedAt'] as String),
      assessmentCount: counts['assessments'] as int? ?? 0,
      actionCount: counts['actions'] as int? ?? 0,
      reportCount: counts['reports'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'type': type,
    'severity': severity,
    'status': status,
    'description': description,
    'location': location,
    'district': {'nameEn': district},
    'activatedAt': activatedAt.toIso8601String(),
    '_count': {
      'assessments': assessmentCount,
      'actions': actionCount,
      'reports': reportCount,
    },
  };
}

/// Demo-only API adapter. Replace the X-Demo-User header with Cognito tokens
/// when the production identity provider is connected.
class EmergencyApiClient {
  EmergencyApiClient({http.Client? client, this.token, this.demoMode = true})
    : _client = client ?? http.Client();

  final String? Function()? token;
  final bool demoMode;
  final http.Client _client;
  static const _configuredBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: String.fromEnvironment('SC_API_BASE_URL'),
  );

  String get _baseUrl {
    if (_configuredBaseUrl.isNotEmpty) {
      return _configuredBaseUrl.replaceFirst(RegExp(r'/$'), '');
    }
    if (kIsWeb) return 'http://localhost:3001/api/v1';
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:3001/api/v1';
    }
    return 'http://127.0.0.1:3001/api/v1';
  }

  String demoUserId(UserRole role) => switch (role) {
    UserRole.societyOfficer => 'demo-officer-sunrise',
    UserRole.programmeCoordinator => 'demo-programme-coordinator',
    UserRole.deputyDistrictManager => 'demo-deputy-district-manager',
    UserRole.districtManager => 'demo-dm-north',
    UserRole.hqAdmin => 'demo-hq-admin',
  };

  Map<String, String> _headers(UserRole role) => {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    if (token?.call() != null) 'Authorization': 'Bearer ${token!()}',
    if (token?.call() == null && demoMode) 'X-Demo-User': demoUserId(role),
  };

  Future<List<EmergencyIncident>> listIncidents(UserRole role) async {
    final response = await _client.get(
      Uri.parse('$_baseUrl/emergencies/incidents'),
      headers: _headers(role),
    );
    final body = _decode(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw EmergencyApiException(
        _message(body, 'Unable to load incidents'),
        statusCode: response.statusCode,
      );
    }
    return (body as List<dynamic>)
        .map((row) => EmergencyIncident.fromJson(row as Map<String, dynamic>))
        .toList(growable: false);
  }

  Future<Map<String, dynamic>> loadIncident(String id, UserRole role) async {
    final response = await _client.get(
      Uri.parse('$_baseUrl/emergencies/incidents/$id'),
      headers: _headers(role),
    );
    final body = _decode(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw EmergencyApiException(
        _message(body, 'Unable to load incident details'),
        statusCode: response.statusCode,
      );
    }
    return body as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> syncAssessment(
    Map<String, dynamic> payload,
    UserRole role,
  ) async {
    final response = await _client.post(
      Uri.parse('$_baseUrl/emergencies/assessments/sync'),
      headers: _headers(role),
      body: jsonEncode(payload),
    );
    final body = _decode(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw EmergencyApiException(
        _message(body, 'Assessment sync failed'),
        statusCode: response.statusCode,
      );
    }
    return body as Map<String, dynamic>;
  }

  Future<void> submitSituationReport(
    Map<String, dynamic> payload,
    UserRole role,
  ) async {
    final response = await _client.post(
      Uri.parse('$_baseUrl/emergencies/situation-reports/sync'),
      headers: _headers(role),
      body: jsonEncode(payload),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw EmergencyApiException(
        _message(_decode(response), 'Situation report submission failed'),
        statusCode: response.statusCode,
      );
    }
  }

  Future<void> createResponseAction(
    Map<String, dynamic> payload,
    UserRole role,
  ) async {
    final response = await _client.post(
      Uri.parse('$_baseUrl/emergencies/actions'),
      headers: _headers(role),
      body: jsonEncode(payload),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw EmergencyApiException(
        _message(_decode(response), 'Could not add response action'),
        statusCode: response.statusCode,
      );
    }
  }

  Future<void> updateIncidentStatus(
    String id,
    String status,
    UserRole role,
  ) async {
    final response = await _client.patch(
      Uri.parse('$_baseUrl/emergencies/incidents/$id/status'),
      headers: _headers(role),
      body: jsonEncode({'status': status}),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw EmergencyApiException(
        _message(_decode(response), 'Could not update incident status'),
        statusCode: response.statusCode,
      );
    }
  }

  Future<void> updateActionStatus(
    String id,
    String status,
    UserRole role,
  ) async {
    final response = await _client.patch(
      Uri.parse('$_baseUrl/emergencies/actions/$id/status'),
      headers: _headers(role),
      body: jsonEncode({'status': status}),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw EmergencyApiException(
        _message(_decode(response), 'Could not update response action status'),
        statusCode: response.statusCode,
      );
    }
  }

  Object? _decode(http.Response response) {
    if (response.body.isEmpty) return null;
    try {
      return jsonDecode(response.body);
    } on FormatException {
      return response.body;
    }
  }

  String _message(Object? body, String fallback) {
    if (body is Map<String, dynamic>) {
      final message = body['message'];
      if (message is String) return message;
      if (message is List) return message.join(', ');
    }
    return fallback;
  }

  void close() => _client.close();
}
