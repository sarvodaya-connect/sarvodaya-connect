import '../auth/api_auth_service.dart';
import '../auth/auth_service.dart';
import '../models/user.dart';

typedef Json = Map<String, dynamic>;

int _int(Object? value) => (value as num?)?.toInt() ?? 0;

/// A temporary district-wide view (V5 PR 7) as the home shows it.
class HomeGrant {
  const HomeGrant({
    required this.deputyName,
    required this.districtName,
    required this.startsAt,
    required this.expiresAt,
    this.grantedByName,
    this.districtSocietyCount = 0,
  });

  factory HomeGrant.fromJson(Json json) => HomeGrant(
    deputyName: json['deputyName'] as String,
    districtName: json['districtName'] as String,
    startsAt: DateTime.parse(json['startsAt'] as String),
    expiresAt: DateTime.parse(json['expiresAt'] as String),
    grantedByName: json['grantedByName'] as String?,
    districtSocietyCount: _int(json['districtSocietyCount']),
  );

  final String deputyName;
  final String districtName;
  final DateTime startsAt;
  final DateTime expiresAt;
  final String? grantedByName;
  final int districtSocietyCount;
}

class AttentionItem {
  const AttentionItem(
    this.societyId,
    this.name,
    this.grade,
    this.reason,
    this.pending,
  );

  factory AttentionItem.fromJson(Json json) {
    final pending = json['pendingGrade'] as Json?;
    return AttentionItem(
      json['societyId'] as String,
      json['societyName'] as String,
      json['grade'] as String?,
      json['reason'] as String,
      pending == null ? null : '${pending['from'] ?? '–'} → ${pending['to']}',
    );
  }

  final String societyId;
  final String name;
  final String? grade;
  final String reason;

  /// "B → A" while a grade request waits for HQ.
  final String? pending;
}

/// V5 M05s / M05d / M05m: the home of an SPC, DDM or DM (`GET /home`).
class RoleHome {
  const RoleHome({
    required this.role,
    required this.districtName,
    required this.total,
    required this.active,
    required this.notActive,
    required this.gradeA,
    required this.gradeB,
    required this.gradeC,
    required this.members,
    required this.viewOnly,
    required this.gradeRequests,
    required this.notUpdated,
    required this.activitiesWaiting,
    this.needsAttention = const [],
    this.temporaryAccess = const [],
    this.districtViewCount,
  });

  factory RoleHome.fromJson(Json json) {
    final societies = json['societies'] as Json;
    final grades = societies['grades'] as Json;
    return RoleHome(
      role: json['role'] as String,
      districtName: (json['district'] as Json?)?['name'] as String?,
      total: _int(societies['total']),
      active: _int(societies['active']),
      notActive: _int(societies['notActive']),
      gradeA: _int(grades['A']),
      gradeB: _int(grades['B']),
      gradeC: _int(grades['C']),
      members: (societies['members'] as num?)?.toInt(),
      viewOnly: json['viewOnly'] == true,
      gradeRequests: _int((json['gradeRequests'] as Json)['pending']),
      notUpdated: _int((json['notUpdated'] as Json)['count']),
      activitiesWaiting: _int(json['activitiesWaiting']),
      needsAttention: [
        for (final row in (json['needsAttention'] as List?) ?? const [])
          AttentionItem.fromJson(row as Json),
      ],
      temporaryAccess: [
        for (final row in (json['temporaryAccess'] as List?) ?? const [])
          HomeGrant.fromJson(row as Json),
      ],
      districtViewCount: (json['districtViewCount'] as num?)?.toInt(),
    );
  }

  final String role;
  final String? districtName;
  final int total;
  final int active;
  final int notActive;
  final int gradeA;
  final int gradeB;
  final int gradeC;
  final int? members;
  final bool viewOnly;
  final int gradeRequests;
  final int notUpdated;
  final int activitiesWaiting;
  final List<AttentionItem> needsAttention;
  final List<HomeGrant> temporaryAccess;
  final int? districtViewCount;
}

