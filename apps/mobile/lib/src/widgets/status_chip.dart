import 'package:flutter/material.dart';

import '../models/audit.dart';
import '../models/document.dart';
import '../models/submission.dart';

/// Colour, icon and label for each status. Every status has its own icon as well as
/// its own colour, so the states stay distinct for colour-blind users.
class StatusStyle {
  const StatusStyle(this.label, this.icon, this.foreground, this.background);

  final String label;
  final IconData icon;
  final Color foreground;
  final Color background;
}

extension SubmissionStatusStyle on SubmissionStatus {
  StatusStyle get style => switch (this) {
    SubmissionStatus.draft => const StatusStyle(
      'Draft',
      Icons.edit_note,
      Color(0xFF55605A),
      Color(0xFFEEF0EC),
    ),
    SubmissionStatus.submitted => const StatusStyle(
      'Submitted',
      Icons.send_outlined,
      Color(0xFF2D5C88),
      Color(0xFFE4EEF8),
    ),
    SubmissionStatus.underReview => const StatusStyle(
      'Under Review',
      Icons.hourglass_top,
      Color(0xFF7A5A00),
      Color(0xFFFFF2CC),
    ),
    SubmissionStatus.changesRequested => const StatusStyle(
      'Changes Requested',
      Icons.undo,
      Color(0xFFA2470F),
      Color(0xFFFFE9DA),
    ),
    SubmissionStatus.resubmitted => const StatusStyle(
      'Resubmitted',
      Icons.replay,
      Color(0xFF1E6461),
      Color(0xFFE0F1EF),
    ),
    SubmissionStatus.approved => const StatusStyle(
      'Approved',
      Icons.check_circle_outline,
      Color(0xFF25643F),
      Color(0xFFE5F3E8),
    ),
    SubmissionStatus.rejected => const StatusStyle(
      'Rejected',
      Icons.cancel_outlined,
      Color(0xFFA8312A),
      Color(0xFFFBE9E7),
    ),
  };
}

extension DocumentStatusStyle on DocumentStatus {
  StatusStyle get style => switch (this) {
    DocumentStatus.draft => SubmissionStatus.draft.style,
    DocumentStatus.submitted => SubmissionStatus.underReview.style,
    DocumentStatus.approved => SubmissionStatus.approved.style,
    DocumentStatus.rejected => SubmissionStatus.rejected.style,
  };
}

extension AuditItemStatusStyle on AuditItemStatus {
  StatusStyle get style => switch (this) {
    AuditItemStatus.complete => const StatusStyle(
      'Complete',
      Icons.check_circle_outline,
      Color(0xFF25643F),
      Color(0xFFE5F3E8),
    ),
    AuditItemStatus.inProgress => const StatusStyle(
      'In progress',
      Icons.hourglass_top,
      Color(0xFF7A5A00),
      Color(0xFFFFF2CC),
    ),
    AuditItemStatus.notStarted => const StatusStyle(
      'Not started',
      Icons.radio_button_unchecked,
      Color(0xFF55605A),
      Color(0xFFEEF0EC),
    ),
    AuditItemStatus.overdue => const StatusStyle(
      'Overdue',
      Icons.warning_amber,
      Color(0xFFA8312A),
      Color(0xFFFBE9E7),
    ),
  };
}

extension AuditStatusStyle on AuditStatus {
  StatusStyle get style => switch (this) {
    AuditStatus.due => const StatusStyle(
      'Due soon',
      Icons.schedule,
      Color(0xFF7A5A00),
      Color(0xFFFFF2CC),
    ),
    AuditStatus.overdue => AuditItemStatus.overdue.style,
    AuditStatus.underReview => SubmissionStatus.underReview.style,
    AuditStatus.approved => SubmissionStatus.approved.style,
  };
}

class StatusChip extends StatelessWidget {
  const StatusChip(
    this.style, {
    super.key,
    this.compact = false,
    this.dot = false,
  });

  StatusChip.submission(
    SubmissionStatus status, {
    Key? key,
    bool compact = false,
    bool dot = false,
  }) : this(status.style, key: key, compact: compact, dot: dot);

  StatusChip.document(DocumentStatus status, {Key? key, bool compact = false})
    : this(status.style, key: key, compact: compact);

  final StatusStyle style;
  final bool compact;

  /// Catalogue list style: a small coloured dot instead of the icon.
  final bool dot;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Status: ${style.label}',
      excludeSemantics: true,
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: compact ? 8 : 10,
          vertical: compact ? 3 : 5,
        ),
        decoration: BoxDecoration(
          color: style.background,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: style.foreground.withValues(alpha: 0.25)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (dot)
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: style.foreground,
                  shape: BoxShape.circle,
                ),
              )
            else
              Icon(
                style.icon,
                size: compact ? 13 : 15,
                color: style.foreground,
              ),
            const SizedBox(width: 4),
            Text(
              style.label,
              style: TextStyle(
                color: style.foreground,
                fontSize: compact ? 11 : 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
