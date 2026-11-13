import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/l10n/generated/app_localizations.dart';
import 'package:sarvodaya_connect_mobile/src/l10n/l10n_format.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/demo_society_record_api.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/membership_widgets.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/record_widgets.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_api.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_models.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_screen.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';

import 'test_helpers.dart';

/// Issue #143: Members & Exco on the phone's society record. Every society
/// and figure is fictional; the Sinhala and Tamil are unreviewed drafts.

const _pahala = 'society-pahala-kosgama';
const _wellawa = 'society-wellawa';

/// Counts saves, and fails them when [fail] is set (no connection).
class _CountingApi extends DemoSocietyRecordApi {
  _CountingApi({required super.user, required super.clock})
    : super(delay: Duration.zero);

  int saves = 0;
  bool fail = false;

  @override
  Future<SocietyRecord> updateRecord(
    String id,
    Map<String, Object> changes,
  ) async {
    saves++;
    if (fail) {
      throw const SocietyRecordException(
        'The server did not answer. Check your connection and try again.',
        offline: true,
        failure: ClientFailure.offline,
      );
    }
    return super.updateRecord(id, changes);
  }
}

Future<DemoStore> _pump(
  WidgetTester tester,
  Widget home, {
  UserRole role = UserRole.societyOfficer,
  String code = 'en',
  Size size = const Size(412, 2400),
  double textScale = 1,
  DateTime Function()? clock,
  SocietyRecordApi Function(AuthenticatedUser? Function() user)? records,
}) async {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  DemoStore? holder;
  final store = DemoStore(
    loadDelay: Duration.zero,
    clock: clock ?? () => demoNow,
    societyRecordApi: records?.call(() => holder?.user),
  )..switchDemoRole(role);
  holder = store;
  await tester.pumpWidget(
    DemoScope(
      store: store,
      child: MaterialApp(
        theme: AppTheme.light(),
        locale: Locale(code),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context)
              .copyWith(textScaler: TextScaler.linear(textScale)),
          child: child!,
        ),
        home: home,
      ),
    ),
  );
  await tester.pumpAndSettle();
  return store;
}

Future<void> _openTab(
  WidgetTester tester, [
  String label = 'Members & Exco',
]) async {
  await tester.tap(find.widgetWithText(Tab, label));
  await tester.pumpAndSettle();
}

Future<void> _openEdit(WidgetTester tester) async {
  await tester.tap(find.byKey(const ValueKey('membership.edit')));
  await tester.pumpAndSettle();
}

Future<void> _type(WidgetTester tester, String key, String text) async {
  await tester.enterText(find.byKey(ValueKey('membership.$key')), text);
  await tester.pump();
}

Future<void> _save(WidgetTester tester) async {
  final save = find.byKey(const ValueKey('membership.save'));
  await tester.ensureVisible(save);
  await tester.tap(save);
  await tester.pumpAndSettle();
}

String _formTotal(WidgetTester tester) => tester
    .widget<ReadOnlyField>(find.byKey(const ValueKey('membership.formTotal')))
    .value;

String _text(WidgetTester tester, String key) =>
    tester.widget<Text>(find.byKey(ValueKey('membership.$key'))).data!;

/// The value shown under a card label such as "Female members".
Finder _cell(String label, String value) => find.descendant(
  of: find.widgetWithText(KeyValue, label),
  matching: find.text(value),
);

