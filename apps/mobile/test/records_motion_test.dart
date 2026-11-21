import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/l10n/generated/app_localizations.dart';
import 'package:sarvodaya_connect_mobile/src/l10n/l10n_format.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/motion/app_motion.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/demo_society_record_api.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/membership_widgets.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_api.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_models.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_screen.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/work_plan_view.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';
import 'package:sarvodaya_connect_mobile/src/widgets/count_field.dart';

import 'test_helpers.dart';

/// Issue #136: motion on the society record and its forms. Every society and
/// figure is fictional.

const _pahala = 'society-pahala-kosgama';

/// Saves that can be held open, failed, and counted.
class _HeldApi extends DemoSocietyRecordApi {
  _HeldApi({required super.user, required super.clock})
    : super(delay: Duration.zero);

  int saves = 0;
  bool fail = false;
  Completer<void>? hold;

  @override
  Future<SocietyRecord> updateRecord(
    String id,
    Map<String, Object> changes,
  ) async {
    saves++;
    await hold?.future;
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
  bool reduceMotion = false,
  _HeldApi Function(AuthenticatedUser? Function() user)? records,
  bool settle = true,
}) async {
  tester.view.physicalSize = const Size(412, 2400) * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  DemoStore? holder;
  final store = DemoStore(
    loadDelay: Duration.zero,
    clock: () => demoNow,
    societyRecordApi: records?.call(() => holder?.user),
  )..switchDemoRole(UserRole.societyOfficer);
  holder = store;
  await tester.pumpWidget(
    DemoScope(
      store: store,
      child: MotionScope(
        child: MaterialApp(
          theme: AppTheme.light(),
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context)
                .copyWith(disableAnimations: reduceMotion),
            child: child!,
          ),
          home: home,
        ),
      ),
    ),
  );
  if (settle) await tester.pumpAndSettle();
  return store;
}

/// The opacity each visible entrance itself applies (its first Opacity, not
/// any Opacity inside the content it wraps).
List<double> _entranceOpacities(WidgetTester tester) => [
  for (final entrance in find.byType(MotionEntrance).evaluate())
    tester
        .widget<Opacity>(
          find
              .descendant(
                of: find.byWidget(entrance.widget),
                matching: find.byType(Opacity),
              )
              .first,
        )
        .opacity,
];

Future<void> _openTab(WidgetTester tester, String label) async {
  final tab = find.widgetWithText(Tab, label);
  // The tab bar scrolls; bring the tab on screen so the tap really lands.
  await tester.ensureVisible(tab);
  await tester.pumpAndSettle();
  await tester.tap(tab);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('the overview enters once, then never replays', (tester) async {
    await _pump(
      tester,
      const SocietyRecordScreen(societyId: _pahala),
      settle: false,
    );
    // The record loads, then its first sections fade and slide in.
    var sawEntrance = false;
    for (var frame = 0; frame < 30 && !sawEntrance; frame++) {
      await tester.pump(const Duration(milliseconds: 16));
      sawEntrance = _entranceOpacities(tester).any((value) => value < 1);
    }
    expect(sawEntrance, isTrue);
    await tester.pumpAndSettle();
    expect(_entranceOpacities(tester), everyElement(1));

    // Going to another tab and back, and an ordinary rebuild, keep it still.
    await _openTab(tester, 'Members & Exco');
    await _openTab(tester, 'Overview');
    expect(_entranceOpacities(tester), everyElement(1));
    tester.element(find.byType(SocietyRecordScreen)).markNeedsBuild();
    await tester.pump(const Duration(milliseconds: 16));
    expect(_entranceOpacities(tester), everyElement(1));
  });

  testWidgets(
    'with reduced motion, content is fully shown on its first frame',
    (tester) async {
      await _pump(
        tester,
        const SocietyRecordScreen(societyId: _pahala),
        reduceMotion: true,
        settle: false,
      );
      for (var frame = 0; frame < 10; frame++) {
        await tester.pump(const Duration(milliseconds: 16));
        expect(_entranceOpacities(tester), everyElement(1));
      }
      await _openTab(tester, 'Work Plan');
      // The loaded work plan is on screen, with no entrance in progress.
      expect(find.byType(WorkPlanView), findsOneWidget);
      expect(_entranceOpacities(tester), everyElement(1));
    },
  );

  group('editing member counts', () {
    late _HeldApi api;
    late SocietyRecord record;

    Future<void> open(WidgetTester tester) async {
      final store = await _pump(
        tester,
        const SizedBox(),
        records: (user) => api = _HeldApi(user: user, clock: () => demoNow),
      );
      record = await store.societyRecords.fetchRecord(_pahala);
      await tester.pumpWidget(const SizedBox());
      await _pump(
        tester,
        EditMembershipScreen(record: record),
        records: (user) => api = _HeldApi(user: user, clock: () => demoNow),
      );
    }

    Finder save() => find.byKey(const ValueKey('membership.save'));

    /// A female count different from the saved one, so Save has something to send.
    String changed() => '${(record.femaleMembers ?? 0) + 7}';

    /// Both counts must be filled before Save sends anything.
    Future<void> typeCounts(WidgetTester tester) async {
      await tester.enterText(
        find.byKey(const ValueKey('membership.female')),
        changed(),
      );
      await tester.enterText(
        find.byKey(const ValueKey('membership.male')),
        '${(record.maleMembers ?? 0) + 3}',
      );
      await tester.pump();
    }

    testWidgets('a double tap sends one save', (tester) async {
      await open(tester);
      await typeCounts(tester);
      api.hold = Completer<void>();
      await tester.ensureVisible(save());
      // Both taps land before the screen rebuilds with the button disabled.
      await tester.tap(save());
      await tester.tap(save(), warnIfMissed: false);
      await tester.pump();
      expect(api.saves, 1);
      api.hold!.complete();
      await tester.pumpAndSettle();
      expect(api.saves, 1);
    });

    testWidgets('a failed save keeps the typed counts and shows why', (
      tester,
    ) async {
      await open(tester);
      api.fail = true;
      await typeCounts(tester);
      await tester.ensureVisible(save());
      await tester.tap(save());
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<TextField>(
              find.descendant(
                of: find.byKey(const ValueKey('membership.female')),
                matching: find.byType(TextField),
                matchRoot: true,
              ),
            )
            .controller!
            .text,
        changed(),
      );
      expect(find.textContaining('did not answer'), findsOneWidget);
      api.fail = false;
      await tester.tap(save());
      await tester.pumpAndSettle();
      expect(api.saves, 2);
    });
  });

  testWidgets('count buttons give press feedback only while they can act', (
    tester,
  ) async {
    var value = 0;
    await tester.pumpWidget(
      MaterialApp(
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        home: Scaffold(
          body: StatefulBuilder(
            builder: (context, setState) => CountField(
              label: 'Injured',
              value: value,
              max: 5,
              onChanged: (next) => setState(() => value = next ?? value),
            ),
          ),
        ),
      ),
    );
    final presses = tester.widgetList<MotionPress>(find.byType(MotionPress));
    // At 0 the minus button cannot act, so it gives no press feedback.
    expect(presses.map((press) => press.enabled), [false, true]);
    await tester.tap(find.byIcon(Icons.add_circle_outline));
    await tester.pumpAndSettle();
    expect(value, 1);
    expect(
      tester
          .widgetList<MotionPress>(find.byType(MotionPress))
          .map((p) => p.enabled),
      [true, true],
    );
  });
}
