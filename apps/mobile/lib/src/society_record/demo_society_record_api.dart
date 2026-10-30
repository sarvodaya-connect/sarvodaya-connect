import 'dart:async';

import '../models/user.dart';
import 'society_record_api.dart';
import 'society_record_models.dart';

/// Fictional society records for demo mode and tests (SC_DEMO_MODE=true).
/// Applies the same role and assignment rules as the API so the demo
/// behaves like the real service. Nothing here leaves the phone.
class DemoSocietyRecordApi implements SocietyRecordApi {
  DemoSocietyRecordApi({
    required this.user,
    required this.clock,
    this.delay = const Duration(milliseconds: 500),
    this.isOnline,
  }) {
    _seed();
  }

  /// The signed-in demo user, whose role and assignments decide access.
  final AuthenticatedUser? Function() user;
  final DateTime Function() clock;
  final Duration delay;
  final bool Function()? isOnline;

  final _societies = <String, _DemoSociety>{};
  var _nextId = 1;

  /// The most recent financial year that has ended (1 April – 31 March).
  int get latestYear {
    final now = clock();
    return now.month >= 4 ? now.year - 1 : now.year - 2;
  }

  void _seed() {
    final year = latestYear;
    final now = clock();
    const spc = ActorRef('S. Karunaratne', UserRole.programmeCoordinator);
    const officer = ActorRef('Nimali Wijesinghe', UserRole.societyOfficer);
    const hq = ActorRef('D. Gunawardena', UserRole.hqAdmin);
    final pahala = _DemoSociety(
      id: 'society-pahala-kosgama',
      code: 'S-104233',
      name: 'Pahala Kosgama SSS',
      nameLocal: 'පහළ කොස්ගම සර්වෝදය සමිතිය',
      districtId: 'district-kurunegala',
      districtName: 'Kurunegala',
      memberCount: 412,
      landline: null,
      addressLine: 'Temple Road, Pahala Kosgama',
      dsDivision: 'Kuliyapitiya East',
      gnDivision: 'Kosgama',
      latitude: 7.4672,
      longitude: 80.0412,
      business: "A small rice mill for members' paddy, and a stall at the weekly Kosgama fair selling members' vegetables.",
      grade: 'B',
      gradeChangedAt: DateTime(2025, 3, 12, 11, 20),
      gradeChangedBy: hq,
      staff: const [
        StaffMember(UserRole.districtManager, 'R. Fernando', 'ACTIVE'),
        StaffMember(UserRole.deputyDistrictManager, 'P. Dissanayake', 'ACTIVE'),
        StaffMember(UserRole.programmeCoordinator, 'S. Karunaratne', 'ACTIVE'),
        StaffMember(UserRole.societyOfficer, 'Nimali Wijesinghe', 'ACTIVE'),
      ],
    );
    pahala.summaries[year] = _DemoSummary(
      profit: 412500,
      expenses: 1286000,
      profitChange: AmountChange(
        updatedAt: now.subtract(const Duration(days: 8)),
        updatedBy: officer,
        previousValue: 398000,
      ),
      expensesChange: AmountChange(
        updatedAt: now.subtract(const Duration(days: 9)),
        updatedBy: spc,
      ),
    );
    pahala.documents.add(
      _auditReport(
        year,
        'Audit_Report_Pahala_Kosgama_FY$year-${(year + 1) % 100}.pdf',
        officer,
        now.subtract(const Duration(days: 8)),
      ),
    );
    pahala.documents.addAll([
      _document(
        'AGM_MINUTES',
        'AGM minutes ${now.year}',
        officer,
        now.subtract(const Duration(days: 23)),
      ),
      _document(
        'OFFICE_BEARER_LIST',
        'Office-bearer list ${now.year}',
        officer,
        now.subtract(const Duration(days: 23)),
      ),
      _document(
        'REGISTRATION',
        'Registration certificate',
        hq,
        DateTime(2024, 1, 12),
      ),
    ]);
    pahala.requests.addAll([
      GradeRequest(
        id: 'grade-request-3',
        fromGrade: 'B',
        toGrade: 'A',
        reason:
            'The Exco was re-formed at the AGM, the ${now.year + 1} work plan is ready and every activity planned for ${now.year} took place.',
        status: GradeRequestStatus.pending,
        requestedBy: spc,
        requestedAt: now.subtract(const Duration(days: 6)),
      ),
      GradeRequest(
        id: 'grade-request-2',
        fromGrade: 'C',
        toGrade: 'B',
        reason: 'Audit complete and Exco reformed.',
        status: GradeRequestStatus.approved,
        requestedBy: spc,
        requestedAt: DateTime(2025, 3, 4),
        decidedBy: hq,
        decidedAt: DateTime(2025, 3, 12, 11, 20),
        decisionComment: 'Audit complete and Exco reformed. Approved.',
      ),
      GradeRequest(
        id: 'grade-request-1',
        fromGrade: 'C',
        toGrade: 'A',
        reason: 'The society has grown strongly this year.',
        status: GradeRequestStatus.rejected,
        requestedBy: officer,
        requestedAt: DateTime(2024, 11, 10),
        decidedBy: const ActorRef('K. Mendis', UserRole.hqAdmin),
        decidedAt: DateTime(2024, 11, 18),
        decisionComment: 'Move one grade at a time. Please apply for B first.',
      ),
    ]);
    pahala.history.addAll([
      _event(
        'ANNUAL_SUMMARY',
        'FY $year/${(year + 1) % 100} profit LKR 398,000 → 412,500',
        officer,
        now.subtract(const Duration(days: 8)),
      ),
      _event(
        'ANNUAL_SUMMARY',
        'FY $year/${(year + 1) % 100} expenses entered: LKR 1,286,000',
        spc,
        now.subtract(const Duration(days: 9)),
      ),
      _event(
        'GRADE',
        'Grade change B → A requested',
        spc,
        now.subtract(const Duration(days: 6)),
      ),
      _event(
        'EXCO',
        'Exco member replaced: K. Perera → D. Ratnayake',
        officer,
        now.subtract(const Duration(days: 10)),
      ),
      _event(
        'WORK_PLAN',
        'Work plan ${now.year + 1}: 3 activities added',
        spc,
        now.subtract(const Duration(days: 12)),
      ),
      _event(
        'GRADE',
        'Grade C → B approved',
        hq,
        DateTime(2025, 3, 12, 11, 20),
      ),
    ]);
    pahala.workPlan = [
      const WorkPlanActivity(
        month: 1,
        name: 'Tank cleaning shramadana',
        allocatedCost: 25000,
        sector: 'Environment',
      ),
      const WorkPlanActivity(
        month: 2,
        name: "Pre-school parents' meeting",
        allocatedCost: 8000,
        sector: 'Child wellbeing',
      ),
      const WorkPlanActivity(
        month: 3,
        name: 'Clean-water awareness day',
        allocatedCost: 15000,
        sector: 'Health and nutrition',
      ),
      const WorkPlanActivity(
        month: 9,
        name: 'Youth leadership camp',
        allocatedCost: 55000,
        sector: 'Community education',
        datesLabel: '12–14 Sep',
      ),
    ];
    pahala.exco = _exco(['A. Jayasekara', 'N. Wijesinghe', 'S. Tharmalingam']);

    final wellawa = _DemoSociety(
      id: 'society-wellawa',
      code: 'S-104507',
      name: 'Wellawa SSS',
      districtId: 'district-kurunegala',
      districtName: 'Kurunegala',
      memberCount: 143,
      addressLine: 'Kanda Para, Wellawa',
      dsDivision: 'Wariyapola',
      grade: 'C',
      staff: const [
        StaffMember(UserRole.districtManager, 'R. Fernando', 'ACTIVE'),
        StaffMember(UserRole.programmeCoordinator, 'S. Karunaratne', 'ACTIVE'),
      ],
    )..exco = _exco(['M. Rathnayake', 'S. Malkanthi', 'J. Fernando']);

    final mawathagama = _DemoSociety(
      id: 'society-mawathagama',
      code: 'S-104247',
      name: 'Mawathagama SSS',
      districtId: 'district-kurunegala',
      districtName: 'Kurunegala',
      memberCount: 188,
      addressLine: 'Wewa Road, Mawathagama',
      dsDivision: 'Mawathagama',
      grade: 'C',
      staff: const [
        StaffMember(UserRole.districtManager, 'R. Fernando', 'ACTIVE'),
        StaffMember(UserRole.programmeCoordinator, 'M. Herath', 'ACTIVE'),
      ],
    )..exco = _exco(['H. Perera', 'K. Gamage', 'P. Herath']);

    final wariyapola = _DemoSociety(
      id: 'society-wariyapola',
      code: 'S-301847',
      name: 'Wariyapola SSS',
      districtId: 'district-anuradhapura',
      districtName: 'Anuradhapura',
      memberCount: 265,
      grade: 'B',
    );
    for (final society in [pahala, wellawa, mawathagama, wariyapola]) {
      _societies[society.id] = society;
    }
  }