void main() {
  testWidgets('the tab reads Members & Exco and keeps the tab order', (
    tester,
  ) async {
    await _pump(tester, const SocietyRecordScreen(societyId: _pahala));
    final labels = tester
        .widgetList<Tab>(find.byType(Tab))
        .map((tab) => tab.text)
        .toList();
    expect(labels, [
      'Overview',
      'Members & Exco',
      'Village Economic Profile',
      'Work Plan',
      'Documents',
      'History',
    ]);
  });

  testWidgets('opens on the Members card, then the whole Exco section', (
    tester,
  ) async {
    await _pump(tester, const SocietyRecordScreen(societyId: _pahala));
    await _openTab(tester);
    final card = tester.getTopLeft(find.text('Members').first).dy;
    final exco = tester.getTopLeft(find.text('Exco · 25 Seats')).dy;
    final bearers = tester
        .getTopLeft(find.text('Office Bearers · Chosen From the 25'))
        .dy;
    expect(card, lessThan(exco));
    expect(exco, lessThan(bearers));
    // The existing Exco section is all still there.
    expect(find.text('Search name or profession'), findsOneWidget);
  });

  testWidgets('an older total-only record shows what is missing honestly', (
    tester,
  ) async {
    await _pump(tester, const SocietyRecordScreen(societyId: _pahala));
    await _openTab(tester);
    // The society's 412 members, not the Exco seat count.
    expect(_text(tester, 'total'), '412');
    for (final label in ['Female members', 'Male members', 'Under 18s']) {
      expect(_cell(label, 'Not entered'), findsOneWidget);
    }
    expect(
      find.text('Female, male and under 18 figures have not been entered yet.'),
      findsOneWidget,
    );
    expect(_text(tester, 'updated'), 'Last updated: not recorded yet');
  });

  testWidgets(
    'female 25, male 17 and under 18s 10 total 42, and stay after reopening',
    (tester) async {
      final l = await AppLocalizations.delegate.load(const Locale('en'));
      final store = await _pump(
        tester,
        const SocietyRecordScreen(societyId: _pahala),
      );
      await _openTab(tester);
      await _openEdit(tester);
      expect(find.text('Edit Members'), findsOneWidget);
      // The older total cannot stand in for the split: it must be entered.
      expect(_formTotal(tester), '—');

      await _type(tester, 'female', '25');
      await _type(tester, 'male', '17');
      await _type(tester, 'under18', '10');
      // Under 18s are inside the total: 42, not 52.
      expect(_formTotal(tester), '42');
      await _save(tester);

      expect(find.text('Edit Members'), findsNothing);
      expect(_text(tester, 'total'), '42');
      expect(_cell('Female members', '25'), findsOneWidget);
      expect(_cell('Male members', '17'), findsOneWidget);
      expect(_cell('Under 18s', '10'), findsOneWidget);
      expect(_text(tester, 'updated'), 'Last updated ${l.savedAt(demoNow)}');

      // Leaving and reopening the record keeps every figure and the time.
      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(
        DemoScope(
          store: store,
          child: MaterialApp(
            theme: AppTheme.light(),
            home: const SocietyRecordScreen(societyId: _pahala),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await _openTab(tester);
      expect(_text(tester, 'total'), '42');
      expect(_cell('Under 18s', '10'), findsOneWidget);
      expect(_text(tester, 'updated'), 'Last updated ${l.savedAt(demoNow)}');
      // The Overview says the same total.
      await _openTab(tester, 'Overview');
      expect(find.text('42 · 25 female, 17 male'), findsOneWidget);
    },
  );

  testWidgets(
    'refuses under 18s above the total and counts that are not whole',
    (tester) async {
      late _CountingApi api;
      await _pump(
        tester,
        const SocietyRecordScreen(societyId: _pahala),
        records: (user) => api = _CountingApi(user: user, clock: () => demoNow),
      );
      await _openTab(tester);
      await _openEdit(tester);
      await _type(tester, 'female', '25');
      await _type(tester, 'male', '17');

      await _type(tester, 'under18', '43');
      expect(
        find.text('Under 18s cannot be more than the total members (42).'),
        findsOneWidget,
      );
      await _save(tester);
      expect(api.saves, 0);

      for (final bad in ['-1', '1.5', '2000000']) {
        await _type(tester, 'under18', bad);
        expect(
          find.text(
            'Enter a whole number from 0 to 1,000,000, for example 25.',
          ),
          findsOneWidget,
          reason: bad,
        );
      }
      await _type(tester, 'female', '2.5');
      expect(_formTotal(tester), '—');
      await _save(tester);
      expect(api.saves, 0);
      expect(find.text('Edit Members'), findsOneWidget);

      // 0 and exactly the total are valid.
      await _type(tester, 'female', '25');
      await _type(tester, 'under18', '42');
      expect(find.textContaining('cannot be more than'), findsNothing);
      await _type(tester, 'under18', '0');
      await _save(tester);
      expect(api.saves, 1);
      expect(_cell('Under 18s', '0'), findsOneWidget);
    },
  );

  testWidgets('a failed save keeps the typed figures and Last updated', (
    tester,
  ) async {
    late _CountingApi api;
    await _pump(
      tester,
      const SocietyRecordScreen(societyId: _wellawa),
      role: UserRole.programmeCoordinator,
      records: (user) => api = _CountingApi(user: user, clock: () => demoNow),
    );
    await _openTab(tester);
    final before = _text(tester, 'updated');
    expect(_text(tester, 'total'), '143');
    await _openEdit(tester);
    await _type(tester, 'female', '90');
    api.fail = true;
    await _save(tester);

    expect(api.saves, 1);
    expect(find.text('Edit Members'), findsOneWidget);
    expect(find.textContaining('Your changes are still here.'), findsOneWidget);
    expect(find.widgetWithText(TextField, '90'), findsOneWidget);
    expect(_formTotal(tester), '153');

    // Cancel: nothing saved, nothing moved.
    await tester.tap(find.widgetWithText(OutlinedButton, 'Cancel'));
    await tester.pumpAndSettle();
    expect(_text(tester, 'total'), '143');
    expect(_cell('Female members', '80'), findsOneWidget);
    expect(_text(tester, 'updated'), before);
  });

  testWidgets('another profile edit does not move the membership time', (
    tester,
  ) async {
    var now = demoNow;
    final store = await _pump(
      tester,
      const SizedBox(),
      role: UserRole.programmeCoordinator,
      clock: () => now,
    );
    final records = store.societyRecords;
    final first = await records.updateRecord(_wellawa, {
      'femaleMembers': 80,
      'maleMembers': 63,
      'under18Members': 25,
    });
    expect(first.membershipUpdatedAt, demoNow);

    now = demoNow.add(const Duration(days: 3));
    final other = await records.updateRecord(_wellawa, {
      'businessDescription': 'Fictional coir rope',
    });
    expect(other.membershipUpdatedAt, demoNow);
    // A retry of the same figures is not a change either.
    final retry = await records.updateRecord(_wellawa, {
      'femaleMembers': 80,
      'maleMembers': 63,
      'under18Members': 25,
    });
    expect(retry.membershipUpdatedAt, demoNow);
    // A smaller split may not leave the under 18s above the total.
    await expectLater(
      records.updateRecord(_wellawa, {'femaleMembers': 10, 'maleMembers': 5}),
      throwsA(isA<SocietyRecordException>()),
    );
    final lower = await records.updateRecord(_wellawa, {
      'femaleMembers': 70,
      'maleMembers': 63,
    });
    expect(lower.memberCount, 133);
    expect(lower.membershipUpdatedAt, now);
  });

  testWidgets('people who may only view see the figures with no Edit', (
    tester,
  ) async {
    await _pump(
      tester,
      const SocietyRecordScreen(societyId: _pahala),
      role: UserRole.districtManager,
    );
    await _openTab(tester);
    expect(_text(tester, 'total'), '412');
    expect(find.byKey(const ValueKey('membership.edit')), findsNothing);
    expect(find.byType(MembershipCard), findsOneWidget);
  });

  for (final code in ['si', 'ta']) {
    testWidgets('reads and fits with large text in $code', (tester) async {
      final l = await AppLocalizations.delegate.load(Locale(code));
      // The record screen at a common phone width. (Below about 400 wide,
      // Overview's office bearers card already overflows in Sinhala and
      // Tamil on the base branch; that card is not part of this change.)
      final store = await _pump(
        tester,
        const SocietyRecordScreen(societyId: _wellawa),
        role: UserRole.programmeCoordinator,
        code: code,
        size: const Size(412, 2400),
        textScale: 1.3,
      );
      await _openTab(tester, l.recTabMembersExco);
      expect(find.text(l.memTitle), findsWidgets);
      expect(find.text(l.memUnder18), findsOneWidget);
      expect(find.text(l.memExcoSection), findsOneWidget);
      expect(_text(tester, 'total'), l.number(143));
      expect(tester.takeException(), isNull);
      await _openEdit(tester);
      expect(find.text(l.memEditTitle), findsOneWidget);
      await _type(tester, 'under18', '200');
      expect(find.text(l.memUnder18TooMany(143)), findsOneWidget);
      expect(tester.takeException(), isNull);

      // The new card and form on a small phone with large text.
      late SocietyRecord record;
      store.societyRecords.fetchRecord(_wellawa).then((r) => record = r);
      await tester.pumpAndSettle();
      // A fresh app, so the Edit Members screen is not still on top.
      await tester.pumpWidget(const SizedBox());
      await _pump(
        tester,
        Scaffold(
          body: ListView(
            padding: const EdgeInsets.all(14),
            children: [MembershipCard(record: record, onEdit: () {})],
          ),
        ),
        role: UserRole.programmeCoordinator,
        code: code,
        size: const Size(320, 2400),
        textScale: 1.3,
      );
      expect(find.text(l.memUnder18Part), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      await _pump(
        tester,
        EditMembershipScreen(record: record),
        role: UserRole.programmeCoordinator,
        code: code,
        size: const Size(320, 2400),
        textScale: 1.3,
      );
      await _type(tester, 'female', '-3');
      expect(find.text(l.editMembersFormat), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}
