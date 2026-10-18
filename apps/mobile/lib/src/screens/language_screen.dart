import 'package:flutter/material.dart';

import '../models/app_language.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/brand.dart';

/// M02 - first-run language selection.
class LanguageScreen extends StatefulWidget {
  const LanguageScreen({super.key});

  @override
  State<LanguageScreen> createState() => _LanguageScreenState();
}

class _LanguageScreenState extends State<LanguageScreen> {
  AppLanguage? _selection;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Align(
                alignment: Alignment.centerLeft,
                child: BrandMark(compact: true),
              ),
              const Spacer(),
              Text(
                'Choose your language',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 8),
              const Text(
                'You can change this later from More.',
                style: TextStyle(color: AppColors.muted),
              ),
              const SizedBox(height: 24),
              ...AppLanguage.values.map(
                (language) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _LanguageOption(
                    language: language,
                    selected: language == _selection,
                    onTap: () => setState(() => _selection = language),
                  ),
                ),
              ),
              const Spacer(),
              FilledButton(
                onPressed: _selection == null
                    ? null
                    : () => DemoScope.read(context).chooseLanguage(_selection!),
                child: const Text('Continue'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LanguageOption extends StatelessWidget {
  const _LanguageOption({
    required this.language,
    required this.selected,
    required this.onTap,
  });

  final AppLanguage language;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      selected: selected,
      button: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: selected ? AppColors.mint : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected ? AppColors.action : AppColors.line,
              width: selected ? 2 : 1,
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      language.nativeLabel,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if (language.nativeLabel != language.englishLabel)
                      Text(
                        language.englishLabel,
                        style: const TextStyle(color: AppColors.muted),
                      ),
                  ],
                ),
              ),
              Icon(
                selected ? Icons.check_circle : Icons.circle_outlined,
                color: selected ? AppColors.action : AppColors.muted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
