import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart' as crypto;
import 'package:cryptography/cryptography.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

import '../incidents/assessment_queue.dart'
    show EncryptedFileQueueStorage, QueueKeyStore, SecureQueueKeyStore;
import '../models/user.dart';

/// Issue #127: unfinished society forms kept on the phone, so leaving the
/// screen, a failed send, a lost connection or an app restart never loses
/// what was typed.
///
/// - One draft per account, society and form. Only the signed-in account's
///   drafts are ever read or written; another account on the same phone has
///   its own folder and key.
/// - Drafts stay encrypted on the phone after sign-out, so the same person
///   finds them after signing in again (the app does not keep the sign-in
///   across a restart). They are deleted when sent or discarded.
/// - Nothing is sent from a draft by itself: the person sends it.

/// The forms that keep drafts.
enum DraftKind {
  /// M06e edit society information.
  societyProfile,
}

class Draft {
  const Draft({required this.data, required this.savedAt});
  final Map<String, dynamic> data;
  final DateTime savedAt;
}

/// Where each account's drafts are kept.
abstract interface class DraftStorage {
  Future<String?> read(String accountId, String key);
  Future<void> write(String accountId, String key, String json);
  Future<void> delete(String accountId, String key);
}

/// Demonstration mode and tests: nothing is written to the phone.
class MemoryDraftStorage implements DraftStorage {
  final saved = <String, String>{};

  @override
  Future<String?> read(String accountId, String key) async =>
      saved['$accountId/$key'];

  @override
  Future<void> write(String accountId, String key, String json) async =>
      saved['$accountId/$key'] = json;

  @override
  Future<void> delete(String accountId, String key) async =>
      saved.remove('$accountId/$key');
}

/// The real store: one folder per account (named by a hash of its id), one
/// file per draft (named by a hash of the form and society), each encrypted
/// with AES-256-GCM under the account's own key in the Keychain or Keystore.
/// It sits in the app's private support directory.
class EncryptedFileDraftStorage implements DraftStorage {
  EncryptedFileDraftStorage({
    this._keys = const SecureQueueKeyStore(),
    Future<Directory> Function()? root,
  }) : _root = root ?? _defaultRoot;

  final QueueKeyStore _keys;
  final Future<Directory> Function() _root;
  final _cipher = AesGcm.with256bits();
  var _next = 0;

  static Future<Directory> _defaultRoot() async =>
      Directory('${(await getApplicationSupportDirectory()).path}/drafts');

  static String _hash(String value) =>
      crypto.sha256.convert(utf8.encode(value)).toString().substring(0, 32);

  Future<File> _file(String accountId, String key) async {
    final folder = Directory(
      '${(await _root()).path}/'
      '${EncryptedFileQueueStorage.accountFolder(accountId)}',
    );
    await folder.create(recursive: true);
    return File('${folder.path}/${_hash(key)}.bin');
  }

  /// One key lookup per account at a time, so two saves never create two keys.
  final _keyLoads = <String, Future<SecretKey>>{};

  Future<SecretKey> _key(String accountId) =>
      _keyLoads[accountId] ??= _loadKey(accountId).then(
        (key) => key,
        onError: (Object error, StackTrace stack) {
          _keyLoads.remove(accountId);
          Error.throwWithStackTrace(error, stack);
        },
      );

  Future<SecretKey> _loadKey(String accountId) async {
    final name =
        'sc.drafts.${EncryptedFileQueueStorage.accountFolder(accountId)}';
    final existing = await _keys.read(name);
    if (existing != null) return SecretKey(existing);
    final created = await _cipher.newSecretKey();
    await _keys.write(name, await created.extractBytes());
    return created;
  }

  @override
  Future<String?> read(String accountId, String key) async {
    final file = await _file(accountId, key);
    if (!await file.exists()) return null;
    final box = SecretBox.fromConcatenation(
      await file.readAsBytes(),
      nonceLength: _cipher.nonceLength,
      macLength: _cipher.macAlgorithm.macLength,
    );
    return utf8.decode(
      await _cipher.decrypt(box, secretKey: await _key(accountId)),
    );
  }

  @override
  Future<void> write(String accountId, String key, String json) async {
    final file = await _file(accountId, key);
    final box = await _cipher.encrypt(
      utf8.encode(json),
      secretKey: await _key(accountId),
    );
    final temporary = File(
      '${file.path}.${DateTime.now().microsecondsSinceEpoch}-${_next++}.tmp',
    );
    await temporary.writeAsBytes(box.concatenation(), flush: true);
    await temporary.rename(file.path);
  }

