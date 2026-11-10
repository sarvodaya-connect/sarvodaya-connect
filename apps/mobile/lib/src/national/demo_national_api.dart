import 'dart:math' as math;

import '../models/user.dart';
import 'national_api.dart';
import 'national_models.dart';

/// Demonstration mode only: fictional national figures shaped like the V5
/// prototype, so every HQ screen can be shown without a server. The screens
/// label them "Demonstration data". Like the server, it refuses every role
/// but HQ, except the scoped Programmes figures (issue #117).
class DemoNationalApi implements NationalApi {
  DemoNationalApi({
    required this.user,
    this.delay = const Duration(milliseconds: 500),
    DateTime Function()? clock,
  }) : clock = clock ?? DateTime.now;

  final AuthenticatedUser? Function() user;
  final Duration delay;

  /// Checks a DDM's temporary grant against the demo's own time.
  final DateTime Function() clock;

  Future<T> _hq<T>(T Function() build) async {
    if (delay > Duration.zero) await Future<void>.delayed(delay);
    if (user()?.roles.contains(UserRole.hqAdmin) != true) {
      throw const SocietyRecordException(
        'This page is for HQ only',
        status: 403,
      );
    }
    return build();
  }

  static const _year = FinancialYearLabel(2025, 'FY 2025/26');

  // name, province, active, members, records complete %, audit %, A, B, C
  static const _districts = [
    ('Ampara', 'Eastern Province', 46, 4759, 84, 78, 6, 5, 35),
    ('Anuradhapura', 'North Central Province', 78, 6245, 68, 82, 8, 11, 59),
    ('Badulla', 'Uva Province', 46, 4057, 75, 82, 8, 9, 29),
    ('Batticaloa', 'Eastern Province', 39, 3799, 68, 86, 4, 5, 30),
    ('Colombo', 'Western Province', 35, 2834, 75, 78, 5, 6, 24),
    ('Galle', 'Southern Province', 46, 4146, 84, 83, 6, 8, 32),
    ('Gampaha', 'Western Province', 65, 5065, 70, 86, 6, 10, 49),
    ('Hambantota', 'Southern Province', 41, 3895, 88, 83, 6, 7, 28),
    ('Jaffna', 'Northern Province', 39, 3807, 84, 69, 4, 4, 31),
    ('Kalutara', 'Western Province', 40, 3696, 84, 77, 6, 4, 30),
    ('Kandy', 'Central Province', 61, 6137, 78, 83, 6, 8, 47),
    ('Kegalle', 'Sabaragamuwa Province', 49, 4183, 75, 72, 5, 9, 35),
    ('Kilinochchi', 'Northern Province', 21, 2010, 68, 75, 3, 3, 15),
    ('Kurunegala', 'North Western Province', 98, 9412, 88, 83, 14, 18, 66),
    ('Mannar', 'Northern Province', 16, 1488, 80, 77, 2, 3, 11),
    ('Matale', 'Central Province', 39, 3611, 88, 84, 5, 6, 28),
    ('Matara', 'Southern Province', 40, 3569, 82, 91, 7, 5, 28),
    ('Monaragala', 'Uva Province', 33, 3288, 90, 88, 7, 7, 19),
    ('Mullaitivu', 'Northern Province', 17, 1742, 86, 61, 3, 3, 11),
    ('Nuwara Eliya', 'Central Province', 36, 3230, 84, 90, 5, 5, 26),
    ('Polonnaruwa', 'North Central Province', 32, 3036, 70, 83, 7, 6, 19),
    ('Puttalam', 'North Western Province', 43, 3376, 68, 83, 4, 7, 32),
    ('Ratnapura', 'Sabaragamuwa Province', 59, 5658, 86, 74, 11, 13, 35),
    ('Trincomalee', 'Eastern Province', 34, 3210, 90, 80, 4, 7, 23),
    ('Vavuniya', 'Northern Province', 23, 2387, 90, 58, 2, 3, 18),
  ];

