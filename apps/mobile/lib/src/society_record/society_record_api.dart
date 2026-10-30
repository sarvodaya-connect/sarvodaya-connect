import 'dart:async';

import 'package:http/http.dart' as http;

import '../auth/api_auth_service.dart';
import '../auth/auth_service.dart';
import 'society_record_models.dart';

/// A failed society-record request. [message] is safe to show; nothing the
/// user typed is lost when this is thrown.
class SocietyRecordException implements Exception {
  const SocietyRecordException(
    this.message, {
    this.status,
    this.offline = false,
  });

  final String message;
  final int? status;
  final bool offline;

  @override
  String toString() => message;
}

/// Boundary between the SC-65 screens and the API. The server enforces every
/// role and assignment rule; [HttpSocietyRecordApi] talks to it and
/// [DemoSocietyRecordApi] mirrors it with fictional data.
abstract interface class SocietyRecordApi {
  Future<List<SocietyListItem>> listSocieties({String search = ''});
  Future<SocietyRecord> fetchRecord(String id);

  /// M06e: only the changed fields. Empty strings remove optional values.
  Future<SocietyRecord> updateRecord(String id, Map<String, Object> changes);
  Future<AnnualSummaryResult> fetchAnnualSummary(String id, {int? year});
  Future<AnnualSummaryResult> saveAnnualSummary(
    String id,
    int year, {
    required double totalProfit,
    required double totalExpenses,
  });
  Future<List<GradeRequest>> fetchGradeRequests(String id);
  Future<GradeRequest> requestGradeChange(
    String id, {
    required String toGrade,
    required String reason,
  });
  Future<List<HistoryEvent>> fetchHistory(String id, {String? category});
  Future<List<RecordDocument>> fetchDocuments(String id);
  Future<WorkPlan> fetchWorkPlan(String id);

  /// The member's full NIC. The server checks scope and records the reveal.
  Future<String> revealNic(String societyId, String memberId);

  /// M13a: records the metadata, sends the file to private storage through a
  /// short-lived link, then confirms it.
  Future<RecordDocument> uploadAuditReport(
    String id, {
    required int financialYear,
    required PickedDocument file,
    void Function(double progress)? onProgress,
  });
}

class HttpSocietyRecordApi implements SocietyRecordApi {
  HttpSocietyRecordApi(this.api, {http.Client? uploadClient})
    : _uploadClient = uploadClient ?? http.Client();

  final IdentityApi api;
  final http.Client _uploadClient;

  Future<dynamic> _call(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) async {
    try {
      return await api.request(path, method: method, body: body);
    } on IdentityError catch (error) {
      throw SocietyRecordException(error.message, status: error.status);
    } on AuthNetworkException {
      throw const SocietyRecordException(
        'The server did not answer. Check your connection and try again.',
        offline: true,
      );
    } on AuthServiceException {
      throw const SocietyRecordException(
        'Something went wrong on the server. Try again.',
      );
    }
  }

  @override
  Future<List<SocietyListItem>> listSocieties({String search = ''}) async {
    final data = await _call(
      '/societies?page=1&pageSize=100&search=${Uri.encodeQueryComponent(search)}',
    );
    return (data['data'] as List)
        .map(
          (row) => SocietyListItem(
            row['id'] as String,
            row['societyCode'] as String,
            row['nameEn'] as String,
            row['district']['nameEn'] as String,
          ),
        )
        .toList();
  }

  @override
  Future<SocietyRecord> fetchRecord(String id) async => SocietyRecord.fromJson(
    await _call('/societies/$id') as Map<String, dynamic>,
  );

  @override
  Future<SocietyRecord> updateRecord(
    String id,
    Map<String, Object> changes,
  ) async => SocietyRecord.fromJson(
    await _call('/societies/$id/profile', method: 'PATCH', body: changes)
        as Map<String, dynamic>,
  );

  @override
  Future<AnnualSummaryResult> fetchAnnualSummary(
    String id, {
    int? year,
  }) async => AnnualSummaryResult.fromJson(
    await _call(
      '/societies/$id/annual-summary${year == null ? '' : '?year=$year'}',
    ) as Map<String, dynamic>,
  );

