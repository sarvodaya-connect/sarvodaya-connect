import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/app.dart';
import 'package:sarvodaya_connect_mobile/src/l10n/generated/app_localizations.dart';
import 'package:sarvodaya_connect_mobile/src/motion/app_motion.dart';
import 'package:sarvodaya_connect_mobile/src/release/release_notes.dart';
import 'package:sarvodaya_connect_mobile/src/release/whats_new_screen.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';

import 'test_helpers.dart';

/// Issue #161: What's new after an app update. Everything here is fictional.

/// The same text and base64 as `scripts/test_release_metadata.py`, so both
/// sides of the build agree on every byte.
const trickyNotes =
    'First line with "quotes", \'apostrophes\', \$HOME and `ticks` \\ done\n'
    '- සිංහල · தமிழ் · 🚀\n'
    '<b>not html</b> & <script>x</script>';
const trickyBase64 =
    'Rmlyc3QgbGluZSB3aXRoICJxdW90ZXMiLCAnYXBvc3Ryb3BoZXMnLCAkSE9NRSBhbmQgYHRpY2tzYCBcIGRvbmUKLSDgt4Pgt5LgtoLgt4Tgtr0gwrcg4K6k4K6u4K6/4K604K+NIMK3IPCfmoAKPGI+bm90IGh0bWw8L2I+ICYgPHNjcmlwdD54PC9zY3JpcHQ+';

const release = ReleaseInfo(
  version: '0.2.0',
  build: 7,
  notes:
      'Assessments are saved on the phone when there is no signal.\n'
      'The SPC can choose Development Goals when approving.',
);

DemoStore _store({
  ReleaseInfo? installed = release,
  WhatsNewPreference? preference,
  bool usedBefore = true,
}) => DemoStore(
  loadDelay: Duration.zero,
  clock: () => demoNow,
  showSplash: false,
  languageChosen: true,
  release: installed,
  whatsNewPreference: preference,
  usedBefore: usedBefore,
);

Future<void> _settle(WidgetTester tester) async {
  await tester.pump();
  await tester.pumpAndSettle();
}