  static String _districtId(String name) =>
      'district-${name.toLowerCase().replaceAll(' ', '-')}';

  // id, name, S number, grade, requested grade, members, figures added,
  // days since update
  static const _societies = [
    (
      'society-pahala-kosgama',
      'Pahala Kosgama SSS',
      'S-104233',
      'B',
      'A',
      418,
      true,
      0,
    ),
    (
      'society-kobeigane',
      'Kobeigane SSS',
      'S-104507',
      'C',
      null,
      143,
      false,
      34,
    ),
    ('society-thalawa', 'Thalawa SSS', 'S-104247', 'C', null, 188, false, 234),
    ('society-giriulla', 'Giriulla SSS', 'S-104412', 'B', null, 265, true, 32),
    (
      'society-bingiriya',
      'Bingiriya SSS',
      'S-104388',
      'A',
      null,
      390,
      true,
      15,
    ),
    (
      'society-nikaweratiya',
      'Nikaweratiya SSS',
      'S-104702',
      'A',
      null,
      356,
      true,
      13,
    ),
  ];

  @override
  Future<NationalOverview> fetchOverview() => _hq(
    () => const NationalOverview(
      year: _year,
      registered: 5340,
      active: 1076,
      grades: GradeCounts(a: 144, b: 172, c: 760),
      notUpdatedIn90Days: 142,
      gradeRequestsWaiting: 6,
      membershipYear: 2026,
      female: 56214,
      male: 42426,
      societiesReported: 1018,
      categories: [
        CategoryCount('CHILDREN', 7200, 6920),
        CategoryCount('YOUTH', 10280, 8070),
        CategoryCount('MOTHERS', 3640, 2230),
        CategoryCount('ORDINARY', 34300, 24640),
        CategoryCount('ELDERS_COUNCIL', 794, 566),
      ],
      planned: 3930,
      completed: 3460,
      byDimension: [
        DimensionCount('SOCIAL', 2180, 1940),
        DimensionCount('ECONOMIC', 1400, 1210),
        DimensionCount('GOVERNANCE', 350, 310),
      ],
      topSdgs: [
        SdgCount(4, 980),
        SdgCount(3, 860),
        SdgCount(2, 720),
        SdgCount(6, 640),
        SdgCount(16, 410),
        SdgCount(8, 380),
      ],
      totalProfit: 312400000,
      totalExpenses: 1026800000,
      societiesWithBoth: 968,
      notSubmitted: 108,
      documentCounts: [
        DocumentCount('AUDIT_REPORT', 812, 264),
        DocumentCount('AGM_MINUTES', 905, 171),
        DocumentCount('OFFICE_BEARER_LIST', 948, 128),
        DocumentCount('MEMBERS_LIST', 776, 300),
      ],
      allFour: 702,
      auditPastDue: true,
    ),
  );

  @override
  Future<List<DistrictFigures>> fetchDistricts() => _hq(
    () => [
      for (final row in _districts)
        DistrictFigures(
          id: _districtId(row.$1),
          name: row.$1,
          province: row.$2,
          active: row.$3,
          members: row.$4,
          recordsCompletePercent: row.$5,
          auditPercent: row.$6,
          grades: GradeCounts(a: row.$7, b: row.$8, c: row.$9),
        ),
    ],
  );

  @override
  Future<SocietyMapData> fetchMap() => _hq(() {
    // Sample positions spread over the island; the demo has no real ones.
    final random = math.Random(5);
    final points = <MapPoint>[
      const MapPoint(
        'society-pahala-kosgama',
        'Pahala Kosgama SSS',
        'B',
        7.55,
        80.25,
      ),
    ];
    for (var i = 0; i < 160; i++) {
      final lat = 6.1 + random.nextDouble() * 3.6;
      final westEdge = 79.9 + (lat > 8.5 ? 0.15 : 0.0);
      final lng = westEdge + random.nextDouble() * (lat > 9 ? 0.6 : 1.6);
      final roll = random.nextDouble();
      final grade = roll < 0.12
          ? 'A'
          : roll < 0.27
          ? 'B'
          : roll < 0.8
          ? 'C'
          : 'NOT_ACTIVE';
      points.add(
        MapPoint('sample-$i', 'Sample society ${i + 1}', grade, lat, lng),
      );
    }
    return SocietyMapData(
      const GradeCounts(a: 144, b: 172, c: 760),
      4264,
      points,
    );
  });

