import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/national/demo_national_api.dart';
import 'package:sarvodaya_connect_mobile/src/national/national_api.dart';
import 'package:sarvodaya_connect_mobile/src/national/national_models.dart';
import 'package:sarvodaya_connect_mobile/src/national/national_screens.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';

import 'test_helpers.dart';

/// Fails every request, as when the server cannot be reached.
class _FailingApi extends DemoNationalApi {
  _FailingApi() : super(user: () => null, delay: Duration.zero);

  @override
  Future<NationalOverview> fetchOverview() async =>
      throw const SocietyRecordException('The server did not answer.');
}

Future<DemoStore> _pump(
  WidgetTester tester,
  Widget home, {
  UserRole role = UserRole.hqAdmin,
  Size size = const Size(412, 2400),
  NationalApi? api,
}) async {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final store = DemoStore(
    loadDelay: Duration.zero,
    clock: () => demoNow,
    nationalApi: api,
  )..switchDemoRole(role);
  await tester.pumpWidget(
    DemoScope(
      store: store,
      child: MaterialApp(theme: AppTheme.light(), home: home),
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

void main() {
  group('M05h National Dashboard', () {
    testWidgets('shows HQ the six sections, labelled as sample data', (
      tester,
    ) async {
      await _pump(tester, const NationalDashboardScreen());
      // The page name is now part of the header's subtitle (#120).
      expect(find.textContaining('National Dashboard'), findsOneWidget);
      expect(find.text('5,340'), findsOneWidget);
      expect(find.text('1,076'), findsOneWidget);
      expect(find.text('98,640'), findsOneWidget);
      expect(find.text('LKR 312.4 m'), findsOneWidget);
      expect(find.text('LKR 1,026.8 m'), findsOneWidget);
      expect(find.text('Demonstration data · FY 2025/26'), findsOneWidget);
      expect(
        find.bySemanticsLabel(
          'Number 1, SDG 4: Quality Education, 980 completed',
        ),
        findsOneWidget,
      );
      // No horizontal progress bars as data displays.
      expect(find.byType(LinearProgressIndicator), findsNothing);
    });

    for (final role in [
      UserRole.districtManager,
      UserRole.deputyDistrictManager,
      UserRole.programmeCoordinator,
      UserRole.societyOfficer,
    ]) {
      testWidgets('tells ${role.name} the page is for HQ only (M69d)', (
        tester,
      ) async {
        await _pump(tester, const NationalDashboardScreen(), role: role);
        expect(find.text('This Page Is for HQ Only'), findsOneWidget);
        expect(find.text('5,340'), findsNothing);
      });
    }

    testWidgets('offers to try again when the figures cannot load (M69c)', (
      tester,
    ) async {
      await _pump(tester, const NationalDashboardScreen(), api: _FailingApi());
      expect(
        find.text('We Couldn’t Load the National Figures'),
        findsOneWidget,
      );
      expect(find.widgetWithText(FilledButton, 'Try again'), findsOneWidget);
    });
  });

  group('M65–M67 districts, societies and the society summary', () {
    testWidgets('opens a district’s societies and a society summary', (
      tester,
    ) async {
      await _pump(tester, const DistrictsScreen());
      expect(find.text('Ampara'), findsOneWidget);
      await tester.enterText(find.byType(TextField), 'Kuru');
      await tester.pumpAndSettle();
      expect(find.text('Ampara'), findsNothing);
      await _tap(tester, find.text('Kurunegala'));

      expect(find.text('District: Kurunegala'), findsOneWidget);
      expect(find.text('Pahala Kosgama SSS'), findsOneWidget);
      expect(find.text('B → A'), findsOneWidget);
      await _tap(tester, find.text('Pahala Kosgama SSS'));

      expect(find.text('Society Summary'), findsOneWidget);
      expect(find.text('96%'), findsOneWidget);
      expect(find.text('LKR 412,500'), findsOneWidget);
      expect(find.text('Grade change B → A'), findsOneWidget);
    });

    testWidgets('shows who adds the figures when there is no Society Officer', (
      tester,
    ) async {
      await _pump(
        tester,
        const SocietySummaryScreen(societyId: 'society-kobeigane'),
      );
      expect(find.text('Not added'), findsNWidgets(2));
      expect(find.text('Past due'), findsOneWidget);
      expect(
        find.textContaining('Its SPC, S. Karunaratne, adds the yearly figures'),
        findsOneWidget,
      );
    });

    testWidgets('filters to nothing and clears the filters', (tester) async {
      await _pump(tester, const NationalSocietiesScreen(asTab: true));
      expect(find.text('Thalawa SSS'), findsOneWidget);
      await _tap(tester, find.widgetWithText(FilterChip, '90+ Days'));
      expect(find.text('Thalawa SSS'), findsOneWidget);
      expect(find.text('Pahala Kosgama SSS'), findsNothing);
      await _tap(tester, find.text('Class: All'));
      await _tap(tester, find.text('Class A').last);
      expect(find.text('No Societies Match'), findsOneWidget);
      await _tap(tester, find.text('Clear all filters'));
      expect(find.text('Pahala Kosgama SSS'), findsOneWidget);
    });
  });

  group('M61–M64 membership, audits, yearly totals, activities and map', () {
    testWidgets('membership shows counts only', (tester) async {
      await _pump(tester, const NationalMembershipScreen());
      expect(find.text('Youth members'), findsOneWidget);
      expect(find.text('18,350'), findsOneWidget);
      expect(find.text('Counts Only'), findsOneWidget);
    });

    testWidgets('audit and Registrar documents', (tester) async {
      await _pump(tester, const AuditAgmScreen());
      expect(find.text('75%'), findsOneWidget);
      expect(find.text('905 · 84%'), findsOneWidget);
    });

    testWidgets('yearly totals and the societies that have not added them', (
      tester,
    ) async {
      await _pump(tester, const ProfitExpensesScreen());
      expect(find.text('LKR 312.4 m'), findsOneWidget);
      expect(find.text('Kobeigane SSS'), findsOneWidget);
      expect(find.text('Not Added Yet · 108'), findsOneWidget);
    });

    testWidgets('activities by sector, dimension and UN SDG', (tester) async {
      await _pump(tester, const NationalActivitiesScreen());
      expect(find.text('Community education'), findsOneWidget);
      await _tap(tester, find.text('Dimensions'));
      expect(find.text('Social'), findsOneWidget);
      expect(
        find.bySemanticsLabel(
          'Number 6, SDG 8: Decent Work and Economic Growth, 380 completed',
        ),
        findsOneWidget,
      );
    });

    testWidgets('the map counts societies by class', (tester) async {
      await _pump(tester, const SocietyMapScreen());
      expect(find.text('A 144'), findsOneWidget);
      expect(find.text('Not active 4,264'), findsOneWidget);
    });
  });

  for (final (label, size) in [
    ('a small phone', const Size(320, 568)),
    ('a standard phone', const Size(375, 667)),
  ]) {
    testWidgets('the dashboard lays out without overflow on $label', (
      tester,
    ) async {
      await _pump(tester, const NationalDashboardScreen(), size: size);
      expect(tester.takeException(), isNull);
      await tester.drag(find.byType(ListView).last, const Offset(0, -1500));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  }

  test('formats counts and yearly totals', () {
    expect(count(98640), '98,640');
    expect(count(5), '5');
    expect(lkr(312400000), 'LKR 312.4 m');
    expect(lkr(412500), 'LKR 412,500');
    expect(lkr(null), 'Not added');
    expect(sharePercent(1, 3), 33);
    expect(sharePercent(1, 0), 0);
  });
}
