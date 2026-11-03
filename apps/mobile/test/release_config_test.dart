import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/app.dart';
import 'package:sarvodaya_connect_mobile/src/auth/api_auth_service.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';

/// V5 PR 10: release builds must point at the real API over HTTPS and must
/// not show sample data unless they are explicitly built for a demonstration.
void main() {
  test('debug builds may use the local development server', () {
    expect(
      IdentityApi.configurationProblem(release: false, configured: ''),
      isNull,
    );
  });

  test('a release build needs an https API address', () {
    expect(
      IdentityApi.configurationProblem(release: true, configured: ''),
      contains('API_BASE_URL'),
    );
    expect(
      IdentityApi.configurationProblem(
        release: true,
        configured: 'http://10.0.2.2:3001/api/v1',
      ),
      'The server address must start with https://.',
    );
    expect(
      IdentityApi.configurationProblem(
        release: true,
        configured: 'https:///api/v1',
      ),
      isNotNull,
    );
    expect(
      IdentityApi.configurationProblem(
        release: true,
        configured: 'https://api.sarvodaya-connect.invalid/api/v1',
      ),
      isNull,
    );
  });

  test(
    'sample data is on only outside release builds (tests run in debug mode)',
    () {
      expect(DemoStore.demoMode, isTrue);
    },
  );

  testWidgets('a misconfigured build explains itself instead of signing in', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: ConfigurationProblemScreen(
          message: IdentityApi.configurationProblem(
            release: true,
            configured: '',
          )!,
        ),
      ),
    );
    expect(find.text('This app is not set up yet'), findsOneWidget);
    expect(
      find.textContaining('--dart-define=API_BASE_URL=https://'),
      findsOneWidget,
    );
  });
}