  List<ExcoMember> _exco(List<String> officeBearers) => [
    for (var seat = 1; seat <= 25; seat++)
      ExcoMember(
        id: 'exco-$seat-${officeBearers.first}',
        seatNumber: seat,
        fullName: seat <= 3 ? officeBearers[seat - 1] : 'Exco member $seat',
        position: switch (seat) {
          1 => 'President',
          2 => 'Secretary',
          3 => 'Treasurer',
          _ => 'Member',
        },
        age: 22 + (seat * 7) % 45,
        nicMasked: '••••${(seat * 37).toString().padLeft(4, '0')}',
      ),
  ];

  RecordDocument _document(
    String type,
    String title,
    ActorRef by,
    DateTime at,
  ) => RecordDocument(
    id: 'demo-document-${_nextId++}',
    documentType: type,
    title: title,
    fileName: '${title.replaceAll(' ', '_')}.pdf',
    sizeBytes: 640000,
    uploadedBy: by.displayName,
    uploadedByRole: by.role,
    uploadedAt: at,
  );

  RecordDocument _auditReport(
    int year,
    String fileName,
    ActorRef by,
    DateTime at,
  ) => RecordDocument(
    id: 'demo-document-${_nextId++}',
    documentType: 'AUDIT_REPORT',
    title: 'Audit report ${FinancialYear.starting(year).label}',
    fileName: fileName,
    sizeBytes: 1800000,
    uploadedBy: by.displayName,
    uploadedByRole: by.role,
    uploadedAt: at,
    financialYearLabel: FinancialYear.starting(year).label,
  );

