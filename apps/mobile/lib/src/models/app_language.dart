enum AppLanguage { sinhala, tamil, english }

extension AppLanguageLabels on AppLanguage {
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
