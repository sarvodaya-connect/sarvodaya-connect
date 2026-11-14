import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/home/home_api.dart';
import 'package:sarvodaya_connect_mobile/src/l10n/generated/app_localizations.dart';
import 'package:sarvodaya_connect_mobile/src/l10n/l10n_format.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/national/national_screens.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';

import 'test_helpers.dart';

/// Issue #119: "Show more" on the phone's Audits & AGM follow-up list. Each
/// request waits until the test answers it, so answers can arrive late, out
/// of order or fail. Every society here is fictional.

typedef _Call = ({int? year, bool district, int page});

class _ScriptedHomeApi implements HomeApi {
  final calls = <_Call>[];
  final _answers = <Completer<ScopedAudits>>[];

  @override
  Future<ScopedAudits> fetchAudits({
    int? year,
    bool district = false,
    int page = 1,
  }) {
    calls.add((year: year, district: district, page: page));
    final answer = Completer<ScopedAudits>();
    _answers.add(answer);
    return answer.future;
  }

  void answer(int call, ScopedAudits audits) => _answers[call].complete(audits);
  void fail(int call, Object error) => _answers[call].completeError(error);

  @override
  Future<RoleHome> fetchHome() => throw UnimplementedError();
  @override
  Future<HomeSocietyList> fetchSocieties(HomeSocietyQuery query) =>
      throw UnimplementedError();
  @override
  Future<ScopedMembership> fetchMembership({bool district = false}) =>
      throw UnimplementedError();
}

ScopedAudits _audits(
  List<String> names, {
  int year = 2025,
  bool district = false,
  int page = 1,
  int totalPages = 3,
  bool districtView = false,
}) => ScopedAudits(
  scope: district ? 'DISTRICT' : 'MINE',
  startYear: year,
  yearLabel: 'FY $year/${(year + 1) % 100}',
  activeSocieties: 18,
  byType: [
    for (final type in [
      'AUDIT_REPORT',
      'AGM_MINUTES',
      'OFFICE_BEARER_LIST',
      'MEMBERS_LIST',
    ])
      (documentType: type, submitted: 9, missing: 9),
  ],
  allFour: 6,
  dueOn: DateTime(year + 1, 9, 30),
  pastDue: true,
  followUp: [
    for (final name in names)
      (id: 'id-$name', name: name, code: 'SC-$name', district: 'Kurunegala'),
  ],
  followUpTotal: 60,
  page: page,
  totalPages: totalPages,
  districtViewAvailable: districtView,
);

const _offline = HomeException(
  'The server did not answer. Check your connection and try again.',
  failure: ClientFailure.offline,
);

Future<_ScriptedHomeApi> _open(
  WidgetTester tester, {
  String code = 'en',
  UserRole role = UserRole.programmeCoordinator,
  ScopedAudits? first,
}) async {
  tester.view.physicalSize = const Size(360, 2600) * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final api = _ScriptedHomeApi();
  final store = DemoStore(
    loadDelay: Duration.zero,
    clock: () => demoNow,
    homeApi: api,
  )..switchDemoRole(role);
  await tester.pumpWidget(
    DemoScope(
      store: store,
      child: MaterialApp(
        theme: AppTheme.light(),
        locale: Locale(code),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        home: const RoleAuditsScreen(),
      ),
    ),
  );
  api.answer(0, first ?? _audits(['Fictional Alpha SSS']));
  await tester.pumpAndSettle();
  return api;
}

Future<void> _tap(WidgetTester tester, String text) async {
  await tester.ensureVisible(find.text(text));
  await tester.pump();
  await tester.tap(find.text(text));
  await tester.pump();
}

