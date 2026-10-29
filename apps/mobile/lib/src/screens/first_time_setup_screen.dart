import 'package:flutter/material.dart';

import '../state/demo_store.dart';
import '../models/user.dart';

/// M04c: the role and assignments come from HQ; they cannot be self-selected.
class FirstTimeSetupScreen extends StatefulWidget {
  const FirstTimeSetupScreen({super.key});
  @override
  State<FirstTimeSetupScreen> createState() => _ReadyState();
}

class _ReadyState extends State<FirstTimeSetupScreen> {
  bool _notifications = true;
  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context), user = DemoScope.of(context).user!;
    return Scaffold(
      appBar: AppBar(title: const Text('Account ready')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const Icon(Icons.check_circle_outline, size: 64),
          const Text('Your account is ready', style: TextStyle(fontSize: 24)),
          Text(user.displayName),
          Text(user.primaryRole.label),
          Text(
            user.primaryRole == UserRole.societyOfficer
                ? store.society.nameEn
                : '${user.societyIds.length} assigned societies',
          ),
          const Text(
            'HQ assigned your role and access. Contact HQ if the details are wrong.',
          ),
          SwitchListTile(
            value: _notifications,
            onChanged: (v) => setState(() => _notifications = v),
            title: const Text('Allow notifications'),
          ),
          FilledButton(
            onPressed: () => store.completeFirstTimeSetup(
              notificationsEnabled: _notifications,
            ),
            child: const Text('Continue to home'),
          ),
          TextButton(
            onPressed: store.signOut,
            child: const Text('Sign out and contact HQ'),
          ),
        ],
      ),
    );
  }
}