class HomeSociety {
  const HomeSociety({
    required this.id,
    required this.code,
    required this.name,
    required this.grade,
    required this.pending,
    required this.members,
    required this.updatedAt,
    required this.stale,
    required this.editable,
    required this.yours,
  });

  factory HomeSociety.fromJson(Json json) {
    final pending = json['pendingGrade'] as Json?;
    return HomeSociety(
      id: json['id'] as String,
      code: json['societyCode'] as String,
      name: json['nameEn'] as String,
      grade: json['grade'] as String?,
      pending: pending == null
          ? null
          : '${pending['from'] ?? '–'} → ${pending['to']}',
      members: (json['members'] as num?)?.toInt(),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      stale: json['stale'] == true,
      editable: json['editable'] == true,
      yours: json['yours'] == true,
    );
  }

  final String id;
  final String code;
  final String name;
  final String? grade;
  final String? pending;
  final int? members;
  final DateTime updatedAt;
  final bool stale;
  final bool editable;
  final bool yours;
}

/// The filters of M05s, M05d (DD04) and the DM's Societies sheet (M20).
class HomeSocietyQuery {
  const HomeSocietyQuery({
    this.search = '',
    this.grade,
    this.needsUpdate = false,
    this.gradeRequest = false,
    this.dsDivision,
    this.spcId,
    this.district = false,
  });

  final String search;
  final String? grade;
  final bool needsUpdate;
  final bool gradeRequest;
  final String? dsDivision;
  final String? spcId;

  /// DDM with temporary access: the whole district instead of their own.
  final bool district;

  bool get filtered =>
      search.isNotEmpty ||
      grade != null ||
      needsUpdate ||
      gradeRequest ||
      dsDivision != null ||
      spcId != null;

  HomeSocietyQuery copyWith({
    String? search,
    String? Function()? grade,
    bool? needsUpdate,
    bool? gradeRequest,
    String? Function()? dsDivision,
    String? Function()? spcId,
    bool? district,
  }) => HomeSocietyQuery(
    search: search ?? this.search,
    grade: grade == null ? this.grade : grade(),
    needsUpdate: needsUpdate ?? this.needsUpdate,
    gradeRequest: gradeRequest ?? this.gradeRequest,
    dsDivision: dsDivision == null ? this.dsDivision : dsDivision(),
    spcId: spcId == null ? this.spcId : spcId(),
    district: district ?? this.district,
  );

  HomeSocietyQuery cleared() => HomeSocietyQuery(district: district);
}

class HomeSocietyList {
  const HomeSocietyList({
    required this.rows,
    required this.total,
    required this.scopeTotal,
    this.mine = 0,
    this.district,
    this.dsDivisions = const [],
    this.spcs = const [],
  });

  factory HomeSocietyList.fromJson(Json json) {
    final tabs = (json['tabs'] as Json?) ?? const {};
    final options = (json['options'] as Json?) ?? const {};
    return HomeSocietyList(
      rows: [
        for (final row in json['data'] as List)
          HomeSociety.fromJson(row as Json),
      ],
      total: _int((json['meta'] as Json)['totalItems']),
      scopeTotal: _int(json['scopeTotal']),
      mine: _int(tabs['mine']),
      district: (tabs['district'] as num?)?.toInt(),
      dsDivisions: [
        for (final value in (options['dsDivisions'] as List?) ?? const [])
          value as String,
      ],
      spcs: [
        for (final row in (options['spcs'] as List?) ?? const [])
          ((row as Json)['id'] as String, row['name'] as String),
      ],
    );
  }

  final List<HomeSociety> rows;
  final int total;
  final int scopeTotal;
  final int mine;
  final int? district;
  final List<String> dsDivisions;
  final List<(String id, String name)> spcs;
}

class HomeException implements Exception {
  const HomeException(this.message, {this.status = 0});

  final String message;
  final int status;

  @override
  String toString() => message;
}

