import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/models/committee.dart';
import 'package:sarvodaya_connect_mobile/src/screens/council_screen.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';

import 'test_helpers.dart';

void main() {
  testWidgets('M07b shows all 25 seats and opens member contact details', (
    tester,
  ) async {
    final store = testStore();
    await tester.pumpWidget(
      DemoScope(
        store: store,
        child: const MaterialApp(home: CouncilScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(store.totalSeats, 25);
    expect(store.council, hasLength(25));
    expect(find.text('25 / 25'), findsOneWidget);
    expect(store.seatsFilled[CouncilSeatType.child], 3);
    expect(store.seatsFilled[CouncilSeatType.youth], 3);
    expect(store.seatsFilled[CouncilSeatType.mother], 3);
    expect(store.seatsFilled[CouncilSeatType.ordinary], 9);
    expect(store.seatsFilled[CouncilSeatType.elder], 7);

    await tester.ensureVisible(find.text('K. Perera'));
    await tester.tap(find.text('K. Perera'));
    await tester.pumpAndSettle();
    expect(find.text('Phone'), findsOneWidget);
    expect(find.text('Email'), findsOneWidget);
    expect(find.text('cm-treasurer@example.invalid'), findsOneWidget);
  });
}
