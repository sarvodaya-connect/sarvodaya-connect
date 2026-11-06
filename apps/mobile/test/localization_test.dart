import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/app.dart';
import 'package:sarvodaya_connect_mobile/src/l10n/l10n.dart';
import 'package:sarvodaya_connect_mobile/src/l10n/language_preference.dart';
import 'package:sarvodaya_connect_mobile/src/models/app_language.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/screens/more_screen.dart';
import 'package:sarvodaya_connect_mobile/src/screens/sign_in_screen.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Issue #108: the foundation. Everyone here is fictional.
Map<String, dynamic> _arb(String code) =>
    jsonDecode(File('lib/l10n/app_$code.arb').readAsStringSync())
        as Map<String, dynamic>;

Set<String> _keys(Map<String, dynamic> arb) =>
    arb.keys.where((key) => !key.startsWith('@')).toSet();

List<String> _placeholders(String text) =>
    {for (final m in RegExp(r'\{(\w+)[,}]').allMatches(text)) m.group(1)!}
        .toList()
      ..sort();

DemoStore _store({
  LanguagePreference? preference,
  List<AppLanguage>? languages,
  bool languageChosen = false,
}) => DemoStore(
  demo: true,
  loadDelay: Duration.zero,
  showSplash: false,
  languageChosen: languageChosen,
  languagePreference: preference,
  languages: languages,
);

Future<void> _pump(WidgetTester tester, DemoStore store) async {
  tester.view.physicalSize = const Size(390, 844) * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(SarvodayaConnectApp(store: store));
  await tester.pumpAndSettle();
}

