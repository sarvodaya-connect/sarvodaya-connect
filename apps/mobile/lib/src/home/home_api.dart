import '../auth/api_auth_service.dart';
import '../auth/auth_service.dart';
import '../l10n/l10n_format.dart' show ClientFailure;
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
  const HomeException(this.message, {this.status = 0, this.failure});

  final String message;
  final int status;

  /// Set when the app, not the server, wrote [message], so a screen can show
  /// it in the chosen language instead.
  final ClientFailure? failure;

  @override
  String toString() => message;
}

/// Issue #118: the HQ Membership figures for the user's own societies, from
/// `GET /home/membership`. Counts only, never member records.
class ScopedMembership {
  const ScopedMembership({
    required this.scope,
    required this.year,
    required this.activeSocieties,
    required this.societiesReported,
    required this.female,
    required this.male,
    required this.categories,
    required this.districts,
    required this.profileSocieties,
    required this.profileMembers,
    required this.profileWithoutBreakdown,
    required this.districtViewAvailable,
    this.districtViewEnds,
  });

  factory ScopedMembership.fromJson(Json json) {
    final profile = (json['profile'] as Json?) ?? const {};
    final view = json['districtView'] as Json?;
    return ScopedMembership(
      scope: json['scope'] as String? ?? 'MINE',
      year: (json['year'] as num?)?.toInt(),
      activeSocieties: _int(json['activeSocieties']),
      societiesReported: _int(json['societiesReported']),
      female: _int(json['female']),
      male: _int(json['male']),
      categories: [
        for (final row in (json['categories'] as List? ?? []).cast<Json>())
          (
            category: row['category'] as String,
            female: _int(row['female']),
            male: _int(row['male']),
          ),
      ],
      districts: [
        for (final row in (json['districts'] as List? ?? []).cast<Json>())
          (
            id: row['id'] as String,
            name: row['name'] as String,
            active: _int(row['active']),
            female: _int(row['female']),
            male: _int(row['male']),
          ),
      ],
      profileSocieties: _int(profile['societies']),
      profileMembers: _int(profile['members']),
      profileWithoutBreakdown: _int(profile['withoutBreakdown']),
      districtViewAvailable: view?['available'] == true,
      districtViewEnds: view?['expiresAt'] == null
          ? null
          : DateTime.parse(view!['expiresAt'] as String),
    );
  }

  /// "DISTRICT_MANAGER", "MINE" or "DISTRICT" (a DDM's temporary view).
  final String scope;

  /// The latest year with category counts, or null when none are entered.
  final int? year;
  final int activeSocieties;
  final int societiesReported;
  final int female;
  final int male;
  final List<({String category, int female, int male})> categories;

  /// Only districts that hold societies in scope.
  final List<({String id, String name, int active, int female, int male})>
  districts;

  /// Profile member counts: no female/male split, so kept apart.
  final int profileSocieties;
  final int profileMembers;
  final int profileWithoutBreakdown;
  final bool districtViewAvailable;
  final DateTime? districtViewEnds;

  int get total => female + male;
}

/// Issue #119: HQ's Audits & AGM figures for the user's own societies and one
/// financial year, from `GET /home/audits`.
class ScopedAudits {
  const ScopedAudits({
    required this.scope,
    required this.startYear,
    required this.yearLabel,
    required this.activeSocieties,
    required this.byType,
    required this.allFour,
    required this.dueOn,
    required this.pastDue,
    required this.followUp,
    required this.followUpTotal,
    required this.page,
    required this.totalPages,
    required this.districtViewAvailable,
  });

