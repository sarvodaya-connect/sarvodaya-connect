import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:crypto/crypto.dart' as crypto;
import 'package:cryptography/cryptography.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path_provider/path_provider.dart';

import '../society_record/society_record_models.dart' show PickedDocument;
import 'incident_api.dart';

/// Issue #125: rapid assessments saved on the phone before they are sent, so
/// a dropped connection never loses one. Each signed-in account has its own
/// encrypted queue; an item leaves the phone only after the API confirms the
/// assessment and every photo.
///
/// Delivery happens while the app is open: when the assessment is sent, when
/// a disaster screen is opened or refreshed, and when the user taps Retry.
/// Nothing is sent in the background after the app is closed.

/// A random UUID v4, kept with the assessment so every retry is the same send.
String newClientMutationId() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

/// Why a saved assessment has not been sent yet.
enum QueueProblem {
  /// No connection: it is retried later.
  offline,

  /// The server failed: it is retried later.
  server,

  /// The session ended: send it after signing in again.
  signIn,

  /// The user no longer covers this society or incident, for example after
  /// temporary district access ended.
  noAccess,

  /// The incident was closed before it arrived.
  closed,

  /// The server refused the answers.
  rejected,

  /// A photo saved with it can no longer be read on this phone (damaged, or
  /// it fails decryption). Retrying cannot help, so it waits to be removed.
  photoUnreadable,
}

extension QueueProblemRetry on QueueProblem {
  /// Offline and server problems clear up on their own; the others need the
  /// user to act, so the item is shown as blocked.
  bool get blocked =>
      this == QueueProblem.noAccess ||
      this == QueueProblem.closed ||
      this == QueueProblem.rejected ||
      this == QueueProblem.photoUnreadable;
}

QueueProblem problemOf(IncidentException error) {
  if (error.offline) return QueueProblem.offline;
  final status = error.status;
  if (status == null || status >= 500) return QueueProblem.server;
  if (status == 401) return QueueProblem.signIn;
  if (status == 403 || status == 404) return QueueProblem.noAccess;
  if (status == 409 && error.message.toLowerCase().contains('closed')) {
    return QueueProblem.closed;
  }
  return QueueProblem.rejected;
}

class QueuedPhoto {
  const QueuedPhoto({
    required this.ref,
    required this.name,
    required this.contentType,
    required this.sizeBytes,
    this.uploadId,
    this.sent = false,
  });

  factory QueuedPhoto.fromJson(Map<String, dynamic> json) => QueuedPhoto(
    ref: json['ref'] as String,
    name: json['name'] as String,
    contentType: json['contentType'] as String,
    sizeBytes: json['sizeBytes'] as int,
    uploadId: json['uploadId'] as String?,
    sent: json['sent'] == true,
  );

  /// Where the encrypted copy is kept on the phone.
  final String ref;
  final String name;
  final String contentType;
  final int sizeBytes;

  /// The API's `clientUploadId` for this photo, the same on every retry, so a
  /// retry after a lost answer confirms the photo instead of adding another.
  /// Null only for items saved before it existed; one is given and saved
  /// before such a photo is sent.
  final String? uploadId;
  final bool sent;

  QueuedPhoto _with({String? uploadId, bool? sent}) => QueuedPhoto(
    ref: ref,
    name: name,
    contentType: contentType,
    sizeBytes: sizeBytes,
    uploadId: uploadId ?? this.uploadId,
    sent: sent ?? this.sent,
  );

  QueuedPhoto markSent() => _with(sent: true);

  QueuedPhoto withUploadId(String id) => _with(uploadId: id);

  Map<String, dynamic> toJson() => {
    'ref': ref,
    'name': name,
    'contentType': contentType,
    'sizeBytes': sizeBytes,
    'uploadId': ?uploadId,
    'sent': sent,
  };
}

