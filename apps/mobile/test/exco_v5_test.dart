import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/exco_screens.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_models.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_screen.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';

import 'test_helpers.dart';

/// Opens Pahala Kosgama's Exco tab (V5 M07) for a demo role.
Future<DemoStore> _openExco(WidgetTester tester, UserRole role) async {
  tester.view.physicalSize = const Size(412 * 3, 3200 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final store = DemoStore(loadDelay: Duration.zero, clock: () => demoNow)
    ..switchDemoRole(role);
  await tester.pumpWidget(
    DemoScope(
      store: store,
      child: MaterialApp(
        theme: AppTheme.light(),
        home: const SocietyRecordScreen(societyId: 'society-pahala-kosgama'),
      ),
    ),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.widgetWithText(Tab, 'Exco'));
  await tester.pumpAndSettle();
  return store;
}

Future<void> _tap(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

ExcoMember _member(int seat, String name, String position) => ExcoMember(
  id: 'm$seat',
  seatNumber: seat,
  fullName: name,
  position: position,
);

void main() {
  test('moving an office makes the previous holder a member', () {
    final exco = [
      _member(1, 'A', 'President'),
      _member(2, 'B', 'Secretary'),
      _member(3, 'C', 'Treasurer'),
      _member(4, 'D', 'Member'),
    ];
    final seats = councilWith(exco, office: (seat: 4, office: 'Treasurer'));
    final position = {for (final s in seats) s['seatNumber']: s['position']};
    expect(position, {
      1: 'President',
      2: 'Secretary',
      3: 'Member',
      4: 'Treasurer',
    });
    expect(seats.first['isPrimaryContact'], isTrue);
  });

  test('age is worked out from the date of birth', () {
    expect(ageFrom(DateTime(1984, 6, 14), DateTime(2026, 6, 13)), 41);
    expect(ageFrom(DateTime(1984, 6, 14), DateTime(2026, 6, 14)), 42);
  });

  testWidgets('M07 lists all 25 with office bearers first and opens M07v', (
    tester,
  ) async {
    await _openExco(tester, UserRole.societyOfficer);

    expect(find.text('All 25 positions filled'), findsOneWidget);
    expect(find.textContaining('25 / 25'), findsOneWidget);
    expect(find.text('Show all 22 members'), findsOneWidget);

    await _tap(tester, find.text('N. Wijesinghe'));
    expect(find.text('Exco member'), findsOneWidget);
    expect(find.text('Exco member 2 of 25'), findsOneWidget);
    expect(find.text('NIC number'), findsOneWidget);
    expect(find.text('Replace this member'), findsOneWidget);
    expect(find.text('Edit'), findsOneWidget);
  });

  testWidgets('M07x then M07e replaces a member and keeps 25', (tester) async {
    await _openExco(tester, UserRole.societyOfficer);
    await _tap(tester, find.text('Show all 22 members'));
    await _tap(tester, find.text('Exco member 4'));
    await _tap(tester, find.text('Replace this member'));
    expect(find.text('Replace Exco member 4?'), findsOneWidget);
    await _tap(tester, find.text('Enter the new member'));

    // Nothing entered yet: every required field says what is missing.
    await _tap(tester, find.text('Save member'));
    expect(find.text('Enter the NIC number.'), findsOneWidget);

    await tester.enterText(find.byType(TextFormField).at(0), '199500000077');
    await tester.enterText(find.byType(TextFormField).at(1), 'W. M. Pathirana');
    await tester.enterText(
      find.byType(TextFormField).at(2),
      'No. 4, Wewa Para',
    );
    await tester.enterText(find.byType(TextFormField).at(3), 'Nurse');
    await tester.enterText(find.byType(TextFormField).at(4), '+94 77 123 4567');
    await _tap(tester, find.text('Save member'));
    // Date of birth is still missing.
    expect(find.text('Enter the date of birth.'), findsOneWidget);

    await _tap(tester, find.text('Choose a date'));
    await _tap(tester, find.text('OK'));
    await _tap(tester, find.text('Save member'));

    expect(find.text('W. M. Pathirana'), findsOneWidget);
    expect(find.text('Exco member 4'), findsNothing);
    expect(find.text('All 25 positions filled'), findsOneWidget);
  });

  testWidgets('M07o changes the Treasurer', (tester) async {
    await _openExco(tester, UserRole.societyOfficer);
    // The third office row is the Treasurer.
    await _tap(tester, find.text('Change').at(2));
    expect(find.text('Choose the Treasurer'), findsOneWidget);
    await _tap(tester, find.text('Exco member 5'));
    expect(
      find.text('S. Tharmalingam will stay an Exco member, without an office.'),
      findsOneWidget,
    );
    await _tap(tester, find.text('Make Treasurer'));

    // The new Treasurer's own page shows the office.
    await _tap(tester, find.text('Exco member 5'));
    expect(find.text('Exco member 5 of 25'), findsOneWidget);
    expect(find.textContaining('Treasurer'), findsOneWidget);
  });

  testWidgets('M07d: a DM sees members but cannot edit or replace', (
    tester,
  ) async {
    await _openExco(tester, UserRole.districtManager);
    expect(find.text('Change'), findsNothing);
    await _tap(tester, find.text('N. Wijesinghe'));
    expect(find.text('View only'), findsOneWidget);
    expect(find.text('Replace this member'), findsNothing);
    expect(find.text('Edit'), findsNothing);
  });
}
