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
import '../widgets/landscape_header.dart';
import '../widgets/section_card.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';
import 'audit_screen.dart';
import 'changes_requested_screen.dart';
import 'council_screen.dart';
import 'notifications_screen.dart';
import 'membership_screen.dart';
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
      body: Column(
        children: [
          LandscapeHeader(
            title: '${copy.greeting(store.now)}, $firstName',
            actions: [
              const _NotificationsButton(),
              IconButton(
                tooltip: 'Demo options',
                icon: const Icon(Icons.tune),
                onPressed: () => showDemoOptions(context),
              ),
            ],
          ),
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
    final completeness = society.profileCompleteness;
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
            const SizedBox(height: 14),
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Profile completeness',
                    style: TextStyle(color: AppColors.muted, fontSize: 12),
                  ),
                ),
                Text(
                  '$completeness%',
                  style: const TextStyle(
                    color: AppColors.forest,
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
                TextButton(
                  onPressed: () => store.selectTab(HomeShell.societyTab),
                  child: const Text('Complete profile'),
                ),
              ],
            ),
            Semantics(
              label: 'Profile $completeness percent complete',
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: LinearProgressIndicator(
                  value: completeness / 100,
                  minHeight: 6,
                  backgroundColor: AppColors.mint,
                  color: AppColors.leaf,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        SectionCard(
          title: copy.needsAttention,
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
          children: [
            const _CurrentSubmissionCard(),
            const Divider(height: 1),
            _AttentionTile(
              icon: Icons.description_outlined,
              iconColor: const Color(0xFF356C99),
              iconBackground: const Color(0xFFE8F2FA),
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
              iconColor: const Color(0xFFB83439),
              iconBackground: const Color(0xFFFDECEC),
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
              childAspectRatio: 1.65,
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
                _QuickAction(
                  icon: Icons.people_alt_outlined,
                  label: 'Membership',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => const MembershipScreen(),
                    ),
                  ),
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

/// Catalogue-style attention row that preserves the current submission actions.
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
        return _AttentionTile(
          icon: Icons.groups_outlined,
          title: 'Update your council',
          subtitle: 'Keep your society committee details current',
          chip: const Icon(Icons.chevron_right, color: AppColors.muted),
          onTap: openCouncil,
        );
      }
      return _AttentionTile(
        icon: Icons.groups_outlined,
        title: 'Council update draft',
        subtitle:
            '${draft.fullName} replaces ${store.memberById(draft.memberId)?.fullName ?? 'a member'} · Not sent yet',
        chip: StatusChip.submission(SubmissionStatus.draft, compact: true),
        onTap: openCouncil,
      );
    }

    final review = submission.latestReview;
    final returned = submission.status == SubmissionStatus.changesRequested;
    return _AttentionTile(
      icon: returned
          ? Icons.keyboard_return_rounded
          : Icons.description_outlined,
      iconColor: returned ? const Color(0xFFD9852B) : null,
      iconBackground: returned ? const Color(0xFFFFF1DC) : null,
      title: returned ? 'Council update returned' : submission.title,
      subtitle: returned
          ? 'Fix 1 field · ${review?.comment ?? 'District comment'}'
          : _summary(submission),
      chip: returned
          ? const Icon(Icons.chevron_right, color: AppColors.muted)
          : StatusChip.submission(submission.status, compact: true),
      onTap: returned
          ? () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) =>
                    ChangesRequestedScreen(submissionId: submission.id),
              ),
            )
          : () => openDetail(submission),
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
    this.iconColor,
    this.iconBackground,
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Widget chip;
  final Color? iconColor;
  final Color? iconBackground;
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
          color: iconBackground ?? AppColors.mintSoft,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, color: iconColor ?? AppColors.leaf, size: 20),
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
