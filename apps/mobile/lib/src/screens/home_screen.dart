import 'package:flutter/material.dart';

import '../app.dart';
import '../format.dart';
import '../models/app_language.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/demo_loader.dart';
import '../widgets/demo_options_sheet.dart';
import '../widgets/landscape_header.dart';
import '../widgets/section_card.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';
import 'audit_screen.dart';
import 'council_screen.dart';
import 'notifications_screen.dart';

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
            _AttentionTile(
              icon: Icons.keyboard_return_rounded,
              iconColor: const Color(0xFFD9852B),
              iconBackground: const Color(0xFFFFF1DC),
              title: 'Council update returned',
              subtitle: 'Fix 1 field · District comment',
              chip: const Icon(Icons.chevron_right, color: AppColors.muted),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => const CouncilScreen()),
              ),
            ),
            const Divider(height: 1),
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
            const Divider(height: 1),
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

class _AttentionTile extends StatelessWidget {
  const _AttentionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.chip,
    required this.iconColor,
    required this.iconBackground,
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Widget chip;
  final Color iconColor;
  final Color iconBackground;
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
          color: iconBackground,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, color: iconColor, size: 20),
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
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.line),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0D1A2D21),
              blurRadius: 5,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, color: AppColors.leaf, size: 23),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    label,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                    maxLines: 2,
                  ),
                ),
              ],
            ),
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
