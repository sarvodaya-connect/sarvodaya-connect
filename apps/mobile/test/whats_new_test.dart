import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/app.dart';
import 'package:sarvodaya_connect_mobile/src/l10n/generated/app_localizations.dart';
import 'package:sarvodaya_connect_mobile/src/motion/app_motion.dart';
import 'package:sarvodaya_connect_mobile/src/release/release_info.dart';
import 'package:sarvodaya_connect_mobile/src/release/whats_new.dart';
import 'package:sarvodaya_connect_mobile/src/release/whats_new_screen.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'test_helpers.dart';

/// Issue #161: What's New once after an update, from the notes the Android
/// release workflow embeds. Versions and notes are fictional.

const _notes =
    'Village Economic Profile on the phone.\n'
    '- Record production for closed businesses\n'
    '- Fixed "quotes" & <b>not HTML</b> stay as typed';

const _release = ReleaseInfo(
  versionName: '0.1.2',
  versionCode: 3,
  notes: _notes,
);

Map<String, Object?> _json({
  Object? name = '0.1.2',
  Object? code = 3,
  Object? notes = _notes,
  Object? schema = 1,
}) => {
  'schemaVersion': schema,
  'versionName': name,
  'versionCode': code,
  'language': 'en',
  'notes': notes,
};

class _Bundle extends CachingAssetBundle {
  _Bundle(this.text);

  final String? text;

  @override
  Future<ByteData> load(String key) async {
    final text = this.text;
    if (key != releaseNotesAsset || text == null) {
      throw FlutterError('Unable to load asset: $key');
    }
    return ByteData.sublistView(utf8.encode(text));
  }
}

DemoStore _store({
  ReleaseInfo? release = _release,
  ReleaseAcknowledgement? acknowledgement,
}) => DemoStore(
  loadDelay: Duration.zero,
  clock: () => demoNow,
  showSplash: false,
  languageChosen: true,
  whatsNew: release == null
      ? WhatsNew.none()
      : WhatsNew(release: release, acknowledgement: acknowledgement),
);

/// Pumps the screen alone, as the app styles and localizes it.
Future<void> _pumpScreen(
  WidgetTester tester, {
  ReleaseInfo? release = _release,
  bool afterUpdate = true,
  String code = 'en',
  Size size = const Size(412, 900),
  double textScale = 1,
  bool reducedMotion = false,
}) async {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MotionScope(
      child: MaterialApp(
        theme: AppTheme.light(),
        locale: Locale(code),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: TextScaler.linear(textScale),
            disableAnimations: reducedMotion,
          ),
          child: child!,
        ),
        home: WhatsNewScreen(release: release, afterUpdate: afterUpdate),
      ),
    ),
  );
}

