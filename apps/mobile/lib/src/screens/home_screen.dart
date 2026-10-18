import 'package:flutter/material.dart';

import '../app.dart';
import '../data/demo_data.dart';
import '../format.dart';
import '../models/app_language.dart';
import '../models/submission.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/demo_loader.dart';
import '../widgets/demo_options_sheet.dart';
import '../widgets/section_card.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';
import 'audit_screen.dart';
import 'changes_requested_screen.dart';
import 'council_screen.dart';
import 'notifications_screen.dart';
import 'submission_detail_screen.dart';

/// M05 · Society Officer home.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final firstName = store.user?.displayName.split(' ').first ?? '';
    final copy = _HomeCopy(store.selectedLanguage);
    return Scaffold(
      appBar: AppBar(
        title: Text('${copy.greeting(store.now)}, $firstName'),
        actions: [
          const _NotificationsButton(),
          IconButton(
            tooltip: 'Demo options',
            icon: const Icon(Icons.tune),
            onPressed: () => showDemoOptions(context),
          ),
        ],
      ),
      body: Column(
        children: [
          if (store.offline) const OfflineBanner(),
          Expanded(
            child: DemoLoader(
              loadingLabel: 'Loading your society',
              builder: (context) => const _HomeContent(),
            ),
          ),
        ],
      ),
    );
  }
}

class _HomeContent extends StatelessWidget {
  const _HomeContent();

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    if (store.emptyRecords) {
      return const StateMessage(
        icon: Icons.holiday_village_outlined,
        title: 'No society information yet',
        message: 'Your assigned society will appear here after the District Centre completes the setup.',
      );
    }
    final copy = _HomeCopy(store.selectedLanguage);
    final society = store.society;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        SectionCard(
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        store.selectedLanguage == AppLanguage.tamil
                            ? 'களுவாஞ்சிக்குடி சர்வோதய சங்கம்'
                            : society.nameEn,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      if (society.nameLocal != null)
                        Text(
                          society.nameLocal!,
                          style: const TextStyle(color: AppColors.inkSoft),
                        ),
                      const SizedBox(height: 6),
                      Text(
                        '${society.societyCode} · ${society.district.nameEn}'
                        '${society.lastVerifiedOn == null ? '' : ' · Verified ${formatDate(society.lastVerifiedOn!)}'}',
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
                const StatusChip(
                  StatusStyle(
                    'Active',
                    Icons.check_circle_outline,
                    Color(0xFF25643F),
                    Color(0xFFE5F3E8),
                  ),
                  compact: true,
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 12),
        const _CompletenessCard(),
        const SizedBox(height: 12),
        const _CurrentSubmissionCard(),
        const SizedBox(height: 12),
        SectionCard(
          title: copy.needsAttention,
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
          children: [
            _AttentionTile(
              icon: Icons.description_outlined,
              title: 'AGM minutes requested',
              subtitle: 'From HQ · due 14 Oct 2026',
              chip: const StatusChip(
                StatusStyle(
                  'Due soon',
                  Icons.schedule,
                  Color(0xFF7A5A00),
                  Color(0xFFFFF2CC),
                ),
                compact: true,
              ),
              onTap: () => store.selectTab(HomeShell.documentsTab),
            ),
            _AttentionTile(
              icon: Icons.verified_outlined,
              title: 'Audit ${store.currentAudit.financialYear}',
              subtitle: store.currentAudit.reportUploaded
                  ? 'Report uploaded'
                  : 'Report not uploaded',
              chip: StatusChip(store.currentAudit.status.style, compact: true),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => const AuditScreen()),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        SectionCard(
          title: copy.quickActions,
          children: [
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 2.4,
              children: [
                _QuickAction(
                  icon: Icons.badge_outlined,
                  label: copy.viewProfile,
                  onTap: () => store.selectTab(HomeShell.societyTab),
                ),
                _QuickAction(
                  icon: Icons.groups_outlined,
                  label: copy.updateCouncil,
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => const CouncilScreen(),
                    ),
                  ),
                ),
                _QuickAction(
                  icon: Icons.insights_outlined,
                  label: copy.reportActivity,
                  onTap: () => ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text(
                        'Activity reporting is built in a separate task.',
                      ),
                    ),
                  ),
                ),
                _QuickAction(
                  icon: Icons.upload_file_outlined,
                  label: copy.uploadDocument,
                  onTap: () => store.selectTab(HomeShell.documentsTab),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }
}

/// Opens M16 Notifications. The badge shows how many are unread.
class _NotificationsButton extends StatelessWidget {
  const _NotificationsButton();

  @override
  Widget build(BuildContext context) {
    final unread = DemoScope.of(context).unreadNotificationCount;
    return Semantics(
      value: unread == 0 ? null : '$unread unread',
      child: IconButton(
        tooltip: 'Notifications',
        icon: Badge(
          isLabelVisible: unread > 0,
          label: Text('$unread'),
          backgroundColor: AppColors.leaf,
          child: Icon(
            unread > 0 ? Icons.notifications : Icons.notifications_outlined,
          ),
        ),
        onPressed: () => Navigator.of(context).push(
          MaterialPageRoute<void>(builder: (_) => const NotificationsScreen()),
        ),
      ),
    );
  }
}

class _CompletenessCard extends StatelessWidget {
  const _CompletenessCard();

  @override
  Widget build(BuildContext context) {
    final percent = DemoScope.of(context).society.profileCompleteness;
    return SectionCard(
      title: 'Profile completeness',
      trailing: Text(
        '$percent%',
        style: Theme.of(context).textTheme.titleMedium,
      ),
      children: [
        Semantics(
          label: 'Profile $percent percent complete',
          child: ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: percent / 100,
              minHeight: 8,
              backgroundColor: AppColors.mint,
              color: AppColors.leaf,
            ),
          ),
        ),
        const SizedBox(height: 10),
        Text(
          '${demoCompletedSections.length} sections complete · Missing: ${demoMissingSections.join(', ')}',
          style: const TextStyle(color: AppColors.muted, fontSize: 13),
        ),
        if (percent < 100) ...[
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: () =>
                DemoScope.read(context).selectTab(HomeShell.societyTab),
            icon: const Icon(Icons.edit_outlined),
            label: const Text('Complete profile'),
          ),
        ],
      ],
    );
  }
}

