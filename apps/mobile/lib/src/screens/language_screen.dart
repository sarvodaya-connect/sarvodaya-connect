import 'package:flutter/material.dart';

import '../motion/app_motion.dart';

import '../l10n/l10n.dart';
import '../models/app_language.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';

/// M02 - first-run language selection.
class LanguageScreen extends StatefulWidget {
  const LanguageScreen({super.key});

  @override
  State<LanguageScreen> createState() => _LanguageScreenState();
}

class _LanguageScreenState extends State<LanguageScreen> {
  late AppLanguage _selection = DemoScope.read(context).selectedLanguage;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 28, 20, 24),
          children: motionBlocks('language', [
            Text(
              context.l10n.languageChooseTitle,
              style: Theme.of(context).textTheme.headlineSmall
                  ?.copyWith(fontSize: 22),
            ),
            const SizedBox(height: 4),
            const Text(
              'ඔබේ භාෂාව තෝරන්න',
              style: TextStyle(color: AppColors.inkSoft, fontSize: 13),
            ),
            const Text(
              'உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்',
              style: TextStyle(color: AppColors.inkSoft, fontSize: 13),
            ),
            const SizedBox(height: 20),
            ...DemoScope.of(context).languages.map(
              (language) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _LanguageOption(
                  language: language,
                  selected: language == _selection,
                  onTap: () => setState(() => _selection = language),
                ),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              context.l10n.languageChangeLater,
              style: const TextStyle(color: AppColors.muted, fontSize: 12),
            ),
          ]),
        ),
      ),
      bottomNavigationBar: Material(
        color: AppColors.surface,
        child: SafeArea(
          top: false,
          child: Container(
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: AppColors.line)),
            ),
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: MotionPress(
              child: FilledButton(
                onPressed: () =>
                    DemoScope.read(context).chooseLanguage(_selection),
                child: Text(context.l10n.languageContinue),
              ),
            ),
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

  static String _glyph(AppLanguage language) => switch (language) {
    AppLanguage.sinhala => 'සි',
    AppLanguage.tamil => 'த',
    AppLanguage.english => 'En',
  };

  @override
  Widget build(BuildContext context) {
    return Semantics(
      selected: selected,
      button: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: AnimatedContainer(
          duration: AppMotion.duration(context, AppMotion.state),
          curve: AppMotion.curve,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: selected ? AppColors.mintSoft : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected ? AppColors.action : AppColors.line,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Row(
            children: [
              ExcludeSemantics(
                child: CircleAvatar(
                  radius: 18,
                  backgroundColor: AppColors.mint,
                  child: Text(
                    _glyph(language),
                    style: const TextStyle(
                      color: AppColors.ink,
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      language.nativeLabel,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      language.englishLabel,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                selected
                    ? Icons.radio_button_checked
                    : Icons.radio_button_unchecked,
                color: selected ? AppColors.action : AppColors.muted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