  HistoryEvent _event(
    String category,
    String summary,
    ActorRef actor,
    DateTime at,
  ) => HistoryEvent(
    id: 'demo-event-${_nextId++}',
    category: category,
    summary: summary,
    actor: actor,
    occurredAt: at,
  );

  Future<void> _wait() async {
    if (delay > Duration.zero) await Future<void>.delayed(delay);
    if (isOnline != null && !isOnline!()) {
      throw const SocietyRecordException(
        'You are offline. Nothing you entered has been lost. Try again when you are connected.',
        offline: true,
      );
    }
  }

  AuthenticatedUser get _signedIn {
    final current = user();
    if (current == null) {
      throw const SocietyRecordException('Sign in to continue', status: 401);
    }
    return current;
  }

  _DemoSociety _visible(String id) {
    final society = _societies[id];
    if (society == null ||
        !_signedIn.canViewSociety(society.id, society.districtId, clock())) {
      throw const SocietyRecordException('Society not found', status: 404);
    }
    return society;
  }

  bool _hasRole(UserRole role) => _signedIn.roles.contains(role);

  bool _canEditSummary(_DemoSociety society) =>
      _signedIn.societyIds.contains(society.id) &&
      (_hasRole(UserRole.societyOfficer) ||
          _hasRole(UserRole.programmeCoordinator));

  bool _canRequestGrade(_DemoSociety society) =>
      !_hasRole(UserRole.hqAdmin) &&
      _signedIn.societyIds.contains(society.id) &&
      (_hasRole(UserRole.societyOfficer) ||
          _hasRole(UserRole.programmeCoordinator) ||
          _hasRole(UserRole.deputyDistrictManager));

  ActorRef get _actor => ActorRef(_signedIn.displayName, _signedIn.primaryRole);

