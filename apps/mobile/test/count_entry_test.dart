import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/incidents/demo_incident_api.dart';
import 'package:sarvodaya_connect_mobile/src/incidents/incident_api.dart';
import 'package:sarvodaya_connect_mobile/src/incidents/incident_screens.dart';
import 'package:sarvodaya_connect_mobile/src/l10n/generated/app_localizations.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/activity_screens.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_screen.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';
import 'package:sarvodaya_connect_mobile/src/widgets/count_field.dart';

import 'test_helpers.dart';

/// Issue #132: counts can be typed as well as stepped. Everything is fictional.

const _pahala = 'society-pahala-kosgama';

Future<DemoStore> _pump(
  WidgetTester tester,
  Widget home, {
  IncidentApi? incidents,
  String code = 'en',
  Size size = const Size(412, 2400),
  double textScale = 1,
}) async {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
  final store = DemoStore(
    loadDelay: Duration.zero,
    clock: () => demoNow,
    incidentApi: incidents,
  )..switchDemoRole(UserRole.societyOfficer);
  await tester.pumpWidget(
    DemoScope(
      store: store,
      child: MaterialApp(
        theme: AppTheme.light(),
        locale: Locale(code),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        home: home,
      ),
    ),
  );
  await tester.pumpAndSettle();
  return store;
}