class QueuedAssessment {
  const QueuedAssessment({
    required this.clientMutationId,
    required this.incidentId,
    required this.incidentReference,
    required this.societyId,
    required this.societyName,
    required this.answers,
    required this.photos,
    required this.savedAt,
    this.assessmentId,
    this.problem,
    this.message,
    this.attempts = 0,
    this.lastAttemptAt,
  });

  factory QueuedAssessment.fromJson(Map<String, dynamic> json) =>
      QueuedAssessment(
        clientMutationId: json['clientMutationId'] as String,
        incidentId: json['incidentId'] as String,
        incidentReference: json['incidentReference'] as String,
        societyId: json['societyId'] as String,
        societyName: json['societyName'] as String,
        answers: Map<String, dynamic>.from(json['answers'] as Map),
        photos: [
          for (final photo in (json['photos'] as List? ?? const []))
            QueuedPhoto.fromJson(Map<String, dynamic>.from(photo as Map)),
        ],
        savedAt: DateTime.parse(json['savedAt'] as String),
        assessmentId: json['assessmentId'] as String?,
        problem: switch (json['problem']) {
          final String name => QueueProblem.values.byName(name),
          _ => null,
        },
        message: json['message'] as String?,
        attempts: json['attempts'] as int? ?? 0,
        lastAttemptAt: switch (json['lastAttemptAt']) {
          final String at => DateTime.parse(at),
          _ => null,
        },
      );

  /// The same id on every retry, so the API never records it twice.
  final String clientMutationId;
  final String incidentId;
  final String incidentReference;
  final String societyId;
  final String societyName;

  /// The answers as the API takes them (`AssessmentAnswers.toJson`).
  final Map<String, dynamic> answers;
  final List<QueuedPhoto> photos;
  final DateTime savedAt;

  /// Set once the API has the assessment; only photos are left after that.
  final String? assessmentId;
  final QueueProblem? problem;

  /// The server's own words for the last refusal, if it gave any.
  final String? message;
  final int attempts;
  final DateTime? lastAttemptAt;

  bool get blocked => problem?.blocked ?? false;
  int get photosLeft => photos.where((p) => !p.sent).length;

  QueuedAssessment copyWith({
    String? assessmentId,
    List<QueuedPhoto>? photos,
    QueueProblem? problem,
    String? message,
    bool clearProblem = false,
    int? attempts,
    DateTime? lastAttemptAt,
  }) => QueuedAssessment(
    clientMutationId: clientMutationId,
    incidentId: incidentId,
    incidentReference: incidentReference,
    societyId: societyId,
    societyName: societyName,
    answers: answers,
    photos: photos ?? this.photos,
    savedAt: savedAt,
    assessmentId: assessmentId ?? this.assessmentId,
    problem: clearProblem ? null : (problem ?? this.problem),
    message: clearProblem ? null : (message ?? this.message),
    attempts: attempts ?? this.attempts,
    lastAttemptAt: lastAttemptAt ?? this.lastAttemptAt,
  );

  Map<String, dynamic> toJson() => {
    'clientMutationId': clientMutationId,
    'incidentId': incidentId,
    'incidentReference': incidentReference,
    'societyId': societyId,
    'societyName': societyName,
    'answers': answers,
    'photos': [for (final photo in photos) photo.toJson()],
    'savedAt': savedAt.toIso8601String(),
    'assessmentId': ?assessmentId,
    'problem': ?problem?.name,
    'message': ?message,
    'attempts': attempts,
    'lastAttemptAt': ?lastAttemptAt?.toIso8601String(),
  };
}

/// Where each account's queue and photos are kept.
abstract interface class QueueStorage {
  Future<String?> readQueue(String accountId);
  Future<void> writeQueue(String accountId, String json);

  /// Keeps a queue that cannot be read under another name, so a new queue
  /// never overwrites it.
  Future<void> setAsideQueue(String accountId);

  /// The queues set aside earlier that can be read now, by name. Ones that
  /// still cannot be read are left where they are.
  Future<Map<String, String>> readSetAside(String accountId);
  Future<void> deleteSetAside(String accountId, String name);

