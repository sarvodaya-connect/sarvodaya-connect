import '../models/user.dart';

/// SC-65 V4 society record (Prototype v4, M06–M13). Mirrors
/// packages/api-contracts/src/society-record.ts. Annual figures are two
/// yearly totals only: no transactions, loans, savings or accounts.

UserRole? roleFromApi(Object? value) => switch (value) {
  'SOCIETY_OFFICER' => UserRole.societyOfficer,
  'PROGRAMME_COORDINATOR' => UserRole.programmeCoordinator,
  'DEPUTY_DISTRICT_MANAGER' => UserRole.deputyDistrictManager,
  'DISTRICT_MANAGER' => UserRole.districtManager,
  'HQ_ADMIN' => UserRole.hqAdmin,
  _ => null,
};

extension RecordRoleLabels on UserRole {
  /// The short labels the society record uses, e.g. "(SPC)" or "(DDM)".
  String get recordLabel => switch (this) {
    UserRole.societyOfficer => 'Society Officer',
    UserRole.programmeCoordinator => 'SPC',
    UserRole.deputyDistrictManager => 'DDM',
    UserRole.districtManager => 'DM',
    UserRole.hqAdmin => 'HQ',
  };
}

DateTime? _date(Object? value) =>
    value is String ? DateTime.parse(value).toLocal() : null;

double? _amount(Object? value) => value is num ? value.toDouble() : null;

class ActorRef {
  const ActorRef(this.displayName, [this.role]);

  factory ActorRef.fromJson(Map<String, dynamic> json) => ActorRef(
    json['displayName'] as String? ?? 'Unknown user',
    roleFromApi(json['role']),
  );

  final String displayName;
  final UserRole? role;

  /// "N. Wijesinghe (Society Officer)"
  String get label =>
      role == null ? displayName : '$displayName (${role!.recordLabel})';
}

const gradeLabels = {
  'A': 'Strong',
  'B': 'Developing',
  'C': 'Needs strengthening',
};

class FinancialYear {
  const FinancialYear({
    required this.startYear,
    required this.label,
    required this.startsOn,
    required this.endsOn,
  });

  factory FinancialYear.fromJson(Map<String, dynamic> json) => FinancialYear(
    startYear: json['startYear'] as int,
    label: json['label'] as String,
    startsOn: DateTime.parse(json['startsOn'] as String),
    endsOn: DateTime.parse(json['endsOn'] as String),
  );

  /// 1 April to 31 March (shown in the prototype; to be confirmed).
  factory FinancialYear.starting(int startYear) => FinancialYear(
    startYear: startYear,
    label:
        'FY $startYear/${((startYear + 1) % 100).toString().padLeft(2, '0')}',
    startsOn: DateTime(startYear, 4, 1),
    endsOn: DateTime(startYear + 1, 3, 31),
  );

  final int startYear;
  final String label;
  final DateTime startsOn;
  final DateTime endsOn;
}

class AmountChange {
  const AmountChange({
    required this.updatedAt,
    required this.updatedBy,
    this.previousValue,
  });

  factory AmountChange.fromJson(Map<String, dynamic> json) => AmountChange(
    updatedAt: _date(json['updatedAt'])!,
    updatedBy: ActorRef.fromJson(json['updatedBy'] as Map<String, dynamic>),
    previousValue: _amount(json['previousValue']),
  );

  final DateTime updatedAt;
  final ActorRef updatedBy;
  final double? previousValue;
}

class AuditReportFile {
  const AuditReportFile({
    required this.documentId,
    required this.fileName,
    required this.sizeBytes,
    required this.uploadedAt,
    required this.uploadedBy,
  });

  factory AuditReportFile.fromJson(Map<String, dynamic> json) =>
      AuditReportFile(
        documentId: json['documentId'] as String,
        fileName: json['fileName'] as String,
        sizeBytes: json['sizeBytes'] as int,
        uploadedAt: _date(json['uploadedAt'])!,
        uploadedBy: ActorRef.fromJson(
          json['uploadedBy'] as Map<String, dynamic>,
        ),
      );

  final String documentId;
  final String fileName;
  final int sizeBytes;
  final DateTime uploadedAt;
  final ActorRef uploadedBy;
}

