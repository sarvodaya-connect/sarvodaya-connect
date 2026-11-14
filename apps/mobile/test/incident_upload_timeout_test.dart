import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sarvodaya_connect_mobile/src/auth/api_auth_service.dart';
import 'package:sarvodaya_connect_mobile/src/incidents/incident_api.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_models.dart';

/// Issue #125: a photo upload that stalls ends, so a saved assessment is
/// marked as waiting and retried instead of holding up sending for ever.
/// Everything here is fictional.
void main() {
  test('a stalled photo upload ends as offline after the timeout', () async {
    final api = IdentityApi(
      baseUrl: 'http://test.invalid',
      client: MockClient(
        (request) async => http.Response(
          jsonEncode({
            'evidence': {'id': 'evidence-1'},
            'upload': {
              'method': 'PUT',
              'url': 'https://storage.invalid/evidence-1',
            },
          }),
          201,
        ),
      ),
    )..token = 'fictional-token';
    final incidents = HttpIncidentApi(
      api,
      uploadClient: MockClient((request) => Completer<http.Response>().future),
      uploadTimeout: const Duration(milliseconds: 50),
    );
    await expectLater(
      incidents.addPhoto(
        'assessment-1',
        const PickedDocument(
          name: 'photo.jpg',
          bytes: [1, 2, 3],
          contentType: 'image/jpeg',
        ),
      ),
      throwsA(
        isA<IncidentException>().having((e) => e.offline, 'offline', true),
      ),
    );
  });
}
