import 'package:flutter/material.dart';

import '../app.dart';
import '../data/demo_data.dart';
import '../models/submission.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/section_card.dart';
import '../widgets/status_chip.dart';
import 'submission_detail_screen.dart';

/// M08 · Submission result: reference, status and next steps.
class SubmissionResultScreen extends StatelessWidget {
  const SubmissionResultScreen({super.key, required this.submissionId});

  final String submissionId;

  @override
  Widget build(BuildContext context) {
    final submission = DemoScope.of(context).submissionById(submissionId);
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: Text(submission?.title ?? 'Submission'),
      ),
      body: submission == null
          ? const SizedBox.shrink()
          : ListView(
              padding: const EdgeInsets.fromLTRB(24, 40, 24, 24),
              children: [
                Semantics(
                  liveRegion: true,
                  child: Column(
                    children: [
                      Container(
                        width: 64,
                        height: 64,
                        decoration: const BoxDecoration(
                          color: AppColors.mint,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.check_circle_outline,
                          color: AppColors.leaf,
                          size: 36,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Sent to District Centre',
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        '$demoReviewerOffice will review it, usually within 3 days. We will tell you when it is approved.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: AppColors.muted, height: 1.4),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                SectionCard(
                  children: [
                    InfoRow(label: 'Reference', value: submission.reference),
                    InfoRow(label: 'Type', value: submission.type.label),
                    Row(
                      children: [
                        const Expanded(
                          child: Text(
                            'Status',
                            style: TextStyle(color: AppColors.muted),
                          ),
                        ),
                        StatusChip.submission(submission.status),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: () => Navigator.of(context).pushReplacement(
                    MaterialPageRoute<void>(
                      builder: (_) =>
                          SubmissionDetailScreen(submissionId: submission.id),
                    ),
                  ),
                  child: const Text('Track submission'),
                ),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: () =>
                      HomeShell.openTab(context, HomeShell.homeTab),
                  child: const Text('Back to Home'),
                ),
              ],
            ),
    );
  }
}
