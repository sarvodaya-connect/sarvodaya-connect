import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sarvodaya_connect_mobile/src/auth/api_auth_service.dart';
import 'package:sarvodaya_connect_mobile/src/incidents/incident_api.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_models.dart';

/// Issue #125: each saved photo is sent with its own clientUploadId, and a
/// photo the API already completed is not uploaded or completed again.
/// Everything here is fictional.
const _photoId = '55555555-5555-4555-8555-555555555555';
const _photo = PickedDocument(
  name: 'photo.jpg',
  bytes: [1, 2, 3],
  contentType: 'image/jpeg',
);

void main() {
  late List<http.Request> apiCalls;
  late List<http.BaseRequest> storageCalls;

  HttpIncidentApi incidents(http.Response Function(http.Request) answer) {
    apiCalls = [];
    storageCalls = [];
    final api = IdentityApi(
      baseUrl: 'http://test.invalid',
      client: MockClient((request) async {
        apiCalls.add(request);
        return answer(request);
      }),
    )..token = 'fictional-token';
    return HttpIncidentApi(
      api,
      uploadClient: MockClient((request) async {
        storageCalls.add(request);
        return http.Response('', 200);
      }),
    );
  }

  http.Response json(Object body, [int status = 201]) =>
      http.Response(jsonEncode(body), status);

  test('sends the photo id and uploads a new photo once', () async {
    final api = incidents(
      (request) => request.url.path.endsWith('/complete')
          ? json({'id': 'evidence-1', 'uploaded': true})
          : json({
              'evidence': {'id': 'evidence-1', 'uploaded': false},
              'upload': {
                'method': 'PUT',
                'url': 'https://storage.invalid/evidence-1',
              },
            }),
    );
    await api.addPhoto('assessment-1', _photo, clientUploadId: _photoId);
    expect(
      jsonDecode(apiCalls.first.body),
      containsPair('clientUploadId', _photoId),
    );
    expect(storageCalls, hasLength(1));
    expect(apiCalls.last.url.path, endsWith('/evidence/evidence-1/complete'));
  });

  test('a photo the API already has is confirmed without uploading or completing again', () async {
    final api = incidents(
      (request) => json({
        'evidence': {'id': 'evidence-1', 'uploaded': true},
        'upload': null,
      }),
    );
    await api.addPhoto('assessment-1', _photo, clientUploadId: _photoId);
    expect(apiCalls, hasLength(1));
    // The stored file is never sent again.
    expect(storageCalls, isEmpty);
  });

  test('an older API that answers a repeated completion with 409 still counts as done', () async {
    final api = incidents(
      (request) => request.url.path.endsWith('/complete')
          ? json({'message': 'This photo has already been uploaded'}, 409)
          : json({
              'evidence': {'id': 'evidence-1'},
              'upload': {
                'method': 'PUT',
                'url': 'https://storage.invalid/evidence-1',
              },
            }),
    );
    await api.addPhoto('assessment-1', _photo, clientUploadId: _photoId);
    expect(storageCalls, hasLength(1));
  });

  test('without an id the request is as before', () async {
    final api = incidents(
      (request) => request.url.path.endsWith('/complete')
          ? json({'id': 'evidence-1', 'uploaded': true})
          : json({
              'evidence': {'id': 'evidence-1'},
              'upload': {
                'method': 'PUT',
                'url': 'https://storage.invalid/evidence-1',
              },
            }),
    );
    await api.addPhoto('assessment-1', _photo);
    expect(
      (jsonDecode(apiCalls.first.body) as Map).keys,
      unorderedEquals(['contentType', 'sizeBytes', 'checksumSha256']),
    );
  });
}
