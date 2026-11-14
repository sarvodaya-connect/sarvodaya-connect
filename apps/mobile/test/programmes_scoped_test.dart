import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/data/demo_data.dart';
import 'package:sarvodaya_connect_mobile/src/home/home_screens.dart';
import 'package:sarvodaya_connect_mobile/src/l10n/l10n.dart';
import 'package:sarvodaya_connect_mobile/src/l10n/l10n_format.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/national/demo_national_api.dart';
import 'package:sarvodaya_connect_mobile/src/national/national_api.dart';
import 'package:sarvodaya_connect_mobile/src/national/national_models.dart';
import 'package:sarvodaya_connect_mobile/src/national/national_screens.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';

import 'test_helpers.dart';

/// Issue #117 on the phone: M64 Programmes & Activities for a DM, DDM and
/// SPC, over their own societies. Every person and society is fictional;
/// the Sinhala and Tamil are unreviewed drafts.

AuthenticatedUser _ddm(List<DistrictAccessGrant> grants) => AuthenticatedUser(
  id: demoDdm.id,
  displayName: demoDdm.displayName,
  roles: demoDdm.roles,
  districtIds: demoDdm.districtIds,
  societyIds: demoDdm.societyIds,
  delegatedDistrictAccess: grants,
);

DistrictAccessGrant _grant(Duration startsIn, Duration endsIn) =>
    DistrictAccessGrant(
      districtId: 'district-kurunegala',
      startsAt: demoNow.add(startsIn),
      expiresAt: demoNow.add(endsIn),
      grantedByName: 'R. Fernando',
    );

DemoNationalApi _api(AuthenticatedUser user) => DemoNationalApi(
  user: () => user,
  delay: Duration.zero,
  clock: () => demoNow,
);

/// Fails once, then answers, to check the error state's retry.
class _FailingOnce implements NationalApi {
  _FailingOnce(this.inner);
  final NationalApi inner;
  int calls = 0;

