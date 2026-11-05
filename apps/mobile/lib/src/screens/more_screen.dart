import 'package:flutter/material.dart';

import '../models/app_language.dart';
import '../models/user.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/demo_options_sheet.dart';
import '../widgets/state_views.dart';
import 'notifications_screen.dart';
import '../incidents/incident_screens.dart';
import '../sarvoai/sarvoai_screen.dart';

/// V5 M17 More: profile, language, notifications, help and sign-out, and
/// SarvoAI for HQ.
class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final user = store.user!;
    return Scaffold(
      appBar: AppBar(
        title: const Text('More'),
        actions: [
          if (store.isDemo)
            IconButton(
              tooltip: 'Demo options',
              icon: const Icon(Icons.tune),
              onPressed: () => showDemoOptions(context),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: [
          if (store.offline)
            const OfflineBanner(
              message: 'No connection. Connect to load or save information.',
            ),
          if (user.roles.contains(UserRole.hqAdmin)) ...[
            // V5 M17 (HQ) and M80: SarvoAI is HQ only; the API checks it too.
            Material(
              color: AppColors.pine,
              borderRadius: BorderRadius.circular(14),
              child: ListTile(
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 6,
                ),
                leading: const Icon(
                  Icons.auto_awesome,
                  color: Color(0xFFF3C44E),
                ),
                title: Text.rich(
                  const TextSpan(
                    children: [
                      TextSpan(text: 'Ask Sarvo'),
                      TextSpan(
                        text: 'AI',
                        style: TextStyle(color: Color(0xFFF0A040)),
                      ),
                    ],
                  ),
                  semanticsLabel: 'Ask SarvoAI',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                subtitle: const Text(
                  'Questions about societies and yearly figures · HQ only',
                  style: TextStyle(color: Colors.white70, fontSize: 12),
                ),
                trailing: const Icon(Icons.chevron_right, color: Colors.white),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const SarvoAiScreen(),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],
          _Group(
            children: [
              ListTile(
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 6,
                ),
                leading: CircleAvatar(
                  backgroundColor: AppColors.mint,
                  foregroundColor: AppColors.forest,
                  child: Text(
                    _initials(user.displayName),
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                title: Text(
                  user.primaryRole == UserRole.societyOfficer
                      ? _shortName(user.displayName)
                      : user.displayName,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
                subtitle: Text(
                  _scopeLabel(store, user),
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: AppColors.muted,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _Group(
            children: [
              _MenuRow(
                icon: Icons.language,
                title: 'Language',
                trailing: store.selectedLanguage.englishLabel,
                onTap: () => _chooseLanguage(context),
              ),
              _MenuRow(
                icon: Icons.notifications_none,
                title: 'Notifications',
                chevron: true,
                trailing: store.unreadNotificationCount == 0
                    ? null
                    : '${store.unreadNotificationCount} unread',
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const NotificationsScreen(),
                  ),
                ),
              ),
              _MenuRow(
                icon: Icons.health_and_safety_outlined,
                title: 'Disaster response',
                chevron: true,
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const IncidentsScreen(),
                  ),
                ),
              ),
              _MenuRow(
                icon: Icons.help_outline,
                title: 'Help and HQ contact',
                chevron: true,
                onTap: () => showDialog<void>(
                  context: context,
                  builder: (context) => AlertDialog(
                    title: const Text('Need help?'),
                    content: const Text(
                      'Contact your District Centre if your account, society assignment or submitted information is incorrect.',
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.of(context).pop(),
                        child: const Text('Close'),
                      ),
                    ],
                  ),
                ),
              ),
              _MenuRow(
                icon: Icons.logout,
                title: 'Sign out',
                subtitle: 'Back to the sign-in screen',
                danger: true,
                last: true,
                onTap: store.signOut,
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// V5 M17: "Society Program Coordinator (SPC) · 12 societies".
  static String _scopeLabel(DemoStore store, AuthenticatedUser user) {
    final societies = user.societyIds.length;
    final count = '$societies ${societies == 1 ? 'society' : 'societies'}';
    return switch (user.primaryRole) {
      // The store's society is fictional, so only a demonstration shows it.
      UserRole.societyOfficer =>
        store.isDemo
            ? 'Society Officer · ${store.society.nameEn}'
            : 'Society Officer · $count',
      UserRole.programmeCoordinator =>
        'Society Program Coordinator (SPC) · $count',
      UserRole.deputyDistrictManager =>
        'Deputy District Manager (DDM) · $count',
      UserRole.districtManager => 'District Manager (DM) · view only',
      UserRole.hqAdmin => 'HQ · National',
    };
  }

  static String _shortName(String name) {
    final parts = name.split(' ');
    return parts.length < 2 ? name : '${parts.first[0]}. ${parts.last}';
  }

  static String _initials(String name) => name
      .split(' ')
      .where((part) => part.isNotEmpty)
      .take(2)
      .map((part) => part[0].toUpperCase())
      .join();

  static void _chooseLanguage(BuildContext context) {
    final store = DemoScope.read(context);
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: RadioGroup<AppLanguage>(
          groupValue: store.selectedLanguage,
          onChanged: (value) {
            if (value == null) return;
            store.chooseLanguage(value);
            Navigator.of(context).pop();
          },
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const ListTile(
                title: Text(
                  'Choose language',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              for (final language in AppLanguage.values)
                RadioListTile<AppLanguage>(
                  value: language,
                  title: Text(language.nativeLabel),
                  subtitle: Text(language.englishLabel),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A white card holding rows, as in V5 M17.
class _Group extends StatelessWidget {
  const _Group({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Material(
    color: AppColors.surface,
    clipBehavior: Clip.antiAlias,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(14),
      side: const BorderSide(color: AppColors.line),
    ),
    child: Column(children: children),
  );
}

class _MenuRow extends StatelessWidget {
  const _MenuRow({
    required this.icon,
    required this.title,
    required this.onTap,
    this.trailing,
    this.subtitle,
    this.danger = false,
    this.chevron = false,
    this.last = false,
  });

  final IconData icon;
  final String title;
  final String? trailing;
  final String? subtitle;
  final VoidCallback onTap;
  final bool danger;
  final bool chevron;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final color = danger ? AppColors.danger : AppColors.ink;
    return InkWell(
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(minHeight: 52),
        decoration: BoxDecoration(
          border: last
              ? null
              : const Border(bottom: BorderSide(color: AppColors.line)),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Icon(icon, size: 20, color: danger ? color : AppColors.inkSoft),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 13.5,
                      color: color,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (subtitle != null)
                    Text(
                      subtitle!,
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: AppColors.muted,
                      ),
                    ),
                ],
              ),
            ),
            if (trailing != null)
              Text(
                trailing!,
                style: const TextStyle(fontSize: 11.5, color: AppColors.muted),
              ),
            if (chevron)
              const Icon(Icons.chevron_right, color: AppColors.muted),
          ],
        ),
      ),
    );
  }
}
