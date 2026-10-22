import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:path_provider/path_provider.dart';

import '../models/user.dart';
import 'emergency_api_client.dart';

class PendingEmergencyAssessment {
  const PendingEmergencyAssessment({
    required this.payload,
    required this.lastError,
  });

  final Map<String, dynamic> payload;
  final String? lastError;

  String get clientMutationId => payload['clientMutationId'] as String;
}

/// Device-local retry queue for fictional assessment drafts.
/// Production use must encrypt this store before saving real incident data.
class EmergencyAssessmentQueue {
  EmergencyAssessmentQueue._(this._file);

  final File _file;

  static Future<EmergencyAssessmentQueue> open({Directory? documentsDirectory}) async {
    final directory = documentsDirectory ?? await getApplicationDocumentsDirectory();
    return EmergencyAssessmentQueue._(
      File('${directory.path}/emergency-assessment-queue.json'),
    );
  }

  Future<List<PendingEmergencyAssessment>> all() async {
    if (!await _file.exists()) return const [];
    try {
      final decoded = jsonDecode(await _file.readAsString()) as List<dynamic>;
      return decoded
          .map((value) {
            final item = value as Map<String, dynamic>;
            return PendingEmergencyAssessment(
              payload: Map<String, dynamic>.from(item['payload'] as Map),
              lastError: item['lastError'] as String?,
            );
          })
          .toList(growable: false);
    } on FormatException {
      rethrow;
    } on TypeError {
      rethrow;
    }
  }

  Future<void> save(Map<String, dynamic> payload) async {
    final items = await all();
    final replacement = PendingEmergencyAssessment(
      payload: Map.of(payload),
      lastError: null,
    );
    final updated = [
      for (final item in items)
        if (item.clientMutationId != replacement.clientMutationId) item,
      replacement,
    ];
    await _write(updated);
  }

  Future<void> markFailed(String clientMutationId, String message) async {
    final items = await all();
    await _write([
      for (final item in items)
        item.clientMutationId == clientMutationId
            ? PendingEmergencyAssessment(
                payload: item.payload,
                lastError: message,
              )
            : item,
    ]);
  }

  Future<void> remove(String clientMutationId) async {
    final items = await all();
    await _write(
      items.where((item) => item.clientMutationId != clientMutationId).toList(),
    );
  }

  Future<void> saveIncidentCache(List<Map<String, dynamic>> incidents) async {
    final file = File('${_file.parent.path}/emergency-incident-cache.json');
    await file.parent.create(recursive: true);
    await file.writeAsString(jsonEncode(incidents), flush: true);
  }

  Future<List<Map<String, dynamic>>> readIncidentCache() async {
    final file = File('${_file.parent.path}/emergency-incident-cache.json');
    if (!await file.exists()) return const [];
    try {
      final decoded = jsonDecode(await file.readAsString()) as List<dynamic>;
      return decoded
          .map((row) => Map<String, dynamic>.from(row as Map))
          .toList(growable: false);
    } on FormatException {
      return const [];
    } on TypeError {
      return const [];
    }
  }

  Future<int> sync(EmergencyApiClient api, UserRole role) async {
    final items = await all();
    var completed = 0;
    for (final item in items) {
      try {
        await api.syncAssessment(item.payload, role);
        await remove(item.clientMutationId);
        completed++;
      } catch (error) {
        await markFailed(item.clientMutationId, error.toString());
      }
    }
    return completed;
  }

  Future<int> syncIfOnline(
    EmergencyApiClient api,
    UserRole role, {
    required bool offline,
  }) {
    if (offline) return Future.value(0);
    return sync(api, role);
  }

  Future<void> _write(List<PendingEmergencyAssessment> items) async {
    await _file.parent.create(recursive: true);
    final temporary = File('${_file.path}.tmp');
    await temporary.writeAsString(
      jsonEncode([
        for (final item in items)
          {'payload': item.payload, 'lastError': item.lastError},
      ]),
      flush: true,
    );
    await temporary.rename(_file.path);
  }
}

String newClientMutationId() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes
      .map((byte) => byte.toRadixString(16).padLeft(2, '0'))
      .join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}
