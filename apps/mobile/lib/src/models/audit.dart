// Annual audit of a society's accounts (Screen Catalogue v3, M12).
// UI model for the provisional demo. Replace it with the shared API contract
// when audits are added to packages/api-contracts.

/// Completion state of one required step in the annual audit.
enum AuditItemStatus { complete, inProgress, notStarted, overdue }

/// Overall state of one financial year's audit.
enum AuditStatus { due, overdue, underReview, approved }

class AuditChecklistItem {
  const AuditChecklistItem({
    required this.id,
    required this.title,
    required this.description,
    required this.status,
    this.completedOn,
    this.dueOn,
  });

  final String id;
  final String title;
  final String description;
  final AuditItemStatus status;
  final DateTime? completedOn;
  final DateTime? dueOn;

  bool get isComplete => status == AuditItemStatus.complete;
}

class AnnualAudit {
  const AnnualAudit({
    required this.id,
    required this.financialYear,
    required this.dueOn,
    required this.status,
    required this.items,
    this.preparedBy = 'Your appointed auditor',
    this.reportDocumentId,
    this.reviewedBy,
    this.reviewedOn,
    this.reviewerComment,
  });

  final String id;

  /// For example "FY 2025/26".
  final String financialYear;

  /// Date the signed audit report is due with the District Centre.
  final DateTime dueOn;
  final AuditStatus status;
  final List<AuditChecklistItem> items;
  final String preparedBy;

  /// The uploaded audit report in the document library, once there is one.
  final String? reportDocumentId;
  final String? reviewedBy;
  final DateTime? reviewedOn;
  final String? reviewerComment;

  int get completedCount => items.where((item) => item.isComplete).length;

  bool get reportUploaded => reportDocumentId != null;
}