/// Current-submission card with one variant per status (SC-25 M02).
class _CurrentSubmissionCard extends StatelessWidget {
  const _CurrentSubmissionCard();

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final submission = store.councilSubmission;
    final draft = store.draft;

    void openCouncil() => Navigator.of(context)
        .push(MaterialPageRoute<void>(builder: (_) => const CouncilScreen()));
    void openDetail(SocietySubmission s) => Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => SubmissionDetailScreen(submissionId: s.id),
      ),
    );

    if (submission == null ||
        (submission.status == SubmissionStatus.approved && draft != null)) {
      if (draft == null) {
        return SectionCard(
          title: 'Current submission',
          children: [
            const Text(
              'No active submission. Changes you make are saved as a draft until you send them.',
              style: TextStyle(color: AppColors.muted),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: openCouncil,
              child: const Text('Update Committee'),
            ),
          ],
        );
      }
      return SectionCard(
        title: 'Current submission',
        highlight: true,
        trailing: StatusChip.submission(SubmissionStatus.draft, compact: true),
        children: [
          Text(
            'Council update · ${draft.fullName} replaces ${store.memberById(draft.memberId)?.fullName ?? 'a member'}',
          ),
          const SizedBox(height: 4),
          const Text(
            'Not sent yet. Only you can see this draft.',
            style: TextStyle(color: AppColors.muted, fontSize: 13),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: openCouncil,
            child: const Text('Continue draft'),
          ),
        ],
      );
    }

    final review = submission.latestReview;
    return SectionCard(
      title: 'Current submission',
      trailing: StatusChip.submission(submission.status, compact: true),
      children: [
        Text(
          '${submission.title} · ${submission.reference}',
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 4),
        Text(
          _summary(submission),
          style: const TextStyle(
            color: AppColors.muted,
            fontSize: 13,
            height: 1.35,
          ),
        ),
        if (submission.status == SubmissionStatus.changesRequested &&
            review?.comment != null) ...[
          const SizedBox(height: 10),
          NoticeBanner(
            icon: Icons.undo,
            tone: NoticeTone.warning,
            title: '${review!.reviewerDisplayName} returned 1 field',
            message: '“${review.comment}”',
          ),
        ],
        const SizedBox(height: 12),
        if (submission.status == SubmissionStatus.changesRequested)
          FilledButton(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) =>
                    ChangesRequestedScreen(submissionId: submission.id),
              ),
            ),
            child: const Text('Open returned submission'),
          )
        else
          OutlinedButton(
            onPressed: () => openDetail(submission),
            child: const Text('Track submission'),
          ),
      ],
    );
  }

  static String _summary(
    SocietySubmission submission,
  ) => switch (submission.status) {
    SubmissionStatus.draft => 'Not sent yet.',
    SubmissionStatus.submitted =>
      'Sent ${formatDateTime(submission.submittedAt!)}. Waiting for $demoReviewerOffice to review it.',
    SubmissionStatus.underReview =>
      '${submission.reviewerDisplayName ?? 'The District Manager'} is reviewing it. It is locked until the review is finished.',
    SubmissionStatus.changesRequested => 'The District Centre needs you to fix 1 field. Everything else is accepted.',
    SubmissionStatus.resubmitted =>
      'Correction sent. Waiting for the District Manager to check it.',
    SubmissionStatus.approved =>
      'Approved. The Council record has been updated. ${submission.latestReview?.comment ?? ''}',
    SubmissionStatus.rejected =>
      'Rejected: ${submission.latestReview?.comment ?? 'see the tracker for the reason.'}',
  };
}

