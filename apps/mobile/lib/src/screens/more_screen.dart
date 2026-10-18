import 'package:flutter/material.dart';

import '../models/app_language.dart';
import '../models/user.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/demo_options_sheet.dart';
import '../widgets/state_views.dart';
import 'notifications_screen.dart';

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
              message: 'Offline · changes will send when online',
            ),
          ListTile(
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 20,
              vertical: 8,
            ),
            leading: CircleAvatar(
              backgroundColor: AppColors.mint,
              foregroundColor: AppColors.forest,
              child: Text(_initials(user.displayName)),
            ),
            title: Text(
              user.displayName,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            subtitle: Text(
              user.primaryRole == UserRole.societyOfficer
                  ? '${user.primaryRole.label} · ${store.society.nameEn}'
                  : user.primaryRole.label,
            ),
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.sync_outlined),
            title: Text('Waiting to send (${store.offline ? 3 : 0})'),
            subtitle: Text(
              store.offline
                  ? 'Saved safely on this phone and sent when online'
                  : 'Everything has been sent',
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _showWaitingItems(context, store.offline),
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.translate),
            title: const Text('Language'),
            subtitle: Text(store.selectedLanguage.englishLabel),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _chooseLanguage(context),
          ),
          if (user.primaryRole == UserRole.societyOfficer)
            ListTile(
              leading: const Icon(Icons.notifications_outlined),
              title: const Text('Notifications'),
              subtitle: Text('${store.unreadNotificationCount} unread'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const NotificationsScreen(),
                ),
              ),
            ),
          ListTile(
            leading: const Icon(Icons.help_outline),
            title: const Text('Help'),
            trailing: const Icon(Icons.chevron_right),
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
          const Divider(),
          ListTile(
            leading: const Icon(Icons.logout, color: AppColors.danger),
            title: const Text(
              'Sign out',
              style: TextStyle(color: AppColors.danger),
            ),
            onTap: store.signOut,
          ),
        ],
      ),
    );
  }

  static String _initials(String name) => name
      .split(' ')
      .where((part) => part.isNotEmpty)
      .take(2)
      .map((part) => part[0].toUpperCase())
      .join();

  static void _showWaitingItems(BuildContext context, bool offline) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          child: offline
              ? const Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Waiting to send',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    ListTile(
                      leading: Icon(Icons.insights_outlined),
                      title: Text('Tank cleaning activity'),
                      subtitle: Text('Saved on this phone'),
                    ),
                    ListTile(
                      leading: Icon(Icons.description_outlined),
                      title: Text('Audit report PDF'),
                      subtitle: Text('Will retry when online'),
                    ),
                    ListTile(
                      leading: Icon(Icons.edit_note_outlined),
                      title: Text('Profile correction'),
                      subtitle: Text('Saved on this phone'),
                    ),
                  ],
                )
              : const StateMessage(
                  icon: Icons.cloud_done_outlined,
                  title: 'Everything is up to date',
                  message: 'There are no items waiting to send.',
                  tone: StateTone.success,
                ),
        ),
      ),
    );
  }

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