  @override
  Future<AnnualSummaryResult> saveAnnualSummary(
    String id,
    int year, {
    required double totalProfit,
    required double totalExpenses,
  }) async => AnnualSummaryResult.fromJson(
    await _call(
      '/societies/$id/annual-summary/$year',
      method: 'PUT',
      body: {'totalProfit': totalProfit, 'totalExpenses': totalExpenses},
    ) as Map<String, dynamic>,
  );

  @override
  Future<List<GradeRequest>> fetchGradeRequests(String id) async =>
      ((await _call('/societies/$id/grade-requests'))['data'] as List)
          .map((row) => GradeRequest.fromJson(row as Map<String, dynamic>))
          .toList();

  @override
  Future<GradeRequest> requestGradeChange(
    String id, {
    required String toGrade,
    required String reason,
  }) async => GradeRequest.fromJson(
    await _call(
      '/societies/$id/grade-requests',
      method: 'POST',
      body: {'toGrade': toGrade, 'reason': reason},
    ) as Map<String, dynamic>,
  );

  @override
  Future<List<HistoryEvent>> fetchHistory(
    String id, {
    String? category,
  }) async =>
      ((await _call(
                '/societies/$id/history${category == null ? '' : '?category=$category'}',
              ))['data']
              as List)
          .map((row) => HistoryEvent.fromJson(row as Map<String, dynamic>))
          .toList();

  @override
  Future<List<RecordDocument>> fetchDocuments(String id) async =>
      ((await _call('/documents?societyId=$id&pageSize=100'))['data'] as List)
          .map((row) => RecordDocument.fromJson(row as Map<String, dynamic>))
          .toList();

  @override
  Future<WorkPlan> fetchWorkPlan(String id) async => WorkPlan.fromJson(
    await _call('/societies/$id/work-plan') as Map<String, dynamic>,
  );

  @override
  Future<String> revealNic(String societyId, String memberId) async =>
      (await _call(
            '/societies/$societyId/council/$memberId/nic/reveal',
            method: 'POST',
          ))['nic']
          as String;

  @override
  Future<RecordDocument> uploadAuditReport(
    String id, {
    required int financialYear,
    required PickedDocument file,
    void Function(double progress)? onProgress,
  }) async {
    final created = await _call(
      '/documents',
      method: 'POST',
      body: {
        'societyId': id,
        'documentType': 'AUDIT_REPORT',
        'financialYear': financialYear,
        'title': 'Audit report',
        'fileName': file.name,
        'contentType': file.contentType,
        'sizeBytes': file.sizeBytes,
      },
    );
    final document = created['document'] as Map<String, dynamic>;
    final upload = created['upload'] as Map<String, dynamic>;
    final request =
        http.StreamedRequest(
            upload['method'] as String? ?? 'PUT',
            Uri.parse(upload['url'] as String),
          )
          ..contentLength = file.sizeBytes
          ..headers['Content-Type'] = file.contentType;
    (upload['headers'] as Map? ?? const {}).forEach(
      (key, value) => request.headers['$key'] = '$value',
    );
    const chunk = 64 * 1024;
    final sending = _uploadClient
        .send(request)
        .timeout(const Duration(minutes: 2));
    for (var start = 0; start < file.sizeBytes; start += chunk) {
      final end = start + chunk > file.sizeBytes
          ? file.sizeBytes
          : start + chunk;
      request.sink.add(file.bytes.sublist(start, end));
      onProgress?.call(end / file.sizeBytes);
      await Future<void>.delayed(Duration.zero);
    }
    unawaited(request.sink.close());
    try {
      final response = await sending;
      await response.stream.drain<void>();
      if (response.statusCode >= 400) {
        throw const SocietyRecordException(
          'The file could not be uploaded. Try again.',
        );
      }
    } on SocietyRecordException {
      rethrow;
    } on Exception {
      throw const SocietyRecordException(
        'The upload stopped. Check your connection and try again.',
        offline: true,
      );
    }
    return RecordDocument.fromJson(
      await _call('/documents/${document['id']}/complete', method: 'POST')
          as Map<String, dynamic>,
    );
  }
}
