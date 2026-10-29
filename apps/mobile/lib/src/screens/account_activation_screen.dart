import 'package:flutter/material.dart';

import '../auth/api_auth_service.dart';
import '../state/demo_store.dart';

class AccountActivationScreen extends StatefulWidget {
  const AccountActivationScreen({super.key});
  @override
  State<AccountActivationScreen> createState() => _ActivationState();
}

class _ActivationState extends State<AccountActivationScreen> {
  final _username = TextEditingController(),
      _credential = TextEditingController(),
      _password = TextEditingController(),
      _confirm = TextEditingController();
  Map<String, dynamic>? _details;
  String? _error;
  bool _busy = false, _ready = false, _expired = false;
  @override
  void dispose() {
    for (final c in [_username, _credential, _password, _confirm]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final api = DemoScope.read(context).identityApi;
      final input = <String, dynamic>{
        'credential': _credential.text.trim(),
        if (_username.text.trim().isNotEmpty) 'username': _username.text.trim(),
      };
      if (_details == null) {
        final details = await api.request(
          '/identity/activation/check',
          method: 'POST',
          body: input,
        );
        if (mounted) setState(() => _details = details as Map<String, dynamic>);
      } else {
        if (_password.text.length < 10 ||
            !RegExp(r'\d').hasMatch(_password.text)) {
          throw const IdentityError(
            400,
            'Use at least 10 characters, including a number.',
          );
        }
        if (_password.text != _confirm.text) {
          throw const IdentityError(400, 'The passwords do not match.');
        }
        await api.request(
          '/identity/activation/complete',
          method: 'POST',
          body: {...input, 'password': _password.text},
        );
        if (mounted) setState(() => _ready = true);
        _password.clear();
        _confirm.clear();
        _credential.clear();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _expired = e is IdentityError && e.status == 410;
          _error = e is IdentityError
              ? e.message
              : 'Could not connect. Please try again.';
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Activate your account')),
    body: ListView(
      padding: const EdgeInsets.all(24),
      children: [
        if (_ready) ...[
          const Icon(Icons.check_circle_outline, size: 64),
          const Text('Your account is ready', style: TextStyle(fontSize: 24)),
          const Text(
            'Sign in with your username and the password you created.',
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Go to sign in'),
          ),
        ] else ...[
          Text(
            _expired
                ? 'Activation link expired'
                : _details == null
                ? 'Use your activation details'
                : 'Check your details and create your password',
            style: const TextStyle(fontSize: 22),
          ),
          const Text(
            'HQ gives you a one-time activation credential or temporary password. Your permanent password stays private.',
          ),
          TextField(
            controller: _username,
            readOnly: _details != null,
            decoration: const InputDecoration(
              labelText: 'Username (required with temporary password)',
            ),
          ),
          TextField(
            controller: _credential,
            readOnly: _details != null,
            obscureText: true,
            decoration: const InputDecoration(
              labelText: 'Activation credential or temporary password',
            ),
          ),
          if (_details != null) ...[
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_details!['displayName'] as String),
                    Text(
                      'Role: ${_details!['roleLabel'] ?? _details!['role']}',
                    ),
                    Text(
                      'District: ${_details!['scopeLabel'] ?? _details!['districtId'] ?? 'National'}',
                    ),
                    Text(
                      'Assigned societies: ${(_details!['societyIds'] as List).length}',
                    ),
                    const Text(
                      'HQ sets your role and assignments. If they are wrong, contact HQ before continuing.',
                    ),
                  ],
                ),
              ),
            ),
            TextField(
              controller: _password,
              obscureText: true,
              autofillHints: const [AutofillHints.newPassword],
              decoration: const InputDecoration(labelText: 'New password'),
            ),
            TextField(
              controller: _confirm,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Confirm password'),
            ),
            const Text(
              'At least 10 characters, including a number. Different from your username.',
            ),
          ],
          if (_error != null)
            Text(_error!, style: const TextStyle(color: Colors.red)),
          if (_expired)
            TextButton(
              onPressed: () => setState(() {
                _expired = false;
                _details = null;
                _credential.clear();
                _error = null;
              }),
              child: const Text('Use a new temporary password'),
            ),
          if (!_expired)
            FilledButton(
              onPressed: _busy ? null : _submit,
              child: Text(
                _busy
                    ? 'Please wait…'
                    : _details == null
                    ? 'Check account details'
                    : 'Activate account',
              ),
            ),
          const Text(
            'An expired or used credential cannot be reused. Ask HQ to issue a new one.',
          ),
        ],
      ],
    ),
  );
}
