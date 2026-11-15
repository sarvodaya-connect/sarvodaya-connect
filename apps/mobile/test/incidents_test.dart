import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/incidents/assessment_queue.dart';
import 'package:sarvodaya_connect_mobile/src/incidents/assessment_queue_card.dart';
import 'package:sarvodaya_connect_mobile/src/incidents/demo_incident_api.dart';
import 'package:sarvodaya_connect_mobile/src/incidents/incident_api.dart';
import 'package:sarvodaya_connect_mobile/src/incidents/incident_format.dart';
import 'package:sarvodaya_connect_mobile/src/incidents/incident_screens.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';
import 'package:sarvodaya_connect_mobile/src/widgets/state_views.dart';

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
    AssessmentAnswers answers, {
    bool Function()? stillSignedIn,
  }) async {
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
      stillSignedIn: stillSignedIn,
    );
  }
}

/// Sending a saved assessment hangs until [release] completes, like a large
/// photo or a stalled upload.
class _StalledIncidentApi extends DemoIncidentApi {
  _StalledIncidentApi({required super.clock});
  final release = Completer<void>();
  int sends = 0;

  @override
  Future<String> sendAssessment(
    String incidentId,
    String societyId,
    String clientMutationId,
    AssessmentAnswers answers, {
    bool Function()? stillSignedIn,
  }) async {
    sends++;
    await release.future;
    return super.sendAssessment(
      incidentId,
      societyId,
      clientMutationId,
      answers,
      stillSignedIn: stillSignedIn,
    );
  }
}

/// Offline: nothing about incidents can be loaded or sent.
class _DownIncidentApi extends DemoIncidentApi {
  _DownIncidentApi({required super.clock});
  static const _offline = IncidentException(
    "You're offline or the server did not answer.",
    offline: true,
  );

  @override
  Future<List<IncidentSummary>> active() async => throw _offline;

  @override
  Future<IncidentDetail> detail(String id) async => throw _offline;

  @override
  Future<String> sendAssessment(
    String incidentId,
    String societyId,
    String clientMutationId,
    AssessmentAnswers answers, {
    bool Function()? stillSignedIn,
  }) async => throw _offline;
}

/// Incidents never finish loading, and sending is offline.
class _LoadingIncidentApi extends _DownIncidentApi {
  _LoadingIncidentApi({required super.clock});

  @override
  Future<List<IncidentSummary>> active() =>
      Completer<List<IncidentSummary>>().future;

  @override
  Future<IncidentDetail> detail(String id) =>
      Completer<IncidentDetail>().future;
}

/// The phone's storage fills up after [writes] successful queue writes.
class _FillingStorage extends MemoryQueueStorage {
  _FillingStorage({required this.writes});
  int writes;

  @override
  Future<void> writeQueue(String accountId, String json) async {
    if (writes-- <= 0) {
      throw const FileSystemException('No space left on device');
    }
    return super.writeQueue(accountId, json);
  }
}

