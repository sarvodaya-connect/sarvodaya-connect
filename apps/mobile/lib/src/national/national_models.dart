/// V5 PR 5: the HQ National Dashboard (M05h) and its drill-downs (M61–M69).
/// Every figure is a count or a yearly total worked out by the API from
/// approved records. Nothing here carries a NIC or a phone number.
library;

typedef Json = Map<String, dynamic>;

int _int(Object? value) => (value as num?)?.toInt() ?? 0;

class GradeCounts {
  const GradeCounts({this.a = 0, this.b = 0, this.c = 0, this.ungraded = 0});

  factory GradeCounts.fromJson(Json json) => GradeCounts(
    a: _int(json['A']),
    b: _int(json['B']),
    c: _int(json['C']),
    ungraded: _int(json['ungraded']),
  );

  final int a;
  final int b;
  final int c;
  final int ungraded;
}

class FinancialYearLabel {
  const FinancialYearLabel(this.startYear, this.label);

  factory FinancialYearLabel.fromJson(Json json) =>
      FinancialYearLabel(_int(json['startYear']), json['label'] as String);

  final int startYear;
  final String label;
}

class CategoryCount {
  const CategoryCount(this.category, this.female, this.male);

  factory CategoryCount.fromJson(Json json) => CategoryCount(
    json['category'] as String,
    _int(json['female']),
    _int(json['male']),
  );

  final String category;
  final int female;
  final int male;
  int get total => female + male;
}

class SdgCount {
  const SdgCount(this.sdg, this.completed);

  factory SdgCount.fromJson(Json json) =>
      SdgCount(_int(json['sdg']), _int(json['completed']));

  final int sdg;
  final int completed;
}

class DimensionCount {
  const DimensionCount(this.dimension, this.planned, this.completed);

  factory DimensionCount.fromJson(Json json) => DimensionCount(
    json['dimension'] as String,
    _int(json['planned']),
    _int(json['completed']),
  );

  final String dimension;
  final int planned;
  final int completed;
}

class DocumentCount {
  const DocumentCount(this.documentType, this.submitted, this.missing);

  factory DocumentCount.fromJson(Json json) => DocumentCount(
    json['documentType'] as String,
    _int(json['submitted']),
    _int(json['missing']),
  );

  final String documentType;
  final int submitted;
  final int missing;
}

/// M05h: the six dashboard sections.
class NationalOverview {
  const NationalOverview({
    required this.year,
    required this.registered,
    required this.active,
    required this.grades,
    required this.notUpdatedIn90Days,
    required this.gradeRequestsWaiting,
    required this.membershipYear,
    required this.female,
    required this.male,
    required this.societiesReported,
    required this.categories,
    required this.planned,
    required this.completed,
    required this.byDimension,
    required this.topSdgs,
    required this.totalProfit,
    required this.totalExpenses,
    required this.societiesWithBoth,
    required this.notSubmitted,
    required this.documentCounts,
    required this.allFour,
    required this.auditPastDue,
  });

  factory NationalOverview.fromJson(Json json) {
    final societies = json['societies'] as Json;
    final membership = json['membership'] as Json;
    final activities = json['activities'] as Json;
    final finance = json['finance'] as Json;
    final documents = json['registrarDocuments'] as Json;
    return NationalOverview(
      year: FinancialYearLabel.fromJson(json['financialYear'] as Json),
      registered: _int(societies['registered']),
      active: _int(societies['active']),
      grades: GradeCounts.fromJson(societies['grades'] as Json),
      notUpdatedIn90Days: _int(societies['notUpdatedIn90Days']),
      gradeRequestsWaiting: _int(societies['gradeRequestsWaiting']),
      membershipYear: (membership['year'] as num?)?.toInt(),
      female: _int(membership['female']),
      male: _int(membership['male']),
      societiesReported: _int(membership['societiesReported']),
      categories: [
        for (final row in membership['categories'] as List)
          CategoryCount.fromJson(row as Json),
      ],
      planned: _int(activities['planned']),
      completed: _int(activities['completed']),
      byDimension: [
        for (final row in activities['byDimension'] as List)
          DimensionCount.fromJson(row as Json),
      ],
      topSdgs: [
        for (final row in activities['topSdgs'] as List)
          SdgCount.fromJson(row as Json),
      ],
      totalProfit: num.parse(finance['totalProfit'] as String),
      totalExpenses: num.parse(finance['totalExpenses'] as String),
      societiesWithBoth: _int(finance['societiesWithBoth']),
      notSubmitted: _int(finance['notSubmitted']),
      documentCounts: [
        for (final row in documents['byType'] as List)
          DocumentCount.fromJson(row as Json),
      ],
      allFour: _int(documents['allFour']),
      auditPastDue: documents['pastDue'] == true,
    );
  }

  final FinancialYearLabel year;
  final int registered;
  final int active;
  final GradeCounts grades;
  final int notUpdatedIn90Days;
  final int gradeRequestsWaiting;
  final int? membershipYear;
  final int female;
  final int male;
  final int societiesReported;
  final List<CategoryCount> categories;
  final int planned;
  final int completed;
  final List<DimensionCount> byDimension;
  final List<SdgCount> topSdgs;
  final num totalProfit;
  final num totalExpenses;
  final int societiesWithBoth;
  final int notSubmitted;
  final List<DocumentCount> documentCounts;
  final int allFour;
  final bool auditPastDue;