class _AttentionTile extends StatelessWidget {
  const _AttentionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.chip,
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Widget chip;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      onTap: onTap,
      leading: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: AppColors.mintSoft,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, color: AppColors.leaf, size: 20),
      ),
      title: Text(
        title,
        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
      ),
      subtitle: Text(subtitle, style: const TextStyle(fontSize: 12)),
      trailing: chip,
    );
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.mintSoft,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          child: Row(
            children: [
              Icon(icon, color: AppColors.leaf, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  label,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                  maxLines: 2,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HomeCopy {
  const _HomeCopy(this.language);

  final AppLanguage language;

  String greeting(DateTime now) {
    if (language == AppLanguage.tamil) return 'முகப்பு';
    if (language == AppLanguage.sinhala) return 'ආයුබෝවන්';
    if (now.hour < 12) return 'Good morning';
    if (now.hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  String get needsAttention => switch (language) {
    AppLanguage.tamil => 'உங்கள் கவனம் தேவை',
    AppLanguage.sinhala => 'ඔබගේ අවධානය අවශ්‍යයි',
    AppLanguage.english => 'Needs your attention',
  };

  String get quickActions => switch (language) {
    AppLanguage.tamil => 'விரைவு செயல்கள்',
    AppLanguage.sinhala => 'ඉක්මන් ක්‍රියා',
    AppLanguage.english => 'Quick actions',
  };

  String get viewProfile => switch (language) {
    AppLanguage.tamil => 'சங்க விவரம்',
    AppLanguage.sinhala => 'සමිති පැතිකඩ',
    AppLanguage.english => 'View Society Profile',
  };

  String get updateCouncil => switch (language) {
    AppLanguage.tamil => 'சபையை புதுப்பிக்க',
    AppLanguage.sinhala => 'සභාව යාවත්කාලීන කරන්න',
    AppLanguage.english => 'Update Council',
  };

  String get reportActivity => switch (language) {
    AppLanguage.tamil => 'செயற்பாட்டைப் பதிவு செய்',
    AppLanguage.sinhala => 'ක්‍රියාකාරකම වාර්තා කරන්න',
    AppLanguage.english => 'Report Activity',
  };

  String get uploadDocument => switch (language) {
    AppLanguage.tamil => 'ஆவணத்தை பதிவேற்று',
    AppLanguage.sinhala => 'ලේඛනය උඩුගත කරන්න',
    AppLanguage.english => 'Upload Document',
  };
}