  SocietyRecord _record(_DemoSociety society) {
    final signedIn = _signedIn;
    final canEdit = signedIn.canEditSociety(society.id);
    final summary = _summary(society, latestYear);
    final pending = society.requests
        .where((request) => request.status == GradeRequestStatus.pending)
        .firstOrNull;
    final temporary = signedIn.delegatedDistrictAccess
        .where(
          (grant) =>
              grant.districtId == society.districtId && grant.activeAt(clock()),
        )
        .firstOrNull;
    return SocietyRecord(
      id: society.id,
      societyCode: society.code,
      nameEn: society.name,
      nameLocal: society.nameLocal,
      districtName: society.districtName,
      memberCount: society.memberCount,
      landline: society.landline,
      addressLine: society.addressLine,
      dsDivision: society.dsDivision,
      gnDivision: society.gnDivision,
      latitude: society.latitude,
      longitude: society.longitude,
      businessDescription: society.business,
      grade: society.grade,
      gradeChangedAt: society.gradeChangedAt,
      gradeChangedBy: society.gradeChangedBy,
      openGradeRequest: pending,
      staff: society.staff,
      exco: society.exco,
      annualSummary: summary,
      lastChangeAt: society.history.isEmpty
          ? null
          : society.history.first.occurredAt,
      lastChangeBy: society.history.isEmpty
          ? null
          : society.history.first.actor,
      permissions: RecordPermissions(
        canEdit: canEdit,
        canRequestGradeChange: _canRequestGrade(society),
        canEditAnnualSummary: _canEditSummary(society),
        canUploadAuditReport: _canEditSummary(society),
        canUploadDocuments: canEdit,
        viewOnlyReason: canEdit
            ? null
            : signedIn.roles.contains(UserRole.districtManager)
            ? ViewOnlyReason.districtManager
            : temporary != null
            ? ViewOnlyReason.temporaryDistrictAccess
            : null,
        viewOnlyUntil: canEdit ? null : temporary?.expiresAt,
      ),
    );
  }

  AnnualSummary _summary(_DemoSociety society, int year) {
    final row = society.summaries[year];
    final report = society.documents
        .where(
          (document) =>
              document.documentType == 'AUDIT_REPORT' &&
              document.financialYearLabel == FinancialYear.starting(year).label,
        )
        .firstOrNull;
    return AnnualSummary(
      financialYear: FinancialYear.starting(year),
      totalProfit: row?.profit,
      totalExpenses: row?.expenses,
      profitChange: row?.profitChange,
      expensesChange: row?.expensesChange,
      auditReport: report == null
          ? null
          : AuditReportFile(
              documentId: report.id,
              fileName: report.fileName,
              sizeBytes: report.sizeBytes,
              uploadedAt: report.uploadedAt!,
              uploadedBy: ActorRef(report.uploadedBy, report.uploadedByRole),
            ),
    );
  }

  List<FinancialYear> get _years => [
    for (var index = 0; index < 5; index++)
      FinancialYear.starting(latestYear - index),
  ];

  @override
  Future<List<SocietyListItem>> listSocieties({String search = ''}) async {
    await _wait();
    final query = search.trim().toLowerCase();
    return _societies.values
        .where(
          (society) =>
              _signedIn.canViewSociety(society.id, society.districtId, clock()),
        )
        .where(
          (society) =>
              query.isEmpty ||
              society.name.toLowerCase().contains(query) ||
              society.code.toLowerCase().contains(query),
        )
        .map(
          (society) => SocietyListItem(
            society.id,
            society.code,
            society.name,
            society.districtName,
          ),
        )
        .toList();
  }

  @override
  Future<SocietyRecord> fetchRecord(String id) async {
    await _wait();
    return _record(_visible(id));
  }

