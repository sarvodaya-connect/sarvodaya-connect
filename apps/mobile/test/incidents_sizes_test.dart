import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/incidents/demo_incident_api.dart';
import 'package:sarvodaya_connect_mobile/src/incidents/incident_screens.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';

import 'test_helpers.dart';

const _sizes = <(String, Size, double)>[
  ('320x568', Size(320, 568), 1.0),
  ('320x568 larger text', Size(320, 568), 1.6),
  ('390x844', Size(390, 844), 1.0),
  ('390x844 larger text', Size(390, 844), 1.6),
];

Future<void> _pump(
  WidgetTester tester,
  Widget home,
  Size size,
  double scale, {
  UserRole role = UserRole.societyOfficer,
  DemoIncidentApi? api,
}) async {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  tester.platformDispatcher.textScaleFactorTestValue = scale;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearAllTestValues);
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
}

void main() {
  for (final (name, size, scale) in _sizes) {
    testWidgets('M40 home card has no overflow at $name', (tester) async {
      await _pump(
        tester,
        const Scaffold(
          body: SingleChildScrollView(
            child: IncidentHomeSection(societyId: 'society-demo'),
          ),
        ),
        size,
        scale,
      );
      expect(find.textContaining('Active Incident'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('M41 rapid assessment has no overflow at $name', (
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
        size,
        scale,
        api: api,
      );
      expect(find.text('QUESTION 1 OF 10'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('M48 report an incident has no overflow at $name', (
      tester,
    ) async {
      await _pump(tester, const ReportIncidentScreen(), size, scale);
      expect(find.text('Open incident'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('M48n incident list has no overflow at $name', (tester) async {
      await _pump(
        tester,
        const IncidentsScreen(),
        size,
        scale,
        role: UserRole.programmeCoordinator,
      );
      await tester.scrollUntilVisible(
        find.text('Incident Notifications'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('Incident Notifications'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}
