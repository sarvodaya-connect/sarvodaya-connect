// Mirrors SocietyDocument and DocumentStatus from packages/api-contracts/src/registry.ts.

enum DocumentStatus { draft, submitted, approved, rejected }

enum DocumentType {
  auditReport,
  agmMinutes,
  officeBearerList,
  membersList,
  other,
}

extension DocumentTypeInfo on DocumentType {
  String get label => switch (this) {
    DocumentType.auditReport => 'Audit report',
    DocumentType.agmMinutes => 'AGM minutes',
    DocumentType.officeBearerList => 'Office-bearer list',
    DocumentType.membersList => 'Members list',
    DocumentType.other => 'Other supporting document',
  };

  /// The four annual documents sent to the Registrar (Screen Catalogue v2, M13).
  bool get isRegistrarDocument => this != DocumentType.other;
}

class SocietyDocument {
  const SocietyDocument({
    required this.id,
    required this.societyId,
    required this.documentType,
    required this.fileName,
    required this.contentType,
    required this.sizeBytes,
    required this.status,
    required this.uploadedBy,
    required this.uploadedAt,
    this.submissionReference,
    this.restrictedToReviewers = false,
  });

  final String id;
  final String societyId;
  final DocumentType documentType;
  final String fileName;
  final String contentType;
  final int sizeBytes;
  final DocumentStatus status;
  final String uploadedBy;
  final DateTime uploadedAt;

  /// Submission this document supports, when attached to a pending update.
  final String? submissionReference;

  /// Signed members list: only the District Manager and HQ can open it.
  final bool restrictedToReviewers;
}