  @override
  Future<SocietyRecord> updateRecord(
    String id,
    Map<String, Object> changes,
  ) async {
    await _wait();
    final society = _visible(id);
    if (!_signedIn.canEditSociety(id)) {
      throw const SocietyRecordException(
        'You are not authorised to update this society',
        status: 403,
      );
    }
    if (changes.containsKey('societyCode') || changes.containsKey('grade')) {
      throw const SocietyRecordException(
        'Only HQ can change the S number or grade',
        status: 403,
      );
    }
    final parts = <String>[];
    if (changes['memberCount'] case final int members) {
      parts.add('Members ${society.memberCount ?? '–'} → $members');
      society.memberCount = members;
    }
    if (changes['landline'] case final String landline) {
      final digits = landline.replaceAll(RegExp(r'[\s-]'), '');
      if (landline.isNotEmpty &&
          !RegExp(r'^(0\d{9}|\+94\d{9})$').hasMatch(digits)) {
        throw const SocietyRecordException(
          'Enter a 10-digit number, for example 037 000 0000, or leave the landline empty',
          status: 400,
        );
      }
      parts.add(
        society.landline == null
            ? 'Landline added'
            : landline.isEmpty
            ? 'Landline removed'
            : 'Landline changed',
      );
      society.landline = landline.isEmpty ? null : landline;
    }
    if (changes['nameEn'] case final String name) {
      parts.add('Name ${society.name} → $name');
      society.name = name;
    }
    if (changes['addressLine'] case final String address) {
      parts.add('Address changed');
      society.addressLine = address;
    }
    if (changes['businessDescription'] case final String business) {
      parts.add(
        society.business == null
            ? 'Business description added'
            : 'Business description changed',
      );
      society.business = business.isEmpty ? null : business;
    }
    if (changes['latitude'] case final num latitude) {
      society.latitude = latitude.toDouble();
      society.longitude = (changes['longitude'] as num).toDouble();
      parts.add('Map location changed');
    }
    if (parts.isNotEmpty) {
      society.history.insert(
        0,
        _event('SOCIETY', parts.join('; '), _actor, clock()),
      );
    }
    return _record(society);
  }

  @override
  Future<AnnualSummaryResult> fetchAnnualSummary(String id, {int? year}) async {
    await _wait();
    final society = _visible(id);
    return AnnualSummaryResult(
      financialYears: _years,
      summary: _summary(society, year ?? latestYear),
    );
  }

  @override
  Future<AnnualSummaryResult> saveAnnualSummary(
    String id,
    int year, {
    required double totalProfit,
    required double totalExpenses,
  }) async {
    await _wait();
    final society = _visible(id);
    if (!_canEditSummary(society)) {
      throw const SocietyRecordException(
        "Only the society's Society Officer or assigned SPC can enter the yearly figures and audit report",
        status: 403,
      );
    }
    if (year > latestYear || year <= latestYear - 5) {
      throw const SocietyRecordException(
        'Choose one of the last completed financial years',
        status: 400,
      );
    }
    final now = clock();
    final current = society.summaries[year] ?? _DemoSummary();
    final label = FinancialYear.starting(year).label;
    if (current.profit != totalProfit) {
      society.history.insert(
        0,
        _event(
          'ANNUAL_SUMMARY',
          '$label profit ${current.profit == null ? 'entered' : 'changed'}',
          _actor,
          now,
        ),
      );
      current.profitChange = AmountChange(
        updatedAt: now,
        updatedBy: _actor,
        previousValue: current.profit,
      );
      current.profit = totalProfit;
    }
    if (current.expenses != totalExpenses) {
      society.history.insert(
        0,
        _event(
          'ANNUAL_SUMMARY',
          '$label expenses ${current.expenses == null ? 'entered' : 'changed'}',
          _actor,
          now,
        ),
      );
      current.expensesChange = AmountChange(
        updatedAt: now,
        updatedBy: _actor,
        previousValue: current.expenses,
      );
      current.expenses = totalExpenses;
    }
    society.summaries[year] = current;
    return AnnualSummaryResult(
      financialYears: _years,
      summary: _summary(society, year),
    );
  }

  @override
  Future<List<GradeRequest>> fetchGradeRequests(String id) async {
    await _wait();
    return List.unmodifiable(_visible(id).requests);
  }

