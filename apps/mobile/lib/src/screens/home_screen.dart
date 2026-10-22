import 'package:flutter/material.dart';

import '../app.dart';
import '../data/demo_data.dart';
import '../format.dart';
import '../models/app_language.dart';
import '../models/submission.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/demo_loader.dart';
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
            actions: const [_NotificationsButton()],
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
      padding: const EdgeInsets.only(bottom: 16),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: SectionCard(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
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
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        if (society.nameLocal != null)
                          Text(
                            society.nameLocal!,
                            style: const TextStyle(
                              color: AppColors.inkSoft,
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
              const SizedBox(height: 8),
              Wrap(
                spacing: 14,
                runSpacing: 2,
                children: [
                  _MetaText(society.societyCode),
                  _MetaText(society.district.nameEn),
                  if (society.lastVerifiedOn != null)
                    _MetaText(
                      'Verified ${formatDate(society.lastVerifiedOn!)}',
                    ),
                ],
              ),
              const SizedBox(height: 12),
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
                    style: TextButton.styleFrom(
                      minimumSize: const Size(0, 32),
                      padding: const EdgeInsets.only(left: 10),
                      textStyle: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
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
        ),
        _SectionLabel(copy.needsAttention),
        _WhiteBlock(
          children: [
            const _CurrentSubmissionCard(),
            _AttentionTile(
              icon: Icons.description_outlined,
              iconColor: const Color(0xFF356C99),
              iconBackground: const Color(0xFFE8F2FA),
              title: 'AGM minutes requested',
              subtitle: 'From HQ · due 14 Oct 2026',
              chip: const StatusChip(
                StatusStyle(
                  '5 days',
                  Icons.schedule,
                  Color(0xFF7A5A00),
                  Color(0xFFFFF2CC),
                ),
                compact: true,
              ),
              onTap: () => store.selectTab(HomeShell.documentsTab),
            ),
            _AttentionTile(
              icon: Icons.verified_user_outlined,
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
        _SectionLabel(copy.quickActions),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: _TwoColumnGrid(
            children: [
              _QuickAction(
                icon: Icons.show_chart,
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
                icon: Icons.groups_outlined,
                label: copy.updateCouncil,
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const CouncilScreen(),
                  ),
                ),
              ),
              _QuickAction(
                icon: Icons.file_upload_outlined,
                label: copy.uploadDocument,
                onTap: () => store.selectTab(HomeShell.documentsTab),
              ),
              _QuickAction(
                icon: Icons.people_alt_outlined,
                label: copy.membership,
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const MembershipScreen(),
                  ),
                ),
              ),
              _QuickAction(
                icon: Icons.badge_outlined,
                label: copy.viewProfile,
                onTap: () => store.selectTab(HomeShell.societyTab),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Two equal columns whose rows grow with their text (no fixed aspect ratio).
class _TwoColumnGrid extends StatelessWidget {
  const _TwoColumnGrid({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      for (var i = 0; i < children.length; i += 2) ...[
        if (i > 0) const SizedBox(height: 10),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(child: children[i]),
              const SizedBox(width: 10),
              Expanded(
                child: i + 1 < children.length
                    ? children[i + 1]
                    : const SizedBox.shrink(),
              ),
            ],
          ),
        ),
      ],
    ],
  );
}

class _MetaText extends StatelessWidget {
  const _MetaText(this.text);

  final String text;

  @override
  Widget build(BuildContext context) =>
      Text(text, style: const TextStyle(color: AppColors.muted, fontSize: 12));
}

/// Bold section label on the page background, as in the catalogue home.
class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
    child: Semantics(
      header: true,
      child: Text(
        text,
        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
      ),
    ),
  );
}

/// Full-width white list with hairline dividers between rows.
class _WhiteBlock extends StatelessWidget {
  const _WhiteBlock({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Material(
    color: AppColors.surface,
    shape: const Border.symmetric(
      horizontal: BorderSide(color: AppColors.line),
    ),
    child: Column(
      children: [
        for (final (index, child) in children.indexed) ...[
          if (index > 0) const Divider(height: 1, indent: 16, endIndent: 16),
          child,
        ],
      ],
    ),
  );
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
          backgroundColor: const Color(0xFFC0392B),
          child: const Icon(Icons.notifications_outlined),
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
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
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
      subtitle: Text(
        subtitle,
        style: const TextStyle(fontSize: 12, color: AppColors.muted),
      ),
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
      color: AppColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.line),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: AppColors.forest, size: 20),
              const SizedBox(height: 10),
              Text(
                label,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
                maxLines: 2,
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
    AppLanguage.english => 'View society profile',
  };

  String get updateCouncil => switch (language) {
    AppLanguage.tamil => 'சபையை புதுப்பிக்க',
    AppLanguage.sinhala => 'සභාව යාවත්කාලීන කරන්න',
    AppLanguage.english => 'Update committee',
  };

  String get reportActivity => switch (language) {
    AppLanguage.tamil => 'செயற்பாட்டைப் பதிவு செய்',
    AppLanguage.sinhala => 'ක්‍රියාකාරකම වාර්තා කරන්න',
    AppLanguage.english => 'Report activity',
  };

  String get membership => switch (language) {
    AppLanguage.tamil => 'உறுப்பினர்',
    AppLanguage.sinhala => 'සාමාජිකත්වය',
    AppLanguage.english => 'Membership',
  };

  String get uploadDocument => switch (language) {
    AppLanguage.tamil => 'ஆவணத்தை பதிவேற்று',
    AppLanguage.sinhala => 'ලේඛනය උඩුගත කරන්න',
    AppLanguage.english => 'Upload document',
  };
}