final _whatsNew = find.byType(WhatsNewScreen);
final _continue = find.byKey(const ValueKey('whatsNew.continue'));

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('release metadata', () {
    test('a release written by the workflow is read as it was typed', () {
      final release = ReleaseInfo.tryParse(_json())!;
      expect(release.id, '0.1.2+3');
      expect(release.notes, _notes);
      expect(release.lines, [
        (text: 'Village Economic Profile on the phone.', bullet: false),
        (text: 'Record production for closed businesses', bullet: true),
        (text: 'Fixed "quotes" & <b>not HTML</b> stay as typed', bullet: true),
      ]);
    });

    test('anything the workflow would not write is no release', () {
      for (final json in <Object?>[
        null,
        'notes',
        [_json()],
        _json(schema: 2),
        _json(name: null),
        _json(name: '1.2'),
        _json(name: '0.1.2-beta'),
        _json(code: 0),
        _json(code: '3'),
        _json(code: 2100000001),
        _json(notes: ''),
        _json(notes: ' padded '),
        _json(notes: 'x' * 501),
        _json(notes: 7),
      ]) {
        expect(ReleaseInfo.tryParse(json), isNull, reason: '$json');
      }
      // Characters are counted as the workflow and Play count them.
      expect(ReleaseInfo.tryParse(_json(notes: '🌱' * 500)), isNotNull);
      expect(ReleaseInfo.tryParse(_json(notes: '🌱' * 501)), isNull);
    });

    // The release workflow runs these tests after embedding a release, so
    // this checks whatever file is there: the development file is no
    // release, and an embedded release reads back exactly as written.
    test('the bundled file is read as the workflow wrote it', () async {
      final text = File(releaseNotesAsset).readAsStringSync();
      final json = jsonDecode(text) as Map<String, dynamic>;
      final fromDisk = await loadReleaseInfo(_Bundle(text));
      // Through the app's real asset bundle: declared in pubspec.yaml.
      final bundled = await loadReleaseInfo();
      if (json['versionName'] == null) {
        expect(fromDisk, isNull);
        expect(bundled, isNull);
      } else {
        expect(fromDisk?.id, '${json['versionName']}+${json['versionCode']}');
        expect(fromDisk?.notes, json['notes']);
        expect(bundled?.id, fromDisk?.id);
        expect(bundled?.notes, fromDisk?.notes);
      }
    });

    test('missing or broken metadata never stops startup', () async {
      expect(await loadReleaseInfo(_Bundle(null)), isNull);
      expect(await loadReleaseInfo(_Bundle('{not json')), isNull);
      expect(await loadReleaseInfo(_Bundle('')), isNull);
      final release = await loadReleaseInfo(_Bundle(jsonEncode(_json())));
      expect(release?.id, '0.1.2+3');
    });
  });

  group('acknowledgement', () {
    test('an update from an acknowledged release is shown once', () {
      final saved = MemoryReleaseAcknowledgement(
        acknowledged: '0.1.1+2',
        usedBefore: true,
      );
      final first = WhatsNew(release: _release, acknowledgement: saved);
      expect(first.pending, isTrue);
      first.acknowledge();
      expect(first.pending, isFalse);
      expect(saved.acknowledged, '0.1.2+3');
      // The next launch, and the same build run again.
      expect(
        WhatsNew(release: _release, acknowledgement: saved).pending,
        isFalse,
      );
    });

    test('skipping versions shows only the installed release', () {
      final whatsNew = WhatsNew(
        release: _release,
        acknowledgement: MemoryReleaseAcknowledgement(
          acknowledged: '0.0.9+1',
          usedBefore: true,
        ),
      );
      expect(whatsNew.pending, isTrue);
      expect(whatsNew.release?.id, '0.1.2+3');
    });

    test('a fresh installation is not called an update', () {
      final saved = MemoryReleaseAcknowledgement();
      expect(
        WhatsNew(release: _release, acknowledgement: saved).pending,
        isFalse,
      );
      // Recorded silently, so the next update is recognised as one.
      expect(saved.acknowledged, '0.1.2+3');
    });

    test('an app used before this feature counts as updated', () {
      expect(
        WhatsNew(
          release: _release,
          acknowledgement: MemoryReleaseAcknowledgement(usedBefore: true),
        ).pending,
        isTrue,
      );
    });

    test('no metadata or unreadable storage shows nothing', () {
      final saved = MemoryReleaseAcknowledgement(usedBefore: true);
      expect(WhatsNew.none().pending, isFalse);
      expect(WhatsNew(release: _release).pending, isFalse);
      expect(saved.acknowledged, isNull);
    });

    test('the device remembers the acknowledgement across restarts', () async {
      SharedPreferences.setMockInitialValues({'language': 'si'});
      final first = DeviceReleaseAcknowledgement(
        await SharedPreferences.getInstance(),
      );
      expect(first.usedBefore, isTrue);
      final whatsNew = WhatsNew(release: _release, acknowledgement: first);
      expect(whatsNew.pending, isTrue);
      whatsNew.acknowledge();
      final restarted = DeviceReleaseAcknowledgement(
        await SharedPreferences.getInstance(),
      );
      expect(restarted.load(), '0.1.2+3');
      expect(
        WhatsNew(release: _release, acknowledgement: restarted).pending,
        isFalse,
      );
    });

    test('a phone with nothing saved is a fresh installation', () async {
      SharedPreferences.setMockInitialValues({});
      final saved = DeviceReleaseAcknowledgement(
        await SharedPreferences.getInstance(),
      );
      expect(saved.usedBefore, isFalse);
      expect(
        WhatsNew(release: _release, acknowledgement: saved).pending,
        isFalse,
      );
      expect(saved.load(), '0.1.2+3');
    });
  });

  group('in the app', () {
    testWidgets(
      'after an update the notes wait for sign-in, show once and return '
      'to the destination',
      (tester) async {
        final saved = MemoryReleaseAcknowledgement(
          acknowledged: '0.1.1+2',
          usedBefore: true,
        );
        await pumpApp(tester, store: _store(acknowledgement: saved));
        // Sign-in is never interrupted.
        expect(_whatsNew, findsNothing);
        expect(find.text('Use demo account'), findsOneWidget);
        await signInWithDemoAccount(tester);

        expect(_whatsNew, findsOneWidget);
        expect(find.text('What’s New'), findsOneWidget);
        expect(find.text('Version 0.1.2 (3)'), findsOneWidget);
        expect(
          find.text(
            'Sarvodaya Connect has been updated on this phone. '
            'Here is what changed.',
          ),
          findsOneWidget,
        );
        expect(
          find.text('Fixed "quotes" & <b>not HTML</b> stay as typed'),
          findsOneWidget,
        );
        expect(
          find.byKey(const ValueKey('whatsNew.englishOnly')),
          findsNothing,
        );
        expect(saved.acknowledged, '0.1.1+2', reason: 'not until Continue');

        await tester.tap(_continue);
        await tester.pumpAndSettle();
        expect(_whatsNew, findsNothing);
        expect(find.byType(HomeShell), findsOneWidget);
        expect(find.byType(NavigationBar), findsOneWidget);
        expect(saved.acknowledged, '0.1.2+3');

        // Signing out and back in does not show it again.
        DemoScope.read(tester.element(find.byType(HomeShell))).signOut();
        await tester.pumpAndSettle();
        await signInWithDemoAccount(tester);
        expect(_whatsNew, findsNothing);
        expect(find.byType(HomeShell), findsOneWidget);
      },
    );

    testWidgets('Back also counts as seen', (tester) async {
      final saved = MemoryReleaseAcknowledgement(
        acknowledged: '0.1.1+2',
        usedBefore: true,
      );
      await pumpApp(tester, store: _store(acknowledgement: saved));
      await signInWithDemoAccount(tester);
      expect(_whatsNew, findsOneWidget);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(_whatsNew, findsNothing);
      expect(saved.acknowledged, '0.1.2+3');
    });

    testWidgets('More → What’s New reopens the notes without resetting '
        'the acknowledgement', (tester) async {
      final saved = MemoryReleaseAcknowledgement(
        acknowledged: '0.1.2+3',
        usedBefore: true,
      );
      await pumpApp(tester, store: _store(acknowledgement: saved));
      await signInWithDemoAccount(tester);
      expect(_whatsNew, findsNothing);
      await tester.tap(navTab('More'));
      await tester.pumpAndSettle();
      await tapVisible(tester, find.text('What’s New'));
      expect(_whatsNew, findsOneWidget);
      expect(find.text('Version 0.1.2 (3)'), findsOneWidget);
      expect(
        find.text(
          'The version installed on this phone, and what changed in it.',
        ),
        findsOneWidget,
      );
      expect(find.byType(BackButton), findsOneWidget);
      await tester.tap(_continue);
      await tester.pumpAndSettle();
      expect(find.text('What’s New'), findsOneWidget, reason: 'back on More');
      expect(saved.acknowledged, '0.1.2+3');
    });

    testWidgets('a fresh installation goes straight to sign-in and home', (
      tester,
    ) async {
      final saved = MemoryReleaseAcknowledgement();
      await pumpApp(tester, store: _store(acknowledgement: saved));
      await signInWithDemoAccount(tester);
      expect(_whatsNew, findsNothing);
      expect(find.byType(HomeShell), findsOneWidget);
      expect(saved.acknowledged, '0.1.2+3');
    });

    testWidgets('without metadata the app starts and More says so', (
      tester,
    ) async {
      await pumpApp(tester, store: _store(release: null));
      await signInWithDemoAccount(tester);
      expect(_whatsNew, findsNothing);
      await tester.tap(navTab('More'));
      await tester.pumpAndSettle();
      await tapVisible(tester, find.text('What’s New'));
      expect(find.text('No Release Notes'), findsOneWidget);
      expect(
        find.text(
          'This build has no release notes. They are added when the '
          'Android release is built.',
        ),
        findsOneWidget,
      );
    });
  });

  group('screen', () {
    for (final code in ['si', 'ta']) {
      testWidgets('$code: the English notes are labelled as English', (
        tester,
      ) async {
        await _pumpScreen(tester, code: code);
        await tester.pumpAndSettle();
        expect(
          find.byKey(const ValueKey('whatsNew.englishOnly')),
          findsOneWidget,
        );
        // The notes themselves are shown as written, not translated.
        expect(
          find.text('Record production for closed businesses'),
          findsOneWidget,
        );
      });
    }

    for (final code in ['en', 'si', 'ta']) {
      testWidgets(
        '$code: long notes on a small phone with large text keep Continue '
        'on screen',
        (tester) async {
          final long = ReleaseInfo(
            versionName: '10.20.30',
            versionCode: 2100000000,
            notes: List.filled(
              12,
              '- A long fictional change description that wraps',
            ).join('\n').substring(0, 500).trim(),
          );
          await _pumpScreen(
            tester,
            release: long,
            code: code,
            size: const Size(320, 568),
            textScale: 2,
          );
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
          final button = tester.getRect(_continue);
          expect(button.bottom, lessThanOrEqualTo(568));
          expect(button.top, greaterThan(0));
          await tester.tap(_continue, warnIfMissed: true);
          // The notes scroll to their last line.
          await tester.drag(
            find.byKey(const ValueKey('whatsNew.list')),
            const Offset(0, -4000),
          );
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
        },
      );
    }

    testWidgets('with reduced motion everything is shown at once', (
      tester,
    ) async {
      await _pumpScreen(tester, reducedMotion: true);
      await tester.pump();
      final opacities = tester.widgetList<Opacity>(
        find.ancestor(
          of: find.byKey(const ValueKey('whatsNew.version')),
          matching: find.byType(Opacity),
        ),
      );
      expect(opacities, isNotEmpty);
      expect(opacities.every((o) => o.opacity == 1), isTrue);
    });

    testWidgets('screen readers get the notes as text and Continue as a '
        'button', (tester) async {
      final semantics = tester.ensureSemantics();
      await _pumpScreen(tester);
      await tester.pumpAndSettle();
      expect(
        find.bySemanticsLabel('Record production for closed businesses'),
        findsOneWidget,
      );
      expect(
        tester.getSemantics(_continue),
        matchesSemantics(
          label: 'Continue',
          isButton: true,
          hasTapAction: true,
          isEnabled: true,
          hasEnabledState: true,
          isFocusable: true,
          hasFocusAction: true,
        ),
      );
      semantics.dispose();
    });
  });
}