  factory ScopedAudits.fromJson(Json json) {
    final year = json['financialYear'] as Json;
    final follow = json['followUp'] as Json;
    final meta = follow['meta'] as Json;
    final view = json['districtView'] as Json?;
    return ScopedAudits(
      scope: json['scope'] as String? ?? 'MINE',
      startYear: _int(year['startYear']),
      yearLabel: year['label'] as String,
      activeSocieties: _int(json['activeSocieties']),
      byType: [
        for (final row in (json['byType'] as List).cast<Json>())
          (
            documentType: row['documentType'] as String,
            submitted: _int(row['submitted']),
            missing: _int(row['missing']),
          ),
      ],
      allFour: _int(json['allFour']),
      dueOn: DateTime.parse(json['auditReportDueOn'] as String),
      pastDue: follow['pastDue'] == true,
      followUp: [
        for (final row in (follow['data'] as List).cast<Json>())
          (
            id: row['id'] as String,
            name: row['name'] as String,
            code: row['societyCode'] as String,
            district: row['district'] as String,
          ),
      ],
      followUpTotal: _int(meta['totalItems']),
      page: _int(meta['page']),
      totalPages: _int(meta['totalPages']),
      districtViewAvailable: view?['available'] == true,
    );
  }

  final String scope;
  final int startYear;
  final String yearLabel;

  /// Active societies in scope: the denominator for every figure.
  final int activeSocieties;
  final List<({String documentType, int submitted, int missing})> byType;
  final int allFour;
  final DateTime dueOn;
  final bool pastDue;

  /// In-scope active societies without the audit report, one page.
  final List<({String id, String name, String code, String district})> followUp;
  final int followUpTotal;
  final int page;
  final int totalPages;
  final bool districtViewAvailable;

  ({String documentType, int submitted, int missing}) get audit =>
      byType.firstWhere((row) => row.documentType == 'AUDIT_REPORT');
}

/// The SPC, DDM and DM phone homes read the same API as their desktop homes
/// (V5 PR 6): the server works out every figure from the user's own scope.
abstract interface class HomeApi {
  Future<RoleHome> fetchHome();
  Future<HomeSocietyList> fetchSocieties(HomeSocietyQuery query);

  /// Issue #118: Membership for the user's own societies; a DDM may ask for
  /// their temporary district view with [district].
  Future<ScopedMembership> fetchMembership({bool district = false});

