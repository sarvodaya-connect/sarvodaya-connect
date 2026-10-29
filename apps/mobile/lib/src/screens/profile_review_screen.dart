import 'package:flutter/material.dart';

import '../app.dart';
import '../data/demo_data.dart';
import '../format.dart';
import '../models/profile_draft.dart';
import '../models/submission.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/profile_widgets.dart';
import '../widgets/section_card.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';
import 'edit_profile_screen.dart';
import 'submission_result_screen.dart';

/// Review the profile draft: approved → proposed values, then send it.
class ProfileReviewScreen extends StatefulWidget {
  const ProfileReviewScreen({super.key});

  @override
  State<ProfileReviewScreen> createState() => _ProfileReviewScreenState();
}

class _ProfileReviewScreenState extends State<ProfileReviewScreen> {
  bool _sending = false;
  String? _sendError;
  List<String> _reloadNotes = const [];

  void _reload() {
    final notes = DemoScope.read(context).reloadProfileDraft();
    setState(() {
      _reloadNotes = notes;
      _sendError = null;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Record reloaded. Your draft changes are kept.'),
      ),
    );
  }

  Future<void> _submit() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Submit to the District Manager?'),
        content: const Text(
          'The $demoReviewerOffice will review these profile changes. The approved record changes only after approval.',
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
    if (confirmed != true || !mounted) return;
    setState(() {
      _sending = true;
      _sendError = null;
    });
    final store = DemoScope.read(context);
    try {
      final submission = await store.submitProfileUpdate();
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute<void>(
          builder: (_) => SubmissionResultScreen(submissionId: submission.id),
        ),
        (route) => route.isFirst,
      );
    } on ConflictingUpdateException {
      if (mounted) setState(() {});
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

  Future<void> _discard() async {
    final discard = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Discard the profile draft?'),
        content: const Text(
          'Your proposed changes will be removed from this phone. The approved record is not affected.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Keep draft'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Discard'),
          ),
        ],
      ),
    );
    if (discard != true || !mounted) return;
    DemoScope.read(context).discardProfileDraft();
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    if (!(store.user?.canEditSociety(store.society.id) ?? false)) {
      return Scaffold(
        appBar: AppBar(title: const Text('Society profile')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: StateMessage(
              icon: Icons.lock_outline,
              title: 'Read-only access',
              message: 'Your role can view society information but cannot submit profile changes.',
            ),
          ),
        ),
      );
    }
    final draft = store.profileDraft;
    if (draft == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Check profile changes')),
        body: StateMessage(
          icon: Icons.inbox_outlined,
          title: 'No profile draft',
          message: 'Start from the society profile and choose Edit Profile.',
          primaryLabel: 'Back to profile',
          onPrimary: () => HomeShell.openTab(context, HomeShell.societyTab),
        ),
      );
    }
    final outdated = store.profileDraftOutdated;
    final changes = store.profileDraftChanges();
    final changedLabels = changes.map((change) => change.label).toSet();
    final unchanged = ProfileField.all
        .where((field) => !changedLabels.contains(field))
        .toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Check profile changes'),
        actions: [
          TextButton(onPressed: _discard, child: const Text('Discard')),
        ],
      ),
      body: Column(
        children: [
          if (store.offline) const OfflineBanner(),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (outdated) ...[
                  ConflictNotice(
                    updatedBy: store.recordUpdatedBy ?? 'The District Centre',
                    updatedAt: store.recordUpdatedAt ?? store.now,
                    onReload: _reload,
                  ),
                  const SizedBox(height: 12),
                ],
                if (_reloadNotes.isNotEmpty) ...[
                  NoticeBanner(
                    icon: Icons.info_outline,
                    tone: NoticeTone.warning,
                    title: 'Check ${_reloadNotes.join(', ')}',
                    message: 'This was also changed in the newer record. Your draft value is kept.',
                  ),
                  const SizedBox(height: 12),
                ],
                if (_sendError != null) ...[
                  NoticeBanner(
                    icon: Icons.wifi_off,
                    tone: NoticeTone.error,
                    title: 'Not sent',
                    message: _sendError,
                  ),
                  const SizedBox(height: 12),
                ],
                NoticeBanner(
                  icon: Icons.edit_note,
                  title: 'Draft saved ${formatDateTime(draft.savedAt)}',
                  message: 'Only you can see it. The approved record has not changed.',
                ),
                const SizedBox(height: 12),
                SectionCard(
                  title: 'Proposed changes',
                  highlight: true,
                  trailing: StatusChip.submission(
                    SubmissionStatus.draft,
                    compact: true,
                  ),
                  children: [
                    if (changes.isEmpty)
                      const Text(
                        'No differences from the approved record after reloading.',
                        style: TextStyle(color: AppColors.muted),
                      ),
                    for (final change in changes)
                      ChangeValue(
                        label: change.label,
                        previous:
                            change.previousValue == null ||
                                change.previousValue!.isEmpty
                            ? 'Missing'
                            : change.previousValue,
                        proposed: change.proposedValue.isEmpty
                            ? '(removed)'
                            : change.proposedValue,
                        note: change.label == ProfileField.location
                            ? Text(
                                draft.locationSource.label,
                                style: const TextStyle(
                                  color: AppColors.muted,
                                  fontSize: 12,
                                ),
                              )
                            : null,
                      ),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        onPressed: () => Navigator.of(context).pushReplacement(
                          MaterialPageRoute<void>(
                            builder: (_) => const EditProfileScreen(),
                          ),
                        ),
                        icon: const Icon(Icons.edit_outlined),
                        label: const Text('Edit draft'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                SectionCard(
                  title: 'Everything else',
                  children: [
                    for (final field in unchanged)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(
                          children: [
                            Expanded(child: Text(field)),
                            const Text(
                              'No change',
                              style: TextStyle(color: AppColors.muted),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: BottomActionBar(
        secondary: OutlinedButton(
          onPressed: _sending ? null : () => Navigator.of(context).pop(),
          child: const Text('Save draft'),
        ),
        primary: FilledButton.icon(
          onPressed: _sending || outdated || changes.isEmpty ? null : _submit,
          icon: const Icon(Icons.send),
          label: const Text('Submit to District'),
        ),
      ),
    );
  }
}
