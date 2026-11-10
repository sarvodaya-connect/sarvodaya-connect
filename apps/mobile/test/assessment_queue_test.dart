import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/incidents/assessment_queue.dart';
import 'package:sarvodaya_connect_mobile/src/incidents/demo_incident_api.dart';
import 'package:sarvodaya_connect_mobile/src/incidents/incident_api.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_models.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';

import 'test_helpers.dart';

/// Issue #125: the offline rapid-assessment queue. Everything here is fictional.

/// Behaves like the API: one record per clientMutationId, and it can be told
/// to drop the connection or refuse with an HTTP status.
class _FakeApi extends DemoIncidentApi {
  _FakeApi() : super(clock: () => demoNow);

  final received = <String, Map<String, dynamic>>{};
  final photos = <String, int>{};
  bool offline = false;
  int? refuse;
  String refuseMessage = 'Refused';

  /// The server stores it, then the response is lost on the way back.
  bool loseResponse = false;
  bool photoOffline = false;
  int sendCalls = 0;

  @override
  Future<String> sendAssessment(
    String incidentId,
    String societyId,
    String clientMutationId,
    AssessmentAnswers answers,
  ) async {
    sendCalls++;
    if (offline) {
      throw const IncidentException('offline', offline: true);
    }
    if (refuse != null) {
      throw IncidentException(refuseMessage, status: refuse);
    }
    received.putIfAbsent(
      clientMutationId,
      () => answers.toJson(clientMutationId, societyId),
    );
    if (loseResponse) {
      loseResponse = false;
      throw const IncidentException('offline', offline: true);
    }
    return 'assessment-$clientMutationId';
  }

  @override
  Future<void> addPhoto(String assessmentId, PickedDocument photo) async {
    if (photoOffline) {
      throw const IncidentException('offline', offline: true);
    }
    photos[assessmentId] = (photos[assessmentId] ?? 0) + 1;
  }
}

final _incident = IncidentSummary(
  id: 'incident-1',
  reference: 'INC-2026-09',
  title: 'Floods — Fictional District',
  type: 'FLOOD',
  isClosed: false,
  areaNames: const ['Fictional North'],
  openedByName: 'N. Fictional',
  openedByRole: 'SOCIETY_OFFICER',
  openedAt: DateTime.utc(2026, 11, 1),
  societiesInArea: 2,
  assessed: 0,
);

AssessmentAnswers _answers({int photos = 0}) => AssessmentAnswers()
  ..impact = 'CRITICAL'
  ..families = 12
  ..people = 40
  ..note = 'Fictional note about the bridge'
  ..photos.addAll([
    for (var i = 0; i < photos; i++)
      PickedDocument(
        name: 'photo-$i.jpg',
        bytes: List.filled(64, i + 1),
        contentType: 'image/jpeg',
      ),
  ]);

