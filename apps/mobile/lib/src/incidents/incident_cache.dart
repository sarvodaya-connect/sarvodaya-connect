import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:cryptography/cryptography.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

import '../models/user.dart';
import 'assessment_queue.dart'
    show EncryptedFileQueueStorage, QueueKeyStore, SecureQueueKeyStore;
import 'incident_api.dart';

/// Issue #126: the last incident list and incident pages this account loaded,
/// kept on the phone so they can still be read without a connection.
///
/// - Only what the API returned to this account is kept, and only for the
///   societies and districts it covered when it was loaded. A saved copy
///   whose account, role, societies, districts or active temporary district
///   access no longer match is never shown, and is deleted.
/// - A saved copy is shown only when the phone is offline or the server did
///   not answer. A refusal (403 or 404) deletes it instead.
/// - Saved copies are read-only: nothing is sent from them.
/// - Each account's copy is encrypted under its own key, and only the
///   signed-in account's copy is ever read.

/// What a screen shows: fresh from the API, or a saved copy and when it was
/// saved.
class Loaded<T> {
  const Loaded(this.value, {this.savedAt});
  final T value;

  /// When the saved copy was loaded from the API. Null when [value] is fresh.
  final DateTime? savedAt;

  bool get cached => savedAt != null;
}

/// Where each account's saved incidents are kept.
abstract interface class IncidentCacheStorage {
  Future<String?> read(String accountId);
  Future<void> write(String accountId, String json);
  Future<void> delete(String accountId);
}

/// Demonstration mode and tests: nothing is written to the phone.
class MemoryIncidentCacheStorage implements IncidentCacheStorage {
  final saved = <String, String>{};

  @override
  Future<String?> read(String accountId) async => saved[accountId];

  @override
  Future<void> write(String accountId, String json) async =>
      saved[accountId] = json;

  @override
  Future<void> delete(String accountId) async => saved.remove(accountId);
}

/// The real store: one file per account, in a folder named by a hash of the
/// account id, encrypted with AES-256-GCM under that account's own key in
/// the phone's Keychain or Keystore. It sits in the app's private support
/// directory, apart from the saved assessments.
class EncryptedFileIncidentCacheStorage implements IncidentCacheStorage {
  EncryptedFileIncidentCacheStorage({
    this._keys = const SecureQueueKeyStore(),
    Future<Directory> Function()? root,
  }) : _root = root ?? _defaultRoot;

  final QueueKeyStore _keys;
  final Future<Directory> Function() _root;
  final _cipher = AesGcm.with256bits();
  var _next = 0;

  static Future<Directory> _defaultRoot() async => Directory(
    '${(await getApplicationSupportDirectory()).path}/incident-cache',
  );

  Future<File> _file(String accountId) async {
    final folder = Directory(
      '${(await _root()).path}/'
      '${EncryptedFileQueueStorage.accountFolder(accountId)}',
    );
    await folder.create(recursive: true);
    return File('${folder.path}/incidents.bin');
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
        'sc.incidentCache.${EncryptedFileQueueStorage.accountFolder(accountId)}';
    final existing = await _keys.read(name);
    if (existing != null) return SecretKey(existing);
    final created = await _cipher.newSecretKey();
    await _keys.write(name, await created.extractBytes());
    return created;
  }