class AnnualSummary {
  const AnnualSummary({
    required this.financialYear,
    this.totalProfit,
    this.totalExpenses,
    this.profitChange,
    this.expensesChange,
    this.auditReport,
  });

  factory AnnualSummary.fromJson(Map<String, dynamic> json) => AnnualSummary(
    financialYear: FinancialYear.fromJson(
      json['financialYear'] as Map<String, dynamic>,
    ),
    totalProfit: _amount(json['totalProfit']),
    totalExpenses: _amount(json['totalExpenses']),
    profitChange: json['profitChange'] == null
        ? null
        : AmountChange.fromJson(json['profitChange'] as Map<String, dynamic>),
    expensesChange: json['expensesChange'] == null
        ? null
        : AmountChange.fromJson(json['expensesChange'] as Map<String, dynamic>),
    auditReport: json['auditReport'] == null
        ? null
        : AuditReportFile.fromJson(json['auditReport'] as Map<String, dynamic>),
  );

  final FinancialYear financialYear;
  final double? totalProfit;
  final double? totalExpenses;
  final AmountChange? profitChange;
  final AmountChange? expensesChange;
  final AuditReportFile? auditReport;

  bool get figuresAdded => totalProfit != null && totalExpenses != null;
  bool get complete => figuresAdded && auditReport != null;

  /// The most recent change to either total.
  AmountChange? get lastChange {
    final changes = [?profitChange, ?expensesChange]
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return changes.isEmpty ? null : changes.first;
  }
}

class AnnualSummaryResult {
  const AnnualSummaryResult({
    required this.financialYears,
    required this.summary,
  });

  factory AnnualSummaryResult.fromJson(Map<String, dynamic> json) =>
      AnnualSummaryResult(
        financialYears: (json['financialYears'] as List)
            .map((year) => FinancialYear.fromJson(year as Map<String, dynamic>))
            .toList(),
        summary: AnnualSummary.fromJson(
          json['summary'] as Map<String, dynamic>,
        ),
      );

  final List<FinancialYear> financialYears;
  final AnnualSummary summary;
}

enum GradeRequestStatus { pending, approved, rejected }

class GradeRequest {
  const GradeRequest({
    required this.id,
    required this.fromGrade,
    required this.toGrade,
    required this.reason,
    required this.status,
    required this.requestedBy,
    required this.requestedAt,
    this.decidedBy,
    this.decidedAt,
    this.decisionComment,
  });

  factory GradeRequest.fromJson(Map<String, dynamic> json) => GradeRequest(
    id: json['id'] as String,
    fromGrade: json['fromGrade'] as String?,
    toGrade: json['toGrade'] as String,
    reason: json['reason'] as String,
    status: switch (json['status']) {
      'APPROVED' => GradeRequestStatus.approved,
      'REJECTED' => GradeRequestStatus.rejected,
      _ => GradeRequestStatus.pending,
    },
    requestedBy: ActorRef.fromJson(json['requestedBy'] as Map<String, dynamic>),
    requestedAt: _date(json['requestedAt'])!,
    decidedBy: json['decidedBy'] == null
        ? null
        : ActorRef.fromJson(json['decidedBy'] as Map<String, dynamic>),
    decidedAt: _date(json['decidedAt']),
    decisionComment: json['decisionComment'] as String?,
  );

  final String id;
  final String? fromGrade;
  final String toGrade;
  final String reason;
  final GradeRequestStatus status;
  final ActorRef requestedBy;
  final DateTime requestedAt;
  final ActorRef? decidedBy;
  final DateTime? decidedAt;
  final String? decisionComment;

  String get change => '${fromGrade ?? '–'} → $toGrade';
}

class StaffMember {
  const StaffMember(this.role, this.displayName, this.accountStatus);

  final UserRole? role;
  final String displayName;
  final String accountStatus;
}

enum ViewOnlyReason { districtManager, temporaryDistrictAccess }

class RecordPermissions {
  const RecordPermissions({
    this.canEdit = false,
    this.canRequestGradeChange = false,
    this.canEditAnnualSummary = false,
    this.canUploadAuditReport = false,
    this.canUploadDocuments = false,
    this.viewOnlyReason,
    this.viewOnlyUntil,
  });

