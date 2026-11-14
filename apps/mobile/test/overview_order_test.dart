import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/economy/demo_economy_api.dart';
import 'package:sarvodaya_connect_mobile/src/economy/economy_api.dart';
import 'package:sarvodaya_connect_mobile/src/economy/economy_models.dart';
import 'package:sarvodaya_connect_mobile/src/l10n/generated/app_localizations.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/motion/app_motion.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_screen.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';
import 'package:sarvodaya_connect_mobile/src/widgets/street_map.dart';

/// Issue #163: the society Overview in the client's order. Every society,
/// person and figure is fictional; the Sinhala and Tamil are drafts.

const _pahala = 'society-pahala-kosgama';
final _now = DateTime(2026, 11, 13, 10, 15);

const _order = [
  'overview.society',
  'overview.members',
  'overview.address',
  'overview.officeBearers',
  'overview.grade',
  'overview.annual',
  'overview.economy',
];

/// Counts profile requests, and can fail the first ones.
class _CountingEconomy extends DemoEconomyApi {
  _CountingEconomy({required super.user, required super.clock})
    : super(delay: Duration.zero);

  int profileRequests = 0;
  int failures = 0;

  @override
  Future<EconomicProfile> fetchProfile(String societyId) async {
    profileRequests++;
    if (failures > 0) {
      failures--;
      throw const SocietyRecordException(
        'Something went wrong on the server. Try again.',
        status: 500,
      );
    }
    return super.fetchProfile(societyId);
  }
}

