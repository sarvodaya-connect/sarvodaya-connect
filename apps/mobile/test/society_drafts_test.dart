import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/drafts/draft_store.dart';
import 'package:sarvodaya_connect_mobile/src/incidents/assessment_queue.dart'
    show MemoryQueueKeyStore;
import 'package:sarvodaya_connect_mobile/src/l10n/generated/app_localizations.dart';
import 'package:sarvodaya_connect_mobile/src/l10n/l10n_format.dart'
    show ClientFailure;
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/demo_society_record_api.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/profile_draft_merge.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_api.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_models.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_screen.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';

import 'test_helpers.dart';

/// Issue #127: society profile drafts kept on the phone, and the Reload
/// Record flow. Every society, person and value here is fictional.

const _pahala = 'society-pahala-kosgama';

const _offline = SocietyRecordException(
  'The server did not answer. Check your connection and try again.',
  offline: true,
  failure: ClientFailure.offline,
);

/// The demo records, with a switch for the connection and for access.
class _Api extends DemoSocietyRecordApi {
  _Api({required super.user, required super.clock})
    : super(delay: Duration.zero);

  bool offline = false;
  bool revoked = false;
  final sent = <Map<String, Object>>[];

  @override
  Future<SocietyRecord> fetchRecord(String id) async {
    if (offline) throw _offline;
    if (revoked) {
      throw const SocietyRecordException('Not authorised', status: 403);
    }
    return super.fetchRecord(id);
  }

  @override
  Future<SocietyRecord> updateRecord(
    String id,
    Map<String, Object> changes,
  ) async {
    if (offline) throw _offline;
    sent.add(changes);
    return super.updateRecord(id, changes);
  }

  /// Someone else saves a change, straight to the record.
  Future<void> changedElsewhere(Map<String, Object> changes) =>
      super.updateRecord(_pahala, changes);
}

const _a = AuthenticatedUser(
  id: 'user-test-a',
  displayName: 'Test A',
  roles: [UserRole.societyOfficer],
  societyIds: [_pahala],
);
const _b = AuthenticatedUser(
  id: 'user-test-b',
  displayName: 'Test B',
  roles: [UserRole.societyOfficer],
  societyIds: [_pahala],
);

