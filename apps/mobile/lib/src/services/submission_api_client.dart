import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../models/submission.dart';
import '../models/user.dart';

class SubmissionApiException implements Exception {
  const SubmissionApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  bool get isConflict => statusCode == 409;
  bool get isForbidden => statusCode == 403;
  bool get isNotFound => statusCode == 404;
  bool get isNetwork => statusCode == null;

  @override
  String toString() => message;
}

String submissionTypeToApi(SubmissionType type) => switch (type) {
  SubmissionType.councilUpdate => 'COUNCIL_UPDATE',
  SubmissionType.profileUpdate => 'PROFILE_UPDATE',
  SubmissionType.membershipCounts => 'MEMBERSHIP_COUNTS',
  SubmissionType.activityReport => 'ACTIVITY_REPORT',
  SubmissionType.payment => 'PAYMENT',
};

SubmissionType _typeFromApi(String? value) => switch (value) {
  'COUNCIL_UPDATE' => SubmissionType.councilUpdate,
  'PROFILE_UPDATE' => SubmissionType.profileUpdate,
  'MEMBERSHIP_COUNTS' => SubmissionType.membershipCounts,
  'ACTIVITY_REPORT' => SubmissionType.activityReport,
  'PAYMENT' => SubmissionType.payment,
  _ => throw FormatException('Unknown submission type: $value'),
};

SubmissionStatus _statusFromApi(String? value) => switch (value) {
  'DRAFT' => SubmissionStatus.draft,
  'SUBMITTED' => SubmissionStatus.submitted,
  'UNDER_REVIEW' => SubmissionStatus.underReview,
  'CHANGES_REQUESTED' => SubmissionStatus.changesRequested,
  'RESUBMITTED' => SubmissionStatus.resubmitted,
  'APPROVED' => SubmissionStatus.approved,
  'REJECTED' => SubmissionStatus.rejected,
  _ => throw FormatException('Unknown submission status: $value'),
};

CorrectionStatus _correctionFromApi(String? value) => switch (value) {
  'REQUIRED' => CorrectionStatus.required,
  'CORRECTED' => CorrectionStatus.corrected,
  _ => CorrectionStatus.none,
};

ReviewDecision _decisionFromApi(String? value) => switch (value) {
  'APPROVED' => ReviewDecision.approved,
  'CHANGES_REQUESTED' => ReviewDecision.changesRequested,
  'REJECTED' => ReviewDecision.rejected,
  _ => throw FormatException('Unknown review decision: $value'),
};

String _eventTitle(String? action) => switch (action) {
  'SUBMIT' => 'Submitted to District Manager',
  'START_REVIEW' => 'Under Review',
  'REQUEST_CHANGES' => 'Changes Requested',
  'RESUBMIT' => 'Resubmitted',
  'APPROVE' => 'Approved',
  'REJECT' => 'Rejected',
  _ => action ?? 'Update',
};

/// The API stores values as JSON; the screens show text.
String? _text(Object? value) {
  if (value == null) return null;
  if (value is String) return value;
  return jsonEncode(value);
}

DateTime? _date(Object? value) =>
    value is String ? DateTime.parse(value).toLocal() : null;

SubmissionChange _changeFromJson(Map<String, dynamic> json) {
  return SubmissionChange(
    field: json['field'] as String,
    label: json['label'] as String,
    previousValue: _text(json['previousValue']),
    proposedValue: _text(json['proposedValue']) ?? '',
    correctionStatus: _correctionFromApi(json['correctionStatus'] as String?),
    correctedValue: _text(json['correctedValue']),
    reviewerComment: json['reviewerComment'] as String?,
  );
}

/// Converts one API submission into the model the screens use.
SocietySubmission submissionFromJson(Map<String, dynamic> json) {
  final changes = [
    for (final row in json['changes'] as List<dynamic>? ?? const [])
      _changeFromJson(row as Map<String, dynamic>),
  ];
  final returned = changes.where((c) => c.reviewerComment != null).toList();

  final reviews = [
    for (final row in json['reviews'] as List<dynamic>? ?? const [])
      () {
        final map = row as Map<String, dynamic>;
        final decision = _decisionFromApi(map['decision'] as String?);
        final fieldLevel = decision == ReviewDecision.changesRequested;
        return ReviewRecord(
          id: map['id'] as String,
          reviewerUserId: map['reviewerUserId'] as String,
          reviewerDisplayName: map['reviewerDisplayName'] as String,
          decision: decision,
          comment:
              map['comment'] as String? ??
              (fieldLevel && returned.isNotEmpty
                  ? returned
                        .map((c) => '${c.label}: ${c.reviewerComment}')
                        .join('\n')
                  : null),
          field: fieldLevel && returned.length == 1
              ? returned.first.field
              : null,
          decidedAt: DateTime.parse(map['decidedAt'] as String).toLocal(),
        );
      }(),
  ];

  final timeline = [
    for (final row in json['events'] as List<dynamic>? ?? const [])
      () {
        final map = row as Map<String, dynamic>;
        return TimelineEvent(
          status: _statusFromApi(map['toStatus'] as String?),
          title: _eventTitle(map['action'] as String?),
          at: DateTime.parse(map['createdAt'] as String).toLocal(),
          detail: map['comment'] as String?,
          actor: map['actorDisplayName'] as String?,
        );
      }(),
  ];

  return SocietySubmission(
    id: json['id'] as String,
    reference: json['reference'] as String,
    societyId: json['societyId'] as String,
    type: _typeFromApi(json['type'] as String?),
    title: json['title'] as String,
    submittedBy: json['submittedBy'] as String,
    status: _statusFromApi(json['status'] as String?),
    correctionStatus: _correctionFromApi(json['correctionStatus'] as String?),
    changes: changes,
    reviews: reviews,
    timeline: timeline,
    submittedAt: _date(json['submittedAt']),
    updatedAt: _date(json['updatedAt']) ?? DateTime.now(),
    reviewStartedAt: _date(json['reviewStartedAt']),
    reviewerDisplayName: json['reviewerDisplayName'] as String?,
    version: json['version'] as int? ?? 1,
  );
}