  factory RecordPermissions.fromJson(Map<String, dynamic> json) =>
      RecordPermissions(
        canEdit: json['canEdit'] == true,
        canRequestGradeChange: json['canRequestGradeChange'] == true,
        canEditAnnualSummary: json['canEditAnnualSummary'] == true,
        canUploadAuditReport: json['canUploadAuditReport'] == true,
        canUploadDocuments: json['canUploadDocuments'] == true,
        viewOnlyReason: switch (json['viewOnlyReason']) {
          'DISTRICT_MANAGER' => ViewOnlyReason.districtManager,
          'TEMPORARY_DISTRICT_ACCESS' => ViewOnlyReason.temporaryDistrictAccess,
          _ => null,
        },
        viewOnlyUntil: _date(json['viewOnlyUntil']),
      );

  final bool canEdit;
  final bool canRequestGradeChange;
  final bool canEditAnnualSummary;
  final bool canUploadAuditReport;
  final bool canUploadDocuments;
  final ViewOnlyReason? viewOnlyReason;
  final DateTime? viewOnlyUntil;
}

/// The three Exco offices; every other seat holder is a "Member".
const officeBearers = ['President', 'Secretary', 'Treasurer'];

class ExcoMember {
  const ExcoMember({
    required this.id,
    required this.seatNumber,
    required this.fullName,
    required this.position,
    this.seatType = 'ORDINARY',
    this.age,
    this.dateOfBirth,
    this.profession,
    this.addressLine,
    this.phone,
    this.email,
    this.appointedOn,
    this.nicMasked,
  });

  factory ExcoMember.fromJson(Map<String, dynamic> json) => ExcoMember(
    id: json['id'] as String,
    seatNumber: json['seatNumber'] as int? ?? 0,
    fullName: json['fullName'] as String,
    position: json['position'] as String,
    seatType: json['seatType'] as String? ?? 'ORDINARY',
    age: json['age'] as int?,
    dateOfBirth: DateTime.tryParse(json['dateOfBirth'] as String? ?? ''),
    profession: json['profession'] as String?,
    addressLine: json['addressLine'] as String?,
    phone: json['phone'] as String?,
    email: json['email'] as String?,
    appointedOn: json['appointedOn'] as String?,
    nicMasked: json['nicMasked'] as String?,
  );

  final String id;
  final int seatNumber;
  final String fullName;
  final String position;

  /// The seat group the API requires (3 children, 3 youth, 3 mothers, 9
  /// ordinary, 7 elders' council). It stays with the seat when replacing.
  final String seatType;
  final int? age;
  final DateTime? dateOfBirth;
  final String? profession;
  final String? addressLine;
  final String? phone;
  final String? email;
  final String? appointedOn;
  final String? nicMasked;

  bool get isOfficeBearer => officeBearers.contains(position);

  /// The seat as the council update expects it (V5 M07e saves all 25 together).
  Map<String, Object?> toCouncilJson() => {
    'seatNumber': seatNumber,
    'fullName': fullName,
    'position': position,
    'seatType': seatType,
    if (dateOfBirth != null)
      'dateOfBirth': dateOfBirth!.toIso8601String().substring(0, 10),
    if (dateOfBirth == null && age != null) 'age': age,
    if (profession != null) 'profession': profession,
    if (addressLine != null) 'addressLine': addressLine,
    if (phone != null) 'phone': phone,
    if (email != null) 'email': email,
    if (appointedOn != null) 'appointedOn': appointedOn,
    'isActive': true,
    'isPrimaryContact': position == 'President',
  };

  ExcoMember copyWith({String? position}) => ExcoMember(
    id: id,
    seatNumber: seatNumber,
    fullName: fullName,
    position: position ?? this.position,
    seatType: seatType,
    age: age,
    dateOfBirth: dateOfBirth,
    profession: profession,
    addressLine: addressLine,
    phone: phone,
    email: email,
    appointedOn: appointedOn,
    nicMasked: nicMasked,
  );
}