void main() {
  group('merging a draft with a newer record', () {
    Map<String, String> values(Map<String, String> changes) => {
      for (final field in profileDraftFields) field: '',
      'nameEn': 'Old Name',
      'addressLine': 'Old Road',
      'landline': '037 000 0000',
      ...changes,
    };

    test('keeps edits, takes newer untouched fields, flags overlaps', () {
      final merge = mergeProfileDraft(
        base: values({}),
        values: values({'nameEn': 'My Name', 'landline': '037 111 1111'}),
        latest: values({
          'nameEn': 'Their Name',
          'addressLine': 'New Road',
          'landline': '037 111 1111',
        }),
      );
      expect(merge.values['nameEn'], 'My Name');
      expect(merge.values['addressLine'], 'New Road');
      expect(merge.values['landline'], '037 111 1111');
      expect(merge.conflicts, {'nameEn'});
      expect(merge.tookNewer, {'addressLine'});
      expect(merge.base['nameEn'], 'Their Name');
    });

    test('an unchanged record changes nothing', () {
      final merge = mergeProfileDraft(
        base: values({}),
        values: values({'nameEn': 'My Name'}),
        latest: values({}),
      );
      expect(merge.changedOnServer, isFalse);
      expect(merge.values['nameEn'], 'My Name');
    });
  });

  group('the draft store', () {
    late AuthenticatedUser? user;
    late MemoryDraftStorage storage;
    late DraftStore drafts;

    setUp(() {
      user = _a;
      storage = MemoryDraftStorage();
      drafts = DraftStore(storage: storage, user: () => user);
    });

    test('keeps one draft per account, society and form', () async {
      await drafts.save(DraftKind.societyProfile, _pahala, {'x': 1});
      expect((await drafts.read(DraftKind.societyProfile, _pahala))!.data, {
        'x': 1,
      });
      expect(await drafts.read(DraftKind.societyProfile, 'other'), isNull);

      user = _b;
      expect(await drafts.read(DraftKind.societyProfile, _pahala), isNull);
      user = null;
      expect(await drafts.read(DraftKind.societyProfile, _pahala), isNull);
      expect(
        await drafts.save(DraftKind.societyProfile, _pahala, {'x': 2}),
        isNull,
      );

      user = _a;
      expect((await drafts.read(DraftKind.societyProfile, _pahala))!.data, {
        'x': 1,
      });
      await drafts.discard(DraftKind.societyProfile, _pahala);
      expect(await drafts.read(DraftKind.societyProfile, _pahala), isNull);
    });

    test('quick typing writes the latest text', () async {
      final saves = [
        for (var i = 0; i < 20; i++)
          drafts.save(DraftKind.societyProfile, _pahala, {'x': i}),
      ];
      await Future.wait(saves);
      expect((await drafts.read(DraftKind.societyProfile, _pahala))!.data, {
        'x': 19,
      });
    });

    test('a discard wins over a save still waiting', () async {
      final save = drafts.save(DraftKind.societyProfile, _pahala, {'x': 1});
      final discard = drafts.discard(DraftKind.societyProfile, _pahala);
      await Future.wait([save, discard]);
      expect(await drafts.read(DraftKind.societyProfile, _pahala), isNull);
    });

    group('on the phone', () {
      late Directory root;
      late MemoryQueueKeyStore keys;

      setUp(() async {
        root = await Directory.systemTemp.createTemp('drafts-test');
        keys = MemoryQueueKeyStore();
      });
      tearDown(() => root.delete(recursive: true));

      DraftStore phone() => DraftStore(
        storage: EncryptedFileDraftStorage(keys: keys, root: () async => root),
        user: () => user,
      );

      test('is encrypted, per account, and survives a restart', () async {
        await phone().save(DraftKind.societyProfile, _pahala, {
          'values': {'nameEn': 'Fictional Draft Name'},
        });
        final file = root.listSync(recursive: true).whereType<File>().single;
        expect(
          latin1.decode(file.readAsBytesSync(), allowInvalid: true),
          isNot(contains('Fictional')),
        );

        final restarted = phone();
        expect(
          (await restarted.read(DraftKind.societyProfile, _pahala))!.data,
          {
            'values': {'nameEn': 'Fictional Draft Name'},
          },
        );
        user = _b;
        expect(await restarted.read(DraftKind.societyProfile, _pahala), isNull);
      });

      test('a draft that cannot be decrypted is not shown', () async {
        await phone().save(DraftKind.societyProfile, _pahala, {'x': 1});
        keys.keys.clear();
        expect(await phone().read(DraftKind.societyProfile, _pahala), isNull);
      });
    });
  });

  group('editing the society', () {
    late _Api api;
    late MemoryDraftStorage storage;

    setUp(() => storage = MemoryDraftStorage());

    /// A fresh app on the same phone: a new store, the same saved drafts.
    Future<DemoStore> pump(
      WidgetTester tester, {
      UserRole role = UserRole.societyOfficer,
    }) async {
      tester.view.physicalSize = const Size(412, 2400) * 3;
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      DemoStore? holder;
      api = _Api(user: () => holder?.user, clock: () => demoNow);
      final store = DemoStore(
        loadDelay: Duration.zero,
        clock: () => demoNow,
        societyRecordApi: api,
        draftStorage: storage,
      )..switchDemoRole(role);
      holder = store;
      await tester.pumpWidget(
        DemoScope(
          // A new app each time: nothing on screen is kept.
          key: UniqueKey(),
          store: store,
          child: MaterialApp(
            theme: AppTheme.light(),
            supportedLocales: AppLocalizations.supportedLocales,
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            home: const SocietyRecordScreen(societyId: _pahala),
          ),
        ),
      );
      await tester.pumpAndSettle();
      return store;
    }

    Future<void> openEdit(WidgetTester tester) async {
      await tester.tap(find.widgetWithText(OutlinedButton, 'Edit'));
      await tester.pumpAndSettle();
    }

    Finder box(int index) => find.byType(TextField).at(index);
    String text(WidgetTester tester, int index) =>
        tester.widget<TextField>(box(index)).controller!.text;

    Future<void> tap(WidgetTester tester, Finder finder) async {
      await tester.ensureVisible(finder);
      await tester.pumpAndSettle();
      await tester.tap(finder);
      await tester.pumpAndSettle();
    }

    Future<void> save(WidgetTester tester) =>
        tap(tester, find.widgetWithText(FilledButton, 'Save changes'));

    testWidgets('leaving and reopening keeps the draft', (tester) async {
      await pump(tester);
      await openEdit(tester);
      await tester.enterText(box(0), 'Draft Name SSS');
      await tester.enterText(box(1), '25');
      await tester.enterText(box(2), '17');
      await tester.pumpAndSettle();
      expect(find.text('Saved on this phone'), findsOneWidget);

      await tap(tester, find.widgetWithText(OutlinedButton, 'Cancel'));
      await tap(tester, find.text('Keep draft and leave'));
      expect(find.text('Edit Society Information'), findsNothing);
      expect(api.sent, isEmpty);

      await openEdit(tester);
      expect(text(tester, 0), 'Draft Name SSS');
      expect(text(tester, 1), '25');
      expect(text(tester, 2), '17');
      expect(find.text('Saved on this phone'), findsOneWidget);
    });

    testWidgets('an app restart keeps the draft', (tester) async {
      await pump(tester);
      await openEdit(tester);
      await tester.enterText(box(0), 'Restart Name SSS');
      await tester.pumpAndSettle();

      // The app closes without leaving the screen, and opens again.
      await pump(tester);
      await openEdit(tester);
      expect(text(tester, 0), 'Restart Name SSS');
    });

    testWidgets('another account on the phone never sees the draft', (
      tester,
    ) async {
      await pump(tester);
      await openEdit(tester);
      await tester.enterText(box(0), 'Private Draft SSS');
      await tester.pumpAndSettle();

      // The fictional DDM also covers this society, as another account.
      await pump(tester, role: UserRole.deputyDistrictManager);
      await openEdit(tester);
      expect(text(tester, 0), isNot('Private Draft SSS'));
      expect(find.text('Saved on this phone'), findsNothing);
    });

    testWidgets('offline the draft is kept; Try again sends it once', (
      tester,
    ) async {
      await pump(tester);
      await openEdit(tester);
      await tester.enterText(box(0), 'Offline Name SSS');
      await tester.pumpAndSettle();

      api.offline = true;
      await save(tester);
      expect(find.text('Connection required'), findsOneWidget);
      expect(find.text('Saved on this phone'), findsOneWidget);
      expect(find.text('Edit Society Information'), findsOneWidget);
      expect(api.sent, isEmpty);
      expect(storage.saved, hasLength(1));

      api.offline = false;
      await tap(tester, find.widgetWithText(OutlinedButton, 'Try again'));
      expect(api.sent, [
        {'nameEn': 'Offline Name SSS'},
      ]);
      expect(find.text('Edit Society Information'), findsNothing);
      expect(storage.saved, isEmpty);
      expect((await api.fetchRecord(_pahala)).nameEn, 'Offline Name SSS');
    });

    testWidgets('a newer record: untouched fields update, overlaps are '
        'reviewed before anything is sent', (tester) async {
      await pump(tester);
      await openEdit(tester);
      await tester.enterText(box(0), 'My Name SSS');
      await tester.pumpAndSettle();

      await api.changedElsewhere({
        'nameEn': 'Their Name SSS',
        'addressLine': '12 Newer Road, Pahala Kosgama',
      });
      await save(tester);
      expect(api.sent, isEmpty);
      expect(find.text('Someone else changed this society'), findsOneWidget);
      expect(
        find.text('Also changed by someone else. Now: Their Name SSS'),
        findsOneWidget,
      );
      expect(text(tester, 0), 'My Name SSS');
      expect(text(tester, 3), '12 Newer Road, Pahala Kosgama');

      // Reviewed: saving again sends only the person's own change.
      await save(tester);
      expect(api.sent, [
        {'nameEn': 'My Name SSS'},
      ]);
      final record = await api.fetchRecord(_pahala);
      expect(record.nameEn, 'My Name SSS');
      expect(record.addressLine, '12 Newer Road, Pahala Kosgama');
      expect(storage.saved, isEmpty);
    });

    testWidgets('Reload record merges a draft reopened later', (tester) async {
      await pump(tester);
      await openEdit(tester);
      await tester.enterText(box(0), 'Kept Name SSS');
      await tester.pumpAndSettle();
      await tap(tester, find.widgetWithText(OutlinedButton, 'Cancel'));
      await tap(tester, find.text('Keep draft and leave'));

      await api.changedElsewhere({'landline': '037 222 2222'});
      await openEdit(tester);
      expect(text(tester, 0), 'Kept Name SSS');
      await tap(tester, find.widgetWithText(OutlinedButton, 'Reload record'));
      expect(text(tester, 0), 'Kept Name SSS');
      expect(text(tester, 4), '037 222 2222');
      expect(
        find.textContaining('Newer values were filled in'),
        findsOneWidget,
      );
    });

    testWidgets('access removed: nothing is sent and the draft is kept', (
      tester,
    ) async {
      await pump(tester);
      await openEdit(tester);
      await tester.enterText(box(0), 'Revoked Name SSS');
      await tester.pumpAndSettle();

      api.revoked = true;
      await save(tester);
      expect(find.text('You can no longer edit this society'), findsOneWidget);
      expect(api.sent, isEmpty);
      expect(storage.saved, hasLength(1));
    });

    testWidgets('Discard draft asks first, then goes back to the record', (
      tester,
    ) async {
      await pump(tester);
      await openEdit(tester);
      final original = text(tester, 0);
      await tester.enterText(box(0), 'Discard Me SSS');
      await tester.pumpAndSettle();

      await tap(tester, find.widgetWithText(TextButton, 'Discard draft'));
      expect(find.text('Discard this draft?'), findsOneWidget);
      await tap(tester, find.widgetWithText(FilledButton, 'Discard draft'));
      expect(text(tester, 0), original);
      expect(find.text('Saved on this phone'), findsNothing);
      expect(storage.saved, isEmpty);
    });
  });
}
