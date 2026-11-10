import 'package:http/http.dart' as http;

import '../auth/api_auth_service.dart';
import '../auth/auth_service.dart';
import '../society_record/society_record_api.dart' show sha256Base64;
import '../society_record/society_record_models.dart' show PickedDocument;

/// V5 PR 8: disaster response on the phone (M40–M49, M48n). Mirrors
/// packages/api-contracts/src/emergency.ts. The API checks every request
/// against the user's own societies or district.
enum SocietyState { safe, affected, critical, notAssessed }

enum ActionState { needed, assigned, inProgress, delivered }

enum HelperStatus { assigned, inProgress, delivered }

SocietyState societyStateFrom(String? value) => switch (value) {
  'SAFE' => SocietyState.safe,
  'AFFECTED' => SocietyState.affected,
  'CRITICAL' => SocietyState.critical,
  _ => SocietyState.notAssessed,
};

HelperStatus helperStatusFrom(String? value) => switch (value) {
  'IN_PROGRESS' => HelperStatus.inProgress,
  'DELIVERED' => HelperStatus.delivered,
  _ => HelperStatus.assigned,
};

const helperStatusCodes = {
  HelperStatus.assigned: 'ASSIGNED',
  HelperStatus.inProgress: 'IN_PROGRESS',
  HelperStatus.delivered: 'DELIVERED',
};

class SocietyRef {
  const SocietyRef({
    required this.id,
    required this.name,
    required this.code,
    required this.districtName,
    this.districtId,
  });
  final String id;
  final String name;
  final String code;
  final String districtName;
  final String? districtId;

  factory SocietyRef.fromJson(Map<String, dynamic> json) => SocietyRef(
    id: json['id'] as String,
    name: json['name'] as String,
    code: json['code'] as String,
    districtName: json['districtName'] as String,
    districtId: json['districtId'] as String?,
  );
}

class IncidentSummary {
  const IncidentSummary({
    required this.id,
    required this.reference,
    required this.title,
    required this.type,
    required this.isClosed,
    required this.areaNames,
    required this.openedByName,
    required this.openedByRole,
    required this.openedAt,
    required this.societiesInArea,
    required this.assessed,
    this.reportingSociety,
    this.assessmentsDueAt,
    this.closedAt,
    this.closedByName,
  });

  final String id;
  final String reference;
  final String title;
  final String type;
  final bool isClosed;
  final List<String> areaNames;
  final SocietyRef? reportingSociety;
  final String? openedByName;
  final String? openedByRole;
  final DateTime openedAt;
  final DateTime? assessmentsDueAt;
  final DateTime? closedAt;
  final String? closedByName;
  final int societiesInArea;
  final int assessed;

  factory IncidentSummary.fromJson(Map<String, dynamic> json) {
    final opened = json['openedBy'] as Map<String, dynamic>? ?? const {};
    final closed = json['closedBy'] as Map<String, dynamic>?;
    final reporting = json['reportingSociety'] as Map<String, dynamic>?;
    return IncidentSummary(
      id: json['id'] as String,
      reference: json['reference'] as String,
      title: json['title'] as String,
      type: json['type'] as String,
      isClosed: json['status'] == 'CLOSED',
      areaNames: [
        for (final d in json['areaDistricts'] as List? ?? const [])
          (d as Map)['name'] as String,
      ],
      reportingSociety: reporting == null
          ? null
          : SocietyRef.fromJson(reporting),
      openedByName: opened['name'] as String?,
      openedByRole: opened['role'] as String?,
      openedAt: DateTime.parse(json['openedAt'] as String),
      assessmentsDueAt: _date(json['assessmentsDueAt']),
      closedAt: _date(json['closedAt']),
      closedByName: closed?['name'] as String?,
      societiesInArea: json['societiesInArea'] as int? ?? 0,
      assessed: json['assessed'] as int? ?? 0,
    );
  }
}

DateTime? _date(Object? value) =>
    value is String ? DateTime.parse(value) : null;

class SocietyRow {
  const SocietyRow({
    required this.society,
    required this.state,
    required this.families,
    required this.people,
    required this.lastReceivedAt,
    required this.updates,
    required this.canAssess,
  });
  final SocietyRef society;
  final SocietyState state;
  final int? families;
  final int? people;
  final DateTime? lastReceivedAt;
  final int updates;
  final bool canAssess;

