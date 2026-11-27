import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sarvodaya_connect_mobile/src/auth/api_auth_service.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/activity_screens.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_api.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';

const _activity = 'Youth leadership camp';

Map<String, dynamic> _response({
  Map<String, dynamic>? classification,
  String status = 'APPROVED',
  List<int> sdgs = const [4],
}) => {
  'id': 'activity',
  'month': 9,
  'year': 2027,
  'allocatedCost': 100,
  'name': _activity,
  'status': status,
  'dimension': 'ECONOMIC',
  'sector': 'Economy',
  'sdgs': sdgs,
  'classification': classification,
  'society': {'id': 'society', 'name': 'Example Society'},
  'permissions': {'canReview': false, 'canEdit': false},
};

const _classification = {
  'dimensions': ['GOVERNANCE', 'SOCIAL'],
  'categories': ['ENVIRONMENT', 'COMMUNITY_EDUCATION'],
};

Future<void> _open(
  WidgetTester tester,
  UserRole role,
  Future<http.Response> Function(http.Request) handler,
) async {
  final api = HttpSocietyRecordApi(
    IdentityApi(baseUrl: 'https://api.test/api/v1', client: MockClient(handler))
      ..token = 'session',
  );
  final store = DemoStore(
    demo: true,
    loadDelay: Duration.zero,
    societyRecordApi: api,
  )..switchDemoRole(role);
  addTearDown(store.dispose);
  tester.view.physicalSize = const Size(420, 1800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    DemoScope(
      store: store,
      child: MaterialApp(
        theme: AppTheme.light(),
        home: const ActivityDetailScreen(
          activityId: 'activity',
          societyName: 'Example Society',
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  for (final role in UserRole.values) {
    testWidgets('shows saved Development Goals read-only for ${role.name}', (
      tester,
    ) async {
      await _open(tester, role, (request) async {
        expect(request.url.path, '/api/v1/activities/activity');
        return http.Response(
          jsonEncode(_response(classification: _classification)),
          200,
        );
      });

      expect(find.text('Sarvodaya dimensions'), findsOneWidget);
      expect(find.text('Sarvodaya categories'), findsOneWidget);
      expect(find.text('Social'), findsOneWidget);
      expect(find.text('Governance'), findsOneWidget);
      expect(
        tester.getTopLeft(find.text('Social')).dx,
        lessThan(tester.getTopLeft(find.text('Governance')).dx),
      );
      expect(find.text('Environment'), findsOneWidget);
      expect(find.text('Quality Education'), findsOneWidget);
      expect(
        find.widgetWithText(FilledButton, 'Change Activity'),
        findsNothing,
      );
    });
  }

  testWidgets('keeps SDGs on legacy approvals and ignores the old dimension', (
    tester,
  ) async {
    await _open(
      tester,
      UserRole.societyOfficer,
      (_) async => http.Response(jsonEncode(_response()), 200),
    );
    expect(
      find.text('Sarvodaya classification not yet recorded.'),
      findsOneWidget,
    );
    expect(find.text('Sarvodaya dimensions'), findsNothing);
    expect(find.text('Quality Education'), findsOneWidget);
  });

  testWidgets('explains when the SPC will classify a pending activity', (
    tester,
  ) async {
    await _open(
      tester,
      UserRole.societyOfficer,
      (_) async =>
          http.Response(jsonEncode(_response(status: 'WAITING_FOR_SPC')), 200),
    );
    expect(
      find.text('The SPC selects the Development Goals during approval.'),
      findsOneWidget,
    );
    expect(find.text('Quality Education'), findsNothing);
  });

  for (final status in [403, 404]) {
    testWidgets('clears details after temporary access is refused ($status)', (
      tester,
    ) async {
      var denied = false;
      await _open(
        tester,
        UserRole.deputyDistrictManager,
        (_) async => denied
            ? http.Response('{"message":"Activity not found"}', status)
            : http.Response(
                jsonEncode(_response(classification: _classification)),
                200,
              ),
      );
      expect(find.text(_activity), findsOneWidget);
      denied = true;
      tester.state<RefreshIndicatorState>(find.byType(RefreshIndicator)).show();
      await tester.pumpAndSettle();
      expect(find.text("You can't open this activity"), findsOneWidget);
      expect(find.text(_activity), findsNothing);
      expect(find.text('Development Goals'), findsNothing);
    });
  }
}