  @override
  Future<void> delete(String accountId, String key) async {
    try {
      await (await _file(accountId, key)).delete();
    } on PathNotFoundException {
      // Nothing saved: nothing to delete.
    }
  }
}

class DraftStore {
  DraftStore({
    required this._storage,
    required this._user,
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now;

  final DraftStorage _storage;
  final AuthenticatedUser? Function() _user;
  final DateTime Function() _clock;

  /// Reads, writes and deletes run one at a time.
  Future<void> _lock = Future.value();

  /// The newest unsaved data for each draft. Typing quickly writes once per
  /// turn of the queue, with the latest text, rather than once per key press.
  final _latest = <String, Map<String, dynamic>>{};
  final _queued = <String, Future<DateTime?>>{};

  /// Bumped by [discard]: a write queued before a discard never runs after
  /// it, and a save made after the discard gets its own turn of the queue.
  final _generation = <String, int>{};

  Future<T> _serialized<T>(Future<T> Function() action) {
    final result = _lock.then((_) => action());
    _lock = result.then<void>((_) {}, onError: (Object _) {});
    return result;
  }

  static String _key(DraftKind kind, String societyId) =>
      '${kind.name}:$societyId';

  /// The signed-in account's draft for this form and society, or null.
  Future<Draft?> read(DraftKind kind, String societyId) {
    final account = _user()?.id;
    if (account == null) return Future.value();
    final key = _key(kind, societyId);
    return _serialized(() async {
      try {
        final text = await _storage.read(account, key);
        if (text == null) return null;
        final saved = jsonDecode(text) as Map<String, dynamic>;
        // A file for another account, society or form is never shown.
        if (saved['v'] != 1 ||
            saved['account'] != account ||
            saved['key'] != key ||
            _user()?.id != account) {
          return null;
        }
        return Draft(
          data: Map<String, dynamic>.from(saved['data'] as Map),
          savedAt: DateTime.parse(saved['savedAt'] as String),
        );
      } catch (error) {
        debugPrint('A draft could not be read: $error');
        return null;
      }
    });
  }

  /// Keeps [data] as the draft and returns when it was saved, or null when
  /// nobody is signed in or it could not be written.
  Future<DateTime?> save(
    DraftKind kind,
    String societyId,
    Map<String, dynamic> data,
  ) async {
    final account = _user()?.id;
    if (account == null) return null;
    final key = _key(kind, societyId);
    final id = '$account/$key';
    _latest[id] = data;
    // A write for this draft is already waiting: it will take this data.
    final waiting = _queued[id];
    if (waiting != null) return waiting;
    final generation = _generation[id] ?? 0;
    late final Future<DateTime?> slot;
    slot = _serialized(() async {
      // Discarded after this write was queued: a later save has its own turn.
      if ((_generation[id] ?? 0) != generation) return null;
      if (identical(_queued[id], slot)) _queued.remove(id);
      final latest = _latest.remove(id);
      // Discarded meanwhile, or signed out: nothing to write.
      if (latest == null || _user()?.id != account) return null;
      final savedAt = _clock();
      try {
        await _storage.write(
          account,
          key,
          jsonEncode({
            'v': 1,
            'account': account,
            'key': key,
            'savedAt': savedAt.toUtc().toIso8601String(),
            'data': latest,
          }),
        );
        return savedAt;
      } catch (error) {
        debugPrint('A draft could not be saved on this phone: $error');
        return null;
      }
    });
    return _queued[id] = slot;
  }

  /// Deletes the draft, for example once it is sent or the person discards
  /// it. Returns false when it could not be deleted, so it is still kept.
  Future<bool> discard(DraftKind kind, String societyId) {
    final account = _user()?.id;
    if (account == null) return Future.value(true);
    final key = _key(kind, societyId);
    final id = '$account/$key';
    _latest.remove(id);
    _queued.remove(id);
    _generation[id] = (_generation[id] ?? 0) + 1;
    return _serialized(() async {
      try {
        await _storage.delete(account, key);
        return true;
      } catch (error) {
        debugPrint('A draft could not be deleted yet: $error');
        return false;
      }
    });
  }
}
