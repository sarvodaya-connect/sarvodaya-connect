import '../auth/api_auth_service.dart';

/// V5 PR 7: temporary district access on the phone (M30–M32). Mirrors
/// packages/api-contracts/src/district-access.ts.
enum AccessStatus { scheduled, active, ended, endedEarly }

class AccessGrant {
  const AccessGrant({
    required this.id,
    required this.districtName,
    required this.societyCount,
    required this.deputyId,
    required this.deputyName,
    required this.grantedByName,
    required this.grantedAt,
    required this.startsAt,
    required this.expiresAt,
    required this.reason,
    required this.status,
    required this.societiesOpened,
    this.endedEarlyByName,
  });

  final String id;
  final String districtName;
  final int societyCount;
  final String deputyId;
  final String deputyName;
  final String? grantedByName;
  final DateTime grantedAt;
  final DateTime startsAt;
  final DateTime expiresAt;
  final String reason;
  final AccessStatus status;
  final int societiesOpened;
  final String? endedEarlyByName;

  bool get isCurrent =>
      status == AccessStatus.active || status == AccessStatus.scheduled;

  factory AccessGrant.fromJson(Map<String, dynamic> json) {
    final district = json['district'] as Map<String, dynamic>;
    final ended = json['endedEarly'] as Map<String, dynamic>?;
    return AccessGrant(
      id: json['id'] as String,
      districtName: district['name'] as String,
      societyCount: district['societyCount'] as int,
      deputyId: (json['deputy'] as Map)['id'] as String,
      deputyName: (json['deputy'] as Map)['name'] as String,
      grantedByName: (json['grantedBy'] as Map)['name'] as String?,
      grantedAt: DateTime.parse(json['grantedAt'] as String),
      startsAt: DateTime.parse(json['startsAt'] as String),
      expiresAt: DateTime.parse(json['expiresAt'] as String),
      reason: (json['reason'] as String?) ?? '',
      status: switch (json['status']) {
        'SCHEDULED' => AccessStatus.scheduled,
        'ACTIVE' => AccessStatus.active,
        'ENDED_EARLY' => AccessStatus.endedEarly,
        _ => AccessStatus.ended,
      },
      societiesOpened: (json['societiesOpened'] as int?) ?? 0,
      endedEarlyByName: ended?['byName'] as String?,
    );
  }
}

enum AccessEventKind { given, started, opened, ended, endedEarly }

class AccessEvent {
  const AccessEvent({
    required this.kind,
    required this.at,
    this.actorName,
    this.societyName,
  });
  final AccessEventKind kind;
  final DateTime at;
  final String? actorName;
  final String? societyName;

  factory AccessEvent.fromJson(Map<String, dynamic> json) => AccessEvent(
    kind: switch (json['kind']) {
      'GIVEN' => AccessEventKind.given,
      'STARTED' => AccessEventKind.started,
      'OPENED' => AccessEventKind.opened,
      'ENDED_EARLY' => AccessEventKind.endedEarly,
      _ => AccessEventKind.ended,
    },
    at: DateTime.parse(json['at'] as String),
    actorName: json['actorName'] as String?,
    societyName: json['societyName'] as String?,
  );
}

class Deputy {
  const Deputy({required this.id, required this.name});
  final String id;
  final String name;
}

class AccessList {
  const AccessList({required this.grants, required this.maxDays});
  final List<AccessGrant> grants;
  final int maxDays;
}

class DistrictAccessException implements Exception {
  const DistrictAccessException(this.message);
  final String message;
}

/// What the DM's access screens need. The API checks every rule itself.
abstract class DistrictAccessApi {
  Future<AccessList> list();
  Future<List<AccessEvent>> history(String grantId);
  Future<List<Deputy>> deputies();
  Future<AccessGrant> give({
    required String deputyId,
    required String districtId,
    required DateTime startsAt,
    required DateTime expiresAt,
    String reason,
  });
  Future<void> end(String grantId);
}

class HttpDistrictAccessApi implements DistrictAccessApi {
  HttpDistrictAccessApi(this._api);
  final IdentityApi _api;

  Future<dynamic> _call(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) async {
    try {
      return await _api.request(path, method: method, body: body);
    } on IdentityError catch (error) {
      throw DistrictAccessException(error.message);
    } catch (_) {
      throw const DistrictAccessException(
        "Couldn't reach Sarvodaya Connect. Check your connection and try again.",
      );
    }
  }

  @override
  Future<AccessList> list() async {
    final data =
        await _call('/identity/district-access') as Map<String, dynamic>;
    return AccessList(
      grants: (data['data'] as List)
          .map((g) => AccessGrant.fromJson(g as Map<String, dynamic>))
          .toList(),
      maxDays: (data['maxDays'] as int?) ?? 14,
    );
  }