void main() {
  final english = _arb('en');

  for (final code in ['si', 'ta']) {
    group('the $code catalog', () {
      final arb = _arb(code);

      test('has every English key and no others', () {
        expect(_keys(arb), _keys(english));
      });

      test('keeps each message\'s placeholders', () {
        for (final key in _keys(english)) {
          expect(
            _placeholders(arb[key] as String),
            _placeholders(english[key] as String),
            reason: key,
          );
        }
      });

      test('does not leave a message in English', () {
        final same = _keys(english)
            .where((key) => arb[key] == english[key] && key != 'navExco');
        expect(same, isEmpty);
      });
    });
  }

  group('which languages the app offers', () {
    test('store builds offer only reviewed languages', () {
      expect(availableLanguages(showDrafts: false), [AppLanguage.english]);
      expect(reviewedLanguages, {AppLanguage.english});
    });

    test('review builds also offer the drafts', () {
      expect(availableLanguages(showDrafts: true), AppLanguage.values);
    });

    test('with one language, first run does not ask', () {
      final store = _store(languages: const [AppLanguage.english]);
      expect(store.languageChosen, isTrue);
      expect(store.selectedLanguage, AppLanguage.english);
    });

    test('an unreviewed language cannot be chosen in a store build', () {
      final store = _store(languages: const [AppLanguage.english]);
      store.chooseLanguage(AppLanguage.tamil);
      expect(store.selectedLanguage, AppLanguage.english);
    });

    test('a saved draft falls back to English in a store build', () {
      final store = _store(
        preference: MemoryLanguagePreference(AppLanguage.sinhala),
        languages: const [AppLanguage.english],
      );
      expect(store.selectedLanguage, AppLanguage.english);
    });
  });

  group('the saved choice', () {
    test('comes back after a restart, and sign-out keeps it', () async {
      SharedPreferences.setMockInitialValues({});
      final first = _store(preference: await DeviceLanguagePreference.open());
      expect(first.languageChosen, isFalse);
      first.chooseLanguage(AppLanguage.tamil);
      first.signOut();
      expect(first.selectedLanguage, AppLanguage.tamil);

      final restarted = _store(
        preference: await DeviceLanguagePreference.open(),
      );
      expect(restarted.selectedLanguage, AppLanguage.tamil);
      expect(restarted.languageChosen, isTrue);
    });

    test('ignores an unknown saved value', () async {
      SharedPreferences.setMockInitialValues({'language': 'fr'});
      final store = _store(preference: await DeviceLanguagePreference.open());
      expect(store.selectedLanguage, AppLanguage.english);
      expect(store.languageChosen, isFalse);
    });
  });

  for (final (language, code, signIn, more, alerts) in [
    (AppLanguage.sinhala, 'si', 'පිවිසෙන්න', 'තවත්', 'ඇඟවීම්'),
    (AppLanguage.tamil, 'ta', 'உள்நுழைக', 'மேலும்', 'எச்சரிக்கைகள்'),
  ]) {
    group('in ${language.name}', () {
      testWidgets('sign-in, its validation and the locale follow', (
        tester,
      ) async {
        final store = _store(languageChosen: true)..chooseLanguage(language);
        await _pump(tester, store);
        expect(find.byType(SignInScreen), findsOneWidget);
        expect(
          Localizations.localeOf(tester.element(find.byType(SignInScreen))),
          Locale(code),
        );
        expect(find.text(signIn), findsWidgets);
        expect(find.text('Sign In'), findsNothing);
        await tester.tap(find.byType(FilledButton).first);
        await tester.pumpAndSettle();
        expect(find.text('Enter the username.'), findsNothing);
      });

      for (final role in UserRole.values) {
        testWidgets('the navigation for ${role.name} follows', (tester) async {
          final store = _store(languageChosen: true)
            ..chooseLanguage(language)
            ..switchDemoRole(role);
          await _pump(tester, store);
          final labels = tester
              .widgetList<NavigationDestination>(
                find.byType(NavigationDestination),
              )
              .map((destination) => destination.label);
          expect(labels, contains(more));
          for (final english in [
            'Home',
            'Society',
            'Incident',
            'Work Plan',
            'More',
            'Overview',
            'Districts',
            'Societies',
            'Alerts',
            'Access',
          ]) {
            expect(labels, isNot(contains(english)));
          }
          if (role == UserRole.hqAdmin) expect(labels, contains(alerts));
        });
      }

      testWidgets('More follows and shows the choice in its own script', (
        tester,
      ) async {
        final store = _store(languageChosen: true)
          ..chooseLanguage(language)
          ..switchDemoRole(UserRole.hqAdmin);
        await _pump(tester, store);
        store.selectTab(4);
        await tester.pumpAndSettle();
        expect(find.byType(MoreScreen), findsOneWidget);
        expect(find.text(language.nativeLabel), findsOneWidget);
        expect(find.text('Help and HQ Contact'), findsNothing);
      });
    });
  }

  for (final (language, text) in [
    (AppLanguage.english, 'Ask SarvoAI'),
    (AppLanguage.sinhala, 'SarvoAI අසන්න'),
    (AppLanguage.tamil, 'SarvoAI-யிடம் கேளுங்கள்'),
  ]) {
    testWidgets('SarvoAI stays whole in ${language.name}', (tester) async {
      final store = _store(languageChosen: true)
        ..chooseLanguage(language)
        ..switchDemoRole(UserRole.hqAdmin);
      await _pump(tester, store);
      store.selectTab(4);
      await tester.pumpAndSettle();
      expect(find.text(text, findRichText: true), findsOneWidget);
    });
  }

  testWidgets('switching back gives English, in the same session', (
    tester,
  ) async {
    final store = _store(languageChosen: true)
      ..chooseLanguage(AppLanguage.tamil);
    await _pump(tester, store);
    expect(find.text('உள்நுழைக'), findsWidgets);
    store.chooseLanguage(AppLanguage.english);
    await tester.pumpAndSettle();
    expect(find.text('Sign In'), findsOneWidget);
    expect(find.text('உள்நுழைக'), findsNothing);
  });

  testWidgets('first run offers what the build allows, and continues', (
    tester,
  ) async {
    final store = _store();
    await _pump(tester, store);
    for (final language in AppLanguage.values) {
      expect(find.text(language.nativeLabel), findsWidgets);
    }
    await tester.tap(find.text('தமிழ்'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(store.selectedLanguage, AppLanguage.tamil);
    expect(find.text('உள்நுழைக'), findsWidgets);
  });

  for (final language in [AppLanguage.sinhala, AppLanguage.tamil]) {
    testWidgets('${language.name} lays out on a small phone with large text', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(320, 568) * 3;
      tester.view.devicePixelRatio = 3;
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.view.reset);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      final store = _store(languageChosen: true)
        ..chooseLanguage(language)
        ..switchDemoRole(UserRole.hqAdmin);
      await tester.pumpWidget(SarvodayaConnectApp(store: store));
      await tester.pumpAndSettle();
      store.selectTab(4);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  }

  test('English is available for screens pumped without the delegates', () {
    expect(lookupAppLocalizations(const Locale('en')).navHome, 'Home');
  });
}