class SocietyRecord {
  const SocietyRecord({
    required this.id,
    required this.societyCode,
    required this.nameEn,
    required this.districtName,
    required this.annualSummary,
    required this.permissions,
    this.nameLocal,
    this.memberCount,
    this.landline,
    this.addressLine,
    this.dsDivision,
    this.gnDivision,
    this.latitude,
    this.longitude,
    this.businessDescription,
    this.grade,
    this.gradeChangedAt,
    this.gradeChangedBy,
    this.openGradeRequest,
    this.staff = const [],
    this.exco = const [],
    this.lastChangeAt,
    this.lastChangeBy,
  });

  factory SocietyRecord.fromJson(Map<String, dynamic> json) {
    final address = (json['address'] as Map?) ?? const {};
    final location = json['location'] as Map?;
    final lastChange = json['lastChange'] as Map<String, dynamic>?;
    return SocietyRecord(
      id: json['id'] as String,
      societyCode: json['societyCode'] as String,
      nameEn: json['nameEn'] as String,
      nameLocal: json['nameLocal'] as String?,
      districtName: (json['district'] as Map)['nameEn'] as String,
      memberCount: json['memberCount'] as int?,
      landline: json['landline'] as String?,
      addressLine: address['addressLine'] as String?,
      dsDivision: address['dsDivision'] as String?,
      gnDivision: address['gnDivision'] as String?,
      latitude: _amount(location?['latitude']),
      longitude: _amount(location?['longitude']),
      businessDescription: json['businessDescription'] as String?,
      grade: json['grade'] as String?,
      gradeChangedAt: _date(json['gradeChangedAt']),
      gradeChangedBy: json['gradeChangedBy'] == null
          ? null
          : ActorRef.fromJson(json['gradeChangedBy'] as Map<String, dynamic>),
      openGradeRequest: json['openGradeRequest'] == null
          ? null
          : GradeRequest.fromJson(
              json['openGradeRequest'] as Map<String, dynamic>,
            ),
      staff: ((json['staff'] as List?) ?? const [])
          .map(
            (row) => StaffMember(
              roleFromApi(row['role']),
              row['displayName'] as String,
              row['accountStatus'] as String,
            ),
          )
          .toList(),
      exco: ((json['committee'] as List?) ?? const [])
          .where((row) => row['isActive'] != false)
          .map((row) => ExcoMember.fromJson(row as Map<String, dynamic>))
          .toList(),
      annualSummary: AnnualSummary.fromJson(
        json['annualSummary'] as Map<String, dynamic>,
      ),
      permissions: RecordPermissions.fromJson(
        json['permissions'] as Map<String, dynamic>,
      ),
      lastChangeAt: _date(lastChange?['at']),
      lastChangeBy: lastChange == null
          ? null
          : ActorRef.fromJson(lastChange['by'] as Map<String, dynamic>),
    );
  }

  final String id;
  final String societyCode;
  final String nameEn;
  final String? nameLocal;
  final String districtName;
  final int? memberCount;
  final String? landline;
  final String? addressLine;
  final String? dsDivision;
  final String? gnDivision;
  final double? latitude;
  final double? longitude;
  final String? businessDescription;
  final String? grade;
  final DateTime? gradeChangedAt;
  final ActorRef? gradeChangedBy;
  final GradeRequest? openGradeRequest;
  final List<StaffMember> staff;
  final List<ExcoMember> exco;
  final AnnualSummary annualSummary;
  final RecordPermissions permissions;
  final DateTime? lastChangeAt;
  final ActorRef? lastChangeBy;

  StaffMember? staffWithRole(UserRole role) {
    for (final member in staff) {
      if (member.role == role) return member;
    }
    return null;
  }
}

class SocietyListItem {
  const SocietyListItem(
    this.id,
    this.societyCode,
    this.nameEn,
    this.districtName,
  );

  final String id;
  final String societyCode;
  final String nameEn;
  final String districtName;
}

class HistoryEvent {
  const HistoryEvent({
    required this.id,
    required this.category,
    required this.summary,
    required this.actor,
    required this.occurredAt,
  });

  factory HistoryEvent.fromJson(Map<String, dynamic> json) => HistoryEvent(
    id: json['id'] as String,
    category: json['category'] as String,
    summary: json['summary'] as String,
    actor: ActorRef.fromJson(json['actor'] as Map<String, dynamic>),
    occurredAt: _date(json['occurredAt'])!,
  );

