import 'package:flutter/material.dart';

import '../app.dart';
import '../data/demo_data.dart';
import '../format.dart';
import '../models/document.dart';
import '../models/submission.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/section_card.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';
import 'replace_member_screen.dart';
import 'submission_result_screen.dart';

/// M07 · Check before sending: old and proposed values, documents, confirmation.
class ReviewSubmitScreen extends StatefulWidget {
  const ReviewSubmitScreen({super.key});

  @override
  State<ReviewSubmitScreen> createState() => _ReviewSubmitScreenState();
}

class _ReviewSubmitScreenState extends State<ReviewSubmitScreen> {
  bool _agreed = false;
  bool _showAgreeError = false;
  bool _sending = false;
  String? _sendError;

  Future<void> _submit() async {
    if (!_agreed) {
      setState(() => _showAgreeError = true);
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Submit to the District Manager?'),
        content: const Text(
          'The $demoReviewerOffice will review this Council update. You cannot change it while it is being reviewed.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Yes, submit'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) {
      return; // Nothing is sent when the officer cancels.
    }
    setState(() {
      _sending = true;
      _sendError = null;
    });
    final store = DemoScope.read(context);
    try {
      final submission = await store.submitCouncilUpdate();
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute<void>(
          builder: (_) => SubmissionResultScreen(submissionId: submission.id),
        ),
        (route) => route.isFirst,
      );
    } on OfflineException {
      if (mounted) {
        setState(
          () => _sendError = 'You are offline, so the update was not sent. Your draft is saved on this phone.',
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _saveDraft() {
    HomeShell.openTab(context, HomeShell.homeTab);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Draft saved. You can send it later from Home.'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final draft = store.draft;
    if (draft == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Check before sending')),
        body: StateMessage(
          icon: Icons.inbox_outlined,
          title: 'Nothing to send',
          message: 'There is no draft change. Start from the Executive Council to replace a member.',
          primaryLabel: 'Back to Home',
          onPrimary: () => HomeShell.openTab(context, HomeShell.homeTab),
        ),
      );
    }
    final outgoing = store.memberById(draft.memberId);
    final changes = store.draftChanges();
    final documents = store.draftDocuments;

    return Scaffold(
      appBar: AppBar(title: const Text('Check before sending')),
      body: Column(
        children: [
          if (store.offline) const OfflineBanner(),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                NoticeBanner(
                  icon: Icons.info_outline,
                  title:
                      'The District Centre will review ${changes.length} changed fields',
                  message:
                      'After approval: ${store.seatsFilled.values.fold(0, (a, b) => a + b)} of ${store.totalSeats} Council seats filled.',
                ),
                if (_sendError != null) ...[
                  const SizedBox(height: 12),
                  NoticeBanner(
                    icon: Icons.wifi_off,
                    tone: NoticeTone.error,
                    title: 'Not sent',
                    message: _sendError,
                    action: Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton(
                        onPressed: _sending ? null : _submit,
                        child: const Text('Try again'),
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                SectionCard(
                  title: '${outgoing?.position ?? 'Member'} replaced',
                  highlight: true,
                  trailing: TextButton(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) =>
                            ReplaceMemberScreen(memberId: draft.memberId),
                      ),
                    ),
                    child: const Text('Edit'),
                  ),
                  children: [
                    for (final change in changes)
                      ChangeValue(
                        label: change.label,
                        previous: change.previousValue,
                        proposed: change.proposedValue,
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                SectionCard(
                  title: 'Supporting documents',
                  children: [
                    for (final document in documents)
                      Row(
                        children: [
                          const Icon(
                            Icons.picture_as_pdf_outlined,
                            color: AppColors.leaf,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  document.fileName,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                Text(
                                  '${document.documentType.label} · ${formatFileSize(document.sizeBytes)}',
                                  style: const TextStyle(
                                    color: AppColors.muted,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          StatusChip.submission(
                            SubmissionStatus.draft,
                            compact: true,
                          ),
                        ],
                      ),
                    if (documents.isEmpty)
                      const InfoRow(label: 'AGM minutes', value: null),
                  ],
                ),
                const SizedBox(height: 12),
                const SectionCard(
                  title: 'Everything else',
                  children: [
                    _NoChangeRow('Society profile and address'),
                    _NoChangeRow('GPS location'),
                    _NoChangeRow('Other Council seats'),
                  ],
                ),
                const SizedBox(height: 12),
                Card(
                  child: CheckboxListTile(
                    value: _agreed,
                    onChanged: (value) => setState(() {
                      _agreed = value ?? false;
                      _showAgreeError = false;
                    }),
                    controlAffinity: ListTileControlAffinity.leading,
                    title: const Text(
                      'These changes were agreed at the AGM on 28 Sep 2026',
                    ),
                    subtitle: _showAgreeError
                        ? const Text(
                            'Confirm this before you submit.',
                            style: TextStyle(color: AppColors.danger),
                          )
                        : null,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: BottomActionBar(
        secondary: OutlinedButton(
          onPressed: _sending ? null : _saveDraft,
          child: const Text('Save draft'),
        ),
        primary: FilledButton.icon(
          onPressed: _sending ? null : _submit,
          icon: _sending
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Icon(Icons.send),
          label: const Text('Submit to District'),
        ),
      ),
    );
  }
}

class _NoChangeRow extends StatelessWidget {
  const _NoChangeRow(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(child: Text(label)),
          const Text('No change', style: TextStyle(color: AppColors.muted)),
        ],
      ),
    );
  }
}
