import 'dart:async';
import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;

import '../auth/api_auth_service.dart';
import '../auth/auth_service.dart';
import '../l10n/l10n_format.dart' show ClientFailure;
import 'society_record_models.dart';

/// A failed society-record request. [message] is safe to show; nothing the
/// user typed is lost when this is thrown.
class SocietyRecordException implements Exception {
  const SocietyRecordException(
    this.message, {
    this.status,
    this.offline = false,
    this.failure,
  });

  final String message;
  final int? status;
  final bool offline;

  /// Set when the app, not the server, wrote [message], so a screen can show
  /// it in the chosen language instead.
  final ClientFailure? failure;

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
  Future<WorkPlan> fetchWorkPlan(String id, {int? year});

  /// M09a–M09d: the new activity waits for the society's SPC.
  Future<ActivityDetail> createActivity(String societyId, ActivityInput input);

  /// Changes an activity that is waiting or was sent back, and sends it again.
  Future<ActivityDetail> updateActivity(
    String societyId,
    String activityId,
    ActivityInput input,
  );
  Future<ActivityDetail> fetchActivity(String activityId);

  /// M50: SPC only; the server refuses other roles.
  Future<ActivityQueue> fetchActivityQueue();

  /// M51: the assigned SPC approves with at least one UN SDG (1–17).
  Future<ActivityDetail> approveActivity(String activityId, List<int> sdgs);

  /// M51b: the assigned SPC sends it back, with an optional note.
  Future<ActivityDetail> sendBackActivity(String activityId, {String? comment});

  /// M13: the four Registrar documents for the year.
  Future<RegistrarDocuments> fetchRegistrarDocuments(String id, {int? year});

  /// The member's full NIC. The server checks scope and records the reveal.
  Future<String> revealNic(String societyId, String memberId);

  /// V5 M07e / M07o: saves the filled Exco seats (0–25) together and returns
  /// the record. A seat left out stays empty.
  Future<SocietyRecord> updateCouncil(
    String societyId,
    List<Map<String, Object?>> members,
  );

  /// Stores a member's NIC in the encrypted NIC vault.
  Future<void> setNic(String societyId, String memberId, String nic);

  /// M13a: records the metadata, sends the file to private storage through a
  /// short-lived link (with its SHA-256, which storage checks), then confirms
  /// it. The four Registrar documents need their [financialYear].
  Future<RecordDocument> uploadDocument(
    String id, {
    required String documentType,
    required PickedDocument file,
    int? financialYear,
    String? title,
    void Function(double progress)? onProgress,
  });
}

/// SHA-256 of the file in base64, as storage expects it.
String sha256Base64(List<int> bytes) =>
    base64Encode(sha256.convert(bytes).bytes);

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
  Future<WorkPlan> fetchWorkPlan(String id, {int? year}) async =>
      WorkPlan.fromJson(
        await _call(
          '/societies/$id/work-plan${year == null ? '' : '?year=$year'}',
        ) as Map<String, dynamic>,
      );

  @override
  Future<ActivityDetail> createActivity(
    String societyId,
    ActivityInput input,
  ) async => ActivityDetail.fromJson(
    await _call(
      '/societies/$societyId/activities',
      method: 'POST',
      body: input.toJson(),
    ) as Map<String, dynamic>,
  );

  @override
  Future<ActivityDetail> updateActivity(
    String societyId,
    String activityId,
    ActivityInput input,
  ) async => ActivityDetail.fromJson(
    await _call(
      '/societies/$societyId/activities/$activityId',
      method: 'PUT',
      body: input.toJson(),
    ) as Map<String, dynamic>,
  );

  @override
  Future<ActivityDetail> fetchActivity(String activityId) async =>
      ActivityDetail.fromJson(
        await _call('/activities/$activityId') as Map<String, dynamic>,
      );

  @override
  Future<ActivityQueue> fetchActivityQueue() async => ActivityQueue.fromJson(
    await _call('/activity-reviews') as Map<String, dynamic>,
  );

  @override
  Future<ActivityDetail> approveActivity(
    String activityId,
    List<int> sdgs,
  ) async => ActivityDetail.fromJson(
    await _call(
      '/activities/$activityId/approve',
      method: 'POST',
      body: {'sdgs': sdgs},
    ) as Map<String, dynamic>,
  );

  @override
  Future<ActivityDetail> sendBackActivity(
    String activityId, {
    String? comment,
  }) async => ActivityDetail.fromJson(
    await _call(
      '/activities/$activityId/send-back',
      method: 'POST',
      body: {
        if (comment?.trim().isNotEmpty ?? false) 'comment': comment!.trim(),
      },
    ) as Map<String, dynamic>,
  );

  @override
  Future<RegistrarDocuments> fetchRegistrarDocuments(
    String id, {
    int? year,
  }) async => RegistrarDocuments.fromJson(
    await _call(
      '/societies/$id/registrar-documents${year == null ? '' : '?year=$year'}',
    ) as Map<String, dynamic>,
  );

  @override
  Future<String> revealNic(String societyId, String memberId) async =>
      (await _call(
            '/societies/$societyId/council/$memberId/nic/reveal',
            method: 'POST',
          ))['nic']
          as String;

  @override
  Future<SocietyRecord> updateCouncil(
    String societyId,
    List<Map<String, Object?>> members,
  ) async => SocietyRecord.fromJson(
    await _call(
      '/societies/$societyId/council',
      method: 'PUT',
      body: {'members': members},
    ) as Map<String, dynamic>,
  );

  @override
  Future<void> setNic(String societyId, String memberId, String nic) async {
    await _call(
      '/societies/$societyId/council/$memberId/nic',
      method: 'PUT',
      body: {'nic': nic},
    );
  }

  @override
  Future<RecordDocument> uploadDocument(
    String id, {
    required String documentType,
    required PickedDocument file,
    int? financialYear,
    String? title,
    void Function(double progress)? onProgress,
  }) async {
    final created = await _call(
      '/documents',
      method: 'POST',
      body: {
        'societyId': id,
        'documentType': documentType,
        'financialYear': ?financialYear,
        'title': title ?? documentTypeLabels[documentType] ?? 'Document',
        'fileName': file.name,
        'contentType': file.contentType,
        'sizeBytes': file.sizeBytes,
        'checksumSha256': sha256Base64(file.bytes),
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
