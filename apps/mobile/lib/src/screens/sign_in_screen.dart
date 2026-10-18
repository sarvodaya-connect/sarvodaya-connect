import 'package:flutter/material.dart';

import '../auth/auth_service.dart';
import '../data/demo_data.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../validation/validators.dart';
import '../widgets/brand.dart';
import '../widgets/state_views.dart';

/// M03 - sign-in through an injected authentication service.
class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key});

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final _formKey = GlobalKey<FormState>();
  final _username = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _error = null);
    if (!_formKey.currentState!.validate()) return;
    setState(() => _busy = true);
    final store = DemoScope.read(context);
    try {
      final ok = await store.signIn(_username.text, _password.text);
      if (!mounted) return;
      if (!ok) {
        // Keep the username; clear only the password.
        _password.clear();
        setState(
          () => _error = 'The username or password is not correct. Check them and try again.',
        );
      }
    } on OfflineException {
      if (!mounted) return;
      setState(
        () => _error = 'You need internet to sign in the first time. Connect and try again.',
      );
    } on AuthServiceException {
      if (!mounted) return;
      setState(
        () => _error =
            'Authentication is temporarily unavailable. Please try again.',
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _useDemoAccount() {
    _username.text = DemoAccount.username;
    _password.text = DemoAccount.password;
    setState(() => _error = null);
  }

  @override
  Widget build(BuildContext context) {
    final offline = DemoScope.of(context).offline;
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: Column(
          children: [
            if (offline) const OfflineBanner(message: 'No connection'),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Align(
                        alignment: Alignment.centerLeft,
                        child: BrandMark(),
                      ),
                      const SizedBox(height: 32),
                      Text(
                        'Sign in with your Sarvodaya account',
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Use the account your District Centre gave you. It opens your society’s record.',
                        style: TextStyle(color: AppColors.muted, height: 1.4),
                      ),
                      const SizedBox(height: 24),
                      if (_error != null) ...[
                        NoticeBanner(
                          icon: Icons.error_outline,
                          title: 'Could not sign in',
                          message: _error,
                          tone: NoticeTone.error,
                          action: Align(
                            alignment: Alignment.centerLeft,
                            child: TextButton(
                              onPressed: _busy ? null : _submit,
                              child: const Text('Try again'),
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],
                      TextFormField(
                        controller: _username,
                        decoration: const InputDecoration(
                          labelText: 'Username or email',
                        ),
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.next,
                        autofillHints: const [AutofillHints.username],
                        validator: (value) =>
                            Validators.required(value, 'username or email'),
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _password,
                        obscureText: _obscure,
                        textInputAction: TextInputAction.done,
                        autofillHints: const [AutofillHints.password],
                        onFieldSubmitted: (_) => _submit(),
                        decoration: InputDecoration(
                          labelText: 'Password',
                          suffixIcon: IconButton(
                            tooltip: _obscure
                                ? 'Show password'
                                : 'Hide password',
                            icon: Icon(
                              _obscure
                                  ? Icons.visibility_outlined
                                  : Icons.visibility_off_outlined,
                            ),
                            onPressed: () =>
                                setState(() => _obscure = !_obscure),
                          ),
                        ),
                        validator: (value) =>
                            Validators.required(value, 'password'),
                      ),
                      const SizedBox(height: 24),
                      FilledButton(
                        onPressed: _busy ? null : _submit,
                        child: _busy
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Text('Sign in'),
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Forgot your password or assigned to the wrong society? Contact your District Centre.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: AppColors.muted, fontSize: 13),
                      ),
                      const SizedBox(height: 24),
                      NoticeBanner(
                        icon: Icons.info_outline,
                        title: 'Demonstration sign-in',
                        message:
                            'This build uses a fictional account. Production authentication will '
                            'be connected securely through Amazon Cognito.',
                        action: Align(
                          alignment: Alignment.centerLeft,
                          child: TextButton(
                            onPressed: _useDemoAccount,
                            style: TextButton.styleFrom(
                              padding: EdgeInsets.zero,
                            ),
                            child: const Text('Use demo account'),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
