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
    final planYear = now.year + 1;
    pahala.workPlan = [
      _activity(
        planYear,
        1,
        'Tank cleaning shramadana',
        25000,
        'Environment',
        sdgs: [6, 15],
        people: [40, 35, 18, 120, 22],
      ),
      _activity(
        planYear,
        2,
        "Pre-school parents' meeting",
        8000,
        'Child wellbeing',
        sdgs: [4],
        people: [26, 9, 0, 30, 8],
      ),
      _activity(
        planYear,
        3,
        'Clean-water awareness day',
        15000,
        'Health and nutrition',
        sdgs: [3, 6],
        people: [52, 31, 20, 95, 17],
      ),
      _activity(
        planYear,
        9,
        'Youth leadership camp',
        55000,
        'Community education',
        datesLabel: '12–14 Sep',
        people: [24, 14, 12, 146, 31],
        submittedAt: now,
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
        seatType: switch (seat) {
          <= 9 => 'ORDINARY',
          <= 16 => 'ELDERS_COUNCIL',
          <= 19 => 'MOTHERS',
          <= 22 => 'YOUTH',
          _ => 'CHILDREN',
        },
        age: 22 + (seat * 7) % 45,
        dateOfBirth: DateTime.utc(
          1960 + (seat * 3) % 40,
          1 + seat % 12,
          1 + seat % 27,
        ),
        profession: const [
          'Teacher',
          'Farmer',
          'Clerk',
          'Shop owner',
          'Nurse',
        ][seat % 5],
        addressLine: 'No. $seat, Fictional Lane',
        phone: '+94 00 000 ${seat.toString().padLeft(4, '0')}',
        nicMasked: '••••${(seat * 37).toString().padLeft(4, '0')}',
      ),
  ];

  WorkPlanActivity _activity(
    int year,
    int month,
    String name,
    double cost,
    String sector, {
    List<int> sdgs = const [],
    List<int> people = const [0, 0, 0, 0, 0],
    String? datesLabel,
    DateTime? submittedAt,
  }) {
    const officer = ActorRef('Nimali Wijesinghe', UserRole.societyOfficer);
    const spc = ActorRef('S. Karunaratne', UserRole.programmeCoordinator);
    final approved = sdgs.isNotEmpty;
    return WorkPlanActivity(
      id: 'demo-activity-${_nextId++}',
      year: year,
      month: month,
      name: name,
      description: '$name with the village.',
      allocatedCost: cost,
      sector: sector,
      datesLabel: datesLabel,
      dimension: ActivityDimension.social,
      status: approved ? ActivityStatus.approved : ActivityStatus.waitingForSpc,
      sdgs: sdgs,
      femaleParticipants: people[0],
      maleParticipants: people[1],
      youthParticipants: people[2],
      householdsBenefited: people[3],
      womenHeadedHouseholds: people[4],
      createdBy: officer,
      submittedAt: submittedAt ?? clock().subtract(const Duration(days: 20)),
      reviewedBy: approved ? spc : null,
      reviewedAt: approved ? clock().subtract(const Duration(days: 10)) : null,
    );
  }

  RecordDocument _document(
    String type,
    String title,
    ActorRef by,
    DateTime at, {
    int? financialYear,
    String? fileName,
    int sizeBytes = 640000,
  }) => RecordDocument(
    id: 'demo-document-${_nextId++}',
    documentType: type,
    title: title,
    fileName: fileName ?? '${title.replaceAll(' ', '_')}.pdf',
    sizeBytes: sizeBytes,
    uploadedBy: by.displayName,
    uploadedByRole: by.role,
    uploadedAt: at,
    // The four Registrar documents are kept per financial year.
    financialYearLabel: registrarDocumentTypes.contains(type)
        ? FinancialYear.starting(financialYear ?? latestYear).label
        : null,
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

  bool _canAddActivities(_DemoSociety society) =>
      _signedIn.canEditSociety(society.id);

  bool _canReviewActivities(_DemoSociety society) =>
      _hasRole(UserRole.programmeCoordinator) &&
      _signedIn.societyIds.contains(society.id);

  @override
  Future<WorkPlan> fetchWorkPlan(String id, {int? year}) async {
    await _wait();
    final society = _visible(id);
    final planYear = year ?? clock().year + 1;
    final plan =
        society.workPlan.where((activity) => activity.year == planYear).toList()
          ..sort((a, b) => a.month.compareTo(b.month));
    return WorkPlan(
      planYear,
      plan,
      plan.fold(0, (sum, activity) => sum + activity.allocatedCost),
      canAddActivities: _canAddActivities(society),
    );
  }

  ({_DemoSociety society, int index}) _findActivity(String activityId) {
    for (final society in _societies.values) {
      final index = society.workPlan.indexWhere((a) => a.id == activityId);
      if (index >= 0 &&
          _signedIn.canViewSociety(society.id, society.districtId, clock())) {
        return (society: society, index: index);
      }
    }
    throw const SocietyRecordException('Activity not found', status: 404);
  }

  ActivityDetail _detail(_DemoSociety society, WorkPlanActivity activity) =>
      ActivityDetail(
        activity: activity,
        societyId: society.id,
        societyName: society.name,
        canEdit:
            activity.status != ActivityStatus.approved &&
            _canAddActivities(society),
        canReview:
            activity.status == ActivityStatus.waitingForSpc &&
            _canReviewActivities(society),
      );

  WorkPlanActivity _fromInput(
    String id,
    ActivityInput input, {
    ActorRef? createdBy,
  }) => WorkPlanActivity(
    id: id,
    year: input.year,
    month: input.month,
    name: input.name,
    description: input.description,
    allocatedCost: input.allocatedCost,
    sector: input.sector,
    datesLabel: input.datesLabel,
    dimension: input.dimension,
    status: ActivityStatus.waitingForSpc,
    femaleParticipants: input.femaleParticipants,
    maleParticipants: input.maleParticipants,
    youthParticipants: input.youthParticipants,
    householdsBenefited: input.householdsBenefited,
    womenHeadedHouseholds: input.womenHeadedHouseholds,
    partners: input.partners,
    resourcesNeeded: input.resourcesNeeded,
    volunteerHours: input.volunteerHours,
    createdBy: createdBy ?? _actor,
    submittedAt: clock(),
  );

  void _checkActivity(ActivityInput input) {
    if ((input.youthParticipants ?? 0) > input.totalParticipants) {
      throw const SocietyRecordException(
        'Youth are counted inside the female and male participants, so they cannot be more than both together',
        status: 400,
      );
    }
    if ((input.womenHeadedHouseholds ?? 0) > (input.householdsBenefited ?? 0)) {
      throw const SocietyRecordException(
        'Women-headed households are part of the households benefited, so they cannot be more',
        status: 400,
      );
    }
  }

  @override
  Future<ActivityDetail> createActivity(
    String societyId,
    ActivityInput input,
  ) async {
    await _wait();
    final society = _visible(societyId);
    if (!_canAddActivities(society)) {
      throw const SocietyRecordException(
        'You can view this work plan but cannot add or change its activities',
        status: 403,
      );
    }
    _checkActivity(input);
    final activity = _fromInput('demo-activity-${_nextId++}', input);
    society.workPlan = [...society.workPlan, activity];
    society.history.insert(
      0,
      _event(
        'WORK_PLAN',
        'Activity “${input.name}” added to the ${input.year} work plan and sent to the SPC',
        _actor,
        clock(),
      ),
    );
    return _detail(society, activity);
  }

  @override
  Future<ActivityDetail> updateActivity(
    String societyId,
    String activityId,
    ActivityInput input,
  ) async {
    await _wait();
    final society = _visible(societyId);
    final index = society.workPlan.indexWhere((a) => a.id == activityId);
    if (index < 0) {
      throw const SocietyRecordException('Activity not found', status: 404);
    }
    if (!_canAddActivities(society)) {
      throw const SocietyRecordException(
        'You can view this work plan but cannot add or change its activities',
        status: 403,
      );
    }
    final existing = society.workPlan[index];
    if (existing.status == ActivityStatus.approved) {
      throw const SocietyRecordException(
        'This activity is already approved and can no longer be changed',
        status: 409,
      );
    }
    _checkActivity(input);
    final activity = _fromInput(
      activityId,
      input,
      createdBy: existing.createdBy,
    );
    society.workPlan = [...society.workPlan]..[index] = activity;
    return _detail(society, activity);
  }

  @override
  Future<ActivityDetail> fetchActivity(String activityId) async {
    await _wait();
    final found = _findActivity(activityId);
    return _detail(found.society, found.society.workPlan[found.index]);
  }

  @override
  Future<ActivityQueue> fetchActivityQueue() async {
    await _wait();
    if (!_hasRole(UserRole.programmeCoordinator)) {
      throw const SocietyRecordException(
        'Only SPCs approve activities',
        status: 403,
      );
    }
    final since = clock().subtract(const Duration(days: 30));
    ActivityQueueItem item(_DemoSociety society, WorkPlanActivity a) =>
        ActivityQueueItem(
          id: a.id,
          name: a.name,
          status: a.status,
          year: a.year,
          month: a.month,
          societyId: society.id,
          societyName: society.name,
          totalParticipants: a.totalParticipants,
          householdsBenefited: a.householdsBenefited,
          sentBy: a.createdBy,
          submittedAt: a.submittedAt,
          sdgs: a.sdgs,
          approvedAt: a.status == ActivityStatus.approved ? a.reviewedAt : null,
        );
    final mine = [for (final id in _signedIn.societyIds) ?_societies[id]];
    final waiting =
        [
          for (final society in mine)
            for (final a in society.workPlan)
              if (a.status == ActivityStatus.waitingForSpc) item(society, a),
        ]..sort(
          (a, b) =>
              (a.submittedAt ?? clock()).compareTo(b.submittedAt ?? clock()),
        );
    final approved = [
      for (final society in mine)
        for (final a in society.workPlan)
          if (a.status == ActivityStatus.approved &&
              (a.reviewedAt?.isAfter(since) ?? false))
            item(society, a),
    ]..sort((a, b) => b.approvedAt!.compareTo(a.approvedAt!));
    return ActivityQueue(
      waiting: waiting,
      approvedRecently: approved.take(20).toList(),
      societyCount: _signedIn.societyIds.length,
    );
  }

  WorkPlanActivity _decide(
    WorkPlanActivity a, {
    required ActivityStatus status,
    List<int> sdgs = const [],
    String? comment,
  }) => WorkPlanActivity(
    id: a.id,
    year: a.year,
    month: a.month,
    name: a.name,
    description: a.description,
    allocatedCost: a.allocatedCost,
    sector: a.sector,
    datesLabel: a.datesLabel,
    status: status,
    dimension: a.dimension,
    sdgs: sdgs,
    femaleParticipants: a.femaleParticipants,
    maleParticipants: a.maleParticipants,
    youthParticipants: a.youthParticipants,
    householdsBenefited: a.householdsBenefited,
    womenHeadedHouseholds: a.womenHeadedHouseholds,
    partners: a.partners,
    resourcesNeeded: a.resourcesNeeded,
    volunteerHours: a.volunteerHours,
    createdBy: a.createdBy,
    submittedAt: a.submittedAt,
    reviewedBy: _actor,
    reviewedAt: clock(),
    reviewComment: comment,
  );

  ({_DemoSociety society, int index}) _reviewable(String activityId) {
    final found = _findActivity(activityId);
    if (!_canReviewActivities(found.society)) {
      throw const SocietyRecordException(
        "Only the society's SPC can approve activities and choose their UN SDGs",
        status: 403,
      );
    }
    if (found.society.workPlan[found.index].status !=
        ActivityStatus.waitingForSpc) {
      throw const SocietyRecordException(
        'This activity is no longer waiting for approval',
        status: 409,
      );
    }
    return found;
  }

  @override
  Future<ActivityDetail> approveActivity(
    String activityId,
    List<int> sdgs,
  ) async {
    await _wait();
    if (sdgs.isEmpty) {
      throw const SocietyRecordException(
        'Choose at least one UN SDG to approve',
        status: 400,
      );
    }
    if (sdgs.any((sdg) => sdg < 1 || sdg > 17)) {
      throw const SocietyRecordException(
        'Each UN SDG is a number from 1 to 17',
        status: 400,
      );
    }
    final found = _reviewable(activityId);
    final sorted = sdgs.toSet().toList()..sort();
    final activity = _decide(
      found.society.workPlan[found.index],
      status: ActivityStatus.approved,
      sdgs: sorted,
    );
    found.society.workPlan = [...found.society.workPlan]
      ..[found.index] = activity;
    found.society.history.insert(
      0,
      _event(
        'WORK_PLAN',
        'Activity “${activity.name}” approved by the SPC · UN SDG ${sorted.join(', ')}',
        _actor,
        clock(),
      ),
    );
    return _detail(found.society, activity);
  }

  @override
  Future<ActivityDetail> sendBackActivity(
    String activityId, {
    String? comment,
  }) async {
    await _wait();
    final found = _reviewable(activityId);
    final note = comment?.trim();
    final activity = _decide(
      found.society.workPlan[found.index],
      status: ActivityStatus.sentBack,
      comment: (note?.isEmpty ?? true) ? null : note,
    );
    found.society.workPlan = [...found.society.workPlan]
      ..[found.index] = activity;
    return _detail(found.society, activity);
  }

  @override
  Future<RegistrarDocuments> fetchRegistrarDocuments(
    String id, {
    int? year,
  }) async {
    await _wait();
    final society = _visible(id);
    final startYear = year ?? latestYear;
    final label = FinancialYear.starting(startYear).label;
    final reviewer =
        _hasRole(UserRole.hqAdmin) || _hasRole(UserRole.districtManager);
    RegistrarDocument? latest(String type) {
      final doc = society.documents
          .where((d) => d.documentType == type && d.financialYearLabel == label)
          .firstOrNull;
      if (doc == null) return null;
      return RegistrarDocument(
        id: doc.id,
        fileName: doc.fileName,
        sizeBytes: doc.sizeBytes,
        version: 1,
        uploadedAt: doc.uploadedAt ?? clock(),
        uploadedBy: ActorRef(doc.uploadedBy, doc.uploadedByRole),
        canOpen: type != 'MEMBERS_LIST' || reviewer,
      );
    }

    return RegistrarDocuments(
      startYear: startYear,
      yearLabel: label,
      documents: {
        for (final type in registrarDocumentTypes) type: latest(type),
      },
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
  Future<SocietyRecord> updateCouncil(
    String societyId,
    List<Map<String, Object?>> members,
  ) async {
    await _wait();
    final society = _visible(societyId);
    if (!_signedIn.canEditSociety(societyId)) {
      throw const SocietyRecordException(
        'You are not authorised to update this society',
        status: 403,
      );
    }
    // A partly entered Exco can be saved (0–25 seats), as on the API.
    if (members.length > 25) {
      throw const SocietyRecordException('The Exco has 25 seats', status: 400);
    }
    // The same seat rules as the API: one member a seat, each group within
    // its number, and each office held by at most one member.
    final problem = excoSaveProblem(members);
    if (problem != null) {
      throw SocietyRecordException(problem, status: 400);
    }
    final before = {
      for (final member in society.exco) member.seatNumber: member,
    };
    society.exco = [
      for (final row in members)
        () {
          final seat = row['seatNumber']! as int;
          final previous = before[seat];
          final same = previous?.fullName == row['fullName'];
          return ExcoMember(
            id: same ? previous!.id : 'exco-$seat-${_nextId++}',
            seatNumber: seat,
            fullName: row['fullName']! as String,
            position: row['position']! as String,
            seatType: row['seatType'] as String? ?? 'ORDINARY',
            dateOfBirth: DateTime.tryParse(row['dateOfBirth'] as String? ?? ''),
            profession: row['profession'] as String?,
            addressLine: row['addressLine'] as String?,
            phone: row['phone'] as String?,
            // The API keeps a NIC only while the seat and name are unchanged.
            nicMasked: same ? previous!.nicMasked : null,
          );
        }(),
    ];
    society.history.insert(0, _event('EXCO', 'Exco updated', _actor, clock()));
    return _record(society);
  }

  @override
  Future<void> setNic(String societyId, String memberId, String nic) async {
    await _wait();
    final society = _visible(societyId);
    final index = society.exco.indexWhere((member) => member.id == memberId);
    if (index < 0) {
      throw const SocietyRecordException('Member not found', status: 404);
    }
    final member = society.exco[index];
    society.exco[index] = ExcoMember(
      id: member.id,
      seatNumber: member.seatNumber,
      fullName: member.fullName,
      position: member.position,
      seatType: member.seatType,
      dateOfBirth: member.dateOfBirth,
      profession: member.profession,
      addressLine: member.addressLine,
      phone: member.phone,
      nicMasked: '••••${nic.substring(nic.length - 4).toUpperCase()}',
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
    await _wait();
    final society = _visible(id);
    final isAudit = documentType == 'AUDIT_REPORT';
    if (isAudit ? !_canEditSummary(society) : !_signedIn.canEditSociety(id)) {
      throw SocietyRecordException(
        isAudit
            ? "Only the society's Society Officer or assigned SPC can upload the audit report"
            : 'You can view this society but cannot add documents to it',
        status: 403,
      );
    }
    final yearly = registrarDocumentTypes.contains(documentType);
    if (yearly && financialYear == null) {
      throw const SocietyRecordException(
        'Choose the financial year',
        status: 400,
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
    final label = documentTypeLabels[documentType] ?? 'Document';
    final document = isAudit
        ? _auditReport(financialYear!, file.name, _actor, clock())
        : _document(
            documentType,
            yearly
                ? '$label ${FinancialYear.starting(financialYear!).label}'
                : (title ?? label),
            _actor,
            clock(),
            financialYear: financialYear,
            fileName: file.name,
            sizeBytes: file.sizeBytes,
          );
    society.documents
      ..removeWhere(
        (existing) =>
            yearly &&
            existing.documentType == documentType &&
            existing.financialYearLabel == document.financialYearLabel,
      )
      ..insert(0, document);
    society.history.insert(
      0,
      _event(
        isAudit ? 'ANNUAL_SUMMARY' : 'DOCUMENTS',
        '${document.title} uploaded',
        _actor,
        clock(),
      ),
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