/// Demo-only adapter for /submissions. Replace the X-Demo-User header with
/// Cognito tokens when the production identity provider is connected.
class SubmissionApiClient {
  SubmissionApiClient({http.Client? client, String? baseUrl})
    : _client = client ?? http.Client(),
      _baseUrlOverride = baseUrl;

  final http.Client _client;
  final String? _baseUrlOverride;
  static const _configuredBaseUrl = String.fromEnvironment('SC_API_BASE_URL');

  String get _baseUrl {
    final override = _baseUrlOverride;
    if (override != null) return override.replaceFirst(RegExp(r'/$'), '');
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
    UserRole.districtManager => 'demo-dm-north',
    UserRole.hqAdmin => 'demo-hq-admin',
  };

  Future<Object?> _request(
    String method,
    String path,
    UserRole role, {
    Object? body,
    required String fallback,
  }) async {
    final request = http.Request(method, Uri.parse('$_baseUrl$path'))
      ..headers.addAll({
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Demo-User': demoUserId(role),
      });
    if (body != null) request.body = jsonEncode(body);

    final http.Response response;
    try {
      response = await http.Response.fromStream(await _client.send(request));
    } catch (_) {
      throw const SubmissionApiException(
        'Could not reach the server. Your entries are kept on this phone.',
      );
    }

    Object? decoded;
    if (response.body.isNotEmpty) {
      try {
        decoded = jsonDecode(response.body);
      } on FormatException {
        decoded = response.body;
      }
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw SubmissionApiException(
        _message(decoded, fallback),
        statusCode: response.statusCode,
      );
    }
    return decoded;
  }

  String _message(Object? body, String fallback) {
    if (body is Map<String, dynamic>) {
      final message = body['message'];
      if (message is String) return message;
      if (message is List) return message.join(', ');
    }
    return fallback;
  }

  Future<List<SocietySubmission>> list(UserRole role) async {
    final body = await _request(
      'GET',
      '/submissions?pageSize=100',
      role,
      fallback: 'Unable to load submissions',
    );
    final rows = (body as Map<String, dynamic>)['data'] as List<dynamic>;
    return [
      for (final row in rows) submissionFromJson(row as Map<String, dynamic>),
    ];
  }

  Future<SocietySubmission> get(String id, UserRole role) async {
    final body = await _request(
      'GET',
      '/submissions/$id',
      role,
      fallback: 'Unable to load the submission',
    );
    return submissionFromJson(body as Map<String, dynamic>);
  }

  Future<SocietySubmission> createDraft({
    required String societyId,
    required SubmissionType type,
    required String title,
    required List<SubmissionChange> changes,
    UserRole role = UserRole.societyOfficer,
  }) async {
    final body = await _request(
      'POST',
      '/submissions',
      role,
      body: {
        'societyId': societyId,
        'type': submissionTypeToApi(type),
        'title': title,
        'changes': [
          for (final change in changes)
            {
              'field': change.field,
              'label': change.label,
              if (change.previousValue != null)
                'previousValue': change.previousValue,
              'proposedValue': change.proposedValue,
            },
        ],
      },
      fallback: 'Could not save the draft',
    );
    return submissionFromJson(body as Map<String, dynamic>);
  }

  Future<SocietySubmission> submit(
    SocietySubmission submission, {
    UserRole role = UserRole.societyOfficer,
  }) async {
    final body = await _request(
      'POST',
      '/submissions/${submission.id}/submit',
      role,
      body: {'version': submission.version},
      fallback: 'Could not submit',
    );
    return submissionFromJson(body as Map<String, dynamic>);
  }

  /// [corrections] maps each returned field name to its corrected value.
  Future<SocietySubmission> resubmit(
    SocietySubmission submission,
    Map<String, String> corrections, {
    UserRole role = UserRole.societyOfficer,
  }) async {
    final body = await _request(
      'POST',
      '/submissions/${submission.id}/resubmit',
      role,
      body: {
        'version': submission.version,
        'corrections': [
          for (final entry in corrections.entries)
            {'field': entry.key, 'correctedValue': entry.value},
        ],
      },
      fallback: 'Could not send the correction',
    );
    return submissionFromJson(body as Map<String, dynamic>);
  }

  void close() => _client.close();
}
