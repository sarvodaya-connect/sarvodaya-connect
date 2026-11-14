import 'dart:async';
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

  /// Runs inside a send before it answers, to act while it is in flight.
  Future<void> Function(String clientMutationId)? beforeSend;

  /// Runs inside a photo upload before it checks the session.
  Future<void> Function()? beforePhoto;
  int photoCalls = 0;

  @override
  Future<String> sendAssessment(
    String incidentId,
    String societyId,
    String clientMutationId,
    AssessmentAnswers answers, {
    bool Function()? stillSignedIn,
  }) async {
    sendCalls++;
    await beforeSend?.call(clientMutationId);
    if (stillSignedIn != null && !stillSignedIn()) {
      throw const IncidentException('Sign in again', status: 401);
    }
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
  Future<void> addPhoto(
    String assessmentId,
    PickedDocument photo, {
    bool Function()? stillSignedIn,
  }) async {
    photoCalls++;
    await beforePhoto?.call();
    if (stillSignedIn != null && !stillSignedIn()) {
      throw const IncidentException('Sign in again', status: 401);
    }
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

  test('a 401 that signs the user out keeps every saved assessment', () async {
    final q = queue();
    final first = await save(q);
    final second = await save(q);
    // As in the app: a 401 signs the user out, which clears memory.
    api.beforeSend = (_) async {
      account = null;
      q.forget();
      throw const IncidentException('Sign in again', status: 401);
    };
    await q.sync();
    expect(q.items, isEmpty);

    account = 'account-a';
    api.beforeSend = null;
    final items = await queue().load();
    expect(items.map((i) => i.clientMutationId), [
      first.clientMutationId,
      second.clientMutationId,
    ]);
    expect(items.first.problem, QueueProblem.signIn);
    expect(items.last.problem, isNull);
  });

  test('a save during a retry round is not overwritten', () async {
    final q = queue();
    final first = await save(q);
    final inFlight = Completer<void>();
    final release = Completer<void>();
    api.beforeSend = (id) async {
      if (id != first.clientMutationId) return;
      inFlight.complete();
      await release.future;
    };
    final round = q.sync();
    await inFlight.future;
    final second = await save(q, photos: 1);
    release.complete();
    await round;

    expect(api.received.keys, [first.clientMutationId]);
    expect(q.items.map((i) => i.clientMutationId), [second.clientMutationId]);
    final relaunched = await queue().load();
    expect(relaunched.map((i) => i.clientMutationId), [
      second.clientMutationId,
    ]);
    expect(relaunched.single.photos, hasLength(1));
    expect(
      root.listSync(recursive: true).where((f) => f.path.endsWith('.tmp')),
      isEmpty,
    );
  });

  test('an assessment discarded during a retry round stays removed', () async {
    final q = queue();
    final first = await save(q);
    final inFlight = Completer<void>();
    final release = Completer<void>();
    api
      ..refuse = 403
      ..beforeSend = (_) async {
        inFlight.complete();
        await release.future;
      };
    final round = q.sync();
    await inFlight.future;
    await q.discard(first.clientMutationId);
    release.complete();
    await round;

    expect(q.items, isEmpty);
    expect(await queue().load(), isEmpty);
  });

  test('saves made at the same moment are all kept', () async {
    final q = queue();
    final saved = await Future.wait([save(q), save(q), save(q)]);
    final items = await queue().load();
    expect(
      items.map((i) => i.clientMutationId).toSet(),
      saved.map((i) => i.clientMutationId).toSet(),
    );
  });

  test(
    'nothing more is sent once the account changes during a photo upload',
    () async {
      final q = queue();
      final item = await save(q, photos: 2);
      // Account A signs out and B signs in while the first photo is going up.
      api.beforePhoto = () async {
        account = 'account-b';
        q.forget();
      };
      await q.sync();
      expect(api.received.keys, [item.clientMutationId]);
      expect(api.photos, isEmpty);
      expect(api.photoCalls, 1);
      expect(q.items, isEmpty);

      // A signs in again: both photos are still saved and are sent.
      account = 'account-a';
      api.beforePhoto = null;
      final again = queue();
      final kept = await again.load();
      expect(kept.single.problem, QueueProblem.signIn);
      expect(kept.single.photosLeft, 2);
      await again.sync();
      expect(api.photos['assessment-${item.clientMutationId}'], 2);
      expect(again.items, isEmpty);
    },
  );

  test('an unreadable queue is set aside, not written over', () async {
    final first = await save(queue());
    final file = root
        .listSync(recursive: true)
        .whereType<File>()
        .singleWhere((f) => f.path.endsWith('queue.bin'));
    final damaged = [...file.readAsBytesSync()]..[40] ^= 0xff;
    file.writeAsBytesSync(damaged);

    final q = queue();
    expect(await q.load(), isEmpty);
    final second = await save(q);
    expect(q.items.map((i) => i.clientMutationId), [second.clientMutationId]);
    final setAside = root
        .listSync(recursive: true)
        .whereType<File>()
        .where((f) => f.path.contains('queue.set-aside-'))
        .single;
    expect(setAside.readAsBytesSync(), damaged);
    expect(
      (await queue().load()).map((i) => i.clientMutationId),
      isNot(contains(first.clientMutationId)),
    );
  });

  test('a queue that could not be read for a moment comes back', () async {
    final storage = _FlakyStorage(
      EncryptedFileQueueStorage(keys: keys, root: () async => root),
    );
    AssessmentQueue flakyQueue() => AssessmentQueue(
      storage: storage,
      accountId: () => account,
      api: () => api,
      clock: () => demoNow,
    );
    final first = await save(flakyQueue());

    storage.failReads = true;
    final q = flakyQueue();
    expect(await q.load(), isEmpty);
    final second = await save(q);
    storage.failReads = false;

    final items = await flakyQueue().load();
    expect(items.map((i) => i.clientMutationId).toSet(), {
      first.clientMutationId,
      second.clientMutationId,
    });
    expect(
      root.listSync(recursive: true).where((f) => f.path.contains('set-aside')),
      isEmpty,
    );
  });

  test('a damaged photo blocks only its own assessment', () async {
    final q = queue();
    final damaged = await save(q, photos: 1);
    final next = await save(q);
    final photo = root
        .listSync(recursive: true)
        .whereType<File>()
        .singleWhere((f) => f.path.endsWith(damaged.photos.single.ref));
    final bytes = [...photo.readAsBytesSync()]..[20] ^= 0xff;
    photo.writeAsBytesSync(bytes);

    final result = await q.sync();
    expect(result.sent, 1);
    expect(result.blocked, 1);
    expect(api.received.keys, [
      damaged.clientMutationId,
      next.clientMutationId,
    ]);
    final left = q.items.single;
    expect(left.clientMutationId, damaged.clientMutationId);
    expect(left.problem, QueueProblem.photoUnreadable);
    expect(left.blocked, isTrue);
    // Kept as it is, for the user to remove.
    expect(left.photosLeft, 1);
  });

  test('photos saved together share one key and can all be read', () async {
    final slowKeys = _SlowKeyStore();
    final storage = EncryptedFileQueueStorage(
      keys: slowKeys,
      root: () async => root,
    );
    final refs = await Future.wait([
      for (var i = 0; i < 3; i++)
        storage.putPhoto('account-a', 'photo-$i.jpg', List.filled(32, i)),
    ]);
    expect(slowKeys.writes, 1);
    for (var i = 0; i < 3; i++) {
      expect(await storage.readPhoto('account-a', refs[i]), List.filled(32, i));
    }
    // A new storage object (the app after a relaunch) reads them too.
    final relaunched = EncryptedFileQueueStorage(
      keys: slowKeys,
      root: () async => root,
    );
    expect(
      await relaunched.readPhoto('account-a', refs[2]),
      List.filled(32, 2),
    );
  });
}

/// Reading the queue fails while [failReads] is set, as a passing storage
/// error would.
class _FlakyStorage implements QueueStorage {
  _FlakyStorage(this._inner);
  final QueueStorage _inner;
  bool failReads = false;

  @override
  Future<String?> readQueue(String accountId) {
    if (failReads) throw const FileSystemException('Storage busy');
    return _inner.readQueue(accountId);
  }

  @override
  Future<void> writeQueue(String accountId, String json) =>
      _inner.writeQueue(accountId, json);

  @override
  Future<void> setAsideQueue(String accountId) =>
      _inner.setAsideQueue(accountId);

  @override
  Future<Map<String, String>> readSetAside(String accountId) async =>
      failReads ? const {} : _inner.readSetAside(accountId);

  @override
  Future<void> deleteSetAside(String accountId, String name) =>
      _inner.deleteSetAside(accountId, name);

  @override
  Future<String> putPhoto(String accountId, String name, List<int> bytes) =>
      _inner.putPhoto(accountId, name, bytes);

  @override
  Future<List<int>> readPhoto(String accountId, String ref) =>
      _inner.readPhoto(accountId, ref);

  @override
  Future<void> deletePhoto(String accountId, String ref) =>
      _inner.deletePhoto(accountId, ref);
}

/// The phone's key store answers after a moment, as the real Keychain does.
class _SlowKeyStore extends MemoryQueueKeyStore {
  int writes = 0;

  @override
  Future<List<int>?> read(String name) async {
    await Future<void>.delayed(const Duration(milliseconds: 5));
    return super.read(name);
  }

  @override
  Future<void> write(String name, List<int> key) async {
    writes++;
    await Future<void>.delayed(const Duration(milliseconds: 5));
    return super.write(name, key);
  }
}