  @override
  Future<GradeRequest> requestGradeChange(
    String id, {
    required String toGrade,
    required String reason,
  }) async {
    await _wait();
    final society = _visible(id);
    if (!_canRequestGrade(society)) {
      throw const SocietyRecordException(
        'Only the assigned Society Officer, SPC or DDM can request a grade change',
        status: 403,
      );
    }
    if (society.grade == toGrade) {
      throw SocietyRecordException(
        'The society is already grade $toGrade. Choose a different grade',
        status: 400,
      );
    }
    if (society.requests.any(
      (request) => request.status == GradeRequestStatus.pending,
    )) {
      throw const SocietyRecordException(
        'This society already has a grade-change request waiting for HQ',
        status: 409,
      );
    }
    final request = GradeRequest(
      id: 'grade-request-${_nextId++}',
      fromGrade: society.grade,
      toGrade: toGrade,
      reason: reason,
      status: GradeRequestStatus.pending,
      requestedBy: _actor,
      requestedAt: clock(),
    );
    society.requests.insert(0, request);
    society.history.insert(
      0,
      _event(
        'GRADE',
        'Grade change ${request.change} requested',
        _actor,
        clock(),
      ),
    );
    return request;
  }

  @override
  Future<List<HistoryEvent>> fetchHistory(String id, {String? category}) async {
    await _wait();
    return _visible(id).history
        .where((event) => category == null || event.category == category)
        .toList();
  }

  @override
  Future<List<RecordDocument>> fetchDocuments(String id) async {
    await _wait();
    return List.unmodifiable(_visible(id).documents);
  }

  @override
  Future<WorkPlan> fetchWorkPlan(String id) async {
    await _wait();
    final plan = _visible(id).workPlan;
    return WorkPlan(
      clock().year + 1,
      plan,
      plan.fold(0, (sum, activity) => sum + activity.allocatedCost),
    );
  }

  @override
  Future<String> revealNic(String societyId, String memberId) async {
    await _wait();
    final member = _visible(societyId).exco
        .where((member) => member.id == memberId)
        .firstOrNull;
    if (member?.nicMasked == null) {
      throw const SocietyRecordException('Member not found', status: 404);
    }
    // Fictional NIC that matches the masked last four characters.
    return '19900000${member!.nicMasked!.substring(4)}';
  }

  @override
  Future<RecordDocument> uploadAuditReport(
    String id, {
    required int financialYear,
    required PickedDocument file,
    void Function(double progress)? onProgress,
  }) async {
    await _wait();
    final society = _visible(id);
    if (!_canEditSummary(society)) {
      throw const SocietyRecordException(
        "Only the society's Society Officer or assigned SPC can upload the audit report",
        status: 403,
      );
    }
    for (var step = 1; step <= 10; step++) {
      if (delay > Duration.zero) {
        await Future<void>.delayed(
          Duration(milliseconds: delay.inMilliseconds ~/ 5),
        );
      }
      onProgress?.call(step / 10);
    }
    final document = _auditReport(financialYear, file.name, _actor, clock());
    society.documents
      ..removeWhere(
        (existing) =>
            existing.documentType == 'AUDIT_REPORT' &&
            existing.financialYearLabel == document.financialYearLabel,
      )
      ..insert(0, document);
    society.history.insert(
      0,
      _event('ANNUAL_SUMMARY', '${document.title} uploaded', _actor, clock()),
    );
    return document;
  }
}

class _DemoSummary {
  _DemoSummary({
    this.profit,
    this.expenses,
    this.profitChange,
    this.expensesChange,
  });

  double? profit;
  double? expenses;
  AmountChange? profitChange;
  AmountChange? expensesChange;
}

class _DemoSociety {
  _DemoSociety({
    required this.id,
    required this.code,
    required this.name,
    required this.districtId,
    required this.districtName,
    this.nameLocal,
    this.memberCount,
    this.landline,
    this.addressLine,
    this.dsDivision,
    this.gnDivision,
    this.latitude,
    this.longitude,
    this.business,
    this.grade,
    this.gradeChangedAt,
    this.gradeChangedBy,
    this.staff = const [],
  });

  final String id;
  final String code;
  String name;
  final String? nameLocal;
  final String districtId;
  final String districtName;
  int? memberCount;
  String? landline;
  String? addressLine;
  final String? dsDivision;
  final String? gnDivision;
  double? latitude;
  double? longitude;
  String? business;
  String? grade;
  final DateTime? gradeChangedAt;
  final ActorRef? gradeChangedBy;
  final List<StaffMember> staff;
  List<ExcoMember> exco = const [];
  List<WorkPlanActivity> workPlan = const [];
  final summaries = <int, _DemoSummary>{};
  final requests = <GradeRequest>[];
  final documents = <RecordDocument>[];
  final history = <HistoryEvent>[];
}
