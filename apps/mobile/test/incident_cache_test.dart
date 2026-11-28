import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/incidents/assessment_queue.dart';
import 'package:sarvodaya_connect_mobile/src/incidents/demo_incident_api.dart';
import 'package:sarvodaya_connect_mobile/src/incidents/incident_api.dart';
import 'package:sarvodaya_connect_mobile/src/incidents/incident_cache.dart';
import 'package:sarvodaya_connect_mobile/src/incidents/incident_screens.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';

import 'test_helpers.dart';

/// Issue #126: incidents saved for offline reading. Everything here is
/// fictional.

const _offline = IncidentException('offline', offline: true);

/// The demo incidents, failing with [failure] while it is set.
class _SwitchableApi extends DemoIncidentApi {
  _SwitchableApi({required super.clock});
  IncidentException? failure;
  int lists = 0;

  /// Also answers for a second, fictional incident when set.
  bool twoIncidents = false;

  @override
  Future<List<IncidentSummary>> active() async {
    lists++;
    if (failure != null) throw failure!;
    final list = await super.active();
    if (!twoIncidents) return list;
    final second = IncidentSummary.fromJson({
      ...list.single.toJson(),
      'id': 'incident-second',
      'reference': 'INC-TEST-2',
    });
    return [...list, second];
  }

  @override
  Future<IncidentDetail> detail(String id) async {
    if (failure != null) throw failure!;
    return super.detail(id);
  }
}

const _officerA = AuthenticatedUser(
  id: 'user-test-a',
  displayName: 'Test Officer A',
  roles: [UserRole.societyOfficer],
  societyIds: ['society-test-1'],
);

const _officerB = AuthenticatedUser(
  id: 'user-test-b',
  displayName: 'Test Officer B',
  roles: [UserRole.societyOfficer],
  societyIds: ['society-test-2'],
);

