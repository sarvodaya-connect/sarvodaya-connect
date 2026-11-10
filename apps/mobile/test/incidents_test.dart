import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/incidents/demo_incident_api.dart';
import 'package:sarvodaya_connect_mobile/src/incidents/incident_api.dart';
import 'package:sarvodaya_connect_mobile/src/incidents/incident_format.dart';
import 'package:sarvodaya_connect_mobile/src/incidents/incident_screens.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';

import 'test_helpers.dart';

/// The API is unreachable until [online] is set, or refuses with [refusal].
/// Like the real API, one clientMutationId is recorded once.
class _OfflineIncidentApi extends DemoIncidentApi {
  _OfflineIncidentApi({required super.clock});
  int attempts = 0;
  bool online = false;
  IncidentException? refusal;
  final ids = <String>[];
  final _seen = <String>{};
  int get received => _seen.length;

  @override
  Future<String> sendAssessment(
    String incidentId,
    String societyId,
    String clientMutationId,
    AssessmentAnswers answers,
  ) async {
    attempts++;
    ids.add(clientMutationId);
    if (refusal != null) throw refusal!;
    if (!online) {
      throw const IncidentException(
        "You're offline or the server did not answer.",
        offline: true,
      );
    }
    _seen.add(clientMutationId);
    return super.sendAssessment(
      incidentId,
      societyId,
      clientMutationId,
      answers,
    );
  }
}

