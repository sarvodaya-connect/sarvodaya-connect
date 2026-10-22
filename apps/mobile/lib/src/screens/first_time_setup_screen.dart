import 'package:flutter/material.dart';

import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/state_views.dart';

/// M04 - three short steps after the first sign-in: confirm the society,
/// confirm the role, allow notifications.
class FirstTimeSetupScreen extends StatefulWidget {
  const FirstTimeSetupScreen({super.key});

  @override
  State<FirstTimeSetupScreen> createState() => _FirstTimeSetupScreenState();
}

class _FirstTimeSetupScreenState extends State<FirstTimeSetupScreen> {
  static const _steps = 3;
  var _step = 0;
  bool _notifications = true;

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final society = store.society;

    final (title, body, note) = switch (_step) {
      0 => (
        'Is your society?',
        _ConfirmCard(
          leading: const CircleAvatar(
            radius: 20,
            backgroundColor: Colors.white,
            backgroundImage: AssetImage(
              'assets/branding/sarvodaya_connect_logo.jpg',
            ),
          ),
          title: society.nameEn,
          lines: [
            ?society.nameLocal,
            '${society.societyCode} · ${society.address.gnDivision} GN · '
                '${society.district.nameEn}',
          ],
        ),
        'Your District Centre linked your account to this society. If it is '
            'wrong, choose “Not my society” and they will fix it.',
      ),
      1 => (
        'Is this your role?',
        const _ConfirmCard(
          leading: CircleAvatar(
            radius: 20,
            backgroundColor: AppColors.mint,
            child: Icon(Icons.badge_outlined, color: AppColors.forest),
          ),
          title: 'Society Officer',
          lines: ['Executive member · updates the society record'],
        ),
        'Society Officers keep the society record up to date and send changes '
            'to the District Centre.',
      ),
      _ => (
        'Allow notifications',
        Card(
          child: SwitchListTile(
            value: _notifications,
            onChanged: (value) => setState(() => _notifications = value),
            title: const Text(
              'Allow notifications',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
            ),
            subtitle: const Text(
              'Approvals, returned submissions and reminders.',
              style: TextStyle(fontSize: 12),
            ),
          ),
        ),
        'You can change this any time in More › Notifications.',
      ),
    };

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            Row(
              children: [
                for (var i = 0; i < _steps; i++) ...[
                  if (i > 0) const SizedBox(width: 4),
                  Expanded(
                    child: Container(
                      height: 3,
                      decoration: BoxDecoration(
                        color: i <= _step ? AppColors.action : AppColors.line,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 10),
            Text(
              'SETUP · STEP ${_step + 1} OF $_steps',
              style: const TextStyle(
                color: AppColors.muted,
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              title,
              style: Theme.of(context).textTheme.headlineSmall
                  ?.copyWith(fontSize: 21),
            ),
            const SizedBox(height: 16),
            body,
            const SizedBox(height: 14),
            Text(
              note,
              style: const TextStyle(
                color: AppColors.muted,
                fontSize: 12,
                height: 1.4,
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: BottomActionBar(
        secondary: _step == 0
            ? OutlinedButton(
                onPressed: store.signOut,
                child: const Text('Not my society'),
              )
            : OutlinedButton(
                onPressed: () => setState(() => _step--),
                child: const Text('Back'),
              ),
        primary: FilledButton(
          onPressed: () {
            if (_step < _steps - 1) {
              setState(() => _step++);
            } else {
              store.completeFirstTimeSetup(
                notificationsEnabled: _notifications,
              );
            }
          },
          child: Text(_step < _steps - 1 ? 'Yes, continue' : 'Finish setup'),
        ),
      ),
    );
  }
}

class _ConfirmCard extends StatelessWidget {
  const _ConfirmCard({
    required this.leading,
    required this.title,
    required this.lines,
  });

  final Widget leading;
  final String title;
  final List<String> lines;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            leading,
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                  ),
                  for (final line in lines)
                    Text(
                      line,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