  int get members => female + male;
  DocumentCount get auditReport =>
      documentCounts.firstWhere((row) => row.documentType == 'AUDIT_REPORT');
}

/// M65: one district, alphabetical, never ranked.
class DistrictFigures {
  const DistrictFigures({
    required this.id,
    required this.name,
    required this.province,
    required this.active,
    required this.grades,
    required this.members,
    required this.recordsCompletePercent,
    required this.auditPercent,
  });

  factory DistrictFigures.fromJson(Json json) => DistrictFigures(
    id: json['id'] as String,
    name: json['name'] as String,
    province: json['province'] as String?,
    active: _int(json['active']),
    grades: GradeCounts.fromJson(json['grades'] as Json),
    members: _int(json['members']),
    recordsCompletePercent: _int(json['recordsCompletePercent']),
    auditPercent: _int(json['auditPercent']),
  );

  final String id;
  final String name;
  final String? province;
  final int active;
  final GradeCounts grades;
  final int members;
  final int recordsCompletePercent;
  final int auditPercent;
}

/// M64: a society with a recorded position.
class MapPoint {
  const MapPoint(this.id, this.name, this.societyClass, this.lat, this.lng);

  factory MapPoint.fromJson(Json json) => MapPoint(
    json['id'] as String,
    json['name'] as String,
    json['class'] as String,
    (json['latitude'] as num).toDouble(),
    (json['longitude'] as num).toDouble(),
  );

  final String id;
  final String name;

  /// A, B, C, UNGRADED or NOT_ACTIVE.
  final String societyClass;
  final double lat;
  final double lng;
}

class SocietyMapData {
  const SocietyMapData(this.counts, this.notActive, this.points);

  factory SocietyMapData.fromJson(Json json) {
    final counts = json['counts'] as Json;
    return SocietyMapData(
      GradeCounts.fromJson(counts),
      _int(counts['notActive']),
      [
        for (final row in json['points'] as List)
          MapPoint.fromJson(row as Json),
      ],
    );
  }

  final GradeCounts counts;
  final int notActive;
  final List<MapPoint> points;
}

/// M66: one row of the society directory.
class DirectoryRow {
  const DirectoryRow({
    required this.id,
    required this.name,
    required this.societyCode,
    required this.grade,
    required this.requestedGrade,
    required this.members,
    required this.figuresAdded,
    required this.updatedAt,
    required this.notUpdatedIn90Days,
    this.excoSeatsFilled,
  });

  factory DirectoryRow.fromJson(Json json) => DirectoryRow(
    id: json['id'] as String,
    name: json['name'] as String,
    societyCode: json['societyCode'] as String,
    grade: json['grade'] as String?,
    requestedGrade: json['requestedGrade'] as String?,
    members: (json['members'] as num?)?.toInt(),
    figuresAdded: json['figuresAdded'] == true,
    updatedAt: DateTime.parse(json['updatedAt'] as String),
    notUpdatedIn90Days: json['notUpdatedIn90Days'] == true,
    excoSeatsFilled: (json['excoSeatsFilled'] as num?)?.toInt(),
  );

  final String id;
  final String name;
  final String societyCode;
  final String? grade;
  final String? requestedGrade;
  final int? members;
  final bool figuresAdded;
  final DateTime updatedAt;
  final bool notUpdatedIn90Days;

  /// Exco seats filled, 0–25 (null from an older server). A new society
  /// starts with none; its Society Officer enters them.
  final int? excoSeatsFilled;
}

class DirectoryPage {
  const DirectoryPage(this.total, this.grades, this.rows);

  factory DirectoryPage.fromJson(Json json) => DirectoryPage(
    _int((json['meta'] as Json)['totalItems']),
    GradeCounts.fromJson(json['grades'] as Json),
    [
      for (final row in json['data'] as List)
        DirectoryRow.fromJson(row as Json),
    ],
  );

  final int total;
  final GradeCounts grades;
  final List<DirectoryRow> rows;
}

/// M66 filters.
class DirectoryQuery {
  const DirectoryQuery({
    this.search = '',
    this.districtId,
    this.districtName,
    this.grade,
    this.notUpdated = false,
  });

  final String search;
  final String? districtId;
  final String? districtName;
  final String? grade;
  final bool notUpdated;

  bool get filtered =>
      search.isNotEmpty || districtId != null || grade != null || notUpdated;

  DirectoryQuery copyWith({
    String? search,
    String? Function()? district,
    String? districtName,
    String? Function()? grade,
    bool? notUpdated,
  }) {
    final districtId = district == null ? this.districtId : district();
    return DirectoryQuery(
      search: search ?? this.search,
      districtId: districtId,
      districtName: districtId == null
          ? null
          : (districtName ?? this.districtName),
      grade: grade == null ? this.grade : grade(),
      notUpdated: notUpdated ?? this.notUpdated,
    );
  }
}

