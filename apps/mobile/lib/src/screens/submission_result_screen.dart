import 'package:flutter/material.dart';

import '../app.dart';
import '../data/demo_data.dart';
import '../state/demo_store.dart';
import '../widgets/state_views.dart';
import 'submission_detail_screen.dart';

/// M26 success state after sending: reference and next steps.
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
          : StateMessage(
              icon: Icons.check_circle_outline,
              tone: StateTone.success,
              isAlert: true,
              title: 'Sent to District Centre',
              message:
                  '$demoReviewerOffice will review it, usually within 3 days. '
                  'We will tell you when it is approved.\n'
                  'Reference ${submission.reference}',
              primaryLabel: 'Track it',
              onPrimary: () => Navigator.of(context).pushReplacement(
                MaterialPageRoute<void>(
                  builder: (_) =>
                      SubmissionDetailScreen(submissionId: submission.id),
                ),
              ),
              secondaryLabel: 'Back to Home',
              onSecondary: () => HomeShell.openTab(context, HomeShell.homeTab),
            ),
    );
  }
}