  factory SocietyRow.fromJson(Map<String, dynamic> json) => SocietyRow(
    society: SocietyRef.fromJson(json['society'] as Map<String, dynamic>),
    state: societyStateFrom(json['state'] as String?),
    families: json['families'] as int?,
    people: json['people'] as int?,
    lastReceivedAt: _date(json['lastReceivedAt']),
    updates: json['updates'] as int? ?? 0,
    canAssess: json['canAssess'] as bool? ?? false,
  );
}

class Helper {
  const Helper({
    required this.id,
    required this.society,
    required this.quantity,
    required this.deliveredQuantity,
    required this.status,
    required this.assignedBy,
    required this.assignedAt,
    required this.canUpdate,
    this.note = '',
    this.deliveryNote = '',
    this.deliveredOn,
  });
  final String id;
  final SocietyRef society;
  final int quantity;
  final int deliveredQuantity;
  final HelperStatus status;
  final String assignedBy;
  final DateTime assignedAt;
  final bool canUpdate;
  final String note;
  final String deliveryNote;
  final String? deliveredOn;

  factory Helper.fromJson(Map<String, dynamic> json) => Helper(
    id: json['id'] as String,
    society: SocietyRef.fromJson(json['society'] as Map<String, dynamic>),
    quantity: json['quantity'] as int,
    deliveredQuantity: json['deliveredQuantity'] as int? ?? 0,
    status: helperStatusFrom(json['status'] as String?),
    assignedBy: json['assignedBy'] as String? ?? 'HQ',
    assignedAt: DateTime.parse(json['assignedAt'] as String),
    canUpdate: json['canUpdate'] as bool? ?? false,
    note: json['note'] as String? ?? '',
    deliveryNote: json['deliveryNote'] as String? ?? '',
    deliveredOn: json['deliveredOn'] as String?,
  );
}

class ResponseAction {
  const ResponseAction({
    required this.id,
    required this.need,
    required this.title,
    required this.quantity,
    required this.unit,
    required this.state,
    required this.delivered,
    required this.helpers,
    this.forSociety,
    this.dueAt,
  });
  final String id;
  final String need;
  final String title;
  final int quantity;
  final String unit;
  final ActionState state;
  final int delivered;
  final List<Helper> helpers;
  final SocietyRef? forSociety;
  final DateTime? dueAt;

  factory ResponseAction.fromJson(Map<String, dynamic> json) {
    final society = json['forSociety'] as Map<String, dynamic>?;
    return ResponseAction(
      id: json['id'] as String,
      need: json['need'] as String,
      title: json['title'] as String,
      quantity: json['quantity'] as int? ?? 0,
      unit: json['unit'] as String? ?? '',
      state: switch (json['state']) {
        'ASSIGNED' => ActionState.assigned,
        'IN_PROGRESS' => ActionState.inProgress,
        'DELIVERED' => ActionState.delivered,
        _ => ActionState.needed,
      },
      delivered: json['delivered'] as int? ?? 0,
      helpers: [
        for (final h in json['helpers'] as List? ?? const [])
          Helper.fromJson(h as Map<String, dynamic>),
      ],
      forSociety: society == null ? null : SocietyRef.fromJson(society),
      dueAt: _date(json['dueAt']),
    );
  }
}

class IncidentTotals {
  const IncidentTotals({
    required this.affected,
    required this.critical,
    required this.families,
    required this.people,
    required this.housesFully,
    required this.housesPartly,
    required this.notAssessed,
    required this.societiesInArea,
    required this.actions,
    required this.byDistrict,
    required this.needs,
  });
  final int affected;
  final int critical;
  final int families;
  final int people;
  final int housesFully;
  final int housesPartly;
  final int notAssessed;
  final int societiesInArea;
  final int actions;
  final List<({String name, int affected, int people})> byDistrict;
  final List<({String need, int societies})> needs;

  factory IncidentTotals.fromJson(Map<String, dynamic> json) => IncidentTotals(
    affected: json['affected'] as int? ?? 0,
    critical: json['critical'] as int? ?? 0,
    families: json['families'] as int? ?? 0,
    people: json['people'] as int? ?? 0,
    housesFully: json['housesFully'] as int? ?? 0,
    housesPartly: json['housesPartly'] as int? ?? 0,
    notAssessed: json['notAssessed'] as int? ?? 0,
    societiesInArea: json['societiesInArea'] as int? ?? 0,
    actions: json['actions'] as int? ?? 0,
    byDistrict: [
      for (final d in json['byDistrict'] as List? ?? const [])
        (
          name: (d as Map)['name'] as String,
          affected: d['affected'] as int? ?? 0,
          people: d['people'] as int? ?? 0,
        ),
    ],
    needs: [
      for (final n in json['needs'] as List? ?? const [])
        (
          need: (n as Map)['need'] as String,
          societies: n['societies'] as int? ?? 0,
        ),
    ],
  );
}