  @override
  Future<List<AccessEvent>> history(String grantId) async {
    final data = await _call(
      '/identity/district-access/$grantId',
    ) as Map<String, dynamic>;
    return (data['history'] as List)
        .map((e) => AccessEvent.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<List<Deputy>> deputies() async {
    final data =
        await _call('/identity/district-deputies') as Map<String, dynamic>;
    return (data['data'] as List)
        .map(
          (d) =>
              Deputy(id: d['id'] as String, name: d['displayName'] as String),
        )
        .toList();
  }

  @override
  Future<AccessGrant> give({
    required String deputyId,
    required String districtId,
    required DateTime startsAt,
    required DateTime expiresAt,
    String reason = '',
  }) async => AccessGrant.fromJson(
    await _call(
      '/identity/district-access',
      method: 'POST',
      body: {
        'deputyId': deputyId,
        'districtId': districtId,
        'startsAt': startsAt.toUtc().toIso8601String(),
        'expiresAt': expiresAt.toUtc().toIso8601String(),
        if (reason.trim().isNotEmpty) 'reason': reason.trim(),
      },
    ) as Map<String, dynamic>,
  );

  @override
  Future<void> end(String grantId) async {
    await _call('/identity/district-access/$grantId/revoke', method: 'POST');
  }
}

/// Fictional grants for demonstration mode and widget tests.
class DemoDistrictAccessApi implements DistrictAccessApi {
  DemoDistrictAccessApi({required this.clock, this.maxDays = 14}) {
    final now = clock();
    _grants.add(
      AccessGrant(
        id: 'grant-demo-1',
        districtName: 'Kurunegala',
        societyCount: 106,
        deputyId: 'ddm-demo',
        deputyName: 'K. Rajapaksha',
        grantedByName: 'R. Fernando',
        grantedAt: now.subtract(const Duration(days: 90)),
        startsAt: now.subtract(const Duration(days: 85)),
        expiresAt: now.subtract(const Duration(days: 81)),
        reason: 'Annual leave',
        status: AccessStatus.ended,
        societiesOpened: 4,
      ),
    );
  }

  final DateTime Function() clock;
  final int maxDays;
  final List<AccessGrant> _grants = [];
  final Map<String, List<AccessEvent>> _history = {};
  static const _deputies = [
    Deputy(id: 'ddm-p-dissanayake', name: 'P. Dissanayake'),
    Deputy(id: 'ddm-demo', name: 'K. Rajapaksha'),
  ];

  @override
  Future<AccessList> list() async =>
      AccessList(grants: List.unmodifiable(_grants.reversed), maxDays: maxDays);

  @override
  Future<List<AccessEvent>> history(String grantId) async =>
      _history[grantId] ?? const [];

  @override
  Future<List<Deputy>> deputies() async => _deputies;

  @override
  Future<AccessGrant> give({
    required String deputyId,
    required String districtId,
    required DateTime startsAt,
    required DateTime expiresAt,
    String reason = '',
  }) async {
    final now = clock();
    if (!expiresAt.isAfter(startsAt)) {
      throw const DistrictAccessException(
        'The end time must be after the start time.',
      );
    }
    if (expiresAt.difference(startsAt) > Duration(days: maxDays)) {
      throw DistrictAccessException(
        'Temporary access can last at most $maxDays days.',
      );
    }
    if (_grants.any((g) => g.deputyId == deputyId && g.isCurrent)) {
      throw const DistrictAccessException(
        'This DDM already has temporary access for some of that time. End it first or choose other dates.',
      );
    }
    final grant = AccessGrant(
      id: 'grant-demo-${_grants.length + 1}',
      districtName: 'Kurunegala',
      societyCount: 106,
      deputyId: deputyId,
      deputyName: _deputies.firstWhere((d) => d.id == deputyId).name,
      grantedByName: 'R. Fernando',
      grantedAt: now,
      startsAt: startsAt,
      expiresAt: expiresAt,
      reason: reason.trim(),
      status: startsAt.isAfter(now)
          ? AccessStatus.scheduled
          : AccessStatus.active,
      societiesOpened: 0,
    );
    _grants.add(grant);
    _history[grant.id] = [
      if (!startsAt.isAfter(now))
        AccessEvent(kind: AccessEventKind.started, at: now),
      AccessEvent(
        kind: AccessEventKind.given,
        at: now,
        actorName: 'R. Fernando',
      ),
    ];
    return grant;
  }

  @override
  Future<void> end(String grantId) async {
    final index = _grants.indexWhere((g) => g.id == grantId);
    if (index < 0 || !_grants[index].isCurrent) {
      throw const DistrictAccessException('This access has already ended');
    }
    final g = _grants[index];
    _grants[index] = AccessGrant(
      id: g.id,
      districtName: g.districtName,
      societyCount: g.societyCount,
      deputyId: g.deputyId,
      deputyName: g.deputyName,
      grantedByName: g.grantedByName,
      grantedAt: g.grantedAt,
      startsAt: g.startsAt,
      expiresAt: g.expiresAt,
      reason: g.reason,
      status: AccessStatus.endedEarly,
      societiesOpened: g.societiesOpened,
      endedEarlyByName: 'R. Fernando',
    );
    _history[grantId] = [
      AccessEvent(
        kind: AccessEventKind.endedEarly,
        at: clock(),
        actorName: 'R. Fernando',
      ),
      ...?_history[grantId],
    ];
  }
}