Future<DemoStore> _pump(
  WidgetTester tester,
  Widget home, {
  IncidentApi? api,
  QueueStorage? assessmentStorage,
  UserRole role = UserRole.societyOfficer,
}) async {
  tester.view.physicalSize = const Size(402 * 3, 1400 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final store = DemoStore(
    loadDelay: Duration.zero,
    clock: () => demoNow,
    incidentApi: api ?? DemoIncidentApi(clock: () => demoNow),
    assessmentStorage: assessmentStorage,
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

  testWidgets(
    'a storage error while sending still shows the assessment as saved',
    (tester) async {
      final api = DemoIncidentApi(clock: () => demoNow);
      final detail = await api.detail('incident-demo');
      final store = await _pump(
        tester,
        RapidAssessmentScreen(
          incident: detail.incident,
          societies: detail.assessableSocieties,
        ),
        api: api,
        // The save works; recording progress afterwards does not.
        assessmentStorage: _FillingStorage(writes: 1),
      );
      await _tap(tester, find.text('Critical'));
      for (var i = 0; i < 9; i++) {
        await _tap(tester, find.text('Next'));
      }
      await _tap(tester, find.text('Check answers'));
      await _tap(tester, find.text('Send assessment'));
      expect(find.text('Saved on This Phone'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(find.text('Assessment Sent'), findsNothing);
      expect(store.assessments.items, hasLength(1));
    },
  );

  testWidgets('a stalled send does not hold up Disaster Response', (
    tester,
  ) async {
    final api = _StalledIncidentApi(clock: () => demoNow);
    final detail = await api.detail('incident-demo');
    final store = await _pump(tester, const SizedBox(), api: api);
    await store.assessments.save(
      incident: detail.incident,
      societyId: detail.assessableSocieties.first.id,
      societyName: detail.assessableSocieties.first.name,
      clientMutationId: newClientMutationId(),
      answers: AssessmentAnswers()..impact = 'CRITICAL',
    );
    await tester.pumpWidget(
      DemoScope(
        store: store,
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const IncidentsScreen(),
        ),
      ),
    );
    for (var i = 0; i < 5; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    // Still sending, yet the incidents and response actions are there.
    expect(api.sends, 1);
    expect(store.assessments.syncing, isTrue);
    expect(find.text('Report an incident'), findsOneWidget);
    expect(find.text('1 assessment saved on this phone'), findsOneWidget);

    api.release.complete();
    await tester.pumpAndSettle();
    expect(store.assessments.items, isEmpty);
    expect(api.sends, 1);
  });

  testWidgets('saved assessments stay visible when incidents cannot load', (
    tester,
  ) async {
    final api = _DownIncidentApi(clock: () => demoNow);
    final detail = await DemoIncidentApi(clock: () => demoNow)
        .detail('incident-demo');
    final store = await _pump(tester, const IncidentsScreen(), api: api);
    expect(find.text("Couldn't load incidents"), findsOneWidget);
    await store.assessments.save(
      incident: detail.incident,
      societyId: detail.assessableSocieties.first.id,
      societyName: detail.assessableSocieties.first.name,
      clientMutationId: newClientMutationId(),
      answers: AssessmentAnswers()..impact = 'CRITICAL',
    );
    await tester.pumpAndSettle();
    expect(find.text("Couldn't load incidents"), findsOneWidget);
    expect(find.text('1 assessment saved on this phone'), findsOneWidget);
    expect(find.text('Remove from this phone'), findsOneWidget);
    expect(find.text('Retry sending'), findsOneWidget);

    // The incident's own page keeps them in reach too.
    await tester.pumpWidget(
      DemoScope(
        store: store,
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const IncidentScreen(incidentId: 'incident-demo'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text("Can't open this incident"), findsOneWidget);
    expect(find.text('1 assessment saved on this phone'), findsOneWidget);
    expect(find.text('Remove from this phone'), findsOneWidget);
  });

  group('many saved assessments on a small phone with large text', () {
    // A 4-inch phone at twice the text size, with more saved assessments
    // than fit on the screen.
    Future<DemoStore> pumpSmall(
      WidgetTester tester,
      Widget home,
      IncidentApi api,
    ) async {
      tester.view.physicalSize = const Size(320 * 2, 568 * 2);
      tester.view.devicePixelRatio = 2;
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.view.reset);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      final detail = await DemoIncidentApi(clock: () => demoNow)
          .detail('incident-demo');
      final store = DemoStore(
        loadDelay: Duration.zero,
        clock: () => demoNow,
        incidentApi: api,
      )..switchDemoRole(UserRole.societyOfficer);
      for (var i = 0; i < 8; i++) {
        await store.assessments.save(
          incident: detail.incident,
          societyId: detail.assessableSocieties.first.id,
          societyName: 'Fictional Society ${i + 1}',
          clientMutationId: newClientMutationId(),
          answers: AssessmentAnswers()..impact = 'CRITICAL',
        );
      }
      await tester.pumpWidget(
        DemoScope(
          store: store,
          child: MaterialApp(theme: AppTheme.light(), home: home),
        ),
      );
      await tester.pumpAndSettle();
      return store;
    }

    final page = find
        .descendant(
          of: find.byType(CustomScrollView),
          matching: find.byType(Scrollable),
        )
        .first;

    Future<void> scrollTo(WidgetTester tester, Finder target) async {
      await tester.scrollUntilVisible(target, 120, scrollable: page);
      await tester.pumpAndSettle();
      final screen = Offset.zero & tester.view.physicalSize / 2;
      expect(screen.contains(tester.getCenter(target)), isTrue);
    }

    Future<void> expectAllReachable(
      WidgetTester tester,
      DemoStore store,
      Finder content,
    ) async {
      expect(tester.takeException(), isNull);
      expect(find.text('8 assessments saved on this phone'), findsOneWidget);
      // The card alone is taller than the screen.
      expect(
        tester.getSize(find.byType(PendingAssessmentsCard)).height,
        greaterThan(568),
      );
      await scrollTo(tester, find.textContaining('Fictional Society 8'));
      await scrollTo(tester, find.text('Remove from this phone').last);
      await scrollTo(tester, find.text('Retry sending'));
      // Retry sending works from there; offline, every item is kept.
      await tester.tap(find.text('Retry sending'));
      await tester.pumpAndSettle();
      expect(store.assessments.items, hasLength(8));
      await scrollTo(tester, content);
      expect(tester.takeException(), isNull);
    }

    testWidgets('Disaster Response, when incidents cannot load', (
      tester,
    ) async {
      final store = await pumpSmall(
        tester,
        const IncidentsScreen(),
        _DownIncidentApi(clock: () => demoNow),
      );
      await expectAllReachable(tester, store, find.text('Try again'));
      expect(find.text("Couldn't load incidents"), findsOneWidget);
    });

    testWidgets('Disaster Response, while incidents load', (tester) async {
      final store = await pumpSmall(
        tester,
        const IncidentsScreen(),
        _LoadingIncidentApi(clock: () => demoNow),
      );
      await expectAllReachable(tester, store, find.byType(LoadingSkeleton));
    });

    testWidgets('the incident page, when it cannot load', (tester) async {
      final store = await pumpSmall(
        tester,
        const IncidentScreen(incidentId: 'incident-demo'),
        _DownIncidentApi(clock: () => demoNow),
      );
      await expectAllReachable(tester, store, find.text('Try again'));
      expect(find.text("Can't open this incident"), findsOneWidget);
    });

    testWidgets('the incident page, while it loads', (tester) async {
      final store = await pumpSmall(
        tester,
        const IncidentScreen(incidentId: 'incident-demo'),
        _LoadingIncidentApi(clock: () => demoNow),
      );
      await expectAllReachable(tester, store, find.byType(LoadingSkeleton));
    });

    testWidgets('with nothing saved, the error still fills the screen', (
      tester,
    ) async {
      final store = await _pump(
        tester,
        const IncidentsScreen(),
        api: _DownIncidentApi(clock: () => demoNow),
      );
      expect(store.assessments.items, isEmpty);
      // Centred in the space below the bar, as before.
      final screen = tester.getSize(find.byType(Scaffold));
      final message = tester.getCenter(find.text("Couldn't load incidents"));
      expect((message.dy - screen.height / 2).abs(), lessThan(120));
    });
  });

  testWidgets('a saved assessment that is only waiting can be removed', (
    tester,
  ) async {
    final api = _OfflineIncidentApi(clock: () => demoNow);
    final detail = await api.detail('incident-demo');
    final store = await _pump(tester, const IncidentsScreen(), api: api);
    await store.assessments.save(
      incident: detail.incident,
      societyId: detail.assessableSocieties.first.id,
      societyName: detail.assessableSocieties.first.name,
      clientMutationId: newClientMutationId(),
      answers: AssessmentAnswers()..impact = 'CRITICAL',
    );
    await store.assessments.sync();
    await tester.pumpAndSettle();
    expect(store.assessments.items.single.blocked, isFalse);
    expect(find.text('1 assessment saved on this phone'), findsOneWidget);

    await _tap(tester, find.text('Remove from this phone'));
    await _tap(tester, find.widgetWithText(FilledButton, 'Remove'));
    expect(store.assessments.items, isEmpty);
    expect(find.text('1 assessment saved on this phone'), findsNothing);
  });

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