  /// Issue #119: Audits & AGM for the user's own societies and [year].
  Future<ScopedAudits> fetchAudits({
    int? year,
    bool district = false,
    int page = 1,
  });
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
        failure: ClientFailure.offline,
      );
    } on AuthServiceException {
      throw const HomeException(
        'Something went wrong on the server. Try again.',
        status: 500,
        failure: ClientFailure.server,
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

  @override
  Future<ScopedAudits> fetchAudits({
    int? year,
    bool district = false,
    int page = 1,
  }) async {
    final params = {
      'page': '$page',
      if (year != null) 'year': '$year',
      if (district) 'scope': 'DISTRICT',
    };
    return ScopedAudits.fromJson(
      await _get('/home/audits?${Uri(queryParameters: params).query}'),
    );
  }

  @override
  Future<ScopedMembership> fetchMembership({bool district = false}) async =>
      ScopedMembership.fromJson(
        await _get(
          district ? '/home/membership?scope=DISTRICT' : '/home/membership',
        ),
      );
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

  @override
  Future<ScopedMembership> fetchMembership({
    bool district = false,
  }) => _wait(() {
    final role = _role;
    final now = clock();
    final grant = user()?.delegatedDistrictAccess
        .where((g) => g.activeAt(now))
        .firstOrNull;
    if (district && (role != UserRole.deputyDistrictManager || grant == null)) {
      throw const HomeException(
        'Your temporary district-wide view has ended',
        status: 403,
      );
    }
    final wide = role == UserRole.districtManager || district;
    // Fictional counts. Some societies have only a profile member count,
    // so the profile total differs from the breakdown on purpose.
    final scale = wide ? 9 : 1;
    final categories = [
      (category: 'CHILDREN', female: 41 * scale, male: 38 * scale),
      (category: 'YOUTH', female: 64 * scale, male: 52 * scale),
      (category: 'MOTHERS', female: 88 * scale, male: 0),
      (category: 'ORDINARY', female: 120 * scale, male: 97 * scale),
      (category: 'ELDERS_COUNCIL', female: 9 * scale, male: 11 * scale),
    ];
    final active = empty()
        ? 0
        : switch (role) {
            UserRole.districtManager => 106,
            UserRole.deputyDistrictManager => district ? 106 : 18,
            _ => 12,
          };
    return ScopedMembership(
      scope: role == UserRole.districtManager
          ? 'DISTRICT_MANAGER'
          : district
          ? 'DISTRICT'
          : 'MINE',
      year: active == 0 ? null : 2026,
      activeSocieties: active,
      societiesReported: active == 0 ? 0 : (active * 3) ~/ 4,
      female: active == 0
          ? 0
          : categories.fold(0, (sum, row) => sum + row.female),
      male: active == 0 ? 0 : categories.fold(0, (sum, row) => sum + row.male),
      categories: active == 0
          ? [
              for (final row in categories)
                (category: row.category, female: 0, male: 0),
            ]
          : categories,
      districts: active == 0
          ? const []
          : [
              (
                id: 'district-kurunegala',
                name: 'Kurunegala',
                active: active,
                female: categories.fold(0, (sum, row) => sum + row.female),
                male: categories.fold(0, (sum, row) => sum + row.male),
              ),
            ],
      profileSocieties: active,
      profileMembers: active * 170,
      profileWithoutBreakdown: active - (active * 3) ~/ 4,
      districtViewAvailable:
          role == UserRole.deputyDistrictManager && grant != null,
      districtViewEnds: role == UserRole.deputyDistrictManager
          ? grant?.expiresAt
          : null,
    );
  });

  @override
  Future<ScopedAudits> fetchAudits({
    int? year,
    bool district = false,
    int page = 1,
  }) => _wait(() {
    final role = _role;
    final now = clock();
    final grant = user()?.delegatedDistrictAccess
        .where((g) => g.activeAt(now))
        .firstOrNull;
    if (district && (role != UserRole.deputyDistrictManager || grant == null)) {
      throw const HomeException(
        'Your temporary district-wide view has ended',
        status: 403,
      );
    }
    final latest = now.month >= 4 ? now.year - 1 : now.year - 2;
    final startYear = year ?? latest;
    final active = empty()
        ? 0
        : switch (role) {
            UserRole.districtManager => 106,
            UserRole.deputyDistrictManager => district ? 106 : 18,
            _ => 12,
          };
    // Fictional: about three in four societies have each document.
    int share(int percent) => (active * percent) ~/ 100;
    final audit = share(78);
    final missing = [
      for (final row
          in _societies
              .where(
                (row) => district || role == UserRole.districtManager || row.$8,
              )
              .take(active - audit))
        (id: row.$1, name: row.$2, code: row.$3, district: 'Kurunegala'),
    ];
    final dueOn = DateTime(startYear + 1, 9, 30);
    return ScopedAudits(
      scope: role == UserRole.districtManager
          ? 'DISTRICT_MANAGER'
          : district
          ? 'DISTRICT'
          : 'MINE',
      startYear: startYear,
      yearLabel: 'FY $startYear/${(startYear + 1) % 100}',
      activeSocieties: active,
      byType: [
        for (final (type, done) in [
          ('AUDIT_REPORT', audit),
          ('AGM_MINUTES', share(84)),
          ('OFFICE_BEARER_LIST', share(91)),
          ('MEMBERS_LIST', share(66)),
        ])
          (documentType: type, submitted: done, missing: active - done),
      ],
      allFour: share(61),
      dueOn: dueOn,
      pastDue: now.isAfter(dueOn.add(const Duration(days: 1))),
      followUp: missing,
      followUpTotal: active - audit,
      page: page,
      totalPages: active - audit == 0 ? 0 : ((active - audit) / 20).ceil(),
      districtViewAvailable:
          role == UserRole.deputyDistrictManager && grant != null,
    );
  });
}