class IncidentDetail {
  const IncidentDetail({
    required this.incident,
    required this.canAssess,
    required this.canClose,
    required this.totals,
    required this.recent,
    required this.actions,
    required this.reports,
    required this.assessableSocieties,
  });
  final IncidentSummary incident;
  final bool canAssess;
  final bool canClose;
  final IncidentTotals totals;
  final List<SocietyRow> recent;
  final List<ResponseAction> actions;
  final List<({String id, int number, DateTime asOf})> reports;
  final List<SocietyRef> assessableSocieties;

  factory IncidentDetail.fromJson(Map<String, dynamic> json) {
    final permissions = json['permissions'] as Map<String, dynamic>;
    return IncidentDetail(
      incident: IncidentSummary.fromJson(
        json['incident'] as Map<String, dynamic>,
      ),
      canAssess: permissions['canAssess'] as bool? ?? false,
      canClose: permissions['canClose'] as bool? ?? false,
      totals: IncidentTotals.fromJson(json['totals'] as Map<String, dynamic>),
      recent: [
        for (final r in json['recentAssessments'] as List? ?? const [])
          SocietyRow.fromJson(r as Map<String, dynamic>),
      ],
      actions: [
        for (final a in json['actions'] as List? ?? const [])
          ResponseAction.fromJson(a as Map<String, dynamic>),
      ],
      reports: [
        for (final r in json['reports'] as List? ?? const [])
          (
            id: (r as Map)['id'] as String,
            number: r['number'] as int,
            asOf: DateTime.parse(r['asOf'] as String),
          ),
      ],
      assessableSocieties: [
        for (final s in json['assessableSocieties'] as List? ?? const [])
          SocietyRef.fromJson(s as Map<String, dynamic>),
      ],
    );
  }

  /// Response actions for one society (M45) and those it helps with (M45h).
  List<ResponseAction> forSociety(String societyId) =>
      actions.where((a) => a.forSociety?.id == societyId).toList();
  List<ResponseAction> helpedBy(String societyId) => actions
      .where((a) => a.helpers.any((h) => h.society.id == societyId))
      .toList();
}

class AssessmentUpdate {
  const AssessmentUpdate({
    required this.id,
    required this.number,
    required this.sentAt,
    required this.photos,
  });
  final String id;
  final int number;
  final DateTime sentAt;
  final int photos;
}

/// V5 M41/M42: the answers to one rapid assessment. Counts only.
class AssessmentAnswers {
  String impact = 'AFFECTED';
  int families = 0;
  int people = 0;
  int injured = 0;
  int housesFully = 0;
  int housesPartly = 0;
  int displaced = 0;
  String roadAccess = 'UNKNOWN';
  final Set<String> needs = {};
  String note = '';
  bool confirmedWithPresident = false;
  final List<PickedDocument> photos = [];

  AssessmentAnswers();

  /// Saved answers back from `toJson` (issue #125). Photos travel separately.
  factory AssessmentAnswers.fromJson(Map<String, dynamic> json) =>
      AssessmentAnswers()
        ..impact = json['impact'] as String
        ..families = json['families'] as int
        ..people = json['people'] as int
        ..housesFully = json['housesFully'] as int
        ..housesPartly = json['housesPartly'] as int
        ..injured = json['injured'] as int
        ..displaced = json['displaced'] as int
        ..roadAccess = json['roadAccess'] as String
        ..needs.addAll((json['needs'] as List).cast<String>())
        ..note = json['note'] as String
        ..confirmedWithPresident = json['confirmedWithPresident'] as bool;

  Map<String, dynamic> toJson(String clientMutationId, String societyId) => {
    'clientMutationId': clientMutationId,
    'societyId': societyId,
    'impact': impact,
    'families': families,
    'people': people,
    'housesFully': housesFully,
    'housesPartly': housesPartly,
    'injured': injured,
    'displaced': displaced,
    'roadAccess': roadAccess,
    'needs': needs.toList(),
    'note': note.trim(),
    'confirmedWithPresident': confirmedWithPresident,
  };
}