  final String id;
  final String category;
  final String summary;
  final ActorRef actor;
  final DateTime occurredAt;
}

class RecordDocument {
  const RecordDocument({
    required this.id,
    required this.documentType,
    required this.title,
    required this.fileName,
    required this.sizeBytes,
    required this.uploadedBy,
    this.uploadedByRole,
    this.uploadedAt,
    this.financialYearLabel,
  });

  factory RecordDocument.fromJson(Map<String, dynamic> json) => RecordDocument(
    id: json['id'] as String,
    documentType: json['documentType'] as String,
    title: json['title'] as String,
    fileName: json['fileName'] as String,
    sizeBytes: json['sizeBytes'] as int,
    uploadedBy: json['uploadedBy'] as String,
    uploadedByRole: roleFromApi(json['uploadedByRole']),
    uploadedAt: _date(json['uploadedAt']),
    financialYearLabel: (json['financialYear'] as Map?)?['label'] as String?,
  );

  final String id;
  final String documentType;
  final String title;
  final String fileName;
  final int sizeBytes;
  final String uploadedBy;
  final UserRole? uploadedByRole;
  final DateTime? uploadedAt;
  final String? financialYearLabel;
}

/// The 17 UN Sustainable Development Goals in official order (V5 M51). The
/// SPC chooses them when approving an activity; the number is what is saved.
const sdgTitles = [
  'No poverty',
  'Zero hunger',
  'Good health and well-being',
  'Quality education',
  'Gender equality',
  'Clean water and sanitation',
  'Affordable and clean energy',
  'Decent work and economic growth',
  'Industry, innovation and infrastructure',
  'Reduced inequalities',
  'Sustainable cities and communities',
  'Responsible consumption and production',
  'Climate action',
  'Life below water',
  'Life on land',
  'Peace, justice and strong institutions',
  'Partnerships for the goals',
];

String sdgTitle(int sdg) =>
    sdg >= 1 && sdg <= sdgTitles.length ? sdgTitles[sdg - 1] : 'SDG $sdg';

/// "SDG 6, 15"
String sdgShortList(List<int> sdgs) => 'SDG ${sdgs.join(', ')}';

/// Official icon shipped in assets/sdg (source: docs/sdg-icons.md).
String sdgAsset(int sdg) =>
    'assets/sdg/sdg-${sdg.toString().padLeft(2, '0')}.jpg';

/// Waiting for the SPC until approved (with UN SDGs) or sent back. Only
/// approved activities count in the dashboards.
enum ActivityStatus {
  waitingForSpc('WAITING_FOR_SPC', 'Waiting for SPC'),
  sentBack('SENT_BACK', 'Sent back'),
  approved('APPROVED', 'Approved');

  const ActivityStatus(this.api, this.label);
  final String api;
  final String label;

  static ActivityStatus fromApi(Object? value) => ActivityStatus.values
      .firstWhere((status) => status.api == value, orElse: () => approved);
}

enum ActivityDimension {
  social('SOCIAL', 'Social'),
  economic('ECONOMIC', 'Economic'),
  governance('GOVERNANCE', 'Governance');

  const ActivityDimension(this.api, this.label);
  final String api;
  final String label;

  static ActivityDimension? fromApi(Object? value) => ActivityDimension.values
      .where((dimension) => dimension.api == value)
      .firstOrNull;
}

/// The 10 Sarvodaya sectors (V5 M09a). To be confirmed with Sarvodaya.
const sarvodayaSectors = [
  'Community education',
  'Child wellbeing',
  'Culture',
  'Economy',
  'Governance',
  'Health and nutrition',
  'Housing and infrastructure',
  'Spiritual development',
  'Agriculture',
  'Environment',
];

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

int? _int(Object? value) => value is num ? value.toInt() : null;

/// M09a–M09c: what the Society Officer sends to the SPC.
class ActivityInput {
  const ActivityInput({
    required this.year,
    required this.month,
    required this.name,
    required this.description,
    required this.sector,
    required this.dimension,
    required this.allocatedCost,
    this.datesLabel,
    this.femaleParticipants,
    this.maleParticipants,
    this.youthParticipants,
    this.householdsBenefited,
    this.womenHeadedHouseholds,
    this.partners,
    this.resourcesNeeded,
    this.volunteerHours,
  });

