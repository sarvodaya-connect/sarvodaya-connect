import 'package:flutter/material.dart';

import '../l10n/l10n.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/state_views.dart';
import 'assessment_queue.dart';

/// What a saved assessment is waiting for, in plain words.
String queueProblemText(AppLocalizations l, QueuedAssessment item) {
  final problem = item.problem;
  final text = switch (problem) {
    null => l.aqWaiting,
    QueueProblem.offline => l.aqWaitingOffline,
    QueueProblem.server => l.aqWaitingServer,
    QueueProblem.signIn => l.aqSignIn,
    QueueProblem.noAccess => l.aqNoAccess,
    QueueProblem.closed => l.aqClosed,
    QueueProblem.rejected => l.aqRejected(item.message ?? ''),
  };
  return item.assessmentId != null && item.photosLeft > 0
      ? '${l.aqReceivedPhotosLeft(item.photosLeft)} $text'
      : text;
}

/// Issue #125: the signed-in account's assessments saved on this phone, with
/// what each is waiting for, "Retry sending" and "Remove from this phone".
/// Shown only while something is saved.
class PendingAssessmentsCard extends StatefulWidget {
  const PendingAssessmentsCard({super.key, this.onSent});

  /// Called after a retry sends something, so the screen can refresh.
  final VoidCallback? onSent;

  @override
  State<PendingAssessmentsCard> createState() => _PendingAssessmentsCardState();
}

class _PendingAssessmentsCardState extends State<PendingAssessmentsCard> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) DemoScope.read(context).assessments.load();
    });
  }

  Future<void> _retry() async {
    final l = context.l10n;
    final messenger = ScaffoldMessenger.of(context);
    final result = await DemoScope.read(context).assessments.sync();
    if (!mounted) return;
    if (result.sent > 0) {
      messenger.showSnackBar(SnackBar(content: Text(l.aqSent(result.sent))));
      widget.onSent?.call();
    }
  }

  Future<void> _remove(QueuedAssessment item) async {
    final l = context.l10n;
    final queue = DemoScope.read(context).assessments;
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        title: Text(l.aqRemoveTitle),
        content: Text(l.aqRemoveMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l.aqKeep),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(l.aqRemoveConfirm),
          ),
        ],
      ),
    );
    if (ok == true) await queue.discard(item.clientMutationId);
  }

  @override
  Widget build(BuildContext context) {
    final queue = DemoScope.of(context).assessments;
    return ListenableBuilder(
      listenable: queue,
      builder: (context, _) {
        final items = queue.items;
        if (items.isEmpty) return const SizedBox.shrink();
        final l = context.l10n;
        final blocked = items.any((i) => i.blocked);
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Material(
            color: blocked ? AppColors.dangerSoft : AppColors.warningSoft,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(
                color: blocked
                    ? const Color(0xFFEFC4BD)
                    : const Color(0xFFE8D28A),
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        queue.syncing ? Icons.sync : Icons.save_outlined,
                        color: blocked ? AppColors.danger : AppColors.warning,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          l.aqPendingTitle(items.length),
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(l.aqPendingNote, style: const TextStyle(fontSize: 12)),
                  for (final item in items) ...[
                    const Divider(height: 18),
                    Text(
                      l.aqItemLine(
                        item.societyName,
                        item.incidentReference,
                        MaterialLocalizations.of(context)
                            .formatShortDate(item.savedAt),
                        TimeOfDay.fromDateTime(item.savedAt).format(context),
                      ),
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      queue.syncing && !item.blocked
                          ? l.aqSyncing
                          : queueProblemText(l, item),
                      style: TextStyle(
                        fontSize: 12,
                        color: item.blocked
                            ? AppColors.danger
                            : AppColors.inkBody,
                      ),
                    ),
                    if (item.blocked || item.problem == QueueProblem.rejected)
                      Align(
                        alignment: Alignment.centerLeft,
                        child: TextButton(
                          onPressed: queue.syncing ? null : () => _remove(item),
                          child: Text(l.aqRemove),
                        ),
                      ),
                  ],
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: queue.syncing ? null : _retry,
                      icon: const Icon(Icons.refresh),
                      label: Text(queue.syncing ? l.aqSyncing : l.aqRetry),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

/// Shown on the assessment screen when it was saved but not (fully) sent.
class SavedAssessmentNotice extends StatelessWidget {
  const SavedAssessmentNotice({super.key, required this.item});

  final QueuedAssessment item;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return NoticeBanner(
      icon: item.blocked ? Icons.error_outline : Icons.save_outlined,
      title: item.blocked ? l.aqBlockedTitle : l.aqSavedTitle,
      message:
          '${queueProblemText(l, item)} ${item.blocked ? l.aqBlockedNext : l.aqSavedNext}',
      tone: item.blocked ? NoticeTone.error : NoticeTone.warning,
    );
  }
}
