import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/screens/society_officer_home_screen.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/record_widgets.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_screen.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';

import 'test_helpers.dart';

/// Pumps the Prototype v4 M05 home for the demo Society Officer.
Future<DemoStore> _openHome(
  WidgetTester tester, {
  Size size = const Size(402, 874),
  double textScale = 1,
}) async {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
  final store = DemoStore(loadDelay: Duration.zero, clock: () => demoNow)
    ..switchDemoRole(UserRole.societyOfficer);
  await tester.pumpWidget(
    DemoScope(
      store: store,
      child: MaterialApp(
        theme: AppTheme.light(),
        home: const SocietyOfficerHomeScreen(
          societyId: 'society-pahala-kosgama',
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return store;
}

void main() {
  group('M05 Society Officer home', () {
    testWidgets('shows the society at a glance and the waiting grade request', (
      tester,
    ) async {
      await _openHome(tester);

      expect(
        find.textContaining('Society Officer · Pahala Kosgama SSS'),
        findsOneWidget,
      );
      expect(
        find.text('Your access: Pahala Kosgama SSS only · view and edit'),
        findsOneWidget,
      );
      expect(find.text('Pahala Kosgama SSS'), findsOneWidget);
      expect(find.text('පහළ කොස්ගම සර්වෝදය සමිතිය'), findsOneWidget);
      expect(find.text('S-104233 · Kurunegala'), findsOneWidget);
      expect(
        find.byWidgetPredicate((w) => w is GradeBadge && w.grade == 'B'),
        findsOneWidget,
      );
      expect(find.text('Members'), findsOneWidget);
      expect(find.text('412'), findsOneWidget);
      expect(find.text('25/25'), findsOneWidget);
      expect(
        find.textContaining('Grade change B → A requested by S. Karunaratne.'),
        findsOneWidget,
      );
      expect(find.textContaining('All changes synced · today'), findsOneWidget);
      expect(find.text('UPDATE YOUR SOCIETY'), findsOneWidget);
      expect(find.text('25 of 25 · complete'), findsOneWidget);
      expect(find.text('Details, yearly profit and expenses'), findsOneWidget);
    });

    testWidgets('tiles open the matching Society, Exco and Work plan tabs', (
      tester,
    ) async {
      final store = await _openHome(tester);

      await tester.tap(find.text('Exco members'));
      expect(store.selectedTab, OfficerTabs.exco);
      await tester.tap(find.text('Annual work plan'));
      expect(store.selectedTab, OfficerTabs.workPlan);
      await tester.tap(find.text('Society information'));
      expect(store.selectedTab, OfficerTabs.society);

      await tester.ensureVisible(find.text('Change history'));
      await tester.tap(find.text('Change history'));
      await tester.pumpAndSettle();
      final record = tester.widget<SocietyRecordScreen>(
        find.byType(SocietyRecordScreen),
      );
      expect(record.initialTab, 4);
    });

    for (final (label, size, scale) in [
      ('a small phone', const Size(320, 568), 1.0),
      ('large text', const Size(375, 667), 1.3),
      ('a large phone', const Size(440, 956), 1.0),
    ]) {
      testWidgets('lays out without overflow on $label', (tester) async {
        await _openHome(tester, size: size, textScale: scale);
        expect(tester.takeException(), isNull);
        await tester.drag(find.byType(ListView), const Offset(0, -800));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        expect(find.text('Disaster response'), findsOneWidget);
      });
    }
  });
}