  final int year;
  final int month;
  final String name;
  final String description;
  final String sector;
  final ActivityDimension dimension;
  final double allocatedCost;
  final String? datesLabel;
  final int? femaleParticipants;
  final int? maleParticipants;
  final int? youthParticipants;
  final int? householdsBenefited;
  final int? womenHeadedHouseholds;
  final String? partners;
  final String? resourcesNeeded;
  final int? volunteerHours;

  /// Female plus male; youth are counted inside these.
  int get totalParticipants =>
      (femaleParticipants ?? 0) + (maleParticipants ?? 0);

  Map<String, Object> toJson() => {
    'year': year,
    'month': month,
    'name': name,
    'description': description,
    'sector': sector,
    'dimension': dimension.api,
    'allocatedCost': allocatedCost,
    if (datesLabel?.trim().isNotEmpty ?? false)
      'datesLabel': datesLabel!.trim(),
    'femaleParticipants': ?femaleParticipants,
    'maleParticipants': ?maleParticipants,
    'youthParticipants': ?youthParticipants,
    'householdsBenefited': ?householdsBenefited,
    'womenHeadedHouseholds': ?womenHeadedHouseholds,
    if (partners?.trim().isNotEmpty ?? false) 'partners': partners!.trim(),
    if (resourcesNeeded?.trim().isNotEmpty ?? false)
      'resourcesNeeded': resourcesNeeded!.trim(),
    'volunteerHours': ?volunteerHours,
  };
}

class WorkPlanActivity {
  const WorkPlanActivity({
    required this.month,
    required this.name,
    required this.allocatedCost,
    this.id = '',
    this.year = 0,
    this.description = '',
    this.sector,
    this.datesLabel,
    this.status = ActivityStatus.approved,
    this.dimension,
    this.sdgs = const [],
    this.femaleParticipants,
    this.maleParticipants,
    this.youthParticipants,
    this.householdsBenefited,
    this.womenHeadedHouseholds,
    this.partners,
    this.resourcesNeeded,
    this.volunteerHours,
    this.createdBy,
    this.submittedAt,
    this.reviewedBy,
    this.reviewedAt,
    this.reviewComment,
  });

  factory WorkPlanActivity.fromJson(Map<String, dynamic> json) {
    final review = json['review'] as Map<String, dynamic>?;
    return WorkPlanActivity(
      id: json['id'] as String,
      year: json['year'] as int,
      month: json['month'] as int,
      name: json['name'] as String,
      description: json['description'] as String? ?? '',
      allocatedCost: (json['allocatedCost'] as num).toDouble(),
      sector: json['sector'] as String?,
      datesLabel: json['datesLabel'] as String?,
      status: ActivityStatus.fromApi(json['status']),
      dimension: ActivityDimension.fromApi(json['dimension']),
      sdgs: [for (final sdg in json['sdgs'] as List? ?? const []) sdg as int],
      femaleParticipants: _int(json['femaleParticipants']),
      maleParticipants: _int(json['maleParticipants']),
      youthParticipants: _int(json['youthParticipants']),
      householdsBenefited: _int(json['householdsBenefited']),
      womenHeadedHouseholds: _int(json['womenHeadedHouseholds']),
      partners: json['partners'] as String?,
      resourcesNeeded: json['resourcesNeeded'] as String?,
      volunteerHours: _int(json['volunteerHours']),
      createdBy: json['createdBy'] == null
          ? null
          : ActorRef.fromJson(json['createdBy'] as Map<String, dynamic>),
      submittedAt: _date(json['submittedAt']),
      reviewedBy: review == null
          ? null
          : ActorRef.fromJson(review['by'] as Map<String, dynamic>),
      reviewedAt: review == null ? null : _date(review['at']),
      reviewComment: review?['comment'] as String?,
    );
  }