  @override
  Future<DirectoryPage> fetchDirectory(DirectoryQuery query) => _hq(() {
    final search = query.search.toLowerCase();
    final kurunegala = _districtId('Kurunegala');
    final rows = [
      for (final row in _societies)
        if ((query.districtId == null || query.districtId == kurunegala) &&
            (search.isEmpty ||
                row.$2.toLowerCase().contains(search) ||
                row.$3.toLowerCase().contains(search)) &&
            (query.grade == null || query.grade == row.$4) &&
            (!query.notUpdated || row.$8 > 90))
          DirectoryRow(
            id: row.$1,
            name: row.$2,
            societyCode: row.$3,
            grade: row.$4,
            requestedGrade: row.$5,
            members: row.$6,
            figuresAdded: row.$7,
            updatedAt: DateTime.now().subtract(Duration(days: row.$8)),
            notUpdatedIn90Days: row.$8 > 90,
          ),
    ];
    int count(String grade) => rows.where((row) => row.grade == grade).length;
    return DirectoryPage(
      rows.length,
      GradeCounts(a: count('A'), b: count('B'), c: count('C')),
      rows,
    );
  });

  @override
  Future<SocietyAtAGlance> fetchSociety(String id) => _hq(() {
    final row = _societies.where((society) => society.$1 == id).firstOrNull;
    if (row == null) {
      throw const SocietyRecordException('Society not found', status: 404);
    }
    final strong = row.$7;
    return SocietyAtAGlance(
      id: row.$1,
      name: row.$2,
      societyCode: row.$3,
      district: 'Kurunegala',
      grade: row.$4,
      updatedAt: DateTime.now().subtract(Duration(days: row.$8)),
      members: row.$6,
      membershipYear: 2026,
      recordsCompletePercent: strong ? 96 : 71,
      missingFields: strong ? 1 : 4,
      year: _year,
      profit: strong ? 412500 : null,
      expenses: strong ? 1286000 : null,
      hasSocietyOfficer: row.$1 != 'society-kobeigane',
      spcName: 'S. Karunaratne',
      uploaded: {
        'AUDIT_REPORT': strong,
        'AGM_MINUTES': true,
        'OFFICE_BEARER_LIST': strong,
        'MEMBERS_LIST': false,
      },
      auditPastDue: !strong,
      gradeRequest: row.$5 == null ? null : '${row.$4} → ${row.$5}',
      planned: strong ? 9 : 0,
      approved: strong ? 7 : 0,
      latestActivity: strong ? 'Youth leadership camp' : null,
      latestSdgs: strong ? const [4, 16] : const [],
    );
  });

  static FinancialYearLabel _fy(int? year) => year == null
      ? _year
      : FinancialYearLabel(
          year,
          'FY $year/${((year + 1) % 100).toString().padLeft(2, '0')}',
        );

  // sector, completed, planned, societies with activities (national).
  static const _sectorFigures = [
    ('Community education', 520, 580, 612),
    ('Child wellbeing', 410, 450, 480),
    ('Health and nutrition', 455, 500, 531),
    ('Agriculture', 380, 440, 402),
    ('Environment', 340, 390, 377),
    ('Economy', 300, 360, 341),
    ('Culture', 255, 290, 268),
    ('Governance', 190, 240, 233),
    ('Spiritual development', 330, 360, 352),
    ('Housing and infrastructure', 280, 320, 296),
  ];