Future<void> _tap(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

Finder _count(int index) => find.descendant(
  of: find.byType(CountField).at(index),
  matching: find.byType(TextField),
);

String _shown(WidgetTester tester, int index) =>
    tester.widget<TextField>(_count(index)).controller!.text;

/// Opens New Activity at step 2 (Participants and Beneficiaries).
Future<DemoStore> _toParticipants(
  WidgetTester tester, {
  String code = 'en',
  double textScale = 1,
  Size size = const Size(412, 2400),
}) async {
  final store = await _pump(
    tester,
    const SocietyRecordScreen(societyId: _pahala, initialTab: 2),
    code: code,
    textScale: textScale,
    size: size,
  );
  await _tap(tester, find.widgetWithText(FilledButton, 'Add'));
  final fields = find.byType(TextField);
  await tester.enterText(fields.at(0), 'Village library day');
  await tester.enterText(
    fields.at(1),
    'A fictional day of reading for children.',
  );
  await _tap(tester, find.byType(FilledButton).last);
  return store;
}

void main() {
  test('a typed count is a whole number in range, or nothing', () {
    expect(parseCount('100', max: 100000), 100);
    expect(parseCount('1,000', max: 100000), 1000);
    expect(parseCount(' 7 ', max: 100000), 7);
    expect(parseCount('0', max: 100000), 0);
    expect(parseCount('100000', max: 100000), 100000);
    for (final bad in [
      '',
      ' ',
      '-1',
      '1.5',
      '12a',
      'abc',
      '100001',
      '1e3',
      '+5',
    ]) {
      expect(parseCount(bad, max: 100000), isNull, reason: bad);
    }
  });

  testWidgets(
    'New Activity: 100 and 1,000 typed straight in, then stepped, survive Back/Next and reach the saved record',
    (tester) async {
      final store = await _toParticipants(tester);
      expect(find.text('STEP 2 OF 4'), findsOneWidget);

      await tester.enterText(_count(0), '1,000');
      await tester.enterText(_count(1), '100');
      await tester.pumpAndSettle();
      expect(find.text('Total participants 1100'), findsOneWidget);

      // The buttons carry on from the typed number.
      await _tap(tester, find.byTooltip('more female participants'));
      await _tap(tester, find.byTooltip('fewer male participants'));
      expect(_shown(tester, 0), '1001');
      expect(_shown(tester, 1), '99');
      expect(find.text('Total participants 1100'), findsOneWidget);

      await tester.enterText(_count(2), '250');
      await tester.enterText(_count(3), '40');
      await tester.enterText(_count(4), '12');
      await tester.pumpAndSettle();

      await _tap(tester, find.text('Next: Resources'));
      expect(find.text('STEP 3 OF 4'), findsOneWidget);
      await _tap(tester, find.text('Back'));
      expect(_shown(tester, 0), '1001');
      expect(_shown(tester, 2), '250');
      expect(find.text('Total participants 1100'), findsOneWidget);

      await _tap(tester, find.text('Next: Resources'));
      await tester.enterText(find.byType(TextField).first, '5000');
      await _tap(tester, find.text('Next: Check'));
      expect(find.text('STEP 4 OF 4'), findsOneWidget);
      expect(find.textContaining('1001'), findsWidgets);
      await _tap(tester, find.text('Send to SPC'));
      expect(find.text('Sent to Your SPC'), findsOneWidget);

      final plan = await store.societyRecords.fetchWorkPlan(_pahala);
      final saved = plan.activities.firstWhere(
        (a) => a.name == 'Village library day',
      );
      expect(
        [
          saved.femaleParticipants,
          saved.maleParticipants,
          saved.youthParticipants,
          saved.householdsBenefited,
          saved.womenHeadedHouseholds,
        ],
        [1001, 99, 250, 40, 12],
      );
    },
  );

  testWidgets('New Activity: invalid numbers are explained and cannot go on', (
    tester,
  ) async {
    await _toParticipants(tester);
    for (final bad in ['-3', '2.5', '12a', '100001']) {
      await tester.enterText(_count(0), bad);
      await tester.pumpAndSettle();
      expect(
        find.text('Enter a whole number from 0 to 100,000.'),
        findsOneWidget,
        reason: bad,
      );
      await _tap(tester, find.text('Next: Resources'));
      expect(find.text('STEP 2 OF 4'), findsOneWidget, reason: bad);
      expect(find.textContaining('Fix it before going on'), findsOneWidget);
    }
    // Empty while editing is not reset to zero, and also cannot go on.
    await tester.enterText(_count(0), '');
    await tester.pumpAndSettle();
    expect(_shown(tester, 0), '');
    await _tap(tester, find.text('Next: Resources'));
    expect(find.text('STEP 2 OF 4'), findsOneWidget);

    await tester.enterText(_count(0), '5');
    await tester.pumpAndSettle();
    expect(find.text('Enter a whole number from 0 to 100,000.'), findsNothing);
    expect(find.text('Total participants 5'), findsOneWidget);
  });

  testWidgets('New Activity: subset rules still apply to typed numbers', (
    tester,
  ) async {
    await _toParticipants(tester);
    await tester.enterText(_count(0), '10');
    await tester.enterText(_count(1), '5');
    await tester.enterText(_count(2), '16');
    await tester.enterText(_count(3), '3');
    await tester.enterText(_count(4), '4');
    await tester.pumpAndSettle();
    // Youth are inside the participants, never added to them.
    expect(find.text('Total participants 15'), findsOneWidget);
    await _tap(tester, find.text('Next: Resources'));
    expect(
      find.textContaining('Youth are counted inside the female'),
      findsOneWidget,
    );
    expect(
      find.textContaining('Women-headed households are part of'),
      findsOneWidget,
    );
    await tester.enterText(_count(2), '15');
    await tester.enterText(_count(4), '3');
    await tester.pumpAndSettle();
    await _tap(tester, find.text('Next: Resources'));
    expect(find.text('STEP 3 OF 4'), findsOneWidget);
  });

  testWidgets(
    'the count fields fit a small screen with large text in Sinhala and Tamil',
    (tester) async {
      for (final code in ['si', 'ta']) {
        // The wizard on its own, so only the count fields are measured.
        await _pump(
          tester,
          const ActivityWizardScreen(
            societyId: _pahala,
            societyName: 'Fictional Test Society A01',
            year: 2027,
          ),
          code: code,
          textScale: 1.3,
          size: const Size(360, 2600),
        );
        final fields = find.byType(TextField);
        await tester.enterText(fields.at(0), 'Village library day');
        await tester.enterText(
          fields.at(1),
          'A fictional day of reading for children.',
        );
        await _tap(tester, find.byType(FilledButton).last);
        expect(find.byType(CountField), findsNWidgets(5));
        await tester.enterText(_count(0), 'x');
        await tester.enterText(_count(1), '1,000');
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull, reason: code);
        final message = tester
            .widgetList<Text>(
              find.descendant(
                of: find.byType(CountField).at(0),
                matching: find.byType(Text),
              ),
            )
            .map((text) => text.data ?? '')
            .where((text) => text.contains('0'))
            .toList();
        expect(message, hasLength(1), reason: code);
        expect(
          message.single,
          isNot(contains('Enter a whole number')),
          reason: '$code is translated',
        );
      }
    },
  );

  testWidgets(
    'the rapid assessment houses card fits a small screen with large text',
    (tester) async {
      final api = DemoIncidentApi(clock: () => demoNow);
      final detail = await api.detail('incident-demo');
      await _pump(
        tester,
        RapidAssessmentScreen(
          incident: detail.incident,
          societies: detail.assessableSocieties,
        ),
        incidents: api,
        textScale: 1.3,
        size: const Size(360, 2600),
      );
      for (var i = 0; i < 4; i++) {
        await _tap(tester, find.text('Next'));
      }
      expect(find.byType(CountField), findsNWidgets(2));
      await tester.enterText(_count(0), '12345');
      await tester.enterText(_count(1), 'abc');
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Rapid assessment: families typed in, stepped, kept across steps and on the check screen',
    (tester) async {
      final api = DemoIncidentApi(clock: () => demoNow);
      final detail = await api.detail('incident-demo');
      await _pump(
        tester,
        RapidAssessmentScreen(
          incident: detail.incident,
          societies: detail.assessableSocieties,
        ),
        incidents: api,
      );
      await _tap(tester, find.text('Next'));
      expect(find.text('QUESTION 2 OF 10'), findsOneWidget);
      await tester.enterText(_count(0), '250');
      await tester.pumpAndSettle();
      await _tap(tester, find.byTooltip('More: Families affected'));
      expect(_shown(tester, 0), '251');

      // An invalid value blocks Next with a message.
      await tester.enterText(_count(0), '25o');
      await tester.pumpAndSettle();
      expect(
        find.text('Enter a whole number from 0 to 1,000,000.'),
        findsOneWidget,
      );
      await _tap(tester, find.text('Next'));
      expect(find.text('QUESTION 2 OF 10'), findsOneWidget);
      expect(find.textContaining('Fix it before going on'), findsOneWidget);

      // Back keeps the last valid number.
      await _tap(tester, find.text('Back'));
      await _tap(tester, find.text('Next'));
      expect(_shown(tester, 0), '251');

      await tester.enterText(_count(0), '1,200');
      await tester.pumpAndSettle();
      for (var i = 0; i < 8; i++) {
        await _tap(tester, find.text('Next'));
      }
      await _tap(tester, find.text('Check answers'));
      expect(find.text('Check Before Sending'), findsOneWidget);
      expect(find.text('1200'), findsOneWidget);
    },
  );
}
