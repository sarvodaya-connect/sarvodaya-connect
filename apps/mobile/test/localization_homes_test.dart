import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/district_access/district_access_api.dart';
import 'package:sarvodaya_connect_mobile/src/district_access/district_access_screens.dart';
import 'package:sarvodaya_connect_mobile/src/home/home_api.dart';
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

/// Issue #108 phase 2 on the phone: role homes, national views, temporary
/// access and the shared states, in Sinhala and Tamil. Everyone and every
/// society here is fictional. The Sinhala and Tamil are unreviewed drafts.

class _Refusing implements HomeApi {
  @override
  Future<RoleHome> fetchHome() async =>
      throw const HomeException('Forbidden', status: 403);

  @override
  Future<HomeSocietyList> fetchSocieties(HomeSocietyQuery query) async =>
      throw const HomeException('Forbidden', status: 403);

  @override
  Future<ScopedMembership> fetchMembership({bool district = false}) async =>
      throw const HomeException('Forbidden', status: 403);

  @override
  Future<ScopedAudits> fetchAudits({
    int? year,
    bool district = false,
    int page = 1,
  }) async => throw const HomeException('Forbidden', status: 403);
}

class _Offline implements HomeApi {
  @override
  Future<RoleHome> fetchHome() async => throw const HomeException(
    'The server did not answer. Check your connection and try again.',
    failure: ClientFailure.offline,
  );

  @override
  Future<HomeSocietyList> fetchSocieties(HomeSocietyQuery query) =>
      fetchHome().then((_) => throw StateError('unreachable'));

  @override
  Future<ScopedMembership> fetchMembership({bool district = false}) =>
      fetchHome().then((_) => throw StateError('unreachable'));

  @override
  Future<ScopedAudits> fetchAudits({
    int? year,
    bool district = false,
    int page = 1,
  }) => fetchHome().then((_) => throw StateError('unreachable'));
}

class _NationalOffline extends DemoNationalApi {
  _NationalOffline() : super(user: () => null, delay: Duration.zero);

  @override
  Future<NationalOverview> fetchOverview() async =>
      throw const SocietyRecordException(
        'The server did not answer. Check your connection and try again.',
        offline: true,
        failure: ClientFailure.offline,
      );
}