void main() {
  group('release metadata from the build', () {
    test('decodes the workflow notes exactly, as plain text', () {
      final parsed = ReleaseInfo.parse(
        version: '0.2.0',
        build: '7',
        notesBase64: trickyBase64,
      );
      expect(parsed?.notes, trickyNotes);
      expect(parsed?.id, '0.2.0+7');
    });

    test('missing or invalid metadata means no release, never an error', () {
      ReleaseInfo? parse(String version, String build, String notes) =>
          ReleaseInfo.parse(version: version, build: build, notesBase64: notes);
      expect(parse('', '', ''), isNull);
      expect(parse('0.2', '7', trickyBase64), isNull);
      expect(parse('0.2.0', '0', trickyBase64), isNull);
      expect(parse('0.2.0', '7x', trickyBase64), isNull);
      expect(parse('0.2.0', '7', 'not base64 !!'), isNull);
      expect(parse('0.2.0', '7', '/w=='), isNull); // not UTF-8
      expect(parse('0.2.0', '7', 'AA=='), isNull); // a control character
      // C1 control characters (U+0080, U+0085, U+009B).
      for (final c1 in ['\u0080', 'a\u0085b', 'a\u009Bb']) {
        expect(parse('0.2.0', '7', base64.encode(utf8.encode(c1))), isNull);
      }
      expect(parse('0.2.0', '7', 'ICAg'), isNull); // only spaces
      final tooLong = 'a' * 501;
      expect(parse('0.2.0', '7', base64Of(tooLong)), isNull);
      expect(ReleaseInfo.fromEnvironment(), isNull);
    });
  });

  group('when to show it', () {
    test(
      'an update shows the installed release once; skipped versions too',
      () {
        expect(
          shouldShowWhatsNew(
            release: release,
            acknowledged: '0.1.0+3',
            usedBefore: true,
          ),
          isTrue,
        );
        // From a build before this feature: nothing acknowledged, used before.
        expect(
          shouldShowWhatsNew(
            release: release,
            acknowledged: null,
            usedBefore: true,
          ),
          isTrue,
        );
        expect(
          shouldShowWhatsNew(
            release: release,
            acknowledged: release.id,
            usedBefore: true,
          ),
          isFalse,
        );
      },
    );

    test('a fresh installation is not an update, and is recorded as seen', () {
      final preference = MemoryWhatsNewPreference();
      final store = _store(preference: preference, usedBefore: false);
      expect(store.whatsNewPending, isFalse);
      expect(preference.acknowledged(), release.id);
    });

    test('a failed save is retried without re-showing the notes', () async {
      final preference = _FlakyWhatsNewPreference(
        failures: 2,
        previous: '0.1.0+3',
      );
      final store = _store(preference: preference);
      expect(store.whatsNewPending, isTrue);
      expect(await store.acknowledgeWhatsNew(), isTrue);
      expect(store.whatsNewPending, isFalse);
      expect(preference.attempts, 3);
      expect(preference.acknowledged(), release.id);
    });

    test(
      'a save that keeps failing never throws or re-shows the notes',
      () async {
        final preference = _FlakyWhatsNewPreference(
          failures: 99,
          previous: '0.1.0+3',
        );
        final store = _store(preference: preference);
        expect(await store.acknowledgeWhatsNew(), isFalse);
        expect(store.whatsNewPending, isFalse);
        expect(preference.attempts, DemoStore.whatsNewSaveAttempts);
        // Not saved, so the next launch shows the notes once more.
        expect(_store(preference: preference).whatsNewPending, isTrue);
      },
    );

    test('a build without notes never asks', () {
      final store = _store(installed: null);
      expect(store.whatsNewPending, isFalse);
    });

    test('Continue is remembered across restarts and sign-outs', () {
      final preference = MemoryWhatsNewPreference('0.1.0+3');
      final first = _store(preference: preference);
      expect(first.whatsNewPending, isTrue);
      first.acknowledgeWhatsNew();
      expect(preference.acknowledged(), release.id);
      // The app opened again, same build.
      expect(_store(preference: preference).whatsNewPending, isFalse);
      // The next update asks again, once.
      const next = ReleaseInfo(version: '0.3.0', build: 9, notes: 'More.');
      expect(
        _store(preference: preference, installed: next).whatsNewPending,
        isTrue,
      );
    });
  });

  group('the screen', () {
    testWidgets(
      'after sign-in it shows once over home; Continue returns there',
      (tester) async {
        final preference = MemoryWhatsNewPreference('0.1.0+3');
        final store = _store(preference: preference);
        await pumpApp(tester, store: store);
        // Sign-in is never interrupted.
        expect(find.byType(WhatsNewScreen), findsNothing);
        await signInWithDemoAccount(tester);
        await _settle(tester);
        expect(find.byType(WhatsNewScreen), findsOneWidget);
        expect(find.text('Sarvodaya Connect was updated.'), findsOneWidget);
        expect(find.text('Version 0.2.0 · build 7'), findsOneWidget);
        expect(find.textContaining('saved on the phone'), findsOneWidget);
        // Only Continue: no back arrow on the update screen.
        expect(find.byType(BackButton), findsNothing);

        await tester.tap(find.widgetWithText(FilledButton, 'Continue'));
        await _settle(tester);
        expect(find.byType(WhatsNewScreen), findsNothing);
        expect(find.byType(HomeShell), findsOneWidget);
        expect(preference.acknowledged(), release.id);

        // Signing out and in again does not ask again.
        store.signOut();
        await _settle(tester);
        await signInWithDemoAccount(tester);
        await _settle(tester);
        expect(find.byType(WhatsNewScreen), findsNothing);
      },
    );

    testWidgets('More → What\'s new reopens the notes without asking again', (
      tester,
    ) async {
      final preference = MemoryWhatsNewPreference(release.id);
      await tester.pumpWidget(
        _app(_store(preference: preference), WhatsNewScreen(release: release)),
      );
      await _settle(tester);
      expect(find.textContaining('Development Goals'), findsOneWidget);
      expect(find.text('Sarvodaya Connect was updated.'), findsNothing);
      expect(preference.acknowledged(), release.id);
    });

    testWidgets('a build without notes says so instead', (tester) async {
      await tester.pumpWidget(
        _app(_store(installed: null), const WhatsNewScreen(release: null)),
      );
      await _settle(tester);
      expect(find.text('No Release Notes in This Build'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Continue'), findsOneWidget);
    });

    testWidgets('notes are shown as plain text, exactly as written', (
      tester,
    ) async {
      await tester.pumpWidget(
        _app(
          _store(),
          WhatsNewScreen(
            release: ReleaseInfo.parse(
              version: '0.2.0',
              build: '7',
              notesBase64: trickyBase64,
            ),
          ),
        ),
      );
      await _settle(tester);
      expect(find.text(trickyNotes), findsOneWidget);
    });

    testWidgets(
      'in Sinhala the labels are translated and the notes are marked English',
      (tester) async {
        await tester.pumpWidget(
          _app(
            _store(),
            const WhatsNewScreen(release: release, afterUpdate: true),
            locale: const Locale('si'),
          ),
        );
        await _settle(tester);
        final si = lookupAppLocalizations(const Locale('si'));
        expect(find.text(si.whatsNewTitle), findsOneWidget);
        expect(find.text(si.whatsNewEnglishOnly), findsOneWidget);
        final notes = tester.widget<Text>(find.text(release.notes));
        expect(notes.locale, const Locale('en'));
      },
    );

    for (final (label, size, scale) in [
      ('a small phone', const Size(320, 568), 1.0),
      ('large text', const Size(360, 640), 2.0),
    ]) {
      testWidgets('long notes scroll and Continue stays reachable on $label', (
        tester,
      ) async {
        tester.view.physicalSize = size * 3;
        tester.view.devicePixelRatio = 3;
        addTearDown(tester.view.reset);
        final long = ReleaseInfo(
          version: '0.2.0',
          build: 7,
          notes: List.generate(25, (i) => '- Change number $i').join('\n'),
        );
        await tester.pumpWidget(
          _app(
            _store(installed: long),
            WhatsNewScreen(release: long, afterUpdate: true),
            textScale: scale,
          ),
        );
        await _settle(tester);
        expect(tester.takeException(), isNull);
        expect(
          find.widgetWithText(FilledButton, 'Continue').hitTestable(),
          findsOneWidget,
        );
        await tester.drag(find.byType(ListView), const Offset(0, -2000));
        await _settle(tester);
        expect(find.textContaining('Change number 24'), findsOneWidget);
        expect(tester.takeException(), isNull);
      });
    }

    testWidgets('with reduced motion the notes are fully shown at once', (
      tester,
    ) async {
      await tester.pumpWidget(
        _app(
          _store(),
          const WhatsNewScreen(release: release, afterUpdate: true),
          reduceMotion: true,
        ),
      );
      await tester.pump();
      final opacity = tester.widget<Opacity>(
        find
            .descendant(
              of: find.byType(MotionEntrance),
              matching: find.byType(Opacity),
            )
            .first,
      );
      expect(opacity.opacity, 1);
    });
  });
}

String base64Of(String text) => base64Encode(utf8.encode(text));

Widget _app(
  DemoStore store,
  Widget home, {
  Locale locale = const Locale('en'),
  double textScale = 1,
  bool reduceMotion = false,
}) => DemoScope(
  store: store,
  child: MaterialApp(
    theme: AppTheme.light(),
    locale: locale,
    supportedLocales: AppLocalizations.supportedLocales,
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(context).copyWith(
        textScaler: TextScaler.linear(textScale),
        disableAnimations: reduceMotion,
      ),
      child: child!,
    ),
    home: home,
  ),
);

/// Fails the first [failures] saves, as a full disk would.
class _FlakyWhatsNewPreference implements WhatsNewPreference {
  _FlakyWhatsNewPreference({required this.failures, String? previous})
    : _saved = previous;

  final int failures;
  int attempts = 0;
  String? _saved;

  @override
  String? acknowledged() => _saved;

  @override
  Future<bool> acknowledge(String releaseId) async {
    attempts++;
    if (attempts <= failures) return false;
    _saved = releaseId;
    return true;
  }
}
