import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/activity_screens.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/sdg_widgets.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_api.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_models.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_screen.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';

import 'test_helpers.dart';

const _pahala = 'society-pahala-kosgama';

DemoStore _store(UserRole role, {Duration loadDelay = Duration.zero}) =>
    DemoStore(loadDelay: loadDelay, clock: () => demoNow)..switchDemoRole(role);

Future<DemoStore> _pump(
  WidgetTester tester,
  Widget home, {
  UserRole role = UserRole.societyOfficer,
  Size size = const Size(412, 2400),
  double textScale = 1,
  Duration loadDelay = Duration.zero,
}) async {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
  final store = _store(role, loadDelay: loadDelay);
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
  group('M09 work plan', () {
    testWidgets('shows each activity with its SPC status and UN SDGs', (
      tester,
    ) async {
      await _pump(
        tester,
        const SocietyRecordScreen(
          societyId: _pahala,
          initialTab: RecordTab.workPlan,
        ),
      );
      expect(find.text('Approved · SDG 6, 15'), findsOneWidget);
      expect(find.text('● Waiting for SPC'), findsOneWidget);
      expect(find.text('3 approved · 1 waiting'), findsOneWidget);
      expect(find.text('Not payments'), findsOneWidget);

      await tester.tap(find.text('Calendar'));
      await tester.pumpAndSettle();
      expect(find.text('Sep'), findsOneWidget);
      expect(find.text('Nothing planned'), findsWidgets);
    });

    testWidgets('a District Manager sees the plan but cannot add', (
      tester,
    ) async {
      await _pump(
        tester,
        const SocietyRecordScreen(
          societyId: _pahala,
          initialTab: RecordTab.workPlan,
        ),
        role: UserRole.districtManager,
      );
      expect(find.text('Youth leadership camp'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Add'), findsNothing);
    });

    testWidgets(
      'the Society Officer adds an activity in four steps and it waits for the SPC',
      (tester) async {
        final store = await _pump(
          tester,
          const SocietyRecordScreen(
            societyId: _pahala,
            initialTab: RecordTab.workPlan,
          ),
        );
        await _tap(tester, find.widgetWithText(FilledButton, 'Add'));
        expect(find.text('STEP 1 OF 4'), findsOneWidget);

        // Required details are checked before moving on.
        await _tap(tester, find.text('Next: Participants'));
        expect(find.text('Enter the activity name.'), findsOneWidget);

        final fields = find.byType(TextField);
        await tester.enterText(fields.at(0), 'Coir rope training');
        await tester.enterText(
          fields.at(1),
          'Two days of coir rope training for women members.',
        );
        await _tap(tester, find.text('Next: Participants'));
        expect(find.text('STEP 2 OF 4'), findsOneWidget);

        // Youth are counted inside the participants, so this is refused.
        await _tap(tester, find.byTooltip('more youth (15–25)'));
        await _tap(tester, find.text('Next: Resources'));
        expect(
          find.textContaining('Youth are counted inside the female'),
          findsOneWidget,
        );
        await _tap(tester, find.byTooltip('fewer youth (15–25)'));
        for (var i = 0; i < 3; i++) {
          await _tap(tester, find.byTooltip('more female participants'));
        }
        expect(find.text('Total participants 3'), findsOneWidget);
        await _tap(tester, find.text('Next: Resources'));

        expect(find.text('STEP 3 OF 4'), findsOneWidget);
        await tester.enterText(find.byType(TextField).first, '18,000');
        await _tap(tester, find.text('Next: Check'));

        expect(find.text('STEP 4 OF 4'), findsOneWidget);
        expect(find.text('LKR 18,000 (planning)'), findsOneWidget);
        await _tap(tester, find.text('Send to SPC'));
        expect(find.text('Sent to Your SPC'), findsOneWidget);
        await _tap(tester, find.text('Back to work plan'));

        expect(find.text('Coir rope training'), findsOneWidget);
        expect(find.text('● Waiting for SPC'), findsNWidgets(2));
        final plan = await store.societyRecords.fetchWorkPlan(_pahala);
        expect(
          plan.activities.map((a) => a.name),
          contains('Coir rope training'),
        );
      },
    );
  });

  group('M50–M57 SPC approval', () {
    testWidgets('lists waiting activities for the SPC only', (tester) async {
      await _pump(
        tester,
        const ActivitiesToApproveScreen(),
        role: UserRole.programmeCoordinator,
      );
      expect(find.text('Youth leadership camp'), findsOneWidget);
      expect(find.text('Approved Recently'), findsOneWidget);
      expect(find.text('Clean Water and Sanitation'), findsWidgets);
    });

    testWidgets('other roles see that only SPCs approve', (tester) async {
      await _pump(tester, const ActivitiesToApproveScreen());
      expect(find.text('Only SPCs Approve Activities'), findsOneWidget);
    });

    testWidgets(
      'the SPC validates each step and approves multiple classifications',
      (tester) async {
        final store = await _pump(
          tester,
          const ActivitiesToApproveScreen(),
          role: UserRole.programmeCoordinator,
        );
        await _tap(tester, find.text('Youth leadership camp'));
        expect(find.text('Review Activity'), findsOneWidget);

        await _tap(tester, find.widgetWithText(FilledButton, 'Continue'));
        await _tap(tester, find.widgetWithText(FilledButton, 'Continue'));
        expect(
          find.text('Choose at least one Sarvodaya dimension.'),
          findsOneWidget,
        );
        await _tap(tester, find.widgetWithText(CheckboxListTile, 'Social'));
        await _tap(tester, find.widgetWithText(CheckboxListTile, 'Economic'));
        await _tap(tester, find.widgetWithText(FilledButton, 'Continue'));
        await _tap(tester, find.widgetWithText(FilledButton, 'Continue'));
        expect(
          find.text('Choose at least one Sarvodaya category.'),
          findsOneWidget,
        );
        await _tap(
          tester,
          find.widgetWithText(CheckboxListTile, 'Community education'),
        );
        await _tap(tester, find.widgetWithText(CheckboxListTile, 'Governance'));
        await _tap(tester, find.widgetWithText(OutlinedButton, 'Back'));
        expect(
          tester
              .widget<CheckboxListTile>(
                find.widgetWithText(CheckboxListTile, 'Social'),
              )
              .value,
          isTrue,
        );
        await _tap(tester, find.widgetWithText(FilledButton, 'Continue'));
        expect(
          tester
              .widget<CheckboxListTile>(
                find.widgetWithText(CheckboxListTile, 'Governance'),
              )
              .value,
          isTrue,
        );
        await _tap(tester, find.widgetWithText(FilledButton, 'Continue'));

        // All 17 official goals, each named for screen readers.
        expect(find.bySemanticsLabel('SDG 1: No Poverty'), findsOneWidget);
        expect(
          find.bySemanticsLabel('SDG 17: Partnerships for the Goals'),
          findsOneWidget,
        );

        await _tap(tester, find.widgetWithText(FilledButton, 'Continue'));
        expect(
          find.text('Choose at least one UN SDG to approve.'),
          findsOneWidget,
        );

        await _tap(tester, find.bySemanticsLabel('SDG 4: Quality Education'));
        expect(
          find.bySemanticsLabel('SDG 4: Quality Education, selected'),
          findsOneWidget,
        );
        await _tap(
          tester,
          find.bySemanticsLabel(
            'SDG 16: Peace, Justice and Strong Institutions',
          ),
        );
        await _tap(tester, find.widgetWithText(FilledButton, 'Continue'));
        expect(find.text('Check and approve'), findsOneWidget);
        expect(find.text('Social · Economic'), findsOneWidget);
        expect(find.text('Community education · Governance'), findsOneWidget);

        store.offline = true;
        await _tap(tester, find.widgetWithText(FilledButton, 'Approve'));
        expect(find.textContaining('You are offline.'), findsOneWidget);
        expect(find.text('Activity approved'), findsNothing);
        expect(find.text('Community education · Governance'), findsOneWidget);

        store.offline = false;
        await _tap(tester, find.widgetWithText(FilledButton, 'Try again'));
        expect(find.text('Activity approved'), findsOneWidget);
        expect(find.text('SDG 4 · Quality Education'), findsOneWidget);
        expect(
          find.text('SDG 16 · Peace, Justice and Strong Institutions'),
          findsOneWidget,
        );

        // A second decision is refused, as on the server.
        final plan = await store.societyRecords.fetchWorkPlan(_pahala);
        final camp = plan.activities.firstWhere(
          (a) => a.name == 'Youth leadership camp',
        );
        expect(camp.sdgs, [4, 16]);
        expect(camp.classification?.dimensions, [
          ActivityDimension.social,
          ActivityDimension.economic,
        ]);
        expect(camp.classification?.categories, [
          ActivityCategory.communityEducation,
          ActivityCategory.governance,
        ]);
        expect(
          () => store.societyRecords.approveActivity(camp.id, [4]),
          throwsA(isA<SocietyRecordException>()),
        );
      },
    );

    testWidgets('the SPC sends an activity back with a note (M51b)', (
      tester,
    ) async {
      final store = await _pump(
        tester,
        const ActivitiesToApproveScreen(),
        role: UserRole.programmeCoordinator,
      );
      await _tap(tester, find.text('Youth leadership camp'));
      await _tap(tester, find.widgetWithText(OutlinedButton, 'Send back'));
      expect(find.text('Send Back to Nimali Wijesinghe?'), findsOneWidget);
      await tester.enterText(
        find.byType(TextField).last,
        'Please split the participants by village ward.',
      );
      await _tap(tester, find.widgetWithText(FilledButton, 'Send back'));

      expect(
        find.text(
          'Nothing is waiting. New activities appear here when a Society Officer sends one.',
        ),
        findsOneWidget,
      );
      final plan = await store.societyRecords.fetchWorkPlan(_pahala);
      final camp = plan.activities.firstWhere(
        (a) => a.name == 'Youth leadership camp',
      );
      expect(
        camp.reviewComment,
        'Please split the participants by village ward.',
      );
    });

    test('approval is refused for a version the SPC did not review', () async {
      final store = _store(UserRole.programmeCoordinator);
      final queue = await store.societyRecords.fetchActivityQueue();
      final id = queue.waiting.first.id;
      final reviewed = (await store.societyRecords.fetchActivity(id)).activity;
      const classification = ActivityClassification(
        dimensions: [ActivityDimension.social],
        categories: [ActivityCategory.communityEducation],
      );
      await expectLater(
        store.societyRecords.approveActivity(
          id,
          [4],
          classification: classification,
          reviewedSubmittedAt: reviewed.submittedAt!.subtract(
            const Duration(minutes: 1),
          ),
        ),
        throwsA(
          isA<SocietyRecordException>()
              .having((e) => e.status, 'status', 409)
              .having((e) => e.message, 'message', contains('changed while')),
        ),
      );
      expect(
        (await store.societyRecords.fetchActivity(id)).activity.status,
        ActivityStatus.waitingForSpc,
      );
      final approved = await store.societyRecords.approveActivity(
        id,
        [4],
        classification: classification,
        reviewedSubmittedAt: reviewed.submittedAt,
      );
      expect(approved.activity.status, ActivityStatus.approved);
    });

    test('the saved classification cannot be changed by the caller', () async {
      final store = _store(UserRole.programmeCoordinator);
      final queue = await store.societyRecords.fetchActivityQueue();
      final id = queue.waiting.first.id;
      final dimensions = [ActivityDimension.social];
      final categories = [ActivityCategory.culture];
      final approved = await store.societyRecords.approveActivity(
        id,
        [4],
        classification: ActivityClassification(
          dimensions: dimensions,
          categories: categories,
        ),
      );
      dimensions.clear();
      categories.clear();
      final saved = (await store.societyRecords.fetchActivity(id)).activity;
      expect(saved.classification?.dimensions, [ActivityDimension.social]);
      expect(saved.classification?.categories, [ActivityCategory.culture]);
      expect(
        () => approved.activity.classification!.dimensions.clear(),
        throwsUnsupportedError,
      );
    });

    testWidgets(
      'a retry that finds the activity already approved shows the saved decision',
      (tester) async {
        final store = await _pump(
          tester,
          const ActivitiesToApproveScreen(),
          role: UserRole.programmeCoordinator,
        );
        await _tap(tester, find.text('Youth leadership camp'));
        await _tap(tester, find.widgetWithText(FilledButton, 'Continue'));
        await _tap(tester, find.widgetWithText(CheckboxListTile, 'Social'));
        await _tap(tester, find.widgetWithText(FilledButton, 'Continue'));
        await _tap(tester, find.widgetWithText(CheckboxListTile, 'Culture'));
        await _tap(tester, find.widgetWithText(FilledButton, 'Continue'));
        await _tap(tester, find.bySemanticsLabel('SDG 4: Quality Education'));
        await _tap(tester, find.widgetWithText(FilledButton, 'Continue'));

        // An earlier attempt went through, but its answer was lost.
        final queue = await store.societyRecords.fetchActivityQueue();
        final camp = queue.waiting.firstWhere(
          (a) => a.name == 'Youth leadership camp',
        );
        await store.societyRecords.approveActivity(
          camp.id,
          [4],
          classification: const ActivityClassification(
            dimensions: [ActivityDimension.social],
            categories: [ActivityCategory.culture],
          ),
        );

        await _tap(tester, find.widgetWithText(FilledButton, 'Approve'));
        expect(find.text('Activity approved'), findsNothing);
        expect(
          find.text('This activity is no longer waiting for approval.'),
          findsOneWidget,
        );
        await tester.scrollUntilVisible(
          find.byType(SdgChip),
          300,
          scrollable: find.byType(Scrollable).first,
        );
        expect(find.textContaining('Approved by'), findsOneWidget);
        expect(find.text('Culture'), findsOneWidget);
        // The card reads as one: who approved, the classification and the goals.
        expect(
          find.bySemanticsLabel(
            RegExp(r'^Approved by .*SDG 4: Quality Education$', dotAll: true),
          ),
          findsOneWidget,
        );
      },
    );

    testWidgets('a category left empty says why, above the buttons', (
      tester,
    ) async {
      final store = _store(UserRole.programmeCoordinator);
      final queue = await store.societyRecords.fetchActivityQueue();
      await _pump(
        tester,
        ActivityReviewScreen(activityId: queue.waiting.first.id),
        role: UserRole.programmeCoordinator,
        size: const Size(320, 568),
      );
      await _tap(tester, find.widgetWithText(FilledButton, 'Continue'));
      await _tap(tester, find.widgetWithText(CheckboxListTile, 'Social'));
      await _tap(tester, find.widgetWithText(FilledButton, 'Continue'));
      await tester.tap(find.widgetWithText(FilledButton, 'Continue'));
      await tester.pumpAndSettle();
      expect(
        find.text('Choose at least one Sarvodaya category.').hitTestable(),
        findsOneWidget,
      );
      expect(find.text('Step 2 of 4'), findsOneWidget);
    });

    testWidgets('sending back says so while it is sent', (tester) async {
      // Slow answers, so the in-progress label can be seen.
      Future<void> wait() async {
        await tester.pump(const Duration(milliseconds: 400));
        await tester.pumpAndSettle();
      }

      await _pump(
        tester,
        const ActivitiesToApproveScreen(),
        role: UserRole.programmeCoordinator,
        loadDelay: const Duration(milliseconds: 300),
      );
      await wait();
      await tester.tap(find.text('Youth leadership camp'));
      await wait();
      await tester.tap(find.widgetWithText(OutlinedButton, 'Send back'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Send back'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text('Sending…'), findsOneWidget);
      expect(find.text('Approving…'), findsNothing);
      await wait();
    });

    testWidgets('an SDG chip can show the goal in the reader’s language', (
      tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(body: SdgChip(4, title: 'ගුණාත්මක අධ්‍යාපනය')),
        ),
      );
      expect(find.text('ගුණාත්මක අධ්‍යාපනය'), findsOneWidget);
      expect(
        find.bySemanticsLabel('SDG 4: ගුණාත්මක අධ්‍යාපනය'),
        findsOneWidget,
      );
    });

    for (final (label, size, scale) in [
      ('a small phone', const Size(320, 568), 1.0),
      ('large text', const Size(375, 667), 1.3),
    ]) {
      testWidgets('the review screen lays out without overflow on $label', (
        tester,
      ) async {
        final store = _store(UserRole.programmeCoordinator);
        final queue = await store.societyRecords.fetchActivityQueue();
        await _pump(
          tester,
          ActivityReviewScreen(activityId: queue.waiting.first.id),
          role: UserRole.programmeCoordinator,
          size: size,
          textScale: scale,
        );
        expect(tester.takeException(), isNull);
        await tester.drag(find.byType(ListView).first, const Offset(0, -1500));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await _tap(tester, find.widgetWithText(FilledButton, 'Continue'));
        await _tap(tester, find.widgetWithText(CheckboxListTile, 'Social'));
        expect(tester.takeException(), isNull);
        await _tap(tester, find.widgetWithText(FilledButton, 'Continue'));
        await tester.drag(find.byType(ListView).first, const Offset(0, -700));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      });
    }
  });

  group('M13 Registrar documents', () {
    testWidgets('counts the year’s documents and shows Not submitted', (
      tester,
    ) async {
      await _pump(
        tester,
        const SocietyRecordScreen(
          societyId: _pahala,
          initialTab: RecordTab.documents,
        ),
      );
      expect(find.text('Annual Documents · FY 2025/26'), findsOneWidget);
      expect(find.text('3 of 4 uploaded'), findsOneWidget);
      expect(find.text('Not submitted'), findsWidgets);
    });
  });
}