Future<(DemoStore, _CountingEconomy)> _pump(
  WidgetTester tester, {
  UserRole role = UserRole.societyOfficer,
  String code = 'en',
  Size size = const Size(412, 4200),
  double textScale = 1,
  bool reducedMotion = false,
  int economyFailures = 0,
}) async {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.binding.setSurfaceSize(size);
  addTearDown(() => tester.binding.setSurfaceSize(null));
  late _CountingEconomy economy;
  DemoStore? holder;
  final store = DemoStore(
    loadDelay: Duration.zero,
    clock: () => _now,
    economyApi: economy = _CountingEconomy(
      user: () => holder?.user,
      clock: () => _now,
    )..failures = economyFailures,
  )..switchDemoRole(role);
  holder = store;
  await tester.pumpWidget(
    DemoScope(
      store: store,
      child: MotionScope(
        child: MaterialApp(
          theme: AppTheme.light(),
          locale: Locale(code),
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(
              textScaler: TextScaler.linear(textScale),
              disableAnimations: reducedMotion,
            ),
            child: child!,
          ),
          home: const SocietyRecordScreen(societyId: _pahala),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return (store, economy);
}

double _top(WidgetTester tester, String key) =>
    tester.getTopLeft(find.byKey(ValueKey(key))).dy;

Future<void> _tap(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

void main() {
  for (final role in [
    UserRole.societyOfficer,
    UserRole.programmeCoordinator,
    UserRole.districtManager,
    UserRole.hqAdmin,
  ]) {
    testWidgets('${role.name}: the Overview has the seven sections in order', (
      tester,
    ) async {
      await _pump(tester, role: role);
      final tops = [for (final key in _order) _top(tester, key)];
      for (var i = 1; i < tops.length; i++) {
        expect(
          tops[i],
          greaterThan(tops[i - 1]),
          reason: '${_order[i]} after ${_order[i - 1]}',
        );
      }
      // Members and the business description are not repeated elsewhere.
      expect(
        find.descendant(
          of: find.byKey(const ValueKey('overview.society')),
          matching: find.text('Members'),
        ),
        findsNothing,
      );
      expect(find.text('Business Run by the Society'), findsOneWidget);
    });
  }

  testWidgets('the Overview members match Members & Exco exactly', (
    tester,
  ) async {
    await _pump(tester);
    String total() => tester
        .widget<Text>(find.byKey(const ValueKey('membership.total')))
        .data!;
    final overview = total();
    await _tap(tester, find.byKey(const ValueKey('overview.openMembers')));
    expect(find.text('Exco · 25 Seats'), findsOneWidget);
    expect(total(), overview);
  });

  testWidgets('summary links open the right tabs after the tab change', (
    tester,
  ) async {
    final (_, economy) = await _pump(tester);
    // Office bearers → Members & Exco.
    await _tap(
      tester,
      find
          .descendant(
            of: find.byKey(const ValueKey('overview.officeBearers')),
            matching: find.textContaining('Members'),
          )
          .first,
    );
    expect(find.text('Exco · 25 Seats'), findsOneWidget);
    await _tap(tester, find.text('Overview'));
    // Village Economic Profile → its own tab, without a second request.
    expect(economy.profileRequests, 1);
    await _tap(tester, find.byKey(const ValueKey('overview.openEconomy')));
    expect(find.byKey(const ValueKey('vep.addBusiness')), findsOneWidget);
    expect(economy.profileRequests, 1);
  });

  testWidgets('the economy summary shows latest figures with their period', (
    tester,
  ) async {
    await _pump(tester);
    final card = find.byKey(const ValueKey('overview.economy'));
    expect(
      find.descendant(
        of: card,
        matching: find.text('Latest actual · 3,100 litres · September 2026'),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(of: card, matching: find.text('Milk · Litres')),
      findsOneWidget,
    );
    // Four products; three shown, then how many more.
    expect(
      find.descendant(
        of: card,
        matching: find.text('1 more product or service in the profile'),
      ),
      findsOneWidget,
    );
  });

  testWidgets('a failed economy summary keeps the record and can retry', (
    tester,
  ) async {
    final (_, economy) = await _pump(tester, economyFailures: 1);
    expect(find.text('Pahala Kosgama SSS'), findsWidgets);
    expect(find.byKey(const ValueKey('overview.grade')), findsOneWidget);
    expect(
      find.textContaining("Couldn't load the economic profile"),
      findsOneWidget,
    );
    await _tap(tester, find.byKey(const ValueKey('overview.economyRetry')));
    expect(economy.profileRequests, 2);
    expect(
      find.textContaining("Couldn't load the economic profile"),
      findsNothing,
    );
    expect(
      find.text('Latest actual · 3,100 litres · September 2026'),
      findsOneWidget,
    );
  });

  testWidgets('read-only viewers keep their access rules', (tester) async {
    await _pump(tester, role: UserRole.districtManager);
    final society = find.byKey(const ValueKey('overview.society'));
    // The assigned SPC, as before; the full staff list stays with editors.
    expect(
      find.descendant(of: society, matching: find.text('Assigned SPC')),
      findsOneWidget,
    );
    expect(
      find.descendant(of: society, matching: find.text('Society Officer')),
      findsNothing,
    );
    // Address without the map, as before; office bearers as in Members & Exco.
    expect(find.byType(SocietyStreetMap), findsNothing);
    expect(find.text('President'), findsOneWidget);
    expect(find.byKey(const ValueKey('membership.edit')), findsNothing);
    expect(find.byKey(const ValueKey('overview.economy')), findsOneWidget);
  });

  testWidgets('editors see the staff and the map in their sections', (
    tester,
  ) async {
    await _pump(tester);
    final society = find.byKey(const ValueKey('overview.society'));
    for (final label in [
      'Assigned SPC',
      'Society Officer',
      'District Manager',
    ]) {
      expect(
        find.descendant(of: society, matching: find.text(label)),
        findsOneWidget,
      );
    }
    expect(
      find.descendant(
        of: find.byKey(const ValueKey('overview.address')),
        matching: find.byType(SocietyStreetMap),
      ),
      findsOneWidget,
    );
  });

  for (final code in ['si', 'ta']) {
    testWidgets('$code: the Overview fits a 360 px phone with large text', (
      tester,
    ) async {
      await _pump(
        tester,
        code: code,
        size: const Size(360, 740),
        textScale: 1.3,
        reducedMotion: true,
      );
      final list = find.byKey(const PageStorageKey('record.overview'));
      for (final key in _order) {
        await tester.scrollUntilVisible(
          find.byKey(ValueKey(key)),
          250,
          scrollable: find.descendant(
            of: list,
            matching: find.byType(Scrollable),
          ),
        );
      }
      await tester.drag(list, const Offset(0, -3000));
      await tester.pumpAndSettle();
    });
  }
}