  static const _sdgFigures = [
    (4, 980),
    (3, 860),
    (2, 720),
    (6, 640),
    (16, 410),
    (8, 380),
  ];

  /// The national figures, or a share of them for a DM's, DDM's or SPC's
  /// fictional societies. Every goal is listed; equal counts by SDG number.
  static NationalProgrammes _figures(
    FinancialYearLabel year,
    double share, {
    ProgrammeScope? scope,
    int maxSocieties = 1 << 30,
  }) {
    int part(int value) => (value * share).round();
    final sectors = {
      for (final (sector, done, planned, societies) in _sectorFigures)
        sector: (
          part(done),
          part(planned),
          math.min(part(societies), maxSocieties),
        ),
    };
    final sdgs =
        [
          for (var sdg = 1; sdg <= 17; sdg++)
            SdgCount(
              sdg,
              part(
                _sdgFigures
                        .where((row) => row.$1 == sdg)
                        .map((row) => row.$2)
                        .firstOrNull ??
                    0,
              ),
            ),
        ]..sort(
          (a, b) => b.completed.compareTo(a.completed) != 0
              ? b.completed.compareTo(a.completed)
              : a.sdg.compareTo(b.sdg),
        );
    return NationalProgrammes(
      year,
      sectors.values.fold(0, (sum, row) => sum + row.$2),
      sectors.values.fold(0, (sum, row) => sum + row.$1),
      sectors,
      [
        DimensionCount('SOCIAL', part(2180), part(1940)),
        DimensionCount('ECONOMIC', part(1400), part(1210)),
        DimensionCount('GOVERNANCE', part(350), part(310)),
      ],
      sdgs,
      scope: scope,
    );
  }

  @override
  Future<NationalProgrammes> fetchProgrammes({int? year}) =>
      _hq(() => _figures(_fy(year), 1));

  /// Issue #117: like the server, a DM sees their district, an SPC their
  /// assigned societies, and a DDM their societies plus the district only
  /// while a temporary grant is valid. HQ and Society Officers are refused.
  @override
  Future<NationalProgrammes> fetchScopedProgrammes({int? year}) async {
    if (delay > Duration.zero) await Future<void>.delayed(delay);
    final signedIn = user();
    final role = signedIn?.primaryRole;
    if (signedIn == null ||
        role == UserRole.hqAdmin ||
        role == UserRole.societyOfficer) {
      throw const SocietyRecordException(
        'This page is for SPCs, DDMs and DMs',
        status: 403,
      );
    }
    final fy = _fy(year);
    if (role == UserRole.districtManager) {
      return _figures(
        fy,
        0.04,
        scope: const ProgrammeScope(
          kind: ProgrammeScopeKind.district,
          societies: 106,
          districts: ['Kurunegala'],
        ),
        maxSocieties: 106,
      );
    }
    final assigned = signedIn.societyIds.toSet().length;
    final grant = role == UserRole.deputyDistrictManager
        ? signedIn.delegatedDistrictAccess
              .where((g) => g.activeAt(clock()))
              .firstOrNull
        : null;
    if (grant != null) {
      return _figures(
        fy,
        0.04,
        scope: ProgrammeScope(
          kind: ProgrammeScopeKind.assignedAndDistrict,
          societies: 106,
          districts: const ['Kurunegala'],
          temporaryAccessEndsAt: grant.expiresAt,
        ),
        maxSocieties: 106,
      );
    }
    return _figures(
      fy,
      0.0026 * assigned,
      scope: ProgrammeScope(
        kind: ProgrammeScopeKind.assigned,
        societies: assigned,
      ),
      maxSocieties: assigned,
    );
  }

  @override
  Future<FiguresNotAdded> fetchFiguresNotAdded() => _hq(
    () => const FiguresNotAdded(108, [
      ('society-kobeigane', 'Kobeigane SSS', 'Kurunegala'),
      ('society-thalawa', 'Thalawa SSS', 'Kurunegala'),
    ]),
  );
}