  @override
  Future<NationalProgrammes> fetchScopedProgrammes({int? year}) async {
    calls++;
    if (calls == 1) {
      throw const SocietyRecordException(
        'Could not reach the server',
        failure: ClientFailure.offline,
      );
    }
    return inner.fetchScopedProgrammes(year: year);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

/// Records the year each request asks for.
class _Years implements NationalApi {
  _Years(this.inner);
  final NationalApi inner;
  final years = <int?>[];

  @override
  Future<NationalProgrammes> fetchScopedProgrammes({int? year}) {
    years.add(year);
    return inner.fetchScopedProgrammes(year: year);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Future<DemoStore> _pump(
  WidgetTester tester,
  Widget home, {
  required UserRole role,
  String code = 'en',
  NationalApi? api,
  Size size = const Size(412, 3000),
  double textScale = 1,
  bool failLoads = false,
}) async {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  if (textScale != 1) {
    tester.platformDispatcher.textScaleFactorTestValue = textScale;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
  }
  final store = DemoStore(
    loadDelay: Duration.zero,
    clock: () => demoNow,
    nationalApi: api,
  )..switchDemoRole(role);
  store.failLoads = failLoads;
  await tester.pumpWidget(
    DemoScope(
      store: store,
      child: MaterialApp(
        theme: AppTheme.light(),
        locale: Locale(code),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        home: home,
      ),
    ),
  );
  await tester.pumpAndSettle();
  return store;
}

List<String> _texts(WidgetTester tester) => [
  for (final widget in tester.widgetList<RichText>(find.byType(RichText)))
    widget.text.toPlainText(),
];

void main() {
  group('the scope the demo serves, like the server', () {
    Future<ProgrammeScope?> scope(AuthenticatedUser user) async =>
        (await _api(user).fetchScopedProgrammes()).scope;

    test('a DM sees their district only', () async {
      final result = await scope(demoDistrictManager);
      expect(result!.kind, ProgrammeScopeKind.district);
      expect(result.districts, ['Kurunegala']);
      expect(result.societies, 106);
    });

    test(
      'an SPC sees assigned societies, not the district they are in',
      () async {
        final result = await scope(demoSpc);
        expect(result!.kind, ProgrammeScopeKind.assigned);
        expect(result.societies, 2);
        expect(result.districts, isEmpty);
      },
    );

    test('a DDM sees the district only while a grant is valid', () async {
      Future<ProgrammeScopeKind> kind(List<DistrictAccessGrant> grants) async =>
          (await scope(_ddm(grants)))!.kind;
      // The district affiliation alone, and a grant ended early (the server
      // sends no revoked grant), give only the assigned society.
      expect(await kind([]), ProgrammeScopeKind.assigned);
      // Before it starts.
      expect(
        await kind([_grant(const Duration(hours: 1), const Duration(days: 1))]),
        ProgrammeScopeKind.assigned,
      );
      // While valid.
      final during = await scope(
        _ddm([_grant(const Duration(hours: -1), const Duration(days: 4))]),
      );
      expect(during!.kind, ProgrammeScopeKind.assignedAndDistrict);
      expect(
        during.temporaryAccessEndsAt,
        demoNow.add(const Duration(days: 4)),
      );
      // After it expires.
      expect(
        await kind([
          _grant(const Duration(days: -2), const Duration(seconds: -1)),
        ]),
        ProgrammeScopeKind.assigned,
      );
    });

    test(
      'HQ and Society Officers are refused; HQ keeps the national figures',
      () async {
        for (final user in [demoHqAdmin, demoOfficer]) {
          await expectLater(
            _api(user).fetchScopedProgrammes(),
            throwsA(
              isA<SocietyRecordException>().having(
                (e) => e.status,
                'status',
                403,
              ),
            ),
          );
        }
        final national = await _api(demoHqAdmin).fetchProgrammes();
        expect(national.scope, isNull);
        await expectLater(
          _api(demoSpc).fetchProgrammes(),
          throwsA(isA<SocietyRecordException>()),
        );
      },
    );

    test('ranks all 17 SDGs, equal counts by SDG number', () async {
      final result = await _api(demoDistrictManager).fetchScopedProgrammes();
      expect(result.sdgs, hasLength(17));
      for (var i = 1; i < result.sdgs.length; i++) {
        final (a, b) = (result.sdgs[i - 1], result.sdgs[i]);
        expect(
          a.completed > b.completed ||
              (a.completed == b.completed && a.sdg < b.sdg),
          isTrue,
        );
      }
    });

    test('reads the scope the server sends', () {
      final parsed = NationalProgrammes.fromJson({
        'financialYear': {'startYear': 2025, 'label': 'FY 2025/26'},
        'planned': 2,
        'completed': 1,
        'sectors': [
          {'sector': 'Culture', 'planned': 2, 'completed': 1, 'societies': 1},
        ],
        'byDimension': <Object>[],
        'sdgs': <Object>[],
        'recent': <Object>[],
        'scope': {
          'kind': 'ASSIGNED_AND_DISTRICT',
          'societies': 14,
          'districts': [
            {'id': 'd1', 'name': 'Kurunegala'},
          ],
          'temporaryAccessEndsAt': '2026-11-08T12:30:00.000Z',
        },
      });
      expect(parsed.sectors['Culture'], (1, 2, 1));
      expect(parsed.scope!.kind, ProgrammeScopeKind.assignedAndDistrict);
      expect(parsed.scope!.districts, ['Kurunegala']);
      expect(parsed.scope!.temporaryAccessEndsAt!.isUtc, isTrue);
    });
  });

  for (final (role, line) in [
    (UserRole.districtManager, 'Kurunegala · 106 societies'),
    (UserRole.deputyDistrictManager, 'Your 1 assigned society'),
    (UserRole.programmeCoordinator, 'Your 2 assigned societies'),
  ]) {
    testWidgets('the ${role.name} home opens their own Programmes view', (
      tester,
    ) async {
      await _pump(tester, const RoleHomeScreen(), role: role);
      final link = find.text('Programmes & Activities');
      await tester.ensureVisible(link);
      await tester.tap(link);
      await tester.pumpAndSettle();
      expect(find.text('Done vs planned · SPC-approved only'), findsOneWidget);
      expect(_texts(tester).where((text) => text.contains(line)), isNotEmpty);
    });
  }

  testWidgets('a DDM with valid temporary access sees when it ends', (
    tester,
  ) async {
    final api = _api(
      _ddm([_grant(const Duration(hours: -1), const Duration(days: 4))]),
    );
    await _pump(
      tester,
      const NationalActivitiesScreen(scoped: true),
      role: UserRole.deputyDistrictManager,
      api: api,
    );
    expect(
      _texts(tester).where(
        (text) =>
            text.contains('Your assigned societies and Kurunegala') &&
            text.contains('temporary access until'),
      ),
      isNotEmpty,
    );
  });

  testWidgets('choosing a financial year asks for that year', (tester) async {
    final api = _Years(_api(demoDistrictManager));
    await _pump(
      tester,
      const NationalActivitiesScreen(scoped: true),
      role: UserRole.districtManager,
      api: api,
    );
    expect(
      tester
          .widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'FY 2025/26'))
          .selected,
      isTrue,
    );
    await tester.tap(find.widgetWithText(ChoiceChip, 'FY 2023/24'));
    await tester.pumpAndSettle();
    expect(api.years, [null, 2023]);
    expect(
      tester
          .widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'FY 2023/24'))
          .selected,
      isTrue,
    );
  });

