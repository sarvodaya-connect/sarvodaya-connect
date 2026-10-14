import 'package:flutter/material.dart';

import '../format.dart';
import '../models/document.dart';
import '../models/submission.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/section_card.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';
import 'changes_requested_screen.dart';

/// M09 (SC-25) · Submission detail with its review timeline.
class SubmissionDetailScreen extends StatelessWidget {
  const SubmissionDetailScreen({super.key, required this.submissionId});

  final String submissionId;

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final submission = store.submissionById(submissionId);
    if (submission == null) {
      return Scaffold(
        appBar: AppBar(),
        body: StateMessage(
          icon: Icons.search_off,
          tone: StateTone.error,
          title: 'Submission not found',
          message:
              'It may have been removed. Go back to the tracker and try again.',
          primaryLabel: 'Back',
          onPrimary: () => Navigator.of(context).pop(),
        ),
      );
    }
    final review = submission.latestReview;

    return Scaffold(
      appBar: AppBar(title: Text(submission.title)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SectionCard(
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          submission.type.label,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        Text(
                          submission.reference,
                          style: const TextStyle(color: AppColors.muted),
                        ),
                      ],
                    ),
                  ),
                  StatusChip.submission(submission.status),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (submission.isLocked) ...[
            if (submission.reviewStartedAt != null &&
                submission.status == SubmissionStatus.underReview)
              NoticeBanner.locked(
                reviewer:
                    submission.reviewerDisplayName ?? 'The District Manager',
                since: submission.reviewStartedAt!,
              )
            else
              const NoticeBanner(
                icon: Icons.lock_outline,
                tone: NoticeTone.warning,
                title: 'Waiting for review',
                message: 'This submission is locked while the District Centre reviews it. You can view it but not edit it.',
              ),
            const SizedBox(height: 12),
          ],
          if (submission.type == SubmissionType.activityReport &&
              submission.status != SubmissionStatus.approved) ...[
            const NoticeBanner(
              icon: Icons.info_outline,
              title: 'Not counted yet',
              message: 'Activity reports are excluded from HQ reporting until they are approved.',
            ),
            const SizedBox(height: 12),
          ],
          if (submission.status == SubmissionStatus.changesRequested &&
              review != null) ...[
            NoticeBanner(
              icon: Icons.undo,
              tone: NoticeTone.warning,
              title: 'Changes Requested by ${review.reviewerDisplayName}',
              message:
                  '“${review.comment}” · ${formatDateTime(review.decidedAt)}',
              action: FilledButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) =>
                        ChangesRequestedScreen(submissionId: submission.id),
                  ),
                ),
                child: const Text('Open returned submission'),
              ),
            ),
            const SizedBox(height: 12),
          ],
          if (submission.status == SubmissionStatus.approved &&
              review?.comment != null) ...[
            NoticeBanner(
              icon: Icons.check_circle_outline,
              tone: NoticeTone.success,
              title: 'Approved by ${review!.reviewerDisplayName}',
              message:
                  '“${review.comment}” · ${formatDateTime(review.decidedAt)}',
            ),
            const SizedBox(height: 12),
          ],
          if (submission.changes.isNotEmpty) ...[
            SectionCard(
              title: 'Changes',
              children: [
                for (final change in submission.changes)
                  ChangeValue(
                    label: change.label,
                    previous: change.correctedValue != null
                        ? change.proposedValue
                        : change.previousValue,
                    proposed: change.currentValue,
                    note: switch (change.correctionStatus) {
                      CorrectionStatus.required => const Text(
                        'Correction required',
                        style: TextStyle(
                          color: Color(0xFFA2470F),
                          fontWeight: FontWeight.w600,
                          fontSize: 12,
                        ),
                      ),
                      CorrectionStatus.corrected => const Text(
                        'Corrected',
                        style: TextStyle(
                          color: AppColors.leaf,
                          fontWeight: FontWeight.w600,
                          fontSize: 12,
                        ),
                      ),
                      CorrectionStatus.none => null,
                    },
                  ),
              ],
            ),
            const SizedBox(height: 12),
          ],
          if (submission.documents.isNotEmpty) ...[
            SectionCard(
              title: 'Supporting documents',
              children: [
                for (final document in submission.documents)
                  InfoRow(
                    label: document.documentType.label,
                    value:
                        '${document.fileName} · ${formatFileSize(document.sizeBytes)}',
                  ),
              ],
            ),
            const SizedBox(height: 12),
          ],
          SectionCard(
            title: 'Timeline',
            children: [
              for (final (index, event) in submission.timeline.indexed)
                _TimelineTile(
                  event: event,
                  last: index == submission.timeline.length - 1,
                ),
            ],
          ),
          if (submission.type == SubmissionType.councilUpdate) ...[
            const SizedBox(height: 12),
            _DemoReviewControls(submission: submission),
          ],
        ],
      ),
    );
  }
}

class _TimelineTile extends StatelessWidget {
  const _TimelineTile({required this.event, required this.last});

  final TimelineEvent event;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final style = event.status.style;
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Column(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: style.background,
                  shape: BoxShape.circle,
                ),
                child: Icon(style.icon, size: 16, color: style.foreground),
              ),
              if (!last)
                Expanded(child: Container(width: 2, color: AppColors.line)),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    event.title,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  Text(
                    [formatDateTime(event.at), ?event.actor].join(' · '),
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 12,
                    ),
                  ),
                  if (event.detail != null) ...[
                    const SizedBox(height: 2),
                    Text(event.detail!, style: const TextStyle(fontSize: 13)),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Stands in for the District Manager's actions, which happen on the web dashboard.
/// Lets the presenter move the demo through review without a backend.
class _DemoReviewControls extends StatelessWidget {
  const _DemoReviewControls({required this.submission});

  final SocietySubmission submission;

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.read(context);
    final actions = <Widget>[
      if (submission.status == SubmissionStatus.submitted ||
          submission.status == SubmissionStatus.resubmitted)
        OutlinedButton(
          onPressed: () => store.demoStartReview(submission.id),
          child: const Text('Start review'),
        ),
      if (submission.status == SubmissionStatus.underReview &&
          submission.correctionStatus != CorrectionStatus.corrected)
        OutlinedButton(
          onPressed: () => store.demoRequestChanges(submission.id),
          child: const Text('Return start date'),
        ),
      if (submission.status == SubmissionStatus.underReview)
        OutlinedButton(
          onPressed: () => store.demoApprove(submission.id),
          child: const Text('Approve'),
        ),
    ];
    if (actions.isEmpty) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.line, style: BorderStyle.solid),
        color: AppColors.mintSoft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Demo: District Manager actions',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          const Text(
            'In the real system these happen on the web dashboard.',
            style: TextStyle(color: AppColors.muted, fontSize: 12),
          ),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 8, children: actions),
        ],
      ),
    );
  }
}