void main() {
  late Directory root;
  late MemoryQueueKeyStore keys;
  late _FakeApi api;
  String? account = 'account-a';

  AssessmentQueue queue() => AssessmentQueue(
    storage: EncryptedFileQueueStorage(keys: keys, root: () async => root),
    accountId: () => account,
    api: () => api,
    clock: () => demoNow,
  );

  Future<QueuedAssessment> save(
    AssessmentQueue q, {
    String? id,
    int photos = 0,
  }) => q.save(
    incident: _incident,
    societyId: 'society-1',
    societyName: 'Fictional North One',
    clientMutationId: id ?? newClientMutationId(),
    answers: _answers(photos: photos),
  );

  setUp(() async {
    root = await Directory.systemTemp.createTemp('assessment-queue-test');
    keys = MemoryQueueKeyStore();
    api = _FakeApi();
    account = 'account-a';
  });

  tearDown(() => root.delete(recursive: true));

  test(
    'a saved assessment survives a relaunch and is encrypted on disk',
    () async {
      final first = queue();
      await save(first, photos: 1);
      // A new queue object with the same storage is the app after a relaunch.
      final relaunched = queue();
      final items = await relaunched.load();
      expect(items, hasLength(1));
      expect(items.single.societyName, 'Fictional North One');
      expect(items.single.answers['note'], 'Fictional note about the bridge');
      expect(items.single.photos.single.sent, isFalse);

      final files = root.listSync(recursive: true).whereType<File>().toList();
      expect(files, hasLength(2));
      for (final file in files) {
        final raw = String.fromCharCodes(file.readAsBytesSync());
        expect(raw.contains('Fictional'), isFalse, reason: file.path);
        expect(raw.contains('CRITICAL'), isFalse, reason: file.path);
      }
      // The folder name is a hash, not the account id.
      expect(files.first.path.contains('account-a'), isFalse);
    },
  );

  test('another account never sees or reads someone else\'s queue', () async {
    final q = queue();
    await save(q);
    account = 'account-b';
    expect(q.items, isEmpty);
    expect(await q.load(), isEmpty);
    await save(q);
    expect(q.items, hasLength(1));

    // Even a copy of A's file in B's folder cannot be read with B's key.
    final aFolder = Directory(
      '${root.path}/${EncryptedFileQueueStorage.accountFolder('account-a')}',
    );
    final bFolder = Directory(
      '${root.path}/${EncryptedFileQueueStorage.accountFolder('account-b')}',
    );
    File('${aFolder.path}/queue.bin').copySync('${bFolder.path}/queue.bin');
    expect(await q.load(), isEmpty);

    account = 'account-a';
    expect(await q.load(), hasLength(1));
    account = null;
    expect(q.items, isEmpty);
  });

  test(
    'offline keeps it, and a retry sends it once with the same id',
    () async {
      final q = queue();
      api.offline = true;
      final saved = await save(q);
      final first = await q.sync();
      expect(first.sent, 0);
      expect(q.items.single.problem, QueueProblem.offline);
      expect(q.items.single.blocked, isFalse);
      expect(q.items.single.attempts, 1);

      api.offline = false;
      final second = await q.sync();
      expect(second.sent, 1);
      expect(q.items, isEmpty);
      expect(api.received.keys, [saved.clientMutationId]);
      final again = await q.sync();
      expect(again.sent, 0);
      expect(api.sendCalls, 2);
    },
  );

  test('a lost response does not create a duplicate', () async {
    final q = queue();
    final saved = await save(q);
    api.loseResponse = true;
    await q.sync();
    expect(q.items.single.problem, QueueProblem.offline);
    expect(api.received, hasLength(1));
    await q.sync();
    expect(q.items, isEmpty);
    expect(api.received.keys, [saved.clientMutationId]);
  });

  test('photos are kept until each one arrives, and the assessment is not sent twice', () async {
    final q = queue();
    api.photoOffline = true;
    await save(q, photos: 2);
    await q.sync();
    final item = q.items.single;
    expect(item.assessmentId, isNotNull);
    expect(item.photosLeft, 2);
    expect(api.sendCalls, 1);

    api.photoOffline = false;
    await q.sync();
    expect(q.items, isEmpty);
    expect(api.sendCalls, 1);
    expect(api.photos[item.assessmentId], 2);
    expect(
      root
          .listSync(recursive: true)
          .whereType<File>()
          .where((f) => f.path.contains('photo-')),
      isEmpty,
    );
  });

  test('refusals are kept and explained, and nothing is overwritten', () async {
    for (final (status, message, problem, blocked) in [
      (401, 'Sign in to continue', QueueProblem.signIn, false),
      (
        403,
        'You can send an assessment only for a society you look after',
        QueueProblem.noAccess,
        true,
      ),
      (404, 'Incident not found', QueueProblem.noAccess, true),
      (409, 'This incident is closed', QueueProblem.closed, true),
      (
        409,
        'This assessment ID was already used for another society',
        QueueProblem.rejected,
        true,
      ),
      (400, 'Request validation failed', QueueProblem.rejected, true),
      (503, 'Busy', QueueProblem.server, false),
    ]) {
      final q = queue();
      api
        ..refuse = status
        ..refuseMessage = message;
      final saved = await save(q);
      await q.sync();
      final item = q.items.firstWhere(
        (i) => i.clientMutationId == saved.clientMutationId,
      );
      expect(item.problem, problem, reason: '$status $message');
      expect(item.blocked, blocked, reason: '$status');
      expect(item.message, message);
      await q.discard(saved.clientMutationId);
    }
    expect(queue().items, isEmpty);
  });

  test('discarding removes the answers and photos from the phone', () async {
    final q = queue();
    api.offline = true;
    final saved = await save(q, photos: 1);
    await q.discard(saved.clientMutationId);
    expect(q.items, isEmpty);
    expect(await queue().load(), isEmpty);
    expect(
      root
          .listSync(recursive: true)
          .whereType<File>()
          .where((f) => f.path.contains('photo-')),
      isEmpty,
    );
  });

  test('two retries at once share one round', () async {
    final q = queue();
    await save(q);
    final results = await Future.wait([q.sync(), q.sync()]);
    expect(api.sendCalls, 1);
    expect(results.first.sent, 1);
  });

  test('signing out keeps nothing in memory for the next person', () async {
    final store = DemoStore(loadDelay: Duration.zero, clock: () => demoNow)
      ..switchDemoRole(UserRole.societyOfficer);
    await store.assessments.save(
      incident: _incident,
      societyId: 'society-1',
      societyName: 'Fictional North One',
      clientMutationId: newClientMutationId(),
      answers: _answers(),
    );
    expect(store.assessments.items, hasLength(1));
    store.signOut();
    expect(store.assessments.items, isEmpty);
  });
}