class SituationReport {
  const SituationReport({
    required this.number,
    required this.asOf,
    required this.incident,
    required this.totals,
    required this.helpingSocieties,
    required this.helpedSocieties,
  });
  final int number;
  final DateTime asOf;
  final IncidentSummary incident;
  final IncidentTotals totals;
  final int helpingSocieties;
  final int helpedSocieties;

  factory SituationReport.fromJson(Map<String, dynamic> json) {
    final snapshot = json['snapshot'] as Map<String, dynamic>;
    return SituationReport(
      number: json['number'] as int,
      asOf: DateTime.parse(json['asOf'] as String),
      incident: IncidentSummary.fromJson(
        json['incident'] as Map<String, dynamic>,
      ),
      totals: IncidentTotals.fromJson({
        ...snapshot['totals'] as Map<String, dynamic>,
        'byDistrict': snapshot['byDistrict'],
        'needs': snapshot['needs'],
      }),
      helpingSocieties: snapshot['helpingSocieties'] as int? ?? 0,
      helpedSocieties: snapshot['helpedSocieties'] as int? ?? 0,
    );
  }
}

class ReportOptions {
  const ReportOptions({required this.societies, required this.districts});
  final List<SocietyRef> societies;
  final List<({String id, String name})> districts;
}

class IncidentNotification {
  const IncidentNotification({
    required this.title,
    required this.body,
    required this.at,
  });
  final String title;
  final String body;
  final DateTime at;
}

class IncidentException implements Exception {
  const IncidentException(this.message, {this.offline = false, this.status});
  final String message;

  /// The phone could not reach the server.
  final bool offline;

  /// The API's HTTP status, when it answered (issue #125 decides what a
  /// saved assessment does next from it).
  final int? status;

  @override
  String toString() => message;
}

/// What the disaster response screens need. The API checks every rule itself.
abstract class IncidentApi {
  Future<List<IncidentSummary>> active();
  Future<IncidentDetail> detail(String id);
  Future<List<AssessmentUpdate>> updates(String incidentId, String societyId);

  /// Sends one assessment online, then its photos. A retry with the same
  /// [clientMutationId] returns the update already received.
  Future<String> sendAssessment(
    String incidentId,
    String societyId,
    String clientMutationId,
    AssessmentAnswers answers,
  );
  Future<void> addPhoto(String assessmentId, PickedDocument photo);
  Future<void> updateDelivery(
    String helperId, {
    required HelperStatus status,
    required int delivered,
    String? deliveredOn,
    String note = '',
    PickedDocument? photo,
  });
  Future<IncidentSummary> close(String id);
  Future<ReportOptions> reportOptions();
  Future<String> open({
    required String type,
    required String reportingSocietyId,
    required List<String> districtIds,
    required String description,
    required DateTime startedAt,
  });
  Future<SituationReport> report(String reportId);
  Future<List<IncidentNotification>> notifications();
}

class HttpIncidentApi implements IncidentApi {
  HttpIncidentApi(this._api, {http.Client? uploadClient})
    : _uploadClient = uploadClient ?? http.Client();
  final IdentityApi _api;
  final http.Client _uploadClient;

  Future<dynamic> _call(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) async {
    try {
      return await _api.request(path, method: method, body: body);
    } on IdentityError catch (error) {
      throw IncidentException(error.message, status: error.status);
    } on AuthNetworkException {
      throw const IncidentException(
        "You're offline or the server did not answer.",
        offline: true,
      );
    } on AuthServiceException {
      throw const IncidentException(
        'Something went wrong on the server. Try again.',
        status: 500,
      );
    }
  }

  @override
  Future<List<IncidentSummary>> active() async {
    final data = await _call(
      '/emergencies/incidents?status=ACTIVE',
    ) as Map<String, dynamic>;
    return [
      for (final i in data['data'] as List)
        IncidentSummary.fromJson(i as Map<String, dynamic>),
    ];
  }

  @override
  Future<IncidentDetail> detail(String id) async => IncidentDetail.fromJson(
    await _call('/emergencies/incidents/$id') as Map<String, dynamic>,
  );

  @override
  Future<List<AssessmentUpdate>> updates(
    String incidentId,
    String societyId,
  ) async {
    final data = await _call(
      '/emergencies/incidents/$incidentId/societies/$societyId',
    ) as Map<String, dynamic>;
    return [
      for (final u in data['updates'] as List)
        AssessmentUpdate(
          id: (u as Map)['id'] as String,
          number: u['number'] as int,
          sentAt: DateTime.parse(u['sentAt'] as String),
          photos: u['photos'] as int? ?? 0,
        ),
    ];
  }