Future<DemoStore> _pump(
  WidgetTester tester,
  Widget home, {
  IncidentApi? api,
  UserRole role = UserRole.societyOfficer,
}) async {
  tester.view.physicalSize = const Size(402 * 3, 1400 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final store = DemoStore(
    loadDelay: Duration.zero,
    clock: () => demoNow,
    incidentApi: api ?? DemoIncidentApi(clock: () => demoNow),
  )..switchDemoRole(role);
  await tester.pumpWidget(
    DemoScope(
      store: store,
      child: MaterialApp(theme: AppTheme.light(), home: home),
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

/// No horizontal progress bars as data displays anywhere (client rule).
void _expectNoBars() {
  expect(find.byType(LinearProgressIndicator), findsNothing);
}

void main() {
  test('deadlines are words and counts are grouped', () {
    final incident = IncidentSummary(
      id: 'i',
      reference: 'INC-2026-09',
      title: 'Floods',
      type: 'FLOOD',
      isClosed: false,
      areaNames: const ['A'],
      openedByName: 'N. Sample',
      openedByRole: 'SOCIETY_OFFICER',
      openedAt: DateTime.utc(2026, 10, 25),
      assessmentsDueAt: DateTime.utc(2026, 10, 27, 12, 30),
      societiesInArea: 1,
      assessed: 0,
    );
    expect(
      dueLine(incident, DateTime.utc(2026, 10, 24, 4, 30)),
      'Tue 27 Oct, 6:00 p.m. · 3 days 8 hours left',
    );
    expect(
      dueLine(incident, DateTime.utc(2026, 10, 28)),
      'Tue 27 Oct, 6:00 p.m. · deadline passed',
    );
    expect(openedByLine(incident), 'N. Sample (Society Officer)');
    expect(grouped(4610), '4,610');
    expect(quantityLine(200, 'L'), '200 L');
  });

  testWidgets('M40: the home card shows the live incident and its deadline', (
    tester,
  ) async {
    await _pump(
      tester,
      const Scaffold(body: IncidentHomeSection(societyId: 'society-demo')),
    );
    expect(find.text('Active Incident · INC-2026-09'), findsOneWidget);
    expect(find.text('Floods — Sample District'), findsOneWidget);
    expect(find.textContaining('1 day 9 hours left'), findsOneWidget);
    expect(find.text('Start rapid assessment'), findsOneWidget);
    expect(find.text('Response Actions for Your Society'), findsOneWidget);
    expect(find.text('Drinking water · 200 L'), findsOneWidget);
    expect(find.text('● Assigned'), findsOneWidget);
    expect(find.text('● In progress'), findsOneWidget);
    _expectNoBars();
  });

  testWidgets('M41–M43: one question at a time, check, then sent online', (
    tester,
  ) async {
    final api = DemoIncidentApi(clock: () => demoNow);
    final detail = await api.detail('incident-demo');
    await _pump(
      tester,
      RapidAssessmentScreen(
        incident: detail.incident,
        societies: detail.assessableSocieties,
      ),
      api: api,
    );
    expect(find.text('QUESTION 1 OF 10'), findsOneWidget);
    await _tap(tester, find.text('Critical'));
    for (var i = 0; i < 4; i++) {
      await _tap(tester, find.text('Next'));
    }
    expect(find.text('QUESTION 5 OF 10'), findsOneWidget);
    expect(find.text('How Many Houses Were Damaged?'), findsOneWidget);
    await _tap(tester, find.byTooltip('More: Fully damaged'));
    await _tap(tester, find.byTooltip('More: Fully damaged'));
    await _tap(tester, find.byTooltip('More: Partly damaged'));
    for (var i = 0; i < 5; i++) {
      await _tap(tester, find.text('Next'));
    }
    await _tap(tester, find.text('Check answers'));
    expect(find.text('Check Before Sending'), findsOneWidget);
    expect(find.text('2 / 1'), findsOneWidget);
    expect(find.text('Critical'), findsOneWidget);
    expect(
      find.text(
        'Only counts are sent — no names or NIC numbers of affected families.',
      ),
      findsOneWidget,
    );
    await _tap(tester, find.text('Send assessment'));
    expect(find.text('Assessment Sent'), findsOneWidget);
    expect(find.text('Update 1 · Flood'), findsOneWidget);
    expect(find.text('● Received'), findsOneWidget);
    _expectNoBars();
  });

  testWidgets(
    'offline: the assessment is saved on the phone and sent once on retry',
    (tester) async {
      final api = _OfflineIncidentApi(clock: () => demoNow);
      final detail = await api.detail('incident-demo');
      final store = await _pump(
        tester,
        RapidAssessmentScreen(
          incident: detail.incident,
          societies: detail.assessableSocieties,
        ),
        api: api,
      );
      await _tap(tester, find.text('Critical'));
      for (var i = 0; i < 9; i++) {
        await _tap(tester, find.text('Next'));
      }
      await _tap(tester, find.text('Check answers'));
      await _tap(tester, find.text('Send assessment'));
      expect(api.attempts, 1);
      // Issue #125: saved first, and the screen says it has not been sent.
      expect(find.text('Saved on This Phone'), findsOneWidget);
      expect(find.textContaining('Waiting for a connection.'), findsOneWidget);
      expect(find.text('Assessment Sent'), findsNothing);
      expect(store.assessments.items, hasLength(1));
      final id = store.assessments.items.single.clientMutationId;

      // The Incident tab shows it and retries it while still offline.
      await tester.pumpWidget(
        DemoScope(
          store: store,
          child: MaterialApp(
            theme: AppTheme.light(),
            home: const IncidentsScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(api.attempts, 2);
      expect(find.text('1 assessment saved on this phone'), findsOneWidget);

      // Back online: Retry sends it once, with the same id.
      api.online = true;
      await _tap(tester, find.text('Retry sending'));
      expect(find.text('1 saved assessment sent.'), findsOneWidget);
      expect(find.text('1 assessment saved on this phone'), findsNothing);
      expect(store.assessments.items, isEmpty);
      expect(api.ids, [id, id, id]);
      expect(api.received, 1);
    },
  );

  testWidgets('a closed incident keeps the assessment and explains why', (
    tester,
  ) async {
    final api = _OfflineIncidentApi(clock: () => demoNow)
      ..refusal = const IncidentException(
        'This incident is closed',
        status: 409,
      );
    final detail = await api.detail('incident-demo');
    final store = await _pump(
      tester,
      RapidAssessmentScreen(
        incident: detail.incident,
        societies: detail.assessableSocieties,
      ),
      api: api,
    );
    await _tap(tester, find.text('Critical'));
    for (var i = 0; i < 9; i++) {
      await _tap(tester, find.text('Next'));
    }
    await _tap(tester, find.text('Check answers'));
    await _tap(tester, find.text('Send assessment'));
    expect(find.text("Saved, but It Can't Be Sent Yet"), findsOneWidget);
    expect(
      find.textContaining('The incident was closed before this arrived.'),
      findsOneWidget,
    );
    expect(store.assessments.items.single.blocked, isTrue);
  });

  testWidgets('M49: closing asks first and records the closer', (tester) async {
    await _pump(tester, const IncidentScreen(incidentId: 'incident-demo'));
    expect(find.text('● Active'), findsOneWidget);
    expect(find.text('96 of 151'), findsOneWidget);
    await _tap(tester, find.text('Close incident'));
    expect(find.text('Close This Incident?'), findsOneWidget);
    await _tap(tester, find.text('Keep open'));
    expect(find.text('● Active'), findsOneWidget);
    await _tap(tester, find.text('Close incident'));
    await _tap(tester, find.widgetWithText(FilledButton, 'Close incident'));
    expect(find.text('● Closed'), findsOneWidget);
    expect(find.text('Start rapid assessment'), findsNothing);
    expect(find.text('Close incident'), findsNothing);
  });

  testWidgets('M45h / M46: the helping society updates its delivery', (
    tester,
  ) async {
    await _pump(tester, const IncidentScreen(incidentId: 'incident-demo'));
    await _tap(tester, find.text('Helping Another Society'));
    expect(find.text('HQ asked your society to help'), findsOneWidget);
    expect(find.text('Sample Lake Society'), findsOneWidget);
    await _tap(tester, find.text('Drinking water · 300 L'));
    expect(find.text('Update Delivery'), findsOneWidget);
    await tester.enterText(
      find.widgetWithText(TextField, 'Delivered so far *'),
      '301',
    );
    await _tap(tester, find.text('Save update'));
    expect(find.text('Enter a number from 0 to 300.'), findsOneWidget);
    await tester.enterText(
      find.widgetWithText(TextField, 'Delivered so far *'),
      '120',
    );
    await _tap(tester, find.text('Save update'));
    expect(find.text('Drinking water · 120 of 300 L'), findsOneWidget);
    expect(find.text('● In progress'), findsOneWidget);
    _expectNoBars();
  });

  testWidgets('M45 / M47: response actions and the situation report', (
    tester,
  ) async {
    await _pump(tester, const IncidentScreen(incidentId: 'incident-demo'));
    await _tap(tester, find.text('Response Actions'));
    expect(
      find.text('INC-2026-09 · Floods — Sample District · Disaster Record'),
      findsOneWidget,
    );
    expect(find.text('Societies Helping You'), findsOneWidget);
    await tester.pageBack();
    await tester.pumpAndSettle();
    await _tap(tester, find.text('Situation Report'));
    expect(find.text('4,610'), findsOneWidget);
    expect(find.text('36 / 412'), findsOneWidget);
    expect(
      find.text('17 societies are helping 24 affected societies.'),
      findsOneWidget,
    );
    expect(
      find.text('Counts only, from received assessments. No personal details.'),
      findsOneWidget,
    );
    _expectNoBars();
  });

  testWidgets(
    'M48: report an incident for an own society, with the area chosen',
    (tester) async {
      await _pump(tester, const ReportIncidentScreen());
      expect(find.text('Sample Village Society · S-000001'), findsOneWidget);
      await _tap(tester, find.text('Open incident'));
      expect(find.textContaining('Fill in what happened'), findsOneWidget);
      await tester.enterText(
        find.widgetWithText(TextField, 'Short description *'),
        'Fictional canal overflow.',
      );
      await _tap(tester, find.text('Open incident'));
      expect(find.byType(ReportIncidentScreen), findsNothing);
    },
  );

  testWidgets('M48n: incident notifications show in the Incident tab', (
    tester,
  ) async {
    await _pump(
      tester,
      const IncidentsScreen(),
      role: UserRole.programmeCoordinator,
    );
    expect(
      find.text('Sample data · fictional incident for demonstration'),
      findsOneWidget,
    );
    expect(find.text('Incident Notifications'), findsOneWidget);
    expect(find.text('New incident: Floods — Sample District'), findsOneWidget);
    expect(find.text('Report an incident'), findsOneWidget);
  });
}
