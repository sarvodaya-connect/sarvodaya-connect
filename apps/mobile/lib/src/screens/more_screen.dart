import 'package:flutter/material.dart';

import '../models/app_language.dart';
import '../models/user.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/demo_options_sheet.dart';
import '../widgets/state_views.dart';
import 'notifications_screen.dart';
import 'emergency_response_screen.dart';

/// M17 - account, language, offline queue, help and sign-out.
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
          IconButton(
            tooltip: 'Demo options',
            icon: const Icon(Icons.tune),
            onPressed: () => showDemoOptions(context),
          ),
        ],
      ),
      body: ListView(
        children: [
          if (store.offline)
            const OfflineBanner(
              message: 'No connection. Connect to load or save information.',
            ),
          Material(
            color: AppColors.surface,
            child: ListTile(
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 4,
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
                user.primaryRole == UserRole.societyOfficer
                    ? 'Secretary · ${store.society.nameEn}'
                    : user.primaryRole.label,
                style: const TextStyle(fontSize: 11.5, color: AppColors.muted),
              ),
            ),
          ),
          const SizedBox(height: 16),
          ListTile(
            leading: const Icon(
              Icons.health_and_safety_outlined,
              color: AppColors.leaf,
            ),
            title: const Text('Emergency response'),
            subtitle: const Text(
              'Incidents, rapid assessments and situation reports',
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const EmergencyResponseScreen(),
              ),
            ),
          ),
          _MenuRow(
            icon: Icons.translate,
            title: 'Language',
            trailing: store.selectedLanguage.englishLabel,
            onTap: () => _chooseLanguage(context),
          ),
          if (user.primaryRole == UserRole.societyOfficer)
            _MenuRow(
              icon: Icons.notifications_none,
              title: 'Notifications',
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
            icon: Icons.help_outline,
            title: 'Help',
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
            danger: true,
            onTap: store.signOut,
          ),
        ],
      ),
    );
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

class _MenuRow extends StatelessWidget {
  const _MenuRow({
    required this.icon,
    required this.title,
    required this.onTap,
    this.trailing,
    this.danger = false,
  });

  final IconData icon;
  final String title;
  final String? trailing;
  final VoidCallback onTap;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final color = danger ? AppColors.danger : AppColors.ink;
    return Material(
      color: AppColors.surface,
      child: InkWell(
        onTap: onTap,
        child: Container(
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: AppColors.line)),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Icon(icon, size: 20, color: danger ? color : AppColors.inkSoft),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(fontSize: 13.5, color: color),
                ),
              ),
              if (trailing != null)
                Text(
                  trailing!,
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: AppColors.muted,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