  @override
  Future<String> sendAssessment(
    String incidentId,
    String societyId,
    String clientMutationId,
    AssessmentAnswers answers,
  ) async {
    final sent = await _call(
      '/emergencies/incidents/$incidentId/assessments',
      method: 'POST',
      body: answers.toJson(clientMutationId, societyId),
    ) as Map<String, dynamic>;
    return sent['id'] as String;
  }

  /// Pre-signed upload straight to storage, then the API checks the size.
  Future<void> _upload(String path, PickedDocument file) async {
    final created = await _call(
      path,
      method: 'POST',
      body: {
        'contentType': file.contentType,
        'sizeBytes': file.sizeBytes,
        'checksumSha256': sha256Base64(file.bytes),
      },
    ) as Map<String, dynamic>;
    final evidence = created['evidence'] as Map<String, dynamic>;
    final upload = created['upload'] as Map<String, dynamic>;
    final request = http.Request(
      upload['method'] as String? ?? 'PUT',
      Uri.parse(upload['url'] as String),
    )..bodyBytes = file.bytes;
    (upload['headers'] as Map? ?? const {}).forEach(
      (key, value) => request.headers['$key'] = '$value',
    );
    try {
      final response = await _uploadClient.send(request);
      if (response.statusCode >= 300) {
        throw const IncidentException(
          'The photo did not reach storage. Try again.',
          status: 502,
        );
      }
    } on http.ClientException {
      throw const IncidentException(
        'The photo did not reach storage. Check your connection and try again.',
        offline: true,
      );
    }
    await _call(
      '/emergencies/evidence/${evidence['id']}/complete',
      method: 'POST',
      body: const {},
    );
  }

  @override
  Future<void> addPhoto(String assessmentId, PickedDocument photo) =>
      _upload('/emergencies/assessments/$assessmentId/evidence', photo);

  @override
  Future<void> updateDelivery(
    String helperId, {
    required HelperStatus status,
    required int delivered,
    String? deliveredOn,
    String note = '',
    PickedDocument? photo,
  }) async {
    await _call(
      '/emergencies/helpers/$helperId',
      method: 'PATCH',
      body: {
        'status': helperStatusCodes[status],
        'deliveredQuantity': delivered,
        'deliveredOn': ?deliveredOn,
        if (note.trim().isNotEmpty) 'note': note.trim(),
      },
    );
    if (photo != null) {
      await _upload('/emergencies/helpers/$helperId/evidence', photo);
    }
  }

  @override
  Future<IncidentSummary> close(String id) async => IncidentSummary.fromJson(
    await _call(
      '/emergencies/incidents/$id/close',
      method: 'POST',
      body: const {},
    ) as Map<String, dynamic>,
  );

  @override
  Future<ReportOptions> reportOptions() async {
    final data =
        await _call('/emergencies/report-options') as Map<String, dynamic>;
    return ReportOptions(
      societies: [
        for (final s in data['societies'] as List)
          SocietyRef.fromJson(s as Map<String, dynamic>),
      ],
      districts: [
        for (final d in data['districts'] as List)
          (id: (d as Map)['id'] as String, name: d['name'] as String),
      ],
    );
  }

  @override
  Future<String> open({
    required String type,
    required String reportingSocietyId,
    required List<String> districtIds,
    required String description,
    required DateTime startedAt,
  }) async {
    final opened = await _call(
      '/emergencies/incidents',
      method: 'POST',
      body: {
        'type': type,
        'reportingSocietyId': reportingSocietyId,
        'districtIds': districtIds,
        'description': description.trim(),
        'startedAt': startedAt.toUtc().toIso8601String(),
      },
    ) as Map<String, dynamic>;
    return opened['id'] as String;
  }

  @override
  Future<SituationReport> report(String reportId) async =>
      SituationReport.fromJson(
        await _call('/emergencies/situation-reports/$reportId')
            as Map<String, dynamic>,
      );

  @override
  Future<List<IncidentNotification>> notifications() async {
    final data =
        await _call('/notifications?pageSize=20') as Map<String, dynamic>;
    return [
      for (final n in data['data'] as List)
        if ((n as Map)['category'] == 'EMERGENCY')
          IncidentNotification(
            title: n['title'] as String,
            body: n['body'] as String? ?? '',
            at: DateTime.parse(n['createdAt'] as String),
          ),
    ];
  }
}
