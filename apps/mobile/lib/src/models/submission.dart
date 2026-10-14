// Mirrors the submission workflow from packages/api-contracts/src/workflow.ts.

import 'document.dart';

enum SubmissionStatus {
  draft,
  submitted,
  underReview,
  changesRequested,
  resubmitted,
  approved,
  rejected,
}

enum CorrectionStatus { none, required, corrected }

enum ReviewDecision { approved, changesRequested, rejected }

enum SubmissionType {
  councilUpdate,
  activityReport,
  membershipCounts,
  payment,
  profileUpdate,
}

extension SubmissionTypeInfo on SubmissionType {
  String get label => switch (this) {
    SubmissionType.councilUpdate => 'Executive Council update',
    SubmissionType.activityReport => 'Activity report',
    SubmissionType.membershipCounts => 'Membership counts',
    SubmissionType.payment => 'Payment',
    SubmissionType.profileUpdate => 'Society profile update',
  };
}

class SubmissionChange {
  const SubmissionChange({
    required this.field,
    required this.label,
    this.previousValue,
    required this.proposedValue,
    this.correctionStatus = CorrectionStatus.none,
    this.correctedValue,
  });

  /// Machine name of the changed field, for example "treasurer.appointedOn".
  final String field;

  /// Label shown to the officer, for example "Treasurer start date".
  final String label;
  final String? previousValue;
  final String proposedValue;
  final CorrectionStatus correctionStatus;
  final String? correctedValue;

  /// The value the reviewer will see next: the correction if one was made.
  String get currentValue => correctedValue ?? proposedValue;

  SubmissionChange copyWith({
    CorrectionStatus? correctionStatus,
    String? correctedValue,
  }) {
    return SubmissionChange(
      field: field,
      label: label,
      previousValue: previousValue,
      proposedValue: proposedValue,
      correctionStatus: correctionStatus ?? this.correctionStatus,
      correctedValue: correctedValue ?? this.correctedValue,
    );
  }
}

class ReviewRecord {
  const ReviewRecord({
    required this.id,
    required this.reviewerUserId,
    required this.reviewerDisplayName,
    required this.decision,
    this.comment,
    this.field,
    required this.decidedAt,
  });

  final String id;
  final String reviewerUserId;
  final String reviewerDisplayName;
  final ReviewDecision decision;
  final String? comment;

  /// The field the comment refers to, when the reviewer returned a single field.
  final String? field;
  final DateTime decidedAt;
}

class TimelineEvent {
  const TimelineEvent({
    required this.status,
    required this.title,
    required this.at,
    this.detail,
    this.actor,
  });

  final SubmissionStatus status;
  final String title;
  final DateTime at;
  final String? detail;
  final String? actor;
}

class SocietySubmission {
  const SocietySubmission({
    required this.id,
    required this.reference,
    required this.societyId,
    required this.type,
    required this.title,
    required this.submittedBy,
    required this.status,
    this.correctionStatus = CorrectionStatus.none,
    this.changes = const [],
    this.documents = const [],
    this.reviews = const [],
    this.timeline = const [],
    this.submittedAt,
    required this.updatedAt,
    this.reviewStartedAt,
    this.reviewerDisplayName,
  });

  final String id;
  final String reference;
  final String societyId;
  final SubmissionType type;
  final String title;
  final String submittedBy;
  final SubmissionStatus status;
  final CorrectionStatus correctionStatus;
  final List<SubmissionChange> changes;
  final List<SocietyDocument> documents;
  final List<ReviewRecord> reviews;
  final List<TimelineEvent> timeline;
  final DateTime? submittedAt;
  final DateTime updatedAt;
  final DateTime? reviewStartedAt;
  final String? reviewerDisplayName;

  /// A submission waiting for or in review cannot be edited by the officer.
  bool get isLocked =>
      status == SubmissionStatus.submitted ||
      status == SubmissionStatus.underReview ||
      status == SubmissionStatus.resubmitted;

  ReviewRecord? get latestReview => reviews.isEmpty ? null : reviews.last;

  SocietySubmission copyWith({
    SubmissionStatus? status,
    CorrectionStatus? correctionStatus,
    List<SubmissionChange>? changes,
    List<SocietyDocument>? documents,
    List<ReviewRecord>? reviews,
    List<TimelineEvent>? timeline,
    DateTime? submittedAt,
    DateTime? updatedAt,
    DateTime? reviewStartedAt,
    String? reviewerDisplayName,
  }) {
    return SocietySubmission(
      id: id,
      reference: reference,
      societyId: societyId,
      type: type,
      title: title,
      submittedBy: submittedBy,
      status: status ?? this.status,
      correctionStatus: correctionStatus ?? this.correctionStatus,
      changes: changes ?? this.changes,
      documents: documents ?? this.documents,
      reviews: reviews ?? this.reviews,
      timeline: timeline ?? this.timeline,
      submittedAt: submittedAt ?? this.submittedAt,
      updatedAt: updatedAt ?? this.updatedAt,
      reviewStartedAt: reviewStartedAt ?? this.reviewStartedAt,
      reviewerDisplayName: reviewerDisplayName ?? this.reviewerDisplayName,
    );
  }
}
