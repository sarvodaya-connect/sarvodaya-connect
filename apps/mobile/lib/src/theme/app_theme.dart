import 'package:flutter/material.dart';

import '../motion/app_motion.dart';

/// Prototype V5 palette, shared with the dashboard (`globals.css`).
class AppColors {
  const AppColors._();

  static const forest = Color(0xFF1F3C2A);
  static const pine = Color(0xFF24573B);
  static const leaf = Color(0xFF26744B);
  static const action = Color(0xFF2F6B45);
  static const actionPressed = Color(0xFF24573B);
  static const mint = Color(0xFFE3EEE2);
  static const mintSoft = Color(0xFFF4F8F3);
  static const background = Color(0xFFF3F4EE);
  static const surface = Colors.white;
  static const line = Color(0xFFDFE5DC);
  static const headerLine = Color(0xFFE3E7E0);
  static const ink = Color(0xFF1C2A21);
  static const inkSoft = Color(0xFF3E4B43);
  static const inkBody = Color(0xFF4F5D54);
  static const muted = Color(0xFF5B675F);
  static const danger = Color(0xFFB3322B);
  static const dangerSoft = Color(0xFFFBE4E1);
  static const warning = Color(0xFF7A5A00);
  static const warningSoft = Color(0xFFFFF4D6);
  // Catalogue "Changed in v2" annotation.
  static const orangeChanged = Color(0xFFD96A2C);
  static const orangeChangedSoft = Color(0xFFFDECE0);
  // V5 M01 splash.
  static const splash = Color(0xFFE8551F);
  // "AI" in the SarvoAI name.
  static const orangeAi = Color(0xFFF0A040);

  /// Selected bottom-bar pill and the empty/success state circle.
  static const navIndicator = Color(0xFFDBE8DB);
  static const navIdle = Color(0xFF4F5D54);

  /// No-access state circle and skeleton rows.
  static const stateGrey = Color(0xFFECEEE9);

  // V5 access banners: background, border, text.
  static const bannerEditBg = Color(0xFFE3F0E3);
  static const bannerEditLine = Color(0xFFBCD8BE);
  static const bannerEditText = Color(0xFF1F5C38);
  static const bannerViewBg = Color(0xFFECEEE9);
  static const bannerViewLine = Color(0xFFD6DDD4);
  static const bannerViewText = Color(0xFF3E4B43);
  static const bannerTemporaryBg = Color(0xFFE6EEF8);
  static const bannerTemporaryLine = Color(0xFFC3D5EA);
  static const bannerTemporaryText = Color(0xFF24476B);
  static const bannerIncidentBg = Color(0xFFFBE9E7);
  static const bannerIncidentLine = Color(0xFFEFC2BD);
  static const bannerIncidentText = Color(0xFF8A241D);
}

class AppTheme {
  const AppTheme._();

  /// Flutter uses the theme's chip label style instead of its own default, not
  /// merged with it, so this style must carry a colour or labels have none.
  static final WidgetStateColor chipLabelColor = WidgetStateColor.resolveWith(
    (states) => switch ((
      states.contains(WidgetState.disabled),
      states.contains(WidgetState.selected),
    )) {
      // A selected chip keeps its dark fill when disabled.
      (true, true) => AppColors.bannerViewLine,
      (true, false) => AppColors.muted,
      (false, true) => Colors.white,
      (false, false) => AppColors.ink,
    },
  );

  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(
      seedColor: AppColors.leaf,
      primary: AppColors.action,
      onPrimary: Colors.white,
      surface: AppColors.surface,
      error: AppColors.danger,
    );
    final base = ThemeData(useMaterial3: true, colorScheme: scheme);
    final text = base.textTheme.apply(
      bodyColor: AppColors.ink,
      displayColor: AppColors.ink,
    );
    final inputBorder = OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: const BorderSide(color: AppColors.line),
    );

    return base.copyWith(
      scaffoldBackgroundColor: AppColors.background,
      pageTransitionsTheme: PageTransitionsTheme(
        builders: {
          for (final entry in base.pageTransitionsTheme.builders.entries)
            entry.key: AccessiblePageTransitions(entry.value),
        },
      ),
      textTheme: text.copyWith(
        headlineSmall: text.headlineSmall?.copyWith(
          fontWeight: FontWeight.w700,
          letterSpacing: -0.3,
        ),
        titleLarge: text.titleLarge?.copyWith(fontWeight: FontWeight.w700),
        titleMedium: text.titleMedium?.copyWith(fontWeight: FontWeight.w600),
        bodySmall: text.bodySmall?.copyWith(color: AppColors.muted),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.ink,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: AppColors.ink,
          fontSize: 18,
          fontWeight: FontWeight.w700,
        ),
      ),
      cardTheme: CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: AppColors.line),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.line,
        space: 1,
        thickness: 1,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.action,
          foregroundColor: Colors.white,
          minimumSize: const Size(48, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.ink,
          minimumSize: const Size(48, 48),
          side: const BorderSide(color: AppColors.line),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.leaf,
          minimumSize: const Size(48, 44),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        border: inputBorder,
        enabledBorder: inputBorder,
        focusedBorder: inputBorder.copyWith(
          borderSide: const BorderSide(color: AppColors.leaf, width: 2),
        ),
        errorBorder: inputBorder.copyWith(
          borderSide: const BorderSide(color: AppColors.danger),
        ),
        focusedErrorBorder: inputBorder.copyWith(
          borderSide: const BorderSide(color: AppColors.danger, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 14,
        ),
        errorMaxLines: 3,
      ),
      // V5 bottom bar: white, icons only, a soft green pill on the current tab.
      // Labels stay as tooltips and screen-reader names.
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.surface,
        indicatorColor: AppColors.navIndicator,
        indicatorShape: const StadiumBorder(),
        surfaceTintColor: Colors.transparent,
        height: 64,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysHide,
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            size: 20,
            color: states.contains(WidgetState.selected)
                ? AppColors.forest
                : AppColors.navIdle,
          ),
        ),
      ),
      chipTheme: base.chipTheme.copyWith(
        side: const BorderSide(color: AppColors.line),
        selectedColor: AppColors.forest,
        backgroundColor: AppColors.surface,
        disabledColor: AppColors.stateGrey,
        checkmarkColor: Colors.white,
        labelStyle: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w500,
          color: chipLabelColor,
        ),
      ),
      snackBarTheme: const SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}
