import 'package:flutter/material.dart';

import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/brand.dart';

/// M04 - confirms the account assignment after the first successful sign-in.
class FirstTimeSetupScreen extends StatefulWidget {
  const FirstTimeSetupScreen({super.key});

  @override
  State<FirstTimeSetupScreen> createState() => _FirstTimeSetupScreenState();
}

class _FirstTimeSetupScreenState extends State<FirstTimeSetupScreen> {
  bool _societyConfirmed = false;
  bool _roleConfirmed = false;
  bool _notifications = true;

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final canContinue = _societyConfirmed && _roleConfirmed;

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const BrandMark(compact: true),
              const SizedBox(height: 32),
              Text(
                'Set up your account',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 8),
              const Text(
                'Check that your society and role are correct before continuing.',
                style: TextStyle(color: AppColors.muted, height: 1.4),
              ),
              const SizedBox(height: 24),
              _SetupCard(
                step: '1',
                title: 'Confirm your society',
                value: store.society.nameEn,
                checked: _societyConfirmed,
                onChanged: (value) =>
                    setState(() => _societyConfirmed = value ?? false),
              ),
              const SizedBox(height: 12),
              _SetupCard(
                step: '2',
                title: 'Confirm your role',
                value: 'Society Officer',
                checked: _roleConfirmed,
                onChanged: (value) =>
                    setState(() => _roleConfirmed = value ?? false),
              ),
              const SizedBox(height: 12),
              Card(
                child: SwitchListTile(
                  value: _notifications,
                  onChanged: (value) => setState(() => _notifications = value),
                  secondary: const CircleAvatar(
                    backgroundColor: AppColors.mint,
                    child: Text('3'),
                  ),
                  title: const Text('Allow notifications'),
                  subtitle: const Text(
                    'Receive approval updates, returned submissions and reminders.',
                  ),
                ),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: canContinue
                    ? () => store.completeFirstTimeSetup(
                        notificationsEnabled: _notifications,
                      )
                    : null,
                child: const Text('Finish setup'),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: store.signOut,
                child: const Text('This is not my society or role'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SetupCard extends StatelessWidget {
  const _SetupCard({
    required this.step,
    required this.title,
    required this.value,
    required this.checked,
    required this.onChanged,
  });

  final String step;
  final String title;
  final String value;
  final bool checked;
  final ValueChanged<bool?> onChanged;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: CheckboxListTile(
        value: checked,
        onChanged: onChanged,
        secondary: CircleAvatar(
          backgroundColor: AppColors.mint,
          child: Text(step),
        ),
        title: Text(title),
        subtitle: Text(value),
        controlAffinity: ListTileControlAffinity.trailing,
      ),
    );
  }
}