  final String id;
  final int year;
  final int month;
  final String name;
  final String description;
  final double allocatedCost;
  final String? sector;
  final String? datesLabel;
  final ActivityStatus status;
  final ActivityDimension? dimension;
  final List<int> sdgs;
  final int? femaleParticipants;
  final int? maleParticipants;
  final int? youthParticipants;
  final int? householdsBenefited;
  final int? womenHeadedHouseholds;
  final String? partners;
  final String? resourcesNeeded;
  final int? volunteerHours;
  final ActorRef? createdBy;
  final DateTime? submittedAt;
  final ActorRef? reviewedBy;
  final DateTime? reviewedAt;
  final String? reviewComment;

  int get totalParticipants =>
      (femaleParticipants ?? 0) + (maleParticipants ?? 0);

  /// "12–14 Sep · September 2027"
  String get whenLabel {
    final month = '${monthNames[this.month - 1]} $year';
    return datesLabel == null ? month : '$datesLabel · $month';
  }

  ActivityInput toInput() => ActivityInput(
    year: year,
    month: month,
    name: name,
    description: description,
    sector: sector ?? sarvodayaSectors.first,
    dimension: dimension ?? ActivityDimension.social,
    allocatedCost: allocatedCost,
    datesLabel: datesLabel,
    femaleParticipants: femaleParticipants,
    maleParticipants: maleParticipants,
    youthParticipants: youthParticipants,
    householdsBenefited: householdsBenefited,
    womenHeadedHouseholds: womenHeadedHouseholds,
    partners: partners,
    resourcesNeeded: resourcesNeeded,
    volunteerHours: volunteerHours,
  );
}

class WorkPlan {
  const WorkPlan(
    this.year,
    this.activities,
    this.totalAllocated, {
    this.canAddActivities = false,
  });

  factory WorkPlan.fromJson(Map<String, dynamic> json) => WorkPlan(
    json['year'] as int,
    (json['activities'] as List)
        .map((row) => WorkPlanActivity.fromJson(row as Map<String, dynamic>))
        .toList(),
    (json['totalAllocated'] as num).toDouble(),
    canAddActivities:
        (json['permissions'] as Map?)?['canAddActivities'] as bool? ?? false,
  );

  final int year;
  final List<WorkPlanActivity> activities;
  final double totalAllocated;
  final bool canAddActivities;

  int count(ActivityStatus status) =>
      activities.where((activity) => activity.status == status).length;
}

/// SP07 / M51: one activity with its society and what the viewer may do.
class ActivityDetail {
  const ActivityDetail({
    required this.activity,
    required this.societyId,
    required this.societyName,
    required this.canEdit,
    required this.canReview,
  });

  factory ActivityDetail.fromJson(Map<String, dynamic> json) {
    final society = json['society'] as Map<String, dynamic>;
    final permissions = json['permissions'] as Map<String, dynamic>;
    return ActivityDetail(
      activity: WorkPlanActivity.fromJson(json),
      societyId: society['id'] as String,
      societyName: society['name'] as String,
      canEdit: permissions['canEdit'] as bool? ?? false,
      canReview: permissions['canReview'] as bool? ?? false,
    );
  }

  final WorkPlanActivity activity;
  final String societyId;
  final String societyName;
  final bool canEdit;
  final bool canReview;
}

/// M50: one row of the SPC's queue or recently approved list.
class ActivityQueueItem {
  const ActivityQueueItem({
    required this.id,
    required this.name,
    required this.status,
    required this.year,
    required this.month,
    required this.societyId,
    required this.societyName,
    required this.totalParticipants,
    this.sentBy,
    this.submittedAt,
    this.householdsBenefited,
    this.sdgs = const [],
    this.approvedAt,
  });

  factory ActivityQueueItem.fromJson(Map<String, dynamic> json) {
    final society = json['society'] as Map<String, dynamic>;
    return ActivityQueueItem(
      id: json['id'] as String,
      name: json['name'] as String,
      status: ActivityStatus.fromApi(json['status']),
      year: json['year'] as int,
      month: json['month'] as int,
      societyId: society['id'] as String,
      societyName: society['name'] as String,
      totalParticipants: _int(json['totalParticipants']) ?? 0,
      sentBy: json['sentBy'] == null
          ? null
          : ActorRef.fromJson(json['sentBy'] as Map<String, dynamic>),
      submittedAt: _date(json['submittedAt']),
      householdsBenefited: _int(json['householdsBenefited']),
      sdgs: [for (final sdg in json['sdgs'] as List? ?? const []) sdg as int],
      approvedAt: _date(json['approvedAt']),
    );
  }