/// The SPC, DDM and DM phone homes read the same API as their desktop homes
/// (V5 PR 6): the server works out every figure from the user's own scope.
abstract interface class HomeApi {
  Future<RoleHome> fetchHome();
  Future<HomeSocietyList> fetchSocieties(HomeSocietyQuery query);
}

class HttpHomeApi implements HomeApi {
  HttpHomeApi(this.api);

  final IdentityApi api;

  Future<Json> _get(String path) async {
    try {
      return await api.request(path) as Json;
    } on IdentityError catch (error) {
      throw HomeException(error.message, status: error.status);
    } on AuthNetworkException {
      throw const HomeException(
        'The server did not answer. Check your connection and try again.',
      );
    } on AuthServiceException {
      throw const HomeException(
        'Something went wrong on the server. Try again.',
        status: 500,
      );
    }
  }

  @override
  Future<RoleHome> fetchHome() async => RoleHome.fromJson(await _get('/home'));

  @override
  Future<HomeSocietyList> fetchSocieties(HomeSocietyQuery query) async {
    final params = {
      'pageSize': '50',
      if (query.search.isNotEmpty) 'q': query.search,
      if (query.grade != null) 'grade': query.grade!,
      if (query.needsUpdate) 'needsUpdate': 'true',
      if (query.gradeRequest) 'gradeRequest': 'PENDING',
      if (query.dsDivision != null) 'dsDivision': query.dsDivision!,
      if (query.spcId != null) 'spcId': query.spcId!,
      if (query.district) 'scope': 'DISTRICT',
    };
    return HomeSocietyList.fromJson(
      await _get('/home/societies?${Uri(queryParameters: params).query}'),
    );
  }
}

/// Demonstration mode only: fictional homes shaped like the V5 prototype.
class DemoHomeApi implements HomeApi {
  DemoHomeApi({
    required this.user,
    required this.clock,
    this.delay = const Duration(milliseconds: 400),
    bool Function()? failing,
    bool Function()? empty,
  }) : failing = failing ?? _never,
       empty = empty ?? _never;

  static bool _never() => false;

  final AuthenticatedUser? Function() user;
  final DateTime Function() clock;
  final Duration delay;

  /// Demo options: fail every load, or show no societies.
  final bool Function() failing;
  final bool Function() empty;

  // id, name, S number, grade, pending, members, days since update, yours
  static const _societies = [
    (
      'society-pahala-kosgama',
      'Pahala Kosgama SSS',
      'S-104233',
      'B',
      'B → A',
      412,
      0,
      true,
    ),
    (
      'society-hettipola',
      'Hettipola SSS',
      'S-104536',
      'C',
      null,
      204,
      154,
      true,
    ),
    ('society-giriulla', 'Giriulla SSS', 'S-104412', 'B', null, 265, 32, true),
    (
      'society-kobeigane',
      'Kobeigane SSS',
      'S-104507',
      'C',
      null,
      143,
      34,
      true,
    ),
    (
      'society-nikaweratiya',
      'Nikaweratiya SSS',
      'S-104702',
      'A',
      null,
      356,
      13,
      true,
    ),
    ('society-thalawa', 'Thalawa SSS', 'S-104247', 'C', null, 188, 234, false),
    (
      'society-kuliyapitiya',
      'Kuliyapitiya SSS',
      'S-104298',
      'B',
      null,
      327,
      0,
      false,
    ),
  ];

  Future<T> _wait<T>(T Function() build) async {
    if (delay > Duration.zero) await Future<void>.delayed(delay);
    if (failing()) {
      throw const HomeException('Could not load your overview.', status: 500);
    }
    return build();
  }

  UserRole get _role => user()?.primaryRole ?? UserRole.programmeCoordinator;