  Future<String> putPhoto(String accountId, String name, List<int> bytes);
  Future<List<int>> readPhoto(String accountId, String ref);
  Future<void> deletePhoto(String accountId, String ref);
}

/// Demonstration mode and tests: nothing is written to the phone.
class MemoryQueueStorage implements QueueStorage {
  final _queues = <String, String>{};
  final _setAside = <String, Map<String, String>>{};
  final _photos = <String, List<int>>{};
  var _next = 0;

  @override
  Future<String?> readQueue(String accountId) async => _queues[accountId];

  @override
  Future<void> writeQueue(String accountId, String json) async =>
      _queues[accountId] = json;

  @override
  Future<void> setAsideQueue(String accountId) async {
    final queue = _queues.remove(accountId);
    if (queue != null) {
      (_setAside[accountId] ??= {})['set-aside-${_next++}'] = queue;
    }
  }

  @override
  Future<Map<String, String>> readSetAside(String accountId) async =>
      Map.of(_setAside[accountId] ?? const {});

  @override
  Future<void> deleteSetAside(String accountId, String name) async =>
      _setAside[accountId]?.remove(name);

  @override
  Future<String> putPhoto(
    String accountId,
    String name,
    List<int> bytes,
  ) async {
    final ref = '$accountId/${_next++}';
    _photos[ref] = List.of(bytes);
    return ref;
  }

  @override
  Future<List<int>> readPhoto(String accountId, String ref) async {
    if (!ref.startsWith('$accountId/') || !_photos.containsKey(ref)) {
      throw const FileSystemException('Photo not found');
    }
    return _photos[ref]!;
  }

  @override
  Future<void> deletePhoto(String accountId, String ref) async =>
      _photos.remove(ref);
}

/// Holds one random key per account.
abstract interface class QueueKeyStore {
  Future<List<int>?> read(String name);
  Future<void> write(String name, List<int> key);
}

/// The phone's Keychain (iOS) or Keystore-backed storage (Android).
class SecureQueueKeyStore implements QueueKeyStore {
  const SecureQueueKeyStore([this._storage = const FlutterSecureStorage()]);

  final FlutterSecureStorage _storage;

  @override
  Future<List<int>?> read(String name) async {
    final value = await _storage.read(key: name);
    return value == null ? null : base64Decode(value);
  }

  @override
  Future<void> write(String name, List<int> key) =>
      _storage.write(key: name, value: base64Encode(key));
}

class MemoryQueueKeyStore implements QueueKeyStore {
  final keys = <String, List<int>>{};

  @override
  Future<List<int>?> read(String name) async => keys[name];

  @override
  Future<void> write(String name, List<int> key) async => keys[name] = key;
}

/// The real store: one folder per account, named by a hash of the account id,
/// with every file encrypted by AES-256-GCM under that account's own key. The
/// folder sits in the app's private support directory, not in shared storage.
class EncryptedFileQueueStorage implements QueueStorage {
  EncryptedFileQueueStorage({
    this._keys = const SecureQueueKeyStore(),
    Future<Directory> Function()? root,
  }) : _root = root ?? _defaultRoot;

  final QueueKeyStore _keys;
  final Future<Directory> Function() _root;
  final _cipher = AesGcm.with256bits();
  var _next = 0;

  static Future<Directory> _defaultRoot() async => Directory(
    '${(await getApplicationSupportDirectory()).path}/assessment-queue',
  );

  static String accountFolder(String accountId) =>
      crypto.sha256.convert(utf8.encode(accountId)).toString().substring(0, 32);

  Future<Directory> _folder(String accountId) async {
    final folder = Directory(
      '${(await _root()).path}/${accountFolder(accountId)}',
    );
    await folder.create(recursive: true);
    return folder;
  }

  /// One key lookup per account at a time. Without this, two photos saved
  /// together could each find no key, create different ones, and leave the
  /// photo encrypted with the key that lost unreadable.
  final _keyLoads = <String, Future<SecretKey>>{};