  final String id;
  final String name;
  final ActivityStatus status;
  final int year;
  final int month;
  final String societyId;
  final String societyName;
  final int totalParticipants;
  final ActorRef? sentBy;
  final DateTime? submittedAt;
  final int? householdsBenefited;
  final List<int> sdgs;
  final DateTime? approvedAt;
}

class ActivityQueue {
  const ActivityQueue({
    required this.waiting,
    required this.approvedRecently,
    required this.societyCount,
  });

  factory ActivityQueue.fromJson(Map<String, dynamic> json) => ActivityQueue(
    waiting: [
      for (final row in json['waiting'] as List)
        ActivityQueueItem.fromJson(row as Map<String, dynamic>),
    ],
    approvedRecently: [
      for (final row in json['approvedRecently'] as List)
        ActivityQueueItem.fromJson(row as Map<String, dynamic>),
    ],
    societyCount: json['societyCount'] as int? ?? 0,
  );

  final List<ActivityQueueItem> waiting;
  final List<ActivityQueueItem> approvedRecently;
  final int societyCount;
}

/// The four annual documents to the Registrar, in V5 order.
const registrarDocumentTypes = [
  'AUDIT_REPORT',
  'AGM_MINUTES',
  'OFFICE_BEARER_LIST',
  'MEMBERS_LIST',
];

const documentTypeLabels = {
  'AUDIT_REPORT': 'Audit report',
  'AGM_MINUTES': 'AGM minutes',
  'OFFICE_BEARER_LIST': 'Office-bearer list',
  'MEMBERS_LIST': 'Signed members list',
  'REGISTRATION': 'Registration',
  'ACTIVITY_EVIDENCE': 'Activity evidence',
  'FINANCE': 'Finance document',
  'OTHER': 'Other document',
};

class RegistrarDocument {
  const RegistrarDocument({
    required this.id,
    required this.fileName,
    required this.sizeBytes,
    required this.version,
    required this.uploadedAt,
    required this.uploadedBy,
    required this.canOpen,
  });

  factory RegistrarDocument.fromJson(Map<String, dynamic> json) =>
      RegistrarDocument(
        id: json['id'] as String,
        fileName: json['fileName'] as String,
        sizeBytes: json['sizeBytes'] as int,
        version: json['version'] as int? ?? 1,
        uploadedAt: _date(json['uploadedAt'])!,
        uploadedBy: ActorRef.fromJson(
          json['uploadedBy'] as Map<String, dynamic>,
        ),
        canOpen: json['canOpen'] as bool? ?? true,
      );

  final String id;
  final String fileName;
  final int sizeBytes;
  final int version;
  final DateTime uploadedAt;
  final ActorRef uploadedBy;
  final bool canOpen;
}

/// M13 "Annual documents · 2026 — 4 of 4 uploaded".
class RegistrarDocuments {
  const RegistrarDocuments({
    required this.startYear,
    required this.yearLabel,
    required this.documents,
  });

  factory RegistrarDocuments.fromJson(Map<String, dynamic> json) {
    final year = json['financialYear'] as Map<String, dynamic>;
    return RegistrarDocuments(
      startYear: year['startYear'] as int,
      yearLabel: year['label'] as String,
      documents: {
        for (final row in json['documents'] as List)
          row['documentType'] as String: row['document'] == null
              ? null
              : RegistrarDocument.fromJson(
                  row['document'] as Map<String, dynamic>,
                ),
      },
    );
  }

  final int startYear;
  final String yearLabel;

  /// Keyed by document type; null when that document is missing.
  final Map<String, RegistrarDocument?> documents;

  int get submitted => documents.values.whereType<RegistrarDocument>().length;
  int get missing => registrarDocumentTypes.length - submitted;
}

/// A file chosen for upload (M13a): PDF, JPG or PNG, up to 10 MB.
class PickedDocument {
  const PickedDocument({
    required this.name,
    required this.bytes,
    required this.contentType,
  });

  final String name;
  final List<int> bytes;
  final String contentType;

  int get sizeBytes => bytes.length;
}