void main() {
  testWidgets(
    'a failed page keeps the rows shown, says why, and retries the same page',
    (tester) async {
      final api = await _open(tester);
      await _tap(tester, 'Show more');
      expect(api.calls.last, (year: 2025, district: false, page: 2));

      api.fail(1, _offline);
      await tester.pumpAndSettle();
      expect(find.text('Fictional Alpha SSS'), findsOneWidget);
      expect(find.text('More societies could not be loaded'), findsOneWidget);
      expect(find.textContaining('Check your connection'), findsOneWidget);
      expect(find.text('Show more'), findsNothing);

      await _tap(tester, 'Try again');
      expect(api.calls, hasLength(3));
      expect(api.calls.last, (year: 2025, district: false, page: 2));
      api.answer(2, _audits(['Fictional Beta SSS'], page: 2));
      await tester.pumpAndSettle();
      expect(find.text('Fictional Alpha SSS'), findsOneWidget);
      expect(find.text('Fictional Beta SSS'), findsOneWidget);
      expect(find.text('More societies could not be loaded'), findsNothing);
      expect(find.text('Show more'), findsOneWidget);
    },
  );

  testWidgets('an unexpected failure still gets a message and a retry', (
    tester,
  ) async {
    final api = await _open(tester);
    await _tap(tester, 'Show more');
    api.fail(1, const FormatException('bad page'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.text('More societies could not be loaded'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
    expect(find.text('Fictional Alpha SSS'), findsOneWidget);
  });

  for (final (code, title, retry) in [
    ('si', 'තවත් සමිති පූරණය කළ නොහැකි විය', 'නැවත උත්සාහ කරන්න'),
    ('ta', 'மேலும் சங்கங்களை ஏற்ற முடியவில்லை', 'மீண்டும் முயலவும்'),
  ]) {
    testWidgets('says a page failed in $code', (tester) async {
      final api = await _open(tester, code: code);
      await _tap(tester, code == 'si' ? 'තවත් පෙන්වන්න' : 'மேலும் காட்டு');
      api.fail(1, _offline);
      await tester.pumpAndSettle();
      expect(find.text(title), findsOneWidget);
      expect(find.text(retry), findsOneWidget);
      expect(find.text('Fictional Alpha SSS'), findsOneWidget);
    });
  }

  testWidgets(
    'a DDM whose district access ends between pages goes back to their own societies',
    (tester) async {
      final api = await _open(
        tester,
        role: UserRole.deputyDistrictManager,
        first: _audits(['Fictional Own SSS'], districtView: true),
      );
      await _tap(tester, 'District · view only');
      expect(api.calls.last, (year: null, district: true, page: 1));
      api.answer(
        1,
        _audits(['Fictional District SSS'], district: true, districtView: true),
      );
      await tester.pumpAndSettle();
      expect(find.text('Fictional District SSS'), findsOneWidget);

      await _tap(tester, 'Show more');
      expect(api.calls.last, (year: 2025, district: true, page: 2));
      // Revoked or expired before the second page.
      api.fail(
        2,
        const HomeException(
          'Your temporary district-wide view has ended',
          status: 403,
        ),
      );
      await tester.pump();
      expect(api.calls.last, (year: null, district: false, page: 1));
      api.answer(3, _audits(['Fictional Own SSS']));
      await tester.pumpAndSettle();
      expect(find.text('Fictional District SSS'), findsNothing);
      expect(find.text('Fictional Own SSS'), findsOneWidget);
      expect(find.text('Your 18 assigned societies'), findsOneWidget);
      expect(find.text('More societies could not be loaded'), findsNothing);

      // The next page is of the user's own societies.
      await _tap(tester, 'Show more');
      expect(api.calls.last, (year: 2025, district: false, page: 2));
    },
  );

  testWidgets('a late page for the previous year is never added', (
    tester,
  ) async {
    final api = await _open(tester);
    await _tap(tester, 'Show more');
    expect(api.calls.last, (year: 2025, district: false, page: 2));

    await _tap(tester, 'FY 2023/24');
    expect(api.calls.last, (year: 2023, district: false, page: 1));
    api.answer(2, _audits(['Fictional 2023 SSS'], year: 2023));
    await tester.pumpAndSettle();

    // The 2025 page arrives after the year changed.
    api.answer(1, _audits(['Fictional Late 2025 SSS'], page: 2));
    await tester.pumpAndSettle();
    expect(find.text('Fictional Late 2025 SSS'), findsNothing);
    expect(find.text('Fictional 2023 SSS'), findsOneWidget);
    expect(find.text('Showing 1 of 60'), findsOneWidget);

    // Not left loading: the next page is of 2023, from page 2.
    await _tap(tester, 'Show more');
    expect(api.calls.last, (year: 2023, district: false, page: 2));
  });

  testWidgets('a late failure after the scope changed shows no error', (
    tester,
  ) async {
    final api = await _open(
      tester,
      role: UserRole.deputyDistrictManager,
      first: _audits(['Fictional Own SSS'], districtView: true),
    );
    await _tap(tester, 'Show more');
    await _tap(tester, 'District · view only');
    expect(api.calls.last, (year: null, district: true, page: 1));
    api.answer(
      2,
      _audits(['Fictional District SSS'], district: true, districtView: true),
    );
    await tester.pumpAndSettle();

    api.fail(1, _offline);
    await tester.pumpAndSettle();
    expect(find.text('More societies could not be loaded'), findsNothing);
    expect(find.text('Fictional District SSS'), findsOneWidget);
    await _tap(tester, 'Show more');
    expect(api.calls.last, (year: 2025, district: true, page: 2));
  });

  testWidgets('a late page after a refresh is never added', (tester) async {
    final api = await _open(tester);
    await _tap(tester, 'Show more');
    // Pull to refresh.
    unawaited(
      tester.state<RefreshIndicatorState>(find.byType(RefreshIndicator)).show(),
    );
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    expect(api.calls.last, (year: null, district: false, page: 1));
    api.answer(2, _audits(['Fictional Fresh SSS']));
    await tester.pumpAndSettle();

    api.answer(1, _audits(['Fictional Late SSS'], page: 2));
    await tester.pumpAndSettle();
    expect(find.text('Fictional Late SSS'), findsNothing);
    expect(find.text('Fictional Fresh SSS'), findsOneWidget);
  });

  testWidgets('a page that arrives after leaving the screen is ignored', (
    tester,
  ) async {
    final api = await _open(tester);
    await _tap(tester, 'Show more');
    await tester.pumpWidget(const SizedBox());
    api.answer(1, _audits(['Fictional Late SSS'], page: 2));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
