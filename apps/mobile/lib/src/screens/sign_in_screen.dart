import 'package:flutter/material.dart';

import '../motion/app_motion.dart';

import '../auth/auth_service.dart';
import '../data/demo_data.dart';
import '../l10n/l10n.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/state_views.dart';

/// V5 M03 / M03e - sign-in with the username and password HQ created, through
/// an injected authentication service.
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
    if (_busy) return;
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
        setState(() => _error = context.l10n.signInErrorIncorrect);
      }
    } on AuthLockedException {
      if (!mounted) return;
      _password.clear();
      setState(() => _error = context.l10n.signInErrorLocked);
    } on AuthAccountNotReadyException {
      if (!mounted) return;
      _password.clear();
      setState(() => _error = context.l10n.signInErrorNotReady);
    } on OfflineException {
      if (!mounted) return;
      setState(() => _error = context.l10n.signInErrorOffline);
    } on AuthServiceException {
      if (!mounted) return;
      setState(() => _error = context.l10n.signInErrorUnavailable);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _useDemoAccount() {
    _username.text = DemoAccount.username;
    _password.text = DemoAccount.password;
    setState(() => _error = null);
  }

  InputDecoration _field({required String hint, Widget? suffix}) =>
      InputDecoration(
        hintText: hint,
        suffixIcon: suffix,
        errorBorder: _error == null ? null : _errorBorder,
        enabledBorder: _error == null ? null : _errorBorder,
      );

  static final _errorBorder = OutlineInputBorder(
    borderRadius: BorderRadius.circular(10),
    borderSide: const BorderSide(color: AppColors.forest, width: 1.5),
  );

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
          child: AutofillGroup(
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: motionBlocks('signIn', [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Semantics(
                      label: 'Sarvodaya Connect',
                      image: true,
                      child: Image.asset(
                        'assets/branding/sarvodaya_connect_wordmark.png',
                        height: 52,
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  Text(
                    l10n.signInTitle,
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    l10n.signInSubtitle,
                    style: const TextStyle(
                      color: AppColors.inkSoft,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _FieldLabel(l10n.signInUsername),
                      TextFormField(
                        controller: _username,
                        decoration: _field(
                          hint: l10n.signInUsername,
                          suffix: const Icon(Icons.person_outline, size: 20),
                        ),
                        autocorrect: false,
                        enableSuggestions: false,
                        textInputAction: TextInputAction.next,
                        autofillHints: const [AutofillHints.username],
                        validator: (value) =>
                            value == null || value.trim().isEmpty
                            ? l10n.signInEnterUsername
                            : null,
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _FieldLabel(l10n.signInPassword),
                      TextFormField(
                        controller: _password,
                        obscureText: _obscure,
                        textInputAction: TextInputAction.done,
                        autofillHints: const [AutofillHints.password],
                        onFieldSubmitted: (_) => _submit(),
                        decoration: _field(
                          hint: l10n.signInPassword,
                          suffix: IconButton(
                            tooltip: _obscure
                                ? l10n.signInShowPassword
                                : l10n.signInHidePassword,
                            icon: Icon(
                              _obscure
                                  ? Icons.visibility_outlined
                                  : Icons.visibility_off_outlined,
                              size: 20,
                            ),
                            onPressed: () =>
                                setState(() => _obscure = !_obscure),
                          ),
                        ),
                        validator: (value) =>
                            value == null || value.trim().isEmpty
                            ? l10n.signInEnterPassword
                            : null,
                      ),
                    ],
                  ),
                  MotionSize(
                    child: _error == null
                        ? const SizedBox.shrink()
                        : Padding(
                            padding: const EdgeInsets.only(top: 12),
                            child: _SignInError(_error!),
                          ),
                  ),
                  const SizedBox(height: 14),
                  MotionPress(
                    enabled: !_busy,
                    child: FilledButton(
                      onPressed: _busy ? null : _submit,
                      child: _busy
                          ? SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                                semanticsLabel: l10n.signInSigningIn,
                              ),
                            )
                          : Text(l10n.signInButton),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    l10n.signInForgot,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: AppColors.inkSoft,
                      fontSize: 12,
                    ),
                  ),
                  if (DemoStore.demoMode) ...[
                    const SizedBox(height: 24),
                    NoticeBanner(
                      icon: Icons.info_outline,
                      title: 'Demonstration Sign-In',
                      message:
                          'This build uses a fictional account. Production authentication will '
                          'be connected securely through Amazon Cognito.',
                      action: Align(
                        alignment: Alignment.centerLeft,
                        child: TextButton(
                          onPressed: _useDemoAccount,
                          style: TextButton.styleFrom(padding: EdgeInsets.zero),
                          child: const Text('Use demo account'),
                        ),
                      ),
                    ),
                  ],
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Text.rich(
      TextSpan(
        text: label,
        children: const [
          TextSpan(
            text: ' *',
            style: TextStyle(color: AppColors.danger),
          ),
        ],
      ),
      style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600),
    ),
  );
}

/// V5 M03e: the error sits under the password, in red, and is announced.
class _SignInError extends StatelessWidget {
  const _SignInError(this.message);

  final String message;

  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    container: true,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.bannerIncidentBg,
        border: Border.all(color: AppColors.bannerIncidentLine),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.error_outline,
            size: 16,
            color: AppColors.bannerIncidentText,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                color: AppColors.bannerIncidentText,
                fontSize: 12.5,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    ),
  );
}
