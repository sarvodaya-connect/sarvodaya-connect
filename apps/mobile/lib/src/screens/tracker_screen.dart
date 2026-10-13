import 'package:flutter/material.dart';

import '../app.dart';
import '../format.dart';
import '../models/submission.dart';
import '../state/demo_store.dart';
import '../widgets/demo_loader.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';
import 'council_screen.dart';
import 'submission_detail_screen.dart';

enum _TrackerFilter { all, changesRequested, inReview, approved }

/// M11 · Submission tracker: every submission with its status.
class TrackerScreen extends StatefulWidget {
  const TrackerScreen({super.key});

  @override
  State<TrackerScreen> createState() => _TrackerScreenState();
}

class _TrackerScreenState extends State<TrackerScreen> {
  _TrackerFilter _filter = _TrackerFilter.all;

  bool _matches(SocietySubmission submission) => switch (_filter) {
    _TrackerFilter.all => true,
    _TrackerFilter.changesRequested =>
      submission.status == SubmissionStatus.changesRequested,
    _TrackerFilter.inReview => submission.isLocked,
    _TrackerFilter.approved => submission.status == SubmissionStatus.approved,
  };

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('My submissions')),
      body: Column(
        children: [
          if (store.offline) const OfflineBanner(),
          Expanded(
            child: DemoLoader(
              loadingLabel: 'Loading your submissions',
              builder: (context) {
                final submissions = store.submissions;
                if (submissions.isEmpty) {
                  return StateMessage(
                    icon: Icons.inbox_outlined,
                    title: 'No submissions yet',
                    message: 'When you send a change to the District Centre, you can follow it here.',
                    primaryLabel: 'Update Committee',
                    onPrimary: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => const CouncilScreen(),
                      ),
                    ),
                    secondaryLabel: 'Back to Home',
                    onSecondary: () => store.selectTab(HomeShell.homeTab),
                  );
                }
                final returned = submissions
                    .where((s) => s.status == SubmissionStatus.changesRequested)
                    .length;
                final visible = submissions.where(_matches).toList();
                return Column(
                  children: [
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                      child: Row(
                        children: [
                          for (final filter in _TrackerFilter.values)
                            Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: ChoiceChip(
                                label: Text(switch (filter) {
                                  _TrackerFilter.all => 'All',
                                  _TrackerFilter.changesRequested =>
                                    'Changes Requested ($returned)',
                                  _TrackerFilter.inReview => 'In review',
                                  _TrackerFilter.approved => 'Approved',
                                }),
                                selected: _filter == filter,
                                showCheckmark: false,
                                labelStyle: TextStyle(
                                  color: _filter == filter
                                      ? Colors.white
                                      : null,
                                ),
                                onSelected: (_) =>
                                    setState(() => _filter = filter),
                              ),
                            ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: visible.isEmpty
                          ? StateMessage(
                              icon: Icons.filter_alt_off_outlined,
                              title: 'Nothing here',
                              message: 'No submissions match this filter.',
                              secondaryLabel: 'Show all',
                              onSecondary: () =>
                                  setState(() => _filter = _TrackerFilter.all),
                            )
                          : ListView.separated(
                              padding: const EdgeInsets.all(16),
                              itemCount: visible.length,
                              separatorBuilder: (_, _) =>
                                  const SizedBox(height: 8),
                              itemBuilder: (context, index) =>
                                  _SubmissionRow(submission: visible[index]),
                            ),
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _SubmissionRow extends StatelessWidget {
  const _SubmissionRow({required this.submission});

  final SocietySubmission submission;

  @override
  Widget build(BuildContext context) {
    final when = submission.submittedAt ?? submission.updatedAt;
    final detail = switch (submission.status) {
      SubmissionStatus.draft => 'Not sent · saved ${formatDate(when)}',
      SubmissionStatus.changesRequested =>
        '1 field to fix · ${submission.reference}',
      SubmissionStatus.approved =>
        'Approved ${formatDate(submission.updatedAt)} · ${submission.reference}',
      _ => 'Sent ${formatDate(when)} · ${submission.reference}',
    };
    return Card(
      child: ListTile(
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => SubmissionDetailScreen(submissionId: submission.id),
          ),
        ),
        title: Text(
          submission.title,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Text(detail, style: const TextStyle(fontSize: 12)),
        trailing: StatusChip.submission(submission.status, compact: true),
      ),
    );
  }
}