  @override
  Future<String?> read(String accountId) async {
    final file = await _file(accountId);
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
  Future<void> write(String accountId, String json) async {
    final file = await _file(accountId);
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
  Future<void> delete(String accountId) async {
    try {
      await (await _file(accountId)).delete();
    } on PathNotFoundException {
      // Nothing saved: nothing to delete.
    }
  }
}

/// What the account could see when a copy was saved: its roles, societies,
/// districts and the temporary district access active at [now]. A copy is
/// shown only while this is unchanged, so expired DDM access, a new role or
/// a removed society never shows data from the old scope.
String incidentScope(AuthenticatedUser user, DateTime now) {
  List<String> sorted(Iterable<String> values) =>
      values.toSet().toList()..sort();
  return jsonEncode({
    'account': user.id,
    'roles': sorted(user.roles.map((role) => role.name)),
    'societies': sorted(user.societyIds),
    'districts': sorted(user.districtIds),
    'access': sorted(
      user.delegatedDistrictAccess
          .where((grant) => grant.activeAt(now))
          .map((grant) => grant.districtId),
    ),
  });
}

/// True when [error] means "no answer", so a saved copy may stand in. A
/// refusal or a rejected request never shows saved data.
bool canUseSavedCopy(IncidentException error) =>
    error.offline || error.status == null || error.status! >= 500;

class IncidentCache {
  IncidentCache({
    required this._storage,
    required this._user,
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now;

  final IncidentCacheStorage _storage;
  final AuthenticatedUser? Function() _user;
  final DateTime Function() _clock;

  /// Reads and changes run one at a time, so two screens saving together
  /// never lose each other's change.
  Future<void> _lock = Future.value();

  Future<T> _serialized<T>(Future<T> Function() action) {
    final result = _lock.then((_) => action());
    _lock = result.then<void>((_) {}, onError: (Object _) {});
    return result;
  }

  /// Every request gets the next number when it starts. An answer is saved
  /// only when no later request for the same list or page has been saved
  /// first, so a slow, older answer never replaces a newer one.
  var _requests = 0;
  final _committed = <String, int>{};

  /// The request whose refusal last cleared the whole saved copy, and the
  /// request whose refusal last removed each incident. A save from a request
  /// that started before a refusal never brings the refused data back.
  var _listRefused = 0;
  final _pageRefused = <String, int>{};

  /// Accounts whose saved copy may still hold something the API refused,
  /// because removing it from the phone failed. Their saved copy is never
  /// read until a save succeeds.
  final _untrusted = <String>{};

  /// The live incident list: from the API when it answers (and saved), else
  /// the saved list.
  Future<Loaded<List<IncidentSummary>>> incidents(IncidentApi api) =>
      _load<List<IncidentSummary>>(
        'list',
        api.active,
        save: (saved, incidents, request) {
          final ids = {for (final incident in incidents) incident.id};
          saved['list'] = {
            'savedAt': _clock().toUtc().toIso8601String(),
            'incidents': [for (final incident in incidents) incident.toJson()],
          };
          // Keep the pages of listed incidents only, so the copy never grows,
          // but never a page saved by a request newer than this list.
          (saved['details'] as Map<String, dynamic>).removeWhere(
            (id, _) =>
                !ids.contains(id) && (_committed['detail:$id'] ?? 0) <= request,
          );
        },
        read: (saved) {
          final list = saved['list'] as Map<String, dynamic>?;
          if (list == null) return null;
          return Loaded([
            for (final incident in list['incidents'] as List)
              IncidentSummary.fromJson(incident as Map<String, dynamic>),
          ], savedAt: DateTime.parse(list['savedAt'] as String));
        },
        // The list is refused only when the account lost disaster access.
        refused: (saved) => saved.clear(),
        onRefused: (request) => _listRefused = request,
      );

  /// One incident's page: from the API when it answers (and saved), else
  /// the saved page.
  Future<Loaded<IncidentDetail>> incident(IncidentApi api, String id) =>
      _load<IncidentDetail>(
        'detail:$id',
        () => api.detail(id),
        save: (saved, detail, _) {
          (saved['details'] as Map<String, dynamic>)[id] = {
            'savedAt': _clock().toUtc().toIso8601String(),
            'detail': detail.toJson(),
          };
        },
        read: (saved) {
          final page =
              (saved['details'] as Map<String, dynamic>)[id]
                  as Map<String, dynamic>?;
          if (page == null) return null;
          return Loaded(
            IncidentDetail.fromJson(page['detail'] as Map<String, dynamic>),
            savedAt: DateTime.parse(page['savedAt'] as String),
          );
        },
        refused: (saved) {
          (saved['details'] as Map<String, dynamic>).remove(id);
          final list = saved['list'] as Map<String, dynamic>?;
          (list?['incidents'] as List?)?.removeWhere(
            (incident) => (incident as Map)['id'] == id,
          );
        },
        onRefused: (request) => _pageRefused[id] = request,
      );

  Future<Loaded<T>> _load<T>(
    String resource,
    Future<T> Function() fetch, {
    required void Function(Map<String, dynamic> saved, T value, int request)
    save,
    required Loaded<T>? Function(Map<String, dynamic> saved) read,
    required void Function(Map<String, dynamic> saved) refused,
    required void Function(int request) onRefused,
  }) async {
    // The account and scope the request is made for. What comes back is
    // saved only for that same account and scope.
    final user = _user();
    final scope = user == null ? null : incidentScope(user, _clock());
    final request = ++_requests;
    try {
      final value = await fetch();
      if (user != null) {
        await _change(
          user,
          scope!,
          resource,
          request,
          (saved) => save(saved, value, request),
        );
      }
      return Loaded(value);
    } on IncidentException catch (error) {
      if (user == null) rethrow;
      if (!canUseSavedCopy(error)) {
        if (error.status == 403 || error.status == 404) {
          await _change(user, scope!, resource, request, (saved) {
            refused(saved);
            onRefused(request);
          }, refusal: true);
        }
        rethrow;
      }
      final saved = await _serialized(() => _read(user, scope!));
      final copy = saved == null ? null : _safeRead(read, saved);
      if (copy == null || !_still(user, scope!)) rethrow;
      return copy;
    }
  }

  Loaded<T>? _safeRead<T>(
    Loaded<T>? Function(Map<String, dynamic>) read,
    Map<String, dynamic> saved,
  ) {
    try {
      return read(saved);
    } catch (error) {
      debugPrint('A saved incident could not be read: $error');
      return null;
    }
  }

  /// Whether [user] is still signed in with the same scope.
  bool _still(AuthenticatedUser user, String scope) {
    final current = _user();
    return current != null &&
        current.id == user.id &&
        incidentScope(current, _clock()) == scope;
  }

  /// The account's saved copy, or null when there is none, it cannot be read,
  /// or it was saved for another scope (then it is deleted).
  Future<Map<String, dynamic>?> _read(
    AuthenticatedUser user,
    String scope,
  ) async {
    if (_untrusted.contains(user.id)) return null;
    try {
      final text = await _storage.read(user.id);
      if (text == null) return null;
      final saved = jsonDecode(text) as Map<String, dynamic>;
      if (saved['v'] != 1 || saved['scope'] != scope) {
        await _storage.delete(user.id);
        return null;
      }
      return saved;
    } catch (error) {
      debugPrint('Saved incidents could not be read: $error');
      return null;
    }
  }

  Future<void> _change(
    AuthenticatedUser user,
    String scope,
    String resource,
    int request,
    void Function(Map<String, dynamic> saved) change, {
    bool refusal = false,
  }) => _serialized(() async {
    // Signed out, switched account or changed scope since the request: the
    // answer belongs to nobody signed in now, so it is not saved.
    if (!_still(user, scope)) return;
    // A later request for the same list or page was saved already.
    if ((_committed[resource] ?? 0) > request) return;
    // The whole copy was refused after this request started.
    if (!refusal && _listRefused > request) return;
    _committed[resource] = request;
    final saved =
        await _read(user, scope) ??
        {'v': 1, 'scope': scope, 'details': <String, dynamic>{}};
    change(saved);
    // Incidents refused after this request started stay out of the copy.
    final details = saved['details'] as Map<String, dynamic>?;
    final list = saved['list'] as Map<String, dynamic>?;
    _pageRefused.forEach((id, refusedBy) {
      if (refusedBy <= request) return;
      // A page saved after the refusal is current: only the old list entry
      // is dropped.
      if ((_committed['detail:$id'] ?? 0) <= refusedBy) details?.remove(id);
      (list?['incidents'] as List?)?.removeWhere(
        (incident) => (incident as Map)['id'] == id,
      );
    });
    try {
      await _storage.write(user.id, jsonEncode(saved));
      // The copy on the phone is now exactly what was meant to be saved.
      _untrusted.remove(user.id);
    } catch (error) {
      // The screen still shows the fresh answer; only the offline copy is
      // older than it.
      debugPrint('Incidents could not be saved on this phone: $error');
      if (refusal) await _forget(user.id);
    }
  });

  /// A refusal could not be saved, so the old copy on the phone may still
  /// hold the refused data: delete it, and stop reading it if that fails too.
  Future<void> _forget(String accountId) async {
    _untrusted.add(accountId);
    try {
      await _storage.delete(accountId);
      _untrusted.remove(accountId);
    } catch (error) {
      debugPrint('Saved incidents could not be deleted: $error');
    }
  }
}
