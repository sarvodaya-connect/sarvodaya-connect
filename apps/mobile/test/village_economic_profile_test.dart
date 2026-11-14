import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/data/demo_data.dart';
import 'package:sarvodaya_connect_mobile/src/economy/demo_economy_api.dart';
import 'package:sarvodaya_connect_mobile/src/economy/economic_profile_tab.dart';
import 'package:sarvodaya_connect_mobile/src/economy/economy_api.dart';
import 'package:sarvodaya_connect_mobile/src/economy/economy_models.dart';
import 'package:sarvodaya_connect_mobile/src/l10n/generated/app_localizations.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/motion/app_motion.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_screen.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/work_plan_view.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';

import 'test_helpers.dart' show navTab, pumpApp, signInWithDemoAccount;

/// Issue #146: the Village Economic Profile tab, business forms and
/// production history on the phone, against the fictional demo API (which
/// applies the #145 rules). Every business and figure is fictional; the
/// Sinhala and Tamil are drafts.

const _pahala = 'society-pahala-kosgama';

/// 13 November 2026: October 2026 has ended and can take actual figures.
final _now = DateTime(2026, 11, 13, 10, 15);

Future<DemoStore> _pump(
  WidgetTester tester, {
  UserRole role = UserRole.societyOfficer,
  Widget? home,
  DemoStore? store,
  String code = 'en',
  Size size = const Size(412, 2000),
  double textScale = 1,
  bool reducedMotion = false,
}) async {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  // The same size when these tests run live on a simulator, where the view
  // size above is not used.
  await tester.binding.setSurfaceSize(size);
  addTearDown(() => tester.binding.setSurfaceSize(null));
  final demo =
      store ??
      (DemoStore(loadDelay: Duration.zero, clock: () => _now)
        ..switchDemoRole(role));
  await tester.pumpWidget(
    DemoScope(
      store: demo,
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
          home:
              home ??
              const SocietyRecordScreen(
                societyId: _pahala,
                initialTab: RecordTab.economy,
              ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return demo;
}

Future<void> _tap(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

/// Opens a dropdown and picks [item].
Future<void> _choose(WidgetTester tester, Key dropdown, String item) async {
  await _tap(tester, find.byKey(dropdown));
  await tester.tap(find.text(item).last);
  await tester.pumpAndSettle();
}

Future<void> _openBusiness(WidgetTester tester, String name) =>
    _tap(tester, find.text(name).first);

DemoEconomyApi _api(DemoStore store) => store.economy as DemoEconomyApi;

Future<BusinessOutput> _output(DemoStore store, String product) async {
  final profile = await store.economy.fetchProfile(_pahala);
  return profile.businesses
      .expand((b) => b.outputs)
      .firstWhere((o) => o.product == product);
}

Future<int> _count(DemoStore store, String product) async =>
    (await store.economy.fetchRecords((await _output(store, product)).id))
        .total;

/// Opens Record production on the dairy and picks Milk.
Future<void> _recordMilk(WidgetTester tester) async {
  await _openBusiness(tester, 'Kosgama Dairy Collective');
  await _tap(tester, find.byKey(const ValueKey('vep.recordProduction')));
  await _choose(
    tester,
    const ValueKey('vep.production.output'),
    'Milk · Litres',
  );
}

Finder _quantity() => find.byKey(const ValueKey('vep.production.quantity'));

/// Scrolls the screen on top until [finder] has been built and is visible.
Future<void> _reveal(WidgetTester tester, Finder finder) async {
  if (finder.evaluate().isEmpty) {
    await tester.scrollUntilVisible(
      finder,
      200,
      scrollable: find
          .descendant(
            of: find.byType(ListView).last,
            matching: find.byType(Scrollable),
          )
          .first,
    );
  }
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
}

/// Adding a product fails the first time, as when the answer is lost.
class _FailingOutputs extends DemoEconomyApi {
  _FailingOutputs({required super.user, required super.clock})
    : super(delay: Duration.zero);

  int failures = 1;
  int attempts = 0;

  @override
  Future<BusinessOutput> createOutput(
    String businessId,
    OutputInput input,
  ) async {
    attempts++;
    if (failures > 0) {
      failures--;
      throw const SocietyRecordException(
        'The server did not answer. Try again.',
        status: 503,
      );
    }
    return super.createOutput(businessId, input);
  }
}

/// A profile from an API that sends no latest figures (an older server).
class _NoLatest extends DemoEconomyApi {
  _NoLatest({required super.user, required super.clock})
    : super(delay: Duration.zero);

  @override
  Future<EconomicProfile> fetchProfile(String societyId) async {
    final profile = await super.fetchProfile(societyId);
    return EconomicProfile(
      societyId: profile.societyId,
      societyName: profile.societyName,
      canManage: profile.canManage,
      businesses: [
        for (final b in profile.businesses)
          SocietyBusiness(
            id: b.id,
            societyId: b.societyId,
            name: b.name,
            industry: b.industry,
            otherIndustry: b.otherIndustry,
            description: b.description,
            status: b.status,
            closedAt: b.closedAt,
            version: b.version,
            createdBy: b.createdBy,
            updatedBy: b.updatedBy,
            createdAt: b.createdAt,
            updatedAt: b.updatedAt,
            outputs: [
              for (final o in b.outputs)
                BusinessOutput(
                  id: o.id,
                  businessId: o.businessId,
                  product: o.product,
                  otherDescription: o.otherDescription,
                  unit: o.unit,
                  kind: o.kind,
                  archivedAt: o.archivedAt,
                  version: o.version,
                  createdAt: o.createdAt,
                  updatedAt: o.updatedAt,
                ),
            ],
          ),
      ],
    );
  }
}

/// A store whose economy API is [make], for the signed-in demo officer.
DemoStore _storeWith(
  DemoEconomyApi Function(AuthenticatedUser? Function() user) make,
) {
  DemoStore? holder;
  final store = DemoStore(
    loadDelay: Duration.zero,
    clock: () => _now,
    economyApi: make(() => holder?.user),
  )..switchDemoRole(UserRole.societyOfficer);
  holder = store;
  return store;
}

void main() {
  testWidgets('the tab sits third and the existing tabs still work', (
    tester,
  ) async {
    await _pump(tester, home: const SocietyRecordScreen(societyId: _pahala));
    expect(tester.widgetList<Tab>(find.byType(Tab)).map((t) => t.text), [
      'Overview',
      'Members & Exco',
      'Village Economic Profile',
      'Work Plan',
      'Documents',
      'History',
    ]);
    await _tap(tester, find.text('Members & Exco'));
    expect(find.text('Exco · 25 Seats'), findsOneWidget);
    await _tap(tester, find.text('Village Economic Profile'));
    expect(find.text('Kosgama Dairy Collective'), findsOneWidget);
    await _tap(tester, find.text('Work Plan'));
    expect(find.byType(WorkPlanView), findsOneWidget);
    await _tap(tester, find.text('Documents'));
    expect(find.text('All Documents'), findsOneWidget);
    await _tap(tester, find.text('History'));
    expect(
      find.text('Every change shows who made it and when.'),
      findsOneWidget,
    );
  });

  testWidgets(
    'the Society Officer sees businesses, latest figures with their period, '
    'a reported zero and Add business',
    (tester) async {
      await _pump(tester);
      expect(
        find.textContaining('Businesses the society runs itself'),
        findsOneWidget,
      );
      expect(find.byKey(const ValueKey('vep.addBusiness')), findsOneWidget);
      expect(find.text('Kosgama Dairy Collective'), findsOneWidget);
      expect(find.text('● Operating'), findsWidgets);
      expect(find.text('● Temporarily stopped'), findsOneWidget);
      // The latest actual says its period; the estimate stays separate.
      expect(
        find.text('Latest actual · 3,100 litres · September 2026'),
        findsOneWidget,
      );
      expect(
        find.text('Latest estimate · 3,300 litres · November 2026'),
        findsOneWidget,
      );
      // A reported zero is shown as 0, never as Not reported.
      expect(
        find.text('Latest actual · 0 kg · September 2026'),
        findsOneWidget,
      );
      expect(find.textContaining('3,100 + 3,300'), findsNothing);
      expect(find.textContaining('6,400'), findsNothing);
    },
  );

  testWidgets('creates a business with two products, saves 3,200 litres for '
      'October 2026 once, and corrects it to 3,400', (tester) async {
    final store = await _pump(tester);
    await _tap(tester, find.byKey(const ValueKey('vep.addBusiness')));
    expect(find.text('Add Business'), findsOneWidget);
    await tester.enterText(
      find.byKey(const ValueKey('vep.form.name')),
      'Fictional Test Dairy',
    );
    await _choose(
      tester,
      const ValueKey('vep.form.industry'),
      'Livestock and dairy',
    );
    await tester.enterText(
      find.byKey(const ValueKey('vep.form.description')),
      'A fictional business for this test.',
    );
    await _tap(tester, find.byKey(const ValueKey('vep.form.addOutput')));
    await _choose(
      tester,
      const ValueKey('vep.picker.product'),
      'Milk · Litres',
    );
    expect(
      find.text('Always measured in Litres, so figures can be compared.'),
      findsOneWidget,
    );
    await _tap(tester, find.byKey(const ValueKey('vep.picker.add')));
    await _tap(tester, find.byKey(const ValueKey('vep.form.addOutput')));
    await _choose(tester, const ValueKey('vep.picker.product'), 'Other');
    await tester.enterText(
      find.byKey(const ValueKey('vep.picker.description')),
      'Fictional ghee',
    );
    await _choose(tester, const ValueKey('vep.picker.unit'), 'Kilograms (kg)');
    await _tap(tester, find.byKey(const ValueKey('vep.picker.add')));
    expect(find.text('Fictional ghee'), findsOneWidget);
    expect(find.text('● Unsaved changes'), findsOneWidget);
    await _tap(tester, find.byKey(const ValueKey('vep.form.save')));
    expect(find.text('Business saved'), findsOneWidget);
    expect(find.text('Fictional Test Dairy'), findsOneWidget);

    final profile = await store.economy.fetchProfile(_pahala);
    final dairy = profile.businesses.firstWhere(
      (b) => b.name == 'Fictional Test Dairy',
    );
    expect(dairy.outputs.map((o) => (o.product, o.unit)), [
      ('MILK', 'LITRE'),
      ('OTHER', 'KILOGRAM'),
    ]);

    // Record 3,200 litres, actual, October 2026.
    await _openBusiness(tester, 'Fictional Test Dairy');
    expect(find.text('Latest actual · Not reported'), findsWidgets);
    await _tap(tester, find.byKey(const ValueKey('vep.recordProduction')));
    await _choose(
      tester,
      const ValueKey('vep.production.output'),
      'Milk · Litres',
    );
    expect(find.text('October 2026'), findsOneWidget);
    await tester.enterText(_quantity(), '3,200');
    await tester.pump();
    expect(
      find.text('Milk: 3,200 litres · October 2026 · Actual'),
      findsOneWidget,
    );
    // A double tap sends one save.
    final save = find.byKey(const ValueKey('vep.production.save'));
    await tester.ensureVisible(save);
    await tester.tap(save);
    await tester.tap(save, warnIfMissed: false);
    await tester.pumpAndSettle();
    expect(find.text('Figure saved'), findsOneWidget);
    final milk = dairy.outputs.first;
    var records = await store.economy.fetchRecords(milk.id);
    expect(records.total, 1);
    expect(records.items.single.quantity, 3200);
    expect(formatDay(records.items.single.period.startsOn), '2026-10-01');
    expect(find.text('3,200 litres'), findsOneWidget);

    // Reopen it: the same values. Then correct it to 3,400.
    await _tap(
      tester,
      find.byKey(ValueKey('vep.recordRow.${records.items.single.id}')),
    );
    expect(
      tester
          .widget<Text>(find.byKey(const ValueKey('vep.record.quantity')))
          .data,
      '3,200 litres',
    );
    expect(find.text('October 2026'), findsOneWidget);
    expect(find.text('Actual'), findsOneWidget);
    await _tap(tester, find.byKey(const ValueKey('vep.record.correct')));
    expect(find.text('Correct Figure'), findsOneWidget);
    expect(tester.widget<TextField>(_quantity()).controller!.text, '3200');
    await tester.enterText(_quantity(), '3400');
    await _tap(tester, find.byKey(const ValueKey('vep.production.save')));
    expect(find.text('Figure corrected'), findsOneWidget);
    expect(
      tester
          .widget<Text>(find.byKey(const ValueKey('vep.record.quantity')))
          .data,
      '3,400 litres',
    );
    expect(find.text('Corrected to 3,400 litres'), findsOneWidget);
    expect(find.text('Saved 3,200 litres'), findsOneWidget);

    // Back on the business and the tab: replaced, not added.
    await tester.pageBack();
    await tester.pumpAndSettle();
    records = await store.economy.fetchRecords(milk.id);
    expect(records.total, 1);
    expect(records.items.single.quantity, 3400);
    expect(find.text('3,400 litres'), findsOneWidget);
    expect(find.text('3,200 litres'), findsNothing);
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(
      find.text('Latest actual · 3,400 litres · October 2026'),
      findsOneWidget,
    );
  });

  testWidgets('a period that already has a figure becomes a correction', (
    tester,
  ) async {
    final store = await _pump(tester);
    final before = await _count(store, 'MILK');
    await _recordMilk(tester);
    await _choose(
      tester,
      const ValueKey('vep.production.month.ACTUAL'),
      'September 2026',
    );
    await tester.enterText(_quantity(), '3150');
    await tester.pump();
    expect(find.text('This period already has a figure'), findsOneWidget);
    await _tap(tester, find.byKey(const ValueKey('vep.production.save')));
    expect(await _count(store, 'MILK'), before);
    await _tap(
      tester,
      find.byKey(const ValueKey('vep.production.correctInstead')),
    );
    expect(find.text('Correct Figure'), findsOneWidget);
    expect(tester.widget<TextField>(_quantity()).controller!.text, '3150');
    await _tap(tester, find.byKey(const ValueKey('vep.production.save')));
    expect(find.text('Figure corrected'), findsOneWidget);
    expect(await _count(store, 'MILK'), before);
    expect(find.text('3,150 litres'), findsOneWidget);
  });

  testWidgets('quantities are checked against the unit before saving', (
    tester,
  ) async {
    final store = await _pump(tester);
    final before = await _count(store, 'TAILORING_JOBS');
    await _openBusiness(tester, 'Kosgama Tailoring Centre');
    await _tap(tester, find.byKey(const ValueKey('vep.recordProduction')));
    expect(find.text('Tailoring jobs · Jobs'), findsOneWidget);
    await _tap(tester, find.byKey(const ValueKey('vep.production.save')));
    expect(
      find.text('Enter the quantity. Enter 0 if nothing was produced.'),
      findsOneWidget,
    );
    await tester.enterText(_quantity(), '2.5');
    await tester.pump();
    expect(find.text('This unit takes whole numbers only'), findsOneWidget);
    await tester.enterText(_quantity(), '-4');
    await tester.pump();
    expect(
      find.text(
        'Enter the quantity as a number, without letters or a minus sign',
      ),
      findsOneWidget,
    );
    await _tap(tester, find.byKey(const ValueKey('vep.production.save')));
    expect(find.text('Record Production'), findsOneWidget);
    expect(await _count(store, 'TAILORING_JOBS'), before);
    // An actual figure cannot cover days still to come.
    await tester.enterText(_quantity(), '0');
    await _tap(
      tester,
      find.byKey(const ValueKey('vep.production.basis.MONTHLY')),
    );
    await _tap(
      tester,
      find.byKey(const ValueKey('vep.production.measurement.ESTIMATED')),
    );
    await _choose(
      tester,
      const ValueKey('vep.production.month.ESTIMATED'),
      'December 2026',
    );
    await _tap(
      tester,
      find.byKey(const ValueKey('vep.production.measurement.ACTUAL')),
    );
    await _tap(tester, find.byKey(const ValueKey('vep.production.save')));
    expect(find.text('Choose the period'), findsOneWidget);
    expect(await _count(store, 'TAILORING_JOBS'), before);
  });

  testWidgets(
    'a failed save keeps the typed figure and the retry adds it once',
    (tester) async {
      final store = await _pump(tester);
      final before = await _count(store, 'MILK');
      await _recordMilk(tester);
      await tester.enterText(_quantity(), '3200');
      await tester.enterText(
        find.byKey(const ValueKey('vep.production.note')),
        'Fictional note',
      );
      store.offline = true;
      await _tap(tester, find.byKey(const ValueKey('vep.production.save')));
      expect(find.text('Not Saved'), findsOneWidget);
      expect(
        find.textContaining('Your changes are still here.'),
        findsOneWidget,
      );
      expect(tester.widget<TextField>(_quantity()).controller!.text, '3200');
      expect(find.text('Figure saved'), findsNothing);
      store.offline = false;
      expect(await _count(store, 'MILK'), before);
      await _tap(tester, find.byKey(const ValueKey('vep.production.save')));
      expect(find.text('Figure saved'), findsOneWidget);
      expect(await _count(store, 'MILK'), before + 1);
    },
  );

  testWidgets(
    'a figure changed elsewhere is not overwritten: reload, review, save',
    (tester) async {
      final store = await _pump(tester);
      final milk = await _output(store, 'MILK');
      final september = (await store.economy.fetchRecords(milk.id)).items
          .firstWhere((r) => r.actual && r.period.startsOn.month == 9);
      await _openBusiness(tester, 'Kosgama Dairy Collective');
      await _tap(tester, find.byKey(ValueKey('vep.recordRow.${september.id}')));
      await _tap(tester, find.byKey(const ValueKey('vep.record.correct')));
      await tester.enterText(_quantity(), '3200');
      _api(store).changeElsewhere(september.id, 3120);
      await _tap(tester, find.byKey(const ValueKey('vep.production.save')));
      expect(find.text('Changed by someone else'), findsOneWidget);
      expect(tester.widget<TextField>(_quantity()).controller!.text, '3200');
      expect(
        (await store.economy.fetchHistory(september.id)).record.quantity,
        3120,
      );
      await _tap(tester, find.byKey(const ValueKey('vep.production.reload')));
      expect(
        find.textContaining('Saved now: 3,120 litres, by Another officer'),
        findsOneWidget,
      );
      expect(tester.widget<TextField>(_quantity()).controller!.text, '3200');
      await _tap(tester, find.byKey(const ValueKey('vep.production.save')));
      expect(find.text('Figure corrected'), findsOneWidget);
      final history = await store.economy.fetchHistory(september.id);
      expect(history.revisions.map((r) => r.quantity), [3200, 3120, 3100]);
    },
  );

  testWidgets('Cancel asks first, and Discard saves nothing', (tester) async {
    final store = await _pump(tester);
    final before = await _count(store, 'MILK');
    await _recordMilk(tester);
    await tester.enterText(_quantity(), '3200');
    await tester.pump();
    await _tap(tester, find.text('Cancel'));
    expect(find.text('Leave Without Saving?'), findsOneWidget);
    await _tap(tester, find.text('Keep editing'));
    expect(tester.widget<TextField>(_quantity()).controller!.text, '3200');
    await _tap(tester, find.text('Cancel'));
    await _tap(tester, find.text('Discard changes'));
    expect(find.text('Record Production'), findsNothing);
    expect(find.text('Kosgama Dairy Collective'), findsWidgets);
    expect(await _count(store, 'MILK'), before);
  });

  for (final role in [
    UserRole.programmeCoordinator,
    UserRole.deputyDistrictManager,
    UserRole.districtManager,
    UserRole.hqAdmin,
  ]) {
    testWidgets('${role.name} sees the same figures, read only', (
      tester,
    ) async {
      final store = await _pump(tester, role: role);
      expect(find.byKey(const ValueKey('vep.addBusiness')), findsNothing);
      expect(
        find.text(
          "You can view this profile. Only the society's own Society Officer can change it.",
        ),
        findsOneWidget,
      );
      expect(
        find.text('Latest actual · 3,100 litres · September 2026'),
        findsOneWidget,
      );
      await _openBusiness(tester, 'Kosgama Dairy Collective');
      expect(find.byKey(const ValueKey('vep.editBusiness')), findsNothing);
      expect(find.byKey(const ValueKey('vep.recordProduction')), findsNothing);
      expect(find.byKey(const ValueKey('vep.closeBusiness')), findsNothing);
      final milk = await _output(store, 'MILK');
      final record = (await store.economy.fetchRecords(milk.id)).items.first;
      await _tap(tester, find.byKey(ValueKey('vep.recordRow.${record.id}')));
      expect(find.byKey(const ValueKey('vep.record.correct')), findsNothing);
      expect(find.text('Changes'), findsOneWidget);
    });
  }

  testWidgets('a refusal from the server is shown, not just hidden buttons', (
    tester,
  ) async {
    AuthenticatedUser user = demoOfficer;
    final store = DemoStore(
      loadDelay: Duration.zero,
      clock: () => _now,
      economyApi: DemoEconomyApi(
        user: () => user,
        clock: () => _now,
        delay: Duration.zero,
      ),
    )..switchDemoRole(UserRole.societyOfficer);
    await _pump(tester, store: store);
    final before = await _count(store, 'MILK');
    await _recordMilk(tester);
    await tester.enterText(_quantity(), '3200');
    // Signed in as someone who may read this society but not change it.
    user = demoSpc;
    await _tap(tester, find.byKey(const ValueKey('vep.production.save')));
    expect(find.text('Not Saved'), findsOneWidget);
    expect(
      find.textContaining("only the society's own Society Officer"),
      findsOneWidget,
    );
    // The officer's assignment moves to another society while the form is open.
    user = const AuthenticatedUser(
      id: 'fictional-moved-officer',
      displayName: 'Nimali Wijesinghe',
      roles: [UserRole.societyOfficer],
      societyIds: ['society-wellawa'],
    );
    await _tap(tester, find.byKey(const ValueKey('vep.production.save')));
    expect(find.textContaining('Your access may have ended'), findsOneWidget);
    expect(tester.widget<TextField>(_quantity()).controller!.text, '3200');
    user = demoOfficer;
    expect(await _count(store, 'MILK'), before);
  });

  testWidgets('temporary district access ends: the figures are withdrawn', (
    tester,
  ) async {
    var now = _now;
    final ddm = AuthenticatedUser(
      id: 'fictional-ddm',
      displayName: 'Fictional DDM',
      roles: const [UserRole.deputyDistrictManager],
      districtIds: const ['district-kurunegala'],
      societyIds: const [],
      delegatedDistrictAccess: [
        DistrictAccessGrant(
          districtId: 'district-kurunegala',
          startsAt: _now.subtract(const Duration(hours: 1)),
          expiresAt: _now.add(const Duration(hours: 2)),
        ),
      ],
    );
    final store = DemoStore(
      loadDelay: Duration.zero,
      clock: () => now,
      economyApi: DemoEconomyApi(
        user: () => ddm,
        clock: () => now,
        delay: Duration.zero,
      ),
    );
    await _pump(
      tester,
      store: store,
      home: const Scaffold(body: EconomicProfileTab(societyId: _pahala)),
    );
    expect(find.text('Kosgama Dairy Collective'), findsOneWidget);
    expect(find.byKey(const ValueKey('vep.addBusiness')), findsNothing);
    now = _now.add(const Duration(hours: 3));
    // Pull to refresh.
    // The future ends only once frames run, so it is not awaited here.
    tester.state<RefreshIndicatorState>(find.byType(RefreshIndicator)).show();
    await tester.pumpAndSettle();
    expect(find.text('Economic profile not available'), findsOneWidget);
    expect(find.text('Kosgama Dairy Collective'), findsNothing);
  });

  testWidgets('a society with no businesses explains what to add', (
    tester,
  ) async {
    await _pump(
      tester,
      role: UserRole.hqAdmin,
      home: const SocietyRecordScreen(
        societyId: 'society-mawathagama',
        initialTab: RecordTab.economy,
      ),
    );
    expect(find.text('No businesses recorded yet'), findsOneWidget);
    expect(
      find.text(
        'The Society Officer has not added any society businesses yet.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('with reduced motion everything is shown at once', (
    tester,
  ) async {
    await _pump(tester, reducedMotion: true);
    final opacities = tester.widgetList<Opacity>(
      find.descendant(
        of: find.byType(MotionEntrance),
        matching: find.byType(Opacity),
      ),
    );
    expect(opacities, isNotEmpty);
    expect(opacities.every((o) => o.opacity == 1), isTrue);
  });

  for (final code in ['si', 'ta']) {
    testWidgets('$code fits a 360 px phone with large text on every frame', (
      tester,
    ) async {
      final store = await _pump(
        tester,
        code: code,
        size: const Size(360, 740),
        textScale: 1.3,
      );
      // Frame 3, then frame 4 with something typed (unsaved changes).
      final dairy = (await store.economy.fetchProfile(_pahala))
          .businesses
          .first;
      final card = find.byKey(ValueKey('vep.business.${dairy.id}'));
      await tester.scrollUntilVisible(
        card,
        200,
        scrollable: find.descendant(
          of: find.byKey(const PageStorageKey('vep.$_pahala')),
          matching: find.byType(Scrollable),
        ),
      );
      await _tap(tester, card);
      await tester.drag(find.byType(ListView).last, const Offset(0, -2000));
      await tester.pumpAndSettle();
      await tester.drag(find.byType(ListView).last, const Offset(0, 4000));
      await tester.pumpAndSettle();
      // Milk's own Record button opens the form with Milk chosen.
      final milk = dairy.outputs.firstWhere((o) => o.product == 'MILK');
      final record = find.byKey(ValueKey('vep.record.${milk.id}'));
      await _reveal(tester, record);
      await _tap(tester, record);
      await _reveal(tester, _quantity());
      await tester.enterText(_quantity(), '3200');
      await tester.pumpAndSettle();
      await tester.drag(find.byType(ListView).last, const Offset(0, -2000));
      await tester.pumpAndSettle();
      await tester.drag(find.byType(ListView).last, const Offset(0, 4000));
      await tester.pumpAndSettle();
      for (final basis in ['WEEKLY', 'SEASONAL']) {
        final chip = find.byKey(ValueKey('vep.production.basis.$basis'));
        await _reveal(tester, chip);
        await _tap(tester, chip);
      }
      // Closing asks first; discard what was typed.
      await tester.tap(find.byIcon(Icons.close).first);
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsOneWidget);
      await tester.tap(
        find
            .descendant(
              of: find.byType(AlertDialog),
              matching: find.byType(TextButton),
            )
            .last,
      );
      await tester.pumpAndSettle();
      // Frame 2. (pageBack looks for the English "Back" tooltip.)
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      // The tab kept its scroll position; go back to the top.
      await tester.drag(
        find.byKey(const PageStorageKey('vep.$_pahala')),
        const Offset(0, 3000),
      );
      await tester.pumpAndSettle();
      await _tap(tester, find.byKey(const ValueKey('vep.addBusiness')));
      await tester.enterText(
        find.byKey(const ValueKey('vep.form.name')),
        'Fictional',
      );
      await tester.pumpAndSettle();
      final add = find.byKey(const ValueKey('vep.form.addOutput'));
      await _reveal(tester, add);
      await _tap(tester, add);
      // The product sheet, with a product and its fixed unit.
      await _choose(
        tester,
        const ValueKey('vep.picker.product'),
        code == 'si' ? 'කිරි · ලීටර්' : 'பால் · லிட்டர்',
      );
    });
  }

  group('review fixes', () {
    testWidgets('the Work Plan and Exco buttons open their own record tabs', (
      tester,
    ) async {
      await pumpApp(tester);
      await signInWithDemoAccount(tester);
      await tester.tap(navTab('Work Plan'));
      await tester.pumpAndSettle();
      expect(find.byType(WorkPlanView), findsOneWidget);
      expect(find.text('Kosgama Dairy Collective'), findsNothing);
      await tester.tap(navTab('Exco'));
      await tester.pumpAndSettle();
      expect(find.text('Exco · 25 Seats'), findsOneWidget);
      expect(find.byType(WorkPlanView), findsNothing);
    });

    testWidgets(
      'business details find an actual figure behind ten newer estimates',
      (tester) async {
        final store = await _pump(tester);
        final api = store.economy;
        final dairy = (await api.fetchProfile(_pahala)).businesses.first;
        final tea = await api.createOutput(
          dairy.id,
          const OutputInput(product: 'TEA_LEAF'),
        );
        for (var m = 1; m <= 10; m++) {
          await api.createRecord(
            tea.id,
            ProductionInput(
              clientRequestId:
                  '00000000-0000-4000-8000-0000000000${m.toString().padLeft(2, '0')}',
              period: ProductionPeriod.month(2026, m),
              measurement: 'ESTIMATED',
              quantity: 75,
            ),
          );
        }
        await api.createRecord(
          tea.id,
          ProductionInput(
            clientRequestId: '00000000-0000-4000-8000-000000000099',
            period: ProductionPeriod.month(2025, 6),
            measurement: 'ACTUAL',
            quantity: 68,
          ),
        );
        await _openBusiness(tester, 'Kosgama Dairy Collective');
        final latest = find.text('Latest actual · 68 kg · June 2025');
        await tester.scrollUntilVisible(
          latest,
          200,
          scrollable: find
              .descendant(
                of: find.byType(ListView).last,
                matching: find.byType(Scrollable),
              )
              .first,
        );
        expect(latest, findsOneWidget);
        expect(
          find.text('Latest estimate · 75 kg · October 2026'),
          findsOneWidget,
        );
        // The first page of history holds only the ten estimates.
        expect(find.text('68 kg'), findsNothing);
      },
    );

    testWidgets('figures that were not sent are not shown as not reported', (
      tester,
    ) async {
      await _pump(
        tester,
        store: _storeWith((user) => _NoLatest(user: user, clock: () => _now)),
      );
      expect(find.text('Latest actual · Not available'), findsWidgets);
      expect(find.text('Latest actual · Not reported'), findsNothing);
      expect(find.textContaining('3,100 litres'), findsNothing);
    });

    testWidgets(
      'after a partial save the saved details lock, and the retry adds only the product',
      (tester) async {
        late _FailingOutputs api;
        final store = _storeWith(
          (user) => api = _FailingOutputs(user: user, clock: () => _now),
        );
        await _pump(tester, store: store);
        await _openBusiness(tester, 'Kosgama Dairy Collective');
        await _tap(tester, find.byKey(const ValueKey('vep.editBusiness')));
        final name = find.byKey(const ValueKey('vep.form.name'));
        await tester.enterText(name, 'Kosgama Dairy Co-op');
        await _tap(tester, find.byKey(const ValueKey('vep.form.addOutput')));
        await _choose(
          tester,
          const ValueKey('vep.picker.product'),
          'Eggs · Eggs',
        );
        await _tap(tester, find.byKey(const ValueKey('vep.picker.add')));
        await _tap(tester, find.byKey(const ValueKey('vep.form.save')));

        // The business change saved; adding Eggs did not.
        var dairy = (await api.fetchProfile(_pahala)).businesses.first;
        expect(dairy.name, 'Kosgama Dairy Co-op');
        expect(dairy.version, 2);
        expect(dairy.outputs.where((o) => o.product == 'EGGS'), isEmpty);
        expect(find.text('Business saved'), findsNothing);
        expect(find.textContaining('was not added'), findsOneWidget);
        expect(find.text('Not Saved'), findsOneWidget);

        // The saved details are locked and say why; nothing typed now could
        // be skipped and then reported as saved.
        expect(tester.widget<TextField>(name).enabled, isFalse);
        expect(
          tester
              .widget<TextField>(
                find.byKey(const ValueKey('vep.form.description')),
              )
              .enabled,
          isFalse,
        );
        expect(
          tester
              .widget<DropdownButtonFormField<String>>(
                find.byKey(const ValueKey('vep.form.status')),
              )
              .onChanged,
          isNull,
        );
        expect(
          find.textContaining(
            'These business details are saved and are locked',
          ),
          findsOneWidget,
        );
        expect(find.text('Eggs'), findsOneWidget);
        expect(find.text('● Unsaved changes'), findsOneWidget);

        await _tap(tester, find.byKey(const ValueKey('vep.form.save')));
        expect(find.text('Business saved'), findsOneWidget);
        dairy = (await api.fetchProfile(_pahala)).businesses.first;
        expect(dairy.name, 'Kosgama Dairy Co-op');
        expect(dairy.version, 2, reason: 'the details were not sent twice');
        expect(dairy.outputs.where((o) => o.product == 'EGGS'), hasLength(1));
        expect(api.attempts, 2);
      },
    );
  });
}