/// M67: the society summary.
class SocietyAtAGlance {
  const SocietyAtAGlance({
    required this.id,
    required this.name,
    required this.societyCode,
    required this.district,
    required this.grade,
    required this.updatedAt,
    required this.members,
    required this.membershipYear,
    required this.recordsCompletePercent,
    required this.missingFields,
    required this.year,
    required this.profit,
    required this.expenses,
    required this.hasSocietyOfficer,
    required this.spcName,
    required this.uploaded,
    required this.auditPastDue,
    required this.gradeRequest,
    required this.planned,
    required this.approved,
    required this.latestActivity,
    required this.latestSdgs,
    this.excoSeatsFilled,
  });

  factory SocietyAtAGlance.fromJson(Json json) {
    final activities = json['activities'] as Json;
    final latest = activities['latest'] as Json?;
    final request = json['gradeRequest'] as Json?;
    return SocietyAtAGlance(
      id: json['id'] as String,
      name: json['name'] as String,
      societyCode: json['societyCode'] as String,
      district: json['district'] as String,
      grade: json['grade'] as String?,
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      members: (json['members'] as num?)?.toInt(),
      membershipYear: (json['membershipYear'] as num?)?.toInt(),
      recordsCompletePercent: _int(json['recordsCompletePercent']),
      missingFields: _int(json['missingFields']),
      year: FinancialYearLabel.fromJson(json['financialYear'] as Json),
      profit: json['profit'] == null
          ? null
          : num.parse(json['profit'] as String),
      expenses: json['expenses'] == null
          ? null
          : num.parse(json['expenses'] as String),
      hasSocietyOfficer: json['hasSocietyOfficer'] == true,
      spcName: json['spcName'] as String?,
      excoSeatsFilled: (json['excoSeatsFilled'] as num?)?.toInt(),
      uploaded: {
        for (final row in json['registrarDocuments'] as List)
          (row as Json)['documentType'] as String: row['uploaded'] == true,
      },
      auditPastDue: json['auditReportPastDue'] == true,
      gradeRequest: request == null
          ? null
          : '${request['fromGrade'] ?? '–'} → ${request['toGrade']}',
      planned: _int(activities['planned']),
      approved: _int(activities['approved']),
      latestActivity: latest?['name'] as String?,
      latestSdgs: [
        for (final sdg in (latest?['sdgs'] as List?) ?? const []) _int(sdg),
      ],
    );
  }

  final String id;
  final String name;
  final String societyCode;
  final String district;
  final String? grade;
  final DateTime updatedAt;
  final int? members;
  final int? membershipYear;
  final int recordsCompletePercent;
  final int missingFields;
  final FinancialYearLabel year;
  final num? profit;
  final num? expenses;
  final bool hasSocietyOfficer;
  final String? spcName;

  /// Registrar document type → uploaded for the year.
  final Map<String, bool> uploaded;
  final bool auditPastDue;
  final String? gradeRequest;
  final int planned;
  final int approved;
  final String? latestActivity;
  final List<int> latestSdgs;

  /// Exco seats filled, 0–25 (null from an older server).
  final int? excoSeatsFilled;
}

/// M63: done vs planned by sector, dimension and UN SDG.
class NationalProgrammes {
  const NationalProgrammes(
    this.year,
    this.planned,
    this.completed,
    this.sectors,
    this.byDimension,
    this.sdgs,
  );

  factory NationalProgrammes.fromJson(Json json) => NationalProgrammes(
    FinancialYearLabel.fromJson(json['financialYear'] as Json),
    _int(json['planned']),
    _int(json['completed']),
    {
      for (final row in json['sectors'] as List)
        (row as Json)['sector'] as String: (
          _int(row['completed']),
          _int(row['planned']),
        ),
    },
    [
      for (final row in json['byDimension'] as List)
        DimensionCount.fromJson(row as Json),
    ],
    [for (final row in json['sdgs'] as List) SdgCount.fromJson(row as Json)],
  );

  final FinancialYearLabel year;
  final int planned;
  final int completed;

  /// Sector → (completed, planned).
  final Map<String, (int, int)> sectors;
  final List<DimensionCount> byDimension;
  final List<SdgCount> sdgs;
}

/// M62b: societies that have not added both yearly figures.
class FiguresNotAdded {
  const FiguresNotAdded(this.total, this.societies);

  factory FiguresNotAdded.fromJson(Json json) =>
      FiguresNotAdded(_int((json['meta'] as Json)['totalItems']), [
        for (final row in json['notAdded'] as List)
          (
            (row as Json)['id'] as String,
            row['name'] as String,
            row['district'] as String,
          ),
      ]);

  final int total;
  final List<(String id, String name, String district)> societies;
}

const membershipCategoryLabels = {
  'CHILDREN': 'Child members',
  'YOUTH': 'Youth members',
  'MOTHERS': 'Mothers',
  'ORDINARY': 'Ordinary members',
  'ELDERS_COUNCIL': 'Elders’ council',
};

int sharePercent(int part, int whole) =>
    whole == 0 ? 0 : (part * 100 / whole).round();