  Future<SecretKey> _key(String accountId) =>
      _keyLoads[accountId] ??= _loadKey(accountId).then(
        (key) => key,
        onError: (Object error, StackTrace stack) {
          // Try again next time instead of keeping the failure.
          _keyLoads.remove(accountId);
          Error.throwWithStackTrace(error, stack);
        },
      );

  Future<SecretKey> _loadKey(String accountId) async {
    final name = 'sc.assessmentQueue.${accountFolder(accountId)}';
    final existing = await _keys.read(name);
    if (existing != null) return SecretKey(existing);
    final created = await _cipher.newSecretKey();
    await _keys.write(name, await created.extractBytes());
    return created;
  }

  Future<List<int>> _encrypt(String accountId, List<int> clear) async {
    final box = await _cipher.encrypt(clear, secretKey: await _key(accountId));
    return box.concatenation();
  }

  Future<List<int>> _decrypt(String accountId, List<int> sealed) async {
    final box = SecretBox.fromConcatenation(
      sealed,
      nonceLength: _cipher.nonceLength,
      macLength: _cipher.macAlgorithm.macLength,
    );
    return _cipher.decrypt(box, secretKey: await _key(accountId));
  }

  Future<void> _writeAtomically(File file, List<int> bytes) async {
    // A temporary name of its own for every write, so two writes never share
    // (and rename) the same file.
    final temporary = File(
      '${file.path}.${DateTime.now().microsecondsSinceEpoch}-${_next++}.tmp',
    );
    await temporary.writeAsBytes(bytes, flush: true);
    await temporary.rename(file.path);
  }

  @override
  Future<String?> readQueue(String accountId) async {
    final file = File('${(await _folder(accountId)).path}/queue.bin');
    if (!await file.exists()) return null;
    return utf8.decode(await _decrypt(accountId, await file.readAsBytes()));
  }

  @override
  Future<void> writeQueue(String accountId, String json) async {
    final file = File('${(await _folder(accountId)).path}/queue.bin');
    await _writeAtomically(file, await _encrypt(accountId, utf8.encode(json)));
  }

  static final _setAsideName = RegExp(r'^queue\.set-aside-[0-9]+-[0-9]+\.bin$');

  @override
  Future<void> setAsideQueue(String accountId) async {
    final folder = await _folder(accountId);
    final file = File('${folder.path}/queue.bin');
    if (!await file.exists()) return;
    await file.rename(
      '${folder.path}/queue.set-aside-'
      '${DateTime.now().microsecondsSinceEpoch}-${_next++}.bin',
    );
  }

  @override
  Future<Map<String, String>> readSetAside(String accountId) async {
    final folder = await _folder(accountId);
    final found = <String, String>{};
    await for (final entry in folder.list()) {
      final name = entry.uri.pathSegments.last;
      if (entry is! File || !_setAsideName.hasMatch(name)) continue;
      try {
        found[name] = utf8.decode(
          await _decrypt(accountId, await entry.readAsBytes()),
        );
      } catch (error) {
        debugPrint('A set-aside queue still cannot be read: $error');
      }
    }
    return found;
  }

  @override
  Future<void> deleteSetAside(String accountId, String name) async {
    if (!_setAsideName.hasMatch(name)) return;
    final file = File('${(await _folder(accountId)).path}/$name');
    if (await file.exists()) await file.delete();
  }

  @override
  Future<String> putPhoto(
    String accountId,
    String name,
    List<int> bytes,
  ) async {
    final ref = 'photo-${DateTime.now().microsecondsSinceEpoch}-${_next++}.bin';
    final file = File('${(await _folder(accountId)).path}/$ref');
    await _writeAtomically(file, await _encrypt(accountId, bytes));
    return ref;
  }

  @override
  Future<List<int>> readPhoto(String accountId, String ref) async {
    final file = File('${(await _folder(accountId)).path}/$ref');
    return _decrypt(accountId, await file.readAsBytes());
  }