  test('the year in progress comes first, then the five that have ended (issue #131)', () {
    expect(selectableProgrammeYears(DateTime(2026, 11, 10)), [
      2026,
      2025,
      2024,
      2023,
      2022,
      2021,
    ]);
    // 31 March is still the old financial year.
    expect(selectableProgrammeYears(DateTime(2026, 3, 31)).first, 2025);
    expect(
      FinancialYearLabel.fromJson({
        'startYear': 2026,
        'label': 'FY 2026/27',
        'inProgress': true,
      }).inProgress,
      isTrue,
    );
  });

  testWidgets('the year in progress says what its completed counts mean', (
    tester,
  ) async {
    final api = _Years(_api(demoDistrictManager));
    await _pump(
      tester,
      const NationalActivitiesScreen(scoped: true),
      role: UserRole.districtManager,
      api: api,
    );
    expect(find.textContaining('is still in progress'), findsNothing);
    await tester.tap(find.widgetWithText(ChoiceChip, 'FY 2026/27'));
    await tester.pumpAndSettle();
    expect(api.years, [null, 2026]);
    expect(
      find.textContaining('FY 2026/27 is still in progress.'),
      findsOneWidget,
    );
  });

  testWidgets('an SPC with no societies sees an empty state, not zeros alone', (
    tester,
  ) async {
    const nobody = AuthenticatedUser(
      id: 'user-fictional-new-spc',
      displayName: 'N. Fictional',
      roles: [UserRole.programmeCoordinator],
      districtIds: ['district-kurunegala'],
      societyIds: [],
    );
    await _pump(
      tester,
      const NationalActivitiesScreen(scoped: true),
      role: UserRole.programmeCoordinator,
      api: _api(nobody),
    );
    expect(find.text('No Societies Assigned Yet'), findsOneWidget);
  });

  testWidgets('figures that fail to load say so, and try again', (
    tester,
  ) async {
    final api = _FailingOnce(_api(demoSpc));
    await _pump(
      tester,
      const NationalActivitiesScreen(scoped: true),
      role: UserRole.programmeCoordinator,
      api: api,
    );
    expect(find.text('Programme Figures Are Unavailable'), findsOneWidget);
    expect(find.text('10 Sectors'), findsNothing);
    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();
    expect(find.text('10 Sectors'), findsOneWidget);
    expect(api.calls, 2);
  });

  testWidgets('a role home that failed to load opens on Try again', (
    tester,
  ) async {
    final store = await _pump(
      tester,
      const RoleHomeScreen(),
      role: UserRole.programmeCoordinator,
      failLoads: true,
    );
    expect(find.text('Try again'), findsOneWidget);
    store.failLoads = false;
    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.text('Programmes & Activities'), findsOneWidget);
  });

  testWidgets('HQ\'s M64 stays national, with no scope line', (tester) async {
    await _pump(
      tester,
      const NationalActivitiesScreen(),
      role: UserRole.hqAdmin,
    );
    expect(find.text('10 Sectors'), findsOneWidget);
    expect(find.textContaining('Counted over'), findsNothing);
  });

  for (final (code, language) in [('si', 'Sinhala'), ('ta', 'Tamil')]) {
    final l = lookupAppLocalizations(Locale(code));

    testWidgets('M64 for a DM in $language', (tester) async {
      await _pump(
        tester,
        const NationalActivitiesScreen(scoped: true),
        role: UserRole.districtManager,
        code: code,
      );
      expect(find.text(l.progTitle), findsOneWidget);
      expect(find.text(l.progSector1), findsOneWidget);
      final shown = _texts(tester).join('\n');
      expect(shown, contains(l.progSdg4));
      for (final english in [
        'Programmes & Activities',
        'planned completed',
        '10 Sectors',
        'Community education',
        'Quality Education',
        'Counted over',
        'societies',
        'equal counts',
      ]) {
        expect(
          shown,
          isNot(contains(english)),
          reason: '"$english" in English',
        );
      }
    });

    for (final role in [
      UserRole.districtManager,
      UserRole.deputyDistrictManager,
      UserRole.programmeCoordinator,
    ]) {
      testWidgets(
        'M64 for ${role.name} fits a small phone with large text in $language',
        (tester) async {
          await _pump(
            tester,
            const NationalActivitiesScreen(scoped: true),
            role: role,
            code: code,
            size: const Size(320, 568),
            textScale: 2,
          );
          expect(tester.takeException(), isNull);
          await tester.drag(find.byType(ListView), const Offset(0, -2000));
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
        },
      );
    }
  }
}
