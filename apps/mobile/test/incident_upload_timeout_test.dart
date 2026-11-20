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

  group('storage requests are released (#128 review)', () {
    IdentityApi api() => IdentityApi(
      baseUrl: 'http://test.invalid',
      client: MockClient((request) async {
        if (request.url.path.endsWith('/complete')) {
          return http.Response('{}', 200);
        }
        return http.Response(
          jsonEncode({
            'evidence': {'id': 'evidence-1'},
            'upload': {
              'method': 'PUT',
              'url': 'https://storage.invalid/evidence-1',
            },
          }),
          201,
        );
      }),
    )..token = 'fictional-token';
    const photo = PickedDocument(
      name: 'photo.jpg',
      bytes: [1, 2, 3],
      contentType: 'image/jpeg',
    );

    test(
      'the deadline aborts the upload instead of leaving it running',
      () async {
        final storage = _StorageClient(
          (request) => Completer<http.StreamedResponse>().future,
        );
        final incidents = HttpIncidentApi(
          api(),
          uploadClient: storage,
          uploadTimeout: const Duration(milliseconds: 50),
        );
        await expectLater(
          incidents.addPhoto('assessment-1', photo),
          throwsA(
            isA<IncidentException>().having((e) => e.offline, 'offline', true),
          ),
        );
        final sent = storage.requests.single;
        expect(sent, isA<http.Abortable>());
        // The trigger has fired, so the client cancels the connection.
        await (sent as http.Abortable).abortTrigger!.timeout(
          const Duration(seconds: 1),
        );
      },
    );

    for (final status in [200, 500]) {
      test('the storage response is read when it answers $status', () async {
        var read = false;
        final storage = _StorageClient(
          (request) async => http.StreamedResponse(
            Stream.value(utf8.encode('<Error/>')).map((chunk) {
              read = true;
              return chunk;
            }),
            status,
          ),
        );
        final incidents = HttpIncidentApi(api(), uploadClient: storage);
        final result = incidents.addPhoto('assessment-1', photo);
        if (status == 200) {
          await result;
        } else {
          await expectLater(result, throwsA(isA<IncidentException>()));
        }
        expect(read, isTrue);
      });
    }
  });
}

/// A storage client that records each request and answers with [reply].
class _StorageClient extends http.BaseClient {
  _StorageClient(this.reply);
  final Future<http.StreamedResponse> Function(http.BaseRequest request) reply;
  final requests = <http.BaseRequest>[];

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) {
    requests.add(request);
    return reply(request);
  }
}