  @override
  Future<void> deletePhoto(String accountId, String ref) async {
    final file = File('${(await _folder(accountId)).path}/$ref');
    if (await file.exists()) await file.delete();
  }
}

/// A saved photo that could not be read back (missing, damaged, or failing
/// decryption), so that one assessment can be set apart from the rest.
class _UnreadablePhoto implements Exception {
  const _UnreadablePhoto(this.cause);
  final Object cause;
}

/// What one round of sending did.
class SyncResult {
  const SyncResult({this.sent = 0, this.waiting = 0, this.blocked = 0});
  final int sent;
  final int waiting;
  final int blocked;
}

class AssessmentQueue extends ChangeNotifier {
  AssessmentQueue({
    required this._storage,
    required this._accountId,
    required this._api,
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now;

  final QueueStorage _storage;
  final String? Function() _accountId;
  final IncidentApi Function() _api;
  final DateTime Function() _clock;

  String? _loadedFor;
  List<QueuedAssessment> _items = const [];
  Future<SyncResult>? _syncing;

  /// Every read and change of the saved queue runs one at a time, so a save
  /// during a retry round (or a discard) never overwrites another change.
  Future<void> _lock = Future.value();

  Future<T> _serialized<T>(Future<T> Function() action) {
    final result = _lock.then((_) => action());
    _lock = result.then<void>((_) {}, onError: (Object _) {});
    return result;
  }

  /// The signed-in account's saved assessments. Empty after sign-out, and
  /// another account never sees them.
  List<QueuedAssessment> get items {
    final account = _accountId();
    return account != null && account == _loadedFor ? _items : const [];
  }

  bool get syncing => _syncing != null;

  /// Reads the signed-in account's queue.
  ///
  /// A queue that cannot be read (a passing storage error, or a key lost
  /// after the phone was restored) is never treated as a loaded empty queue:
  /// nothing is marked loaded, so the next load tries again, and the first
  /// change sets the file aside rather than writing over it. Queues set aside
  /// earlier are added back as soon as they can be read.
  Future<List<QueuedAssessment>> load() => _serialized(() async {
    final account = _accountId();
    if (account == null) {
      forget();
      return const <QueuedAssessment>[];
    }
    var stored = await _readStored(account);
    if (stored != null) stored = await _recoverSetAside(account, stored);
    // Signed out or switched account while reading: keep nothing in memory.
    if (_accountId() != account) return const <QueuedAssessment>[];
    _items = stored ?? const [];
    _loadedFor = stored == null ? null : account;
    notifyListeners();
    return _items;
  });

  /// Adds back the assessments from queues set aside earlier that can be
  /// read now, then removes those set-aside copies.
  Future<List<QueuedAssessment>> _recoverSetAside(
    String account,
    List<QueuedAssessment> stored,
  ) async {
    final Map<String, String> setAside;
    try {
      setAside = await _storage.readSetAside(account);
    } catch (error) {
      debugPrint('Set-aside queues could not be read: $error');
      return stored;
    }
    if (setAside.isEmpty) return stored;
    final merged = [...stored];
    final recovered = <String>[];
    for (final MapEntry(key: name, value: json) in setAside.entries) {
      try {
        final items = [
          for (final item in jsonDecode(json) as List)
            QueuedAssessment.fromJson(Map<String, dynamic>.from(item as Map)),
        ];
        for (final item in items) {
          if (!merged.any((i) => i.clientMutationId == item.clientMutationId)) {
            merged.add(item);
          }
        }
        recovered.add(name);
      } catch (error) {
        debugPrint('A set-aside queue could not be read: $error');
      }
    }
    if (recovered.isEmpty) return stored;
    merged.sort((a, b) => a.savedAt.compareTo(b.savedAt));
    await _storage.writeQueue(
      account,
      jsonEncode([for (final item in merged) item.toJson()]),
    );
    for (final name in recovered) {
      await _storage.deleteSetAside(account, name);
    }
    return merged;
  }

  /// The account's queue as saved on the phone; null if it cannot be read.
  Future<List<QueuedAssessment>?> _readStored(String account) async {
    try {
      final json = await _storage.readQueue(account);
      final decoded = json == null ? const [] : jsonDecode(json) as List;
      return [
        for (final item in decoded)
          QueuedAssessment.fromJson(Map<String, dynamic>.from(item as Map)),
      ];
    } catch (error) {
      debugPrint('Saved assessments could not be read: $error');
      return null;
    }
  }

  /// Clears what is held in memory, for example at sign-out.
  void forget() {
    _loadedFor = null;
    _items = const [];
    notifyListeners();
  }

  /// Applies [change] to the account's saved queue, one change at a time.
  ///
  /// The change starts from the latest queue, never from an older snapshot.
  /// If the account signed out or changed while this was running (a 401
  /// during a send signs the user out), memory no longer holds this account's
  /// queue, so the change starts from what is saved on the phone instead and
  /// every saved assessment is kept for the next sign-in.
  ///
  /// A saved queue that cannot be read is never written over. Once signed
  /// out it is left untouched; for the signed-in account it is set aside (and
  /// added back once it can be read), and the change starts a new queue.
  Future<void> _update(
    String account,
    List<QueuedAssessment> Function(List<QueuedAssessment> current) change,
  ) => _serialized(() async {
    var current = _loadedFor == account ? _items : await _readStored(account);
    if (current == null) {
      if (_accountId() != account) return;
      await _storage.setAsideQueue(account);
      current = const [];
    }
    final next = change(current);
    await _storage.writeQueue(
      account,
      jsonEncode([for (final item in next) item.toJson()]),
    );
    if (_accountId() == account) {
      _items = next;
      _loadedFor = account;
      notifyListeners();
    }
  });

  /// Saves an assessment on the phone before any attempt to send it.
  Future<QueuedAssessment> save({
    required IncidentSummary incident,
    required String societyId,
    required String societyName,
    required String clientMutationId,
    required AssessmentAnswers answers,
  }) async {
    final account = _accountId();
    if (account == null) {
      throw StateError('Sign in to save an assessment');
    }
    await _ensureLoaded(account);
    final photos = [
      for (final photo in answers.photos)
        QueuedPhoto(
          ref: await _storage.putPhoto(account, photo.name, photo.bytes),
          name: photo.name,
          contentType: photo.contentType,
          sizeBytes: photo.sizeBytes,
          uploadId: newClientMutationId(),
        ),
    ];
    final item = QueuedAssessment(
      clientMutationId: clientMutationId,
      incidentId: incident.id,
      incidentReference: incident.reference,
      societyId: societyId,
      societyName: societyName,
      answers: answers.toJson(clientMutationId, societyId),
      photos: photos,
      savedAt: _clock(),
    );
    await _update(
      account,
      (current) => [
        for (final existing in current)
          if (existing.clientMutationId != clientMutationId) existing,
        item,
      ],
    );
    return item;
  }

  Future<void> _ensureLoaded(String account) async {
    if (_loadedFor != account) await load();
  }

  /// Sends what is saved, oldest first. Only one round runs at a time; a
  /// second call joins the round already running.
  Future<SyncResult> sync() => _syncing ??= _sync().whenComplete(() {
    _syncing = null;
    notifyListeners();
  });

  Future<SyncResult> _sync() async {
    final account = _accountId();
    if (account == null) return const SyncResult();
    await _ensureLoaded(account);
    if (_items.isEmpty) return const SyncResult();
    notifyListeners();
    var sent = 0;
    var stop = false;
    // Every request in this round is for this account only. Once it signs
    // out, nothing more is sent, even if someone else has signed in since.
    bool stillSignedIn() => _accountId() == account;
    for (final saved in List.of(_items)) {
      // The account changed while sending: stop, and never mix queues.
      if (stop || !stillSignedIn()) break;
      var item = saved;
      try {
        final api = _api();
        var assessmentId = item.assessmentId;
        if (assessmentId == null) {
          assessmentId = await api.sendAssessment(
            item.incidentId,
            item.societyId,
            item.clientMutationId,
            AssessmentAnswers.fromJson(item.answers),
            stillSignedIn: stillSignedIn,
          );
          item = item.copyWith(assessmentId: assessmentId);
          await _replace(account, item);
        }
        for (var photo in item.photos.where((p) => !p.sent).toList()) {
          if (!stillSignedIn()) {
            throw const IncidentException(
              'Sign in again to send this.',
              status: 401,
            );
          }
          // Saved before photos had an id: give it one, and keep it on the
          // phone before anything is sent, so every retry uses the same one.
          if (photo.uploadId == null) {
            final named = photo.withUploadId(newClientMutationId());
            item = item.copyWith(
              photos: [
                for (final p in item.photos) p.ref == photo.ref ? named : p,
              ],
            );
            await _replace(account, item);
            photo = named;
          }
          final List<int> bytes;
          try {
            bytes = await _storage.readPhoto(account, photo.ref);
          } catch (error) {
            throw _UnreadablePhoto(error);
          }
          await api.addPhoto(
            assessmentId,
            PickedDocument(
              name: photo.name,
              bytes: bytes,
              contentType: photo.contentType,
            ),
            stillSignedIn: stillSignedIn,
            clientUploadId: photo.uploadId,
          );
          item = item.copyWith(
            photos: [
              for (final p in item.photos)
                p.ref == photo.ref ? p.markSent() : p,
            ],
          );
          await _replace(account, item);
          await _storage.deletePhoto(account, photo.ref);
        }
        final done = item.clientMutationId;
        await _update(
          account,
          (current) => [
            for (final existing in current)
              if (existing.clientMutationId != done) existing,
          ],
        );
        sent++;
      } on IncidentException catch (error) {
        final problem = problemOf(error);
        await _replace(
          account,
          item.copyWith(
            problem: problem,
            message: error.message,
            attempts: item.attempts + 1,
            lastAttemptAt: _clock(),
          ),
        );
        // No point trying the rest without a connection or a session.
        stop =
            problem == QueueProblem.offline || problem == QueueProblem.signIn;
      } on _UnreadablePhoto catch (error) {
        // Only this assessment is affected: mark it and go on to the next.
        debugPrint('A saved photo could not be read: ${error.cause}');
        await _replace(
          account,
          item.copyWith(
            problem: QueueProblem.photoUnreadable,
            attempts: item.attempts + 1,
            lastAttemptAt: _clock(),
          ),
        );
      } on FileSystemException catch (error) {
        await _replace(
          account,
          item.copyWith(
            problem: QueueProblem.rejected,
            message: error.message,
            attempts: item.attempts + 1,
            lastAttemptAt: _clock(),
          ),
        );
      }
    }
    final left = _accountId() == account ? _items : const <QueuedAssessment>[];
    return SyncResult(
      sent: sent,
      waiting: left.where((i) => !i.blocked).length,
      blocked: left.where((i) => i.blocked).length,
    );
  }

  /// Records [item]'s progress. An item discarded meanwhile stays removed.
  Future<void> _replace(String account, QueuedAssessment item) => _update(
    account,
    (current) => [
      for (final existing in current)
        existing.clientMutationId == item.clientMutationId ? item : existing,
    ],
  );

  /// Removes a saved assessment the user chose not to send, with its photos.
  Future<void> discard(String clientMutationId) async {
    final account = _accountId();
    if (account == null) return;
    await _ensureLoaded(account);
    QueuedAssessment? removed;
    await _update(account, (current) {
      removed = current
          .where((i) => i.clientMutationId == clientMutationId)
          .firstOrNull;
      return [
        for (final existing in current)
          if (existing.clientMutationId != clientMutationId) existing,
      ];
    });
    // The answers are gone from the queue first, then their photos.
    for (final photo in removed?.photos ?? const <QueuedPhoto>[]) {
      await _storage.deletePhoto(account, photo.ref);
    }
  }
}
