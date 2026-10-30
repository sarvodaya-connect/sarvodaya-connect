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

class ExcoMember {
  const ExcoMember({
    required this.id,
    required this.seatNumber,
    required this.fullName,
    required this.position,
    this.age,
    this.phone,
    this.nicMasked,
  });

  factory ExcoMember.fromJson(Map<String, dynamic> json) => ExcoMember(
    id: json['id'] as String,
    seatNumber: json['seatNumber'] as int? ?? 0,
    fullName: json['fullName'] as String,
    position: json['position'] as String,
    age: json['age'] as int?,
    phone: json['phone'] as String?,
    nicMasked: json['nicMasked'] as String?,
  );

  final String id;
  final int seatNumber;
  final String fullName;
  final String position;
  final int? age;
  final String? phone;
  final String? nicMasked;

  bool get isOfficeBearer =>
      const ['President', 'Secretary', 'Treasurer'].contains(position);
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

class WorkPlanActivity {
  const WorkPlanActivity({
    required this.month,
    required this.name,
    required this.allocatedCost,
    this.sector,
    this.datesLabel,
  });

  final int month;
  final String name;
  final double allocatedCost;
  final String? sector;
  final String? datesLabel;
}

class WorkPlan {
  const WorkPlan(this.year, this.activities, this.totalAllocated);

  factory WorkPlan.fromJson(Map<String, dynamic> json) => WorkPlan(
    json['year'] as int,
    (json['activities'] as List)
        .map(
          (row) => WorkPlanActivity(
            month: row['month'] as int,
            name: row['name'] as String,
            allocatedCost: (row['allocatedCost'] as num).toDouble(),
            sector: row['sector'] as String?,
            datesLabel: row['datesLabel'] as String?,
          ),
        )
        .toList(),
    (json['totalAllocated'] as num).toDouble(),
  );

  final int year;
  final List<WorkPlanActivity> activities;
  final double totalAllocated;
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
