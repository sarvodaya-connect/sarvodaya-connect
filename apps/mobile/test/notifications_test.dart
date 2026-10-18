import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/app.dart';
import 'package:sarvodaya_connect_mobile/src/screens/audit_screen.dart';
import 'package:sarvodaya_connect_mobile/src/screens/changes_requested_screen.dart';
import 'package:sarvodaya_connect_mobile/src/screens/notifications_screen.dart';
import 'package:sarvodaya_connect_mobile/src/screens/submission_detail_screen.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';

import 'test_helpers.dart';

const _auditTitle = 'Audit report FY 2025/26 is overdue';

Finder _badge(String count) => find.descendant(
  of: find.byTooltip('Notifications'),
  matching: find.text(count),
);

Finder _unreadDot(String id) => find.byKey(ValueKey('unread-$id'));

Future<void> _openNotifications(WidgetTester tester) async {
  await tester.tap(find.byTooltip('Notifications'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('M16 shows read and unread notifications in groups', (
    tester,
  ) async {
    await pumpApp(tester);
    await signInWithDemoAccount(tester);

    expect(_badge('4'), findsOneWidget);
    await _openNotifications(tester);

    expect(find.byType(NotificationsScreen), findsOneWidget);
    expect(find.text('4 unread'), findsOneWidget);
    expect(find.text('TODAY'), findsOneWidget);
    expect(find.text('EARLIER'), findsOneWidget);
    expect(find.text('HQ asked for the 4 Registrar documents'), findsOneWidget);

    // Unread: dot, bold title and "Unread" for screen readers.
    expect(_unreadDot('note-audit-overdue'), findsOneWidget);
    expect(
      find.bySemanticsLabel(RegExp('^Unread\\. $_auditTitle\\.')),
      findsOneWidget,
    );
    final unreadTitle = tester.widget<Text>(find.text(_auditTitle));
    expect(unreadTitle.style?.fontWeight, FontWeight.w700);

    // Read: no dot, regular weight, no "Unread" label.
    expect(_unreadDot('note-membership-q2'), findsNothing);
    expect(
      find.bySemanticsLabel(RegExp('^Membership Apr–Jun approved\\.')),
      findsOneWidget,
    );
    final readTitle = tester.widget<Text>(
      find.text('Membership Apr–Jun approved'),
    );
    expect(readTitle.style?.fontWeight, FontWeight.w500);
  });

  testWidgets('Tapping a notification marks it read and opens the audit', (
    tester,
  ) async {
    final store = await pumpApp(tester);
    await signInWithDemoAccount(tester);
    await _openNotifications(tester);

    await tester.tap(find.text(_auditTitle));
    await tester.pumpAndSettle();
    expect(find.byType(AuditScreen), findsOneWidget);
    expect(find.text('3 of 6 complete'), findsOneWidget);

    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.text('3 unread'), findsOneWidget);
    expect(_unreadDot('note-audit-overdue'), findsNothing);
    expect(store.unreadNotificationCount, 3);

    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(_badge('3'), findsOneWidget);
  });

  testWidgets('Notifications open documents, submissions and the profile', (
    tester,
  ) async {
    final store = await pumpApp(tester);
    await signInWithDemoAccount(tester);

    await _openNotifications(tester);
    await tester.tap(find.text('HQ asked for the 4 Registrar documents'));
    await tester.pumpAndSettle();
    expect(store.selectedTab, HomeShell.documentsTab);
    expect(find.text('Registrar documents · FY 2025/26'), findsOneWidget);

    await tester.tap(find.text('Home'));
    await tester.pumpAndSettle();
    await _openNotifications(tester);
    await tapVisible(tester, find.text('Membership Apr–Jun approved'));
    expect(find.byType(SubmissionDetailScreen), findsOneWidget);
    expect(find.text('Counts match the register. Thank you.'), findsWidgets);

    await tester.pageBack();
    await tester.pumpAndSettle();
    await tapVisible(tester, find.text('Society location verified'));
    expect(store.selectedTab, HomeShell.societyTab);
    expect(find.text('SSS-104233'), findsOneWidget);
  });

  testWidgets('Mark all read clears every unread state', (tester) async {
    final store = await pumpApp(tester);
    await signInWithDemoAccount(tester);
    await _openNotifications(tester);

    // A notice with no linked item is marked read without leaving the list.
    await tester.tap(find.text('District society meeting on 25 Oct 2026'));
    await tester.pumpAndSettle();
    expect(find.byType(NotificationsScreen), findsOneWidget);
    expect(_unreadDot('note-district-meeting'), findsNothing);
    expect(find.text('3 unread'), findsOneWidget);

    await tester.tap(find.text('Mark all read'));
    await tester.pumpAndSettle();
    expect(store.unreadNotificationCount, 0);
    expect(find.text('All caught up'), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp('^Unread')), findsNothing);
    expect(
      tester
          .widget<TextButton>(find.widgetWithText(TextButton, 'Mark all read'))
          .onPressed,
      isNull,
    );

    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(_badge('0'), findsNothing);
  });

  testWidgets('A returned Council update notifies the officer', (tester) async {
    final store = await pumpApp(tester);
    await signInWithDemoAccount(tester);

    final treasurer = store.council.firstWhere(
      (member) => member.position == 'Treasurer',
    );
    store.saveDraft(
      CouncilReplacementDraft(
        memberId: treasurer.id,
        fullName: 'S. Tharmalingam',
        phone: '+94 00 000 0040',
        seatType: treasurer.seatType,
        startDate: DateTime(2026, 10, 1),
      ),
    );
    final submission = (await tester.runAsync(store.submitCouncilUpdate))!;
    store
      ..demoStartReview(submission.id)
      ..demoRequestChanges(submission.id);
    await tester.pumpAndSettle();

    expect(_badge('5'), findsOneWidget);
    await _openNotifications(tester);
    await tester.tap(find.text('Council update returned · 1 field to fix'));
    await tester.pumpAndSettle();
    expect(find.byType(ChangesRequestedScreen), findsOneWidget);
  });

  testWidgets('M16 shows the empty, error and retry states', (tester) async {
    final store = await pumpApp(tester);
    await signInWithDemoAccount(tester);
    store.setDemoOptions(emptyRecords: true);
    await tester.pump();
    await tester.pumpAndSettle();

    expect(_badge('4'), findsNothing);
    await _openNotifications(tester);
    expect(find.text('No notifications'), findsOneWidget);
    await tester.tap(find.text('Back to Home'));
    await tester.pumpAndSettle();

    store.setDemoOptions(emptyRecords: false, failLoads: true);
    await tester.pump();
    await tester.pumpAndSettle();
    await _openNotifications(tester);
    expect(find.text('Something went wrong'), findsOneWidget);

    store.failLoads = false;
    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();
    expect(find.text('4 unread'), findsOneWidget);
  });
}