void main() {
  late DateTime now;
  late AuthenticatedUser? user;
  late MemoryIncidentCacheStorage storage;
  late _SwitchableApi api;
  late IncidentCache cache;

  setUp(() {
    now = DateTime.utc(2026, 10, 13, 4, 45);
    user = _officerA;
    storage = MemoryIncidentCacheStorage();
    api = _SwitchableApi(clock: () => now);
    cache = IncidentCache(storage: storage, user: () => user, clock: () => now);
  });

  test('a saved incident page reads back the same', () async {
    final detail = await DemoIncidentApi(clock: () => demoNow)
        .detail('incident-demo');
    final copy = IncidentDetail.fromJson(
      jsonDecode(jsonEncode(detail.toJson())) as Map<String, dynamic>,
    );
    expect(jsonEncode(copy.toJson()), jsonEncode(detail.toJson()));
    expect(copy.incident.reference, detail.incident.reference);
    expect(copy.incident.areaNames, detail.incident.areaNames);
    expect(copy.actions.length, detail.actions.length);
    expect(copy.recent.length, detail.recent.length);

    // A received assessment row too (the demo page has none).
    final row = {
      'society': {
        'id': 'society-test-1',
        'name': 'Test Society',
        'code': 'SSS-TEST-1',
        'districtName': 'Test District',
        'districtId': 'district-test',
      },
      'state': 'CRITICAL',
      'families': 12,
      'people': 40,
      'lastReceivedAt': '2026-10-13T04:00:00.000Z',
      'updates': 2,
      'canAssess': true,
    };
    final rowCopy = SocietyRow.fromJson(
      jsonDecode(jsonEncode(SocietyRow.fromJson(row).toJson()))
          as Map<String, dynamic>,
    );
    expect(rowCopy.toJson(), row);
    expect(rowCopy.state, SocietyState.critical);
    expect(copy.totals.byDistrict.length, detail.totals.byDistrict.length);
  });

  test(
    'online it is fresh and saved; offline the saved copy is shown',
    () async {
      final fresh = await cache.incidents(api);
      expect(fresh.cached, isFalse);
      expect(fresh.value.single.id, 'incident-demo');

      now = now.add(const Duration(hours: 2));
      api.failure = _offline;
      final saved = await cache.incidents(api);
      expect(saved.cached, isTrue);
      expect(saved.savedAt, DateTime.utc(2026, 10, 13, 4, 45));
      expect(saved.value.single.reference, fresh.value.single.reference);
    },
  );

  test('a failed refresh keeps the last good copy; a good one replaces it '
      'without duplicates', () async {
    await cache.incidents(api);
    api.twoIncidents = true;
    now = now.add(const Duration(minutes: 30));
    await cache.incidents(api);

    api.failure = _offline;
    final first = await cache.incidents(api);
    expect(first.value.map((i) => i.id), ['incident-demo', 'incident-second']);
    expect(first.savedAt, DateTime.utc(2026, 10, 13, 5, 15));

    // The failed refresh changed nothing saved.
    final second = await cache.incidents(api);
    expect(second.savedAt, first.savedAt);
    expect(second.value.length, 2);

    api.failure = null;
    api.twoIncidents = false;
    now = now.add(const Duration(minutes: 30));
    await cache.incidents(api);
    api.failure = _offline;
    final third = await cache.incidents(api);
    expect(third.value.map((i) => i.id), ['incident-demo']);
    expect(third.savedAt, DateTime.utc(2026, 10, 13, 5, 45));
  });

  test('offline with nothing saved is an error, never an empty list', () async {
    api.failure = _offline;
    await expectLater(cache.incidents(api), throwsA(same(_offline)));
    await expectLater(
      cache.incident(api, 'incident-demo'),
      throwsA(same(_offline)),
    );
  });

  test('a server error shows the saved copy; a refusal deletes it', () async {
    await cache.incidents(api);
    await cache.incident(api, 'incident-demo');

    api.failure = const IncidentException('down', status: 503);
    expect((await cache.incidents(api)).cached, isTrue);
    expect((await cache.incident(api, 'incident-demo')).cached, isTrue);

    // Losing access to the incident deletes its saved page.
    api.failure = const IncidentException('no', status: 403);
    await expectLater(
      cache.incident(api, 'incident-demo'),
      throwsA(isA<IncidentException>()),
    );
    api.failure = _offline;
    await expectLater(
      cache.incident(api, 'incident-demo'),
      throwsA(same(_offline)),
    );
    expect((await cache.incidents(api)).value, isEmpty);

    // Losing disaster access altogether deletes the saved list too.
    api.failure = const IncidentException('no', status: 403);
    await expectLater(cache.incidents(api), throwsA(isA<IncidentException>()));
    api.failure = _offline;
    await expectLater(cache.incidents(api), throwsA(same(_offline)));
  });

  test('another account never sees the saved incidents', () async {
    await cache.incidents(api);
    await cache.incident(api, 'incident-demo');

    user = _officerB;
    api.failure = _offline;
    await expectLater(cache.incidents(api), throwsA(same(_offline)));
    await expectLater(
      cache.incident(api, 'incident-demo'),
      throwsA(same(_offline)),
    );

    // Signed out: nothing is read.
    user = null;
    await expectLater(cache.incidents(api), throwsA(same(_offline)));

    // The first account still has its own copy.
    user = _officerA;
    expect((await cache.incidents(api)).cached, isTrue);
  });

  test('a changed scope never shows the old copy, and deletes it', () async {
    await cache.incidents(api);
    user = const AuthenticatedUser(
      id: 'user-test-a',
      displayName: 'Test Officer A',
      roles: [UserRole.societyOfficer],
      societyIds: ['society-test-9'],
    );
    api.failure = _offline;
    await expectLater(cache.incidents(api), throwsA(same(_offline)));
    expect(storage.saved, isEmpty);
  });

  test('expired temporary district access hides what it loaded', () async {
    final ddm = AuthenticatedUser(
      id: 'user-test-ddm',
      displayName: 'Test DDM',
      roles: const [UserRole.deputyDistrictManager],
      districtIds: const ['district-test-home'],
      societyIds: const [],
      delegatedDistrictAccess: [
        DistrictAccessGrant(
          districtId: 'district-test-covered',
          startsAt: DateTime.utc(2026, 10, 13),
          expiresAt: DateTime.utc(2026, 10, 14),
        ),
      ],
    );
    user = ddm;
    await cache.incidents(api);
    api.failure = _offline;
    expect((await cache.incidents(api)).cached, isTrue);

    now = DateTime.utc(2026, 10, 14, 0, 1);
    await expectLater(cache.incidents(api), throwsA(same(_offline)));
    expect(storage.saved, isEmpty);
  });

  test('an answer that arrives after sign-out is not saved', () async {
    final slow = _SignOutDuringListApi(
      clock: () => now,
      onList: () => user = null,
    );
    await cache.incidents(slow);
    expect(storage.saved, isEmpty);
  });

  test(
    'an older answer that arrives late never replaces a newer one',
    () async {
      final full = await api.active();
      final ordered = _OrderedListApi(clock: () => now);
      final older = Completer<List<IncidentSummary>>();
      final newer = Completer<List<IncidentSummary>>();
      ordered.answers
        ..add(older)
        ..add(newer);

      final first = cache.incidents(ordered);
      final second = cache.incidents(ordered);
      // The incident closed: the newer answer is empty and is saved first.
      newer.complete(const []);
      expect((await second).value, isEmpty);
      older.complete(full);
      expect((await first).value, hasLength(1));

      api.failure = _offline;
      expect((await cache.incidents(api)).value, isEmpty);
    },
  );

  test('a refusal that cannot be saved still hides the refused copy', () async {
    final failing = _FailingStorage();
    cache = IncidentCache(storage: failing, user: () => user, clock: () => now);
    await cache.incidents(api);
    await cache.incident(api, 'incident-demo');

    failing.failWrites = true;
    api.failure = const IncidentException('no', status: 403);
    await expectLater(
      cache.incident(api, 'incident-demo'),
      throwsA(isA<IncidentException>()),
    );
    api.failure = _offline;
    await expectLater(
      cache.incident(api, 'incident-demo'),
      throwsA(same(_offline)),
    );
    expect(failing.saved, isEmpty);
  });

  test('a refusal that can be neither saved nor deleted is never read again '
      'until a save succeeds', () async {
    final failing = _FailingStorage();
    cache = IncidentCache(storage: failing, user: () => user, clock: () => now);
    await cache.incidents(api);
    await cache.incident(api, 'incident-demo');

    failing
      ..failWrites = true
      ..failDeletes = true;
    api.failure = const IncidentException('no', status: 404);
    await expectLater(
      cache.incident(api, 'incident-demo'),
      throwsA(isA<IncidentException>()),
    );
    api.failure = _offline;
    expect(failing.saved, isNotEmpty);
    await expectLater(
      cache.incident(api, 'incident-demo'),
      throwsA(same(_offline)),
    );
    await expectLater(cache.incidents(api), throwsA(same(_offline)));

    // A fresh answer replaces the old copy, and it is read again.
    failing.failWrites = false;
    api.failure = null;
    await cache.incidents(api);
    api.failure = _offline;
    expect((await cache.incidents(api)).cached, isTrue);
    await expectLater(
      cache.incident(api, 'incident-demo'),
      throwsA(same(_offline)),
    );
  });

  group('on the phone', () {
    late Directory root;
    late MemoryQueueKeyStore keys;

    setUp(() async {
      root = await Directory.systemTemp.createTemp('incident-cache-test');
      keys = MemoryQueueKeyStore();
    });
    tearDown(() => root.delete(recursive: true));

    EncryptedFileIncidentCacheStorage phone() =>
        EncryptedFileIncidentCacheStorage(keys: keys, root: () async => root);

    test('is encrypted, per account, and survives an app restart', () async {
      cache = IncidentCache(
        storage: phone(),
        user: () => user,
        clock: () => now,
      );
      await cache.incidents(api);
      await cache.incident(api, 'incident-demo');

      final files = root.listSync(recursive: true).whereType<File>().toList();
      expect(files, hasLength(1));
      final bytes = files.single.readAsBytesSync();
      expect(latin1.decode(bytes, allowInvalid: true), isNot(contains('INC-')));

      // A new app session: new objects, the same phone.
      final restarted = IncidentCache(
        storage: phone(),
        user: () => user,
        clock: () => now,
      );
      api.failure = _offline;
      final list = await restarted.incidents(api);
      expect(list.cached, isTrue);
      expect(list.value.single.id, 'incident-demo');
      expect((await restarted.incident(api, 'incident-demo')).cached, isTrue);

      // Another account on the same phone has nothing to read.
      user = _officerB;
      await expectLater(restarted.incidents(api), throwsA(same(_offline)));
    });

    test(
      'a copy that cannot be decrypted is treated as nothing saved',
      () async {
        cache = IncidentCache(
          storage: phone(),
          user: () => user,
          clock: () => now,
        );
        await cache.incidents(api);
        keys.keys
            .clear(); // For example, the phone was restored without its keys.
        final restarted = IncidentCache(
          storage: phone(),
          user: () => user,
          clock: () => now,
        );
        api.failure = _offline;
        await expectLater(restarted.incidents(api), throwsA(same(_offline)));
      },
    );
  });

  group('screens', () {
    Future<DemoStore> pump(WidgetTester tester, Widget home) async {
      tester.view.physicalSize = const Size(402 * 3, 1400 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      final store = DemoStore(
        loadDelay: Duration.zero,
        clock: () => demoNow,
        incidentApi: api,
      )..switchDemoRole(UserRole.societyOfficer);
      await tester.pumpWidget(
        DemoScope(
          store: store,
          child: MaterialApp(theme: AppTheme.light(), home: home),
        ),
      );
      await tester.pumpAndSettle();
      return store;
    }

    testWidgets('the Incident tab shows the saved list with its notice', (
      tester,
    ) async {
      api = _SwitchableApi(clock: () => demoNow);
      await pump(tester, const IncidentsScreen());
      expect(find.text('Showing a saved copy'), findsNothing);
      expect(find.text('Report an incident'), findsOneWidget);

      // Refresh by pulling down, now offline.
      api.failure = _offline;
      await tester.fling(find.byType(ListView), const Offset(0, 400), 1000);
      await tester.pumpAndSettle();
      expect(find.text('Showing a saved copy'), findsOneWidget);
      expect(find.textContaining('were saved 13 Oct'), findsOneWidget);
      expect(find.byType(ActiveIncidentCard), findsOneWidget);

      api.failure = null;
      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();
      expect(find.text('Showing a saved copy'), findsNothing);
      expect(find.byType(ActiveIncidentCard), findsOneWidget);
    });

    testWidgets('first use offline explains that nothing is saved yet', (
      tester,
    ) async {
      api = _SwitchableApi(clock: () => demoNow)..failure = _offline;
      await pump(tester, const IncidentsScreen());
      expect(find.text('No incidents saved on this phone'), findsOneWidget);
      expect(
        find.textContaining('No live incidents cover your societies'),
        findsNothing,
      );
      final before = api.lists;
      api.failure = null;
      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();
      expect(api.lists, greaterThan(before));
      expect(find.byType(ActiveIncidentCard), findsOneWidget);
    });

    testWidgets('a saved incident page is read-only for closing', (
      tester,
    ) async {
      api = _SwitchableApi(clock: () => demoNow);
      await pump(tester, const IncidentScreen(incidentId: 'incident-demo'));
      await tester.scrollUntilVisible(find.text('Close incident'), 200);
      expect(find.text('Close incident'), findsOneWidget);

      api.failure = _offline;
      await tester.fling(find.byType(ListView), const Offset(0, 2000), 2000);
      await tester.pumpAndSettle();
      expect(find.text('Showing a saved copy'), findsOneWidget);
      expect(
        find.textContaining('Closing it needs a connection'),
        findsOneWidget,
      );
      expect(find.text('Close incident'), findsNothing);
    });
  });
}

/// Signs out while the list is on its way.
class _SignOutDuringListApi extends DemoIncidentApi {
  _SignOutDuringListApi({required super.clock, required this.onList});
  final void Function() onList;

  @override
  Future<List<IncidentSummary>> active() async {
    final list = await super.active();
    onList();
    return list;
  }
}

/// Answers each list request with the next completer in [answers].
class _OrderedListApi extends DemoIncidentApi {
  _OrderedListApi({required super.clock});
  final answers = <Completer<List<IncidentSummary>>>[];
  var _next = 0;

  @override
  Future<List<IncidentSummary>> active() => answers[_next++].future;
}

/// Memory storage whose writes or deletes fail while asked to.
class _FailingStorage extends MemoryIncidentCacheStorage {
  bool failWrites = false;
  bool failDeletes = false;

  @override
  Future<void> write(String accountId, String json) async {
    if (failWrites) throw const FileSystemException('disk full');
    return super.write(accountId, json);
  }

  @override
  Future<void> delete(String accountId) async {
    if (failDeletes) throw const FileSystemException('disk full');
    return super.delete(accountId);
  }
}
