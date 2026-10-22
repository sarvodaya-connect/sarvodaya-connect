import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/services/emergency_api_client.dart';
import 'package:sarvodaya_connect_mobile/src/services/emergency_assessment_queue.dart';

void main() {
  late Directory directory;

  setUp(() async {
    directory = await Directory.systemTemp.createTemp('sc-emergency-queue-');
  });

  tearDown(() async {
    await directory.delete(recursive: true);
  });

  test('saved assessments survive reopening the local queue', () async {
    final queue = await EmergencyAssessmentQueue.open(documentsDirectory: directory);
    await queue.save({'clientMutationId': 'mutation-1', 'notes': 'fictional'});

    final reopened = await EmergencyAssessmentQueue.open(documentsDirectory: directory);
    final items = await reopened.all();
    expect(items, hasLength(1));
    expect(items.single.payload['notes'], 'fictional');
  });

  test('sync removes confirmed records but preserves failed records and errors', () async {
    final queue = await EmergencyAssessmentQueue.open(documentsDirectory: directory);
    await queue.save({'clientMutationId': 'confirmed', 'notes': 'fictional'});
    await queue.save({'clientMutationId': 'retry', 'notes': 'fictional'});
    final api = EmergencyApiClient(
      client: MockClient((request) async => request.body.contains('confirmed')
          ? http.Response('{"record":{},"replayed":false}', 200)
          : http.Response('{"message":"temporarily unavailable"}', 503)),
    );

    expect(await queue.sync(api, UserRole.societyOfficer), 1);
    final pending = await queue.all();
    expect(pending, hasLength(1));
    expect(pending.single.clientMutationId, 'retry');
    expect(pending.single.lastError, contains('temporarily unavailable'));
    api.close();
  });
}