Future<DemoStore> _pump(
  WidgetTester tester,
  Widget home, {
  required String code,
  required UserRole role,
  HomeApi? homeApi,
  NationalApi? nationalApi,
  Size size = const Size(412, 2400),
  double textScale = 1,
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
    homeApi: homeApi,
    nationalApi: nationalApi,
    districtAccessApi: DemoDistrictAccessApi(clock: () => demoNow),
  )..switchDemoRole(role);
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

Future<void> _tap(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

/// Every piece of text on screen, from plain and rich text alike.
List<String> _texts(WidgetTester tester) => [
  for (final widget in tester.widgetList<RichText>(find.byType(RichText)))
    widget.text.toPlainText(),
];

/// Fails if any of [english] is still on screen.
void _noEnglish(WidgetTester tester, List<String> english) {
  final shown = _texts(tester);
  for (final phrase in english) {
    expect(
      shown.where((text) => text.contains(phrase)),
      isEmpty,
      reason: '"$phrase" is still in English',
    );
  }
}

void main() {
  final en = lookupAppLocalizations(const Locale('en'));

  group('time left and dates', () {
    test('English keeps its exact wording', () {
      final now = DateTime.utc(2026, 10, 27, 2, 30);
      expect(
        en.accessTimeLeft(DateTime.utc(2026, 10, 31, 12, 30), now),
        '4 days left',
      );
      expect(
        en.accessTimeLeft(DateTime.utc(2026, 10, 30, 10, 30), now),
        '3 days 8 hours left',
      );
      expect(
        en.accessTimeLeft(DateTime.utc(2026, 10, 28, 2, 30), now),
        '1 day left',
      );
      expect(
        en.accessTimeLeft(DateTime.utc(2026, 10, 27, 3, 30), now),
        '1 hour left',
      );
      expect(
        en.accessTimeLeft(DateTime.utc(2026, 10, 27, 2, 50), now),
        'Less than an hour left',
      );
      expect(en.accessTimeLeft(DateTime.utc(2026, 10, 27, 2), now), 'Ended');
      expect(
        en.accessEndsAt(DateTime.utc(2026, 10, 31, 12, 30)),
        'Sat 31 Oct, 6:00 p.m.',
      );
      expect(
        en.accessDuration(
          DateTime.utc(2026, 10, 27),
          DateTime.utc(2026, 10, 31, 10),
        ),
        '4 days 10 hours',
      );
      expect(en.number(98640), '98,640');
    });

    for (final (code, fourDays, oneDayOneHour) in [
      ('si', 'තව දින 4', 'තව දින 1 පැය 1'),
      ('ta', '4 நாட்கள் மீதம்', '1 நாள் 1 மணி நேரம் மீதம்'),
    ]) {
      test('$code uses whole phrases with plural forms', () {
        final l = lookupAppLocalizations(Locale(code));
        final now = DateTime.utc(2026, 10, 27, 2, 30);
        expect(
          l.accessTimeLeft(DateTime.utc(2026, 10, 31, 2, 30), now),
          fourDays,
        );
        expect(
          l.accessTimeLeft(DateTime.utc(2026, 10, 28, 3, 30), now),
          oneDayOneHour,
        );
        expect(l.accessErrorTooLong(14), contains('14'));
      });
    }
  });

  for (final (code, language) in [('si', 'Sinhala'), ('ta', 'Tamil')]) {
    final l = lookupAppLocalizations(Locale(code));

    group('in $language', () {
      testWidgets('M05s: the SPC home', (tester) async {
        await _pump(
          tester,
          const RoleHomeScreen(),
          code: code,
          role: UserRole.programmeCoordinator,
        );
        expect(find.text('${l.roleSpc} · Kurunegala'), findsOneWidget);
        expect(find.text(l.homeAccessAssigned(12)), findsOneWidget);
        expect(find.text(l.homeActivitiesToApprove(2)), findsOneWidget);
        expect(find.text(l.homeMySocieties), findsOneWidget);
        // Names and S numbers stay as stored.
        expect(find.text('Pahala Kosgama SSS'), findsOneWidget);
        _noEnglish(tester, [
          'Good morning',
          'Your access',
          'Activities to Approve',
          'My Societies',
          'Grade request',
          'members',
          'updated',
          'Search name or S number',
        ]);
      });

      testWidgets('M05d and M20 filters: the DDM home', (tester) async {
        await _pump(
          tester,
          const RoleHomeScreen(),
          code: code,
          role: UserRole.deputyDistrictManager,
        );
        expect(find.text(l.homeTileAssigned), findsOneWidget);
        expect(find.text(l.homeTileGradeRequests), findsOneWidget);
        await _tap(tester, find.byTooltip(l.homeFilterTitle));
        expect(find.text(l.homeFilterNotUpdated), findsOneWidget);
        expect(find.text(l.homeFilterHasRequest), findsOneWidget);
        _noEnglish(tester, [
          'Filter Societies',
          'Clear all',
          'Grade',
          'Not Updated in 90 Days',
          'Show societies',
        ]);
      });

      testWidgets('M05m: the DM home and its temporary access card', (
        tester,
      ) async {
        await _pump(
          tester,
          const RoleHomeScreen(),
          code: code,
          role: UserRole.districtManager,
        );
        expect(find.text(l.homeDistrictOverview), findsOneWidget);
        expect(find.text(l.homeTempAccessTitle), findsOneWidget);
        _noEnglish(tester, [
          'District Overview',
          'Temporary Access for Your DDM',
          'Grades:',
          'not active',
          'Needs Attention',
          'view only',
        ]);
      });

      testWidgets('M05t: the DDM\'s temporary district-wide view', (
        tester,
      ) async {
        final grant = DistrictAccessGrant(
          districtId: 'district-kurunegala',
          startsAt: demoNow.subtract(const Duration(hours: 1)),
          expiresAt: demoNow.add(const Duration(days: 4, hours: 3)),
          grantedByName: 'R. Fernando',
        );
        await _pump(
          tester,
          Scaffold(
            body: TemporaryViewCard(grant: grant, now: demoNow),
          ),
          code: code,
          role: UserRole.deputyDistrictManager,
        );
        expect(find.text(l.homeTempViewTitle), findsOneWidget);
        expect(
          find.text(l.homeTempViewBodyGrantedBy('R. Fernando')),
          findsOneWidget,
        );
        expect(find.textContaining(l.accessDaysLeft(4)), findsOneWidget);
        _noEnglish(tester, ['days left', 'Granted by', 'Browse']);
      });

      testWidgets('M26: no access names nothing', (tester) async {
        await _pump(
          tester,
          const RoleHomeScreen(),
          code: code,
          role: UserRole.programmeCoordinator,
          homeApi: _Refusing(),
        );
        expect(find.text(l.stateNoAccessTitle), findsOneWidget);
        expect(find.text(l.stateNoAccessMessage), findsOneWidget);
      });

      testWidgets('M26: could not load, with try again', (tester) async {
        await _pump(
          tester,
          const RoleHomeScreen(),
          code: code,
          role: UserRole.programmeCoordinator,
          homeApi: _Offline(),
        );
        expect(find.text(l.homeErrorTitle), findsOneWidget);
        expect(find.text(l.errorOffline), findsOneWidget);
        expect(find.text(l.commonTryAgain), findsOneWidget);
      });

      testWidgets('M30 → M31 → M32 → M33: give, confirm, see and end', (
        tester,
      ) async {
        await _pump(
          tester,
          const DistrictAccessScreen(),
          code: code,
          role: UserRole.districtManager,
        );
        expect(find.text(l.accessTitle), findsOneWidget);
        await _tap(tester, find.text(l.accessGive));

        // M30, with its validation.
        expect(find.text(l.accessGiveTitle), findsOneWidget);
        expect(find.text(l.accessDeputyHelp), findsOneWidget);
        expect(find.text(l.accessScopeValue), findsOneWidget);
        await _tap(tester, find.byType(DropdownButtonFormField<String>));
        await _tap(tester, find.text('P. Dissanayake').last);
        await _tap(tester, find.widgetWithText(FilledButton, l.commonContinue));

        // M31
        expect(find.text(l.accessConfirmTitle), findsOneWidget);
        expect(
          find.text(l.accessWillBeAbleTo('P. Dissanayake')),
          findsOneWidget,
        );
        expect(find.text(l.accessCannotShare), findsOneWidget);
        expect(find.text(l.accessLengthDays(4)), findsOneWidget);
        expect(find.text(l.accessReasonNone), findsOneWidget);
        _noEnglish(tester, ['Will Be Able To', 'days', 'Not given', 'Back']);
        await _tap(
          tester,
          find.widgetWithText(FilledButton, l.accessGiveButton),
        );

        // M32, with its result message.
        expect(find.text(l.accessGivenSnack), findsOneWidget);
        expect(find.text('P. Dissanayake · DDM'), findsOneWidget);
        expect(find.text(l.accessEventGiven), findsOneWidget);
        _noEnglish(tester, ['days left', 'View only', 'Access History']);

        // M33
        await _tap(tester, find.text(l.accessEndNow));
        expect(
          find.text(l.accessEndConfirmTitle('P. Dissanayake')),
          findsOneWidget,
        );
        expect(find.text(l.accessKeep), findsOneWidget);
        await _tap(tester, find.widgetWithText(FilledButton, l.accessEndNow));
        expect(find.text(l.accessEndedSnack), findsOneWidget);
        expect(find.text(l.accessEventEndedEarly), findsOneWidget);
      });

      testWidgets('M05h: the National Dashboard keeps SarvoAI whole', (
        tester,
      ) async {
        await _pump(
          tester,
          const NationalDashboardScreen(),
          code: code,
          role: UserRole.hqAdmin,
        );
        // The page name is now part of the header's subtitle (#120).
        expect(find.textContaining(l.nationalTitle), findsOneWidget);
        expect(
          find.text(l.moreAsk('SarvoAI'), findRichText: true),
          findsOneWidget,
        );
        expect(find.text(l.nationalSectionStatus), findsOneWidget);
        _noEnglish(tester, [
          'National Dashboard',
          'Societies Status',
          'Registered',
          'Members',
          'Audit Reports',
          'Profit for the Year',
          'planned completed',
          'Demonstration data',
          'HQ only',
        ]);
      });

      testWidgets('M65, M68 and M61: districts, map and membership', (
        tester,
      ) async {
        await _pump(
          tester,
          const DistrictsScreen(standalone: true),
          code: code,
          role: UserRole.hqAdmin,
        );
        expect(find.text(l.nationalDistrictsSubtitle), findsOneWidget);
        _noEnglish(tester, ['Alphabetical', 'active ·', 'members ·', 'Audit ']);

        await _pump(
          tester,
          const SocietyMapScreen(),
          code: code,
          role: UserRole.hqAdmin,
        );
        expect(find.text(l.nationalMapSubtitle), findsOneWidget);
        _noEnglish(tester, ['Active societies by class', 'Not active']);

        await _pump(
          tester,
          const NationalMembershipScreen(),
          code: code,
          role: UserRole.hqAdmin,
        );
        expect(find.text(l.nationalCountsOnlyTitle), findsOneWidget);
        expect(find.text(l.membershipYouth), findsOneWidget);
        _noEnglish(tester, [
          'Total Members',
          'Youth members',
          ' female ·',
          'Counts Only',
        ]);
      });

      testWidgets('M69d: the national view is for HQ only', (tester) async {
        await _pump(
          tester,
          const NationalDashboardScreen(),
          code: code,
          role: UserRole.programmeCoordinator,
        );
        expect(find.text(l.nationalHqOnlyTitle), findsOneWidget);
        _noEnglish(tester, ['HQ Only', 'signed in as']);
      });

      testWidgets('M69c: the national figures could not load', (tester) async {
        await _pump(
          tester,
          const NationalMembershipScreen(),
          code: code,
          role: UserRole.hqAdmin,
          nationalApi: _NationalOffline(),
        );
        expect(find.text(l.nationalErrorTitle), findsOneWidget);
        expect(find.text(l.errorOffline), findsOneWidget);
      });

      for (final (role, screen) in <(UserRole, Widget)>[
        (UserRole.programmeCoordinator, const RoleHomeScreen()),
        (UserRole.deputyDistrictManager, const RoleHomeScreen()),
        (UserRole.districtManager, const RoleHomeScreen()),
        (UserRole.districtManager, const DistrictAccessScreen()),
        (UserRole.hqAdmin, const NationalDashboardScreen()),
        (UserRole.hqAdmin, const NationalMembershipScreen()),
      ]) {
        testWidgets(
          '${screen.runtimeType} for ${role.name} fits a small phone with '
          'large text',
          (tester) async {
            await _pump(
              tester,
              screen,
              code: code,
              role: role,
              size: const Size(320, 568),
              textScale: 2,
            );
            expect(tester.takeException(), isNull);
          },
        );
      }
    });
  }
}
