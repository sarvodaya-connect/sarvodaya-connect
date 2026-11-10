import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

enum AppLanguage { sinhala, tamil, english }

/// Languages a native speaker has approved. Add one only after that review
/// (docs/localization.md): this is what lets it reach store builds.
const reviewedLanguages = <AppLanguage>{AppLanguage.english};

/// Debug builds, and builds made for translation review, also show drafts.
const showUnreviewedLanguages = bool.fromEnvironment(
  'SC_SHOW_UNREVIEWED_TRANSLATIONS',
  defaultValue: !kReleaseMode,
);

List<AppLanguage> availableLanguages({
  bool showDrafts = showUnreviewedLanguages,
}) => [
  for (final language in AppLanguage.values)
    if (showDrafts || reviewedLanguages.contains(language)) language,
];

extension AppLanguageLabels on AppLanguage {
  String get code => switch (this) {
    AppLanguage.sinhala => 'si',
    AppLanguage.tamil => 'ta',
    AppLanguage.english => 'en',
  };

  Locale get locale => Locale(code);

  String get nativeLabel => switch (this) {
    AppLanguage.sinhala => 'සිංහල',
    AppLanguage.tamil => 'தமிழ்',
    AppLanguage.english => 'English',
  };

  String get englishLabel => switch (this) {
    AppLanguage.sinhala => 'Sinhala',
    AppLanguage.tamil => 'Tamil',
    AppLanguage.english => 'English',
  };
}