  @override
  Future<RoleHome> fetchHome() => _wait(() {
    final now = clock();
    final role = _role;
    if (role == UserRole.hqAdmin || role == UserRole.societyOfficer) {
      throw const HomeException(
        'This home is for SPCs, DDMs and DMs',
        status: 403,
      );
    }
    final grants = [
      for (final grant
          in user()?.delegatedDistrictAccess ?? const <DistrictAccessGrant>[])
        if (grant.activeAt(now))
          HomeGrant(
            deputyName: user()!.displayName,
            districtName: 'Kurunegala',
            startsAt: grant.startsAt,
            expiresAt: grant.expiresAt,
            grantedByName: grant.grantedByName ?? 'R. Fernando',
            districtSocietyCount: 106,
          ),
    ];
    return switch (role) {
      UserRole.districtManager => const RoleHome(
        role: 'DISTRICT_MANAGER',
        districtName: 'Kurunegala',
        total: 106,
        active: 98,
        notActive: 8,
        gradeA: 14,
        gradeB: 18,
        gradeC: 66,
        members: 9412,
        viewOnly: true,
        gradeRequests: 4,
        notUpdated: 12,
        activitiesWaiting: 0,
        needsAttention: [
          AttentionItem(
            'society-thalawa',
            'Thalawa SSS',
            'C',
            'Not updated for 234 days',
            null,
          ),
          AttentionItem(
            'society-pahala-kosgama',
            'Pahala Kosgama SSS',
            'B',
            'Grade request with HQ',
            'B → A',
          ),
        ],
      ),
      UserRole.deputyDistrictManager => RoleHome(
        role: 'DEPUTY_DISTRICT_MANAGER',
        districtName: 'Kurunegala',
        total: 18,
        active: 18,
        notActive: 0,
        gradeA: 4,
        gradeB: 6,
        gradeC: 8,
        members: 4120,
        viewOnly: false,
        gradeRequests: 2,
        notUpdated: 3,
        activitiesWaiting: 0,
        temporaryAccess: grants,
        districtViewCount: grants.isEmpty ? null : 106,
      ),
      _ => const RoleHome(
        role: 'PROGRAMME_COORDINATOR',
        districtName: 'Kurunegala',
        total: 12,
        active: 12,
        notActive: 0,
        gradeA: 2,
        gradeB: 4,
        gradeC: 6,
        members: 3260,
        viewOnly: false,
        gradeRequests: 1,
        notUpdated: 2,
        activitiesWaiting: 2,
      ),
    };
  });

  @override
  Future<HomeSocietyList> fetchSocieties(HomeSocietyQuery query) => _wait(() {
    final now = clock();
    final role = _role;
    final district = role == UserRole.districtManager || query.district;
    final search = query.search.toLowerCase();
    final rows = [
      for (final row in _societies)
        if (!empty() &&
            (district || row.$8) &&
            (search.isEmpty ||
                row.$2.toLowerCase().contains(search) ||
                row.$3.toLowerCase().contains(search)) &&
            (query.grade == null || query.grade == row.$4) &&
            (!query.needsUpdate || row.$7 >= 90) &&
            (!query.gradeRequest || row.$5 != null))
          HomeSociety(
            id: row.$1,
            code: row.$3,
            name: row.$2,
            grade: row.$4,
            pending: row.$5,
            members: row.$6,
            updatedAt: now.subtract(Duration(days: row.$7)),
            stale: row.$7 >= 90,
            editable: role != UserRole.districtManager && row.$8,
            yours: role == UserRole.deputyDistrictManager && row.$8,
          ),
    ];
    final scopeTotal = switch (role) {
      UserRole.districtManager => 106,
      UserRole.deputyDistrictManager => district ? 106 : 18,
      _ => 12,
    };
    return HomeSocietyList(
      rows: rows,
      total: rows.length,
      scopeTotal: scopeTotal,
      mine: role == UserRole.deputyDistrictManager ? 18 : rows.length,
      district: role == UserRole.deputyDistrictManager ? 106 : null,
      dsDivisions: const ['Kuliyapitiya East', 'Narammala', 'Nikaweratiya'],
      spcs: const [('spc-1', 'S. Karunaratne'), ('spc-2', 'M. Herath')],
    );
  });
}
