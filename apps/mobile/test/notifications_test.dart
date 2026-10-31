import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/app.dart';
import 'package:sarvodaya_connect_mobile/src/data/demo_data.dart';
import 'package:sarvodaya_connect_mobile/src/screens/audit_screen.dart';
import 'package:sarvodaya_connect_mobile/src/screens/notifications_screen.dart';

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
  testWidgets('M16 shows v4 alerts, grade changes and reminders by date', (
    tester,
  ) async {
    await pumpApp(tester);
    await signInWithDemoAccount(tester);

    expect(_badge('4'), findsOneWidget);
    await _openNotifications(tester);
    expect(find.byType(NotificationsScreen), findsOneWidget);
    expect(find.bySemanticsLabel('4 unread'), findsOneWidget);
    expect(find.bySemanticsLabel('Today'), findsOneWidget);
    expect(find.bySemanticsLabel('Earlier'), findsOneWidget);
    expect(find.text('New incident: Floods — North Western'), findsOneWidget);
    expect(find.text('Grade B → A requested'), findsOneWidget);
    expect(find.text('Grade C → B approved by HQ'), findsOneWidget);
    expect(find.text('HQ asked for the 4 Registrar documents'), findsNothing);
    expect(_unreadDot('note-audit-reminder'), findsOneWidget);
    expect(_unreadDot('note-grade-approved'), findsNothing);
  });

  testWidgets('Tapping a notification marks it read and opens the audit', (
    tester,
  ) async {
    await pumpApp(tester);
    await signInWithDemoAccount(tester);
    await _openNotifications(tester);

    await tapVisible(tester, find.text(_auditTitle));
    expect(find.byType(AuditScreen), findsOneWidget);
    expect(find.text('3 of 6 complete'), findsOneWidget);

    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.bySemanticsLabel('3 unread'), findsOneWidget);
    expect(_unreadDot('note-audit-reminder'), findsNothing);
  });

  testWidgets('Grade request notifications open the society record', (
    tester,
  ) async {
    final store = await pumpApp(tester);
    await signInWithDemoAccount(tester);
    await _openNotifications(tester);

    await tapVisible(tester, find.text('Grade B → A requested'));
    expect(store.selectedTab, HomeShell.societyTab);
    expect(find.text('SSS-104233'), findsOneWidget);
  });

  testWidgets('Mark all read clears every unread state', (tester) async {
    await pumpApp(tester);
    await signInWithDemoAccount(tester);
    await _openNotifications(tester);

    await tapVisible(tester, find.text('New incident: Floods — North Western'));
    expect(find.byType(NotificationsScreen), findsOneWidget);
    expect(_unreadDot('note-incident-flood'), findsNothing);
    expect(find.bySemanticsLabel('3 unread'), findsOneWidget);

    await tester.tap(find.text('Mark all read'));
    await tester.pumpAndSettle();
    expect(find.bySemanticsLabel('All caught up'), findsOneWidget);
  });

  testWidgets('M16 shows the empty, error and retry states', (tester) async {
    final store = await pumpApp(tester);
    await signInWithDemoAccount(tester);
    (store.registryApiClient as TestRegistryApiClient).notifications = [];
    store.setDemoOptions(emptyRecords: true);
    await tester.pump();
    await tester.pumpAndSettle();

    expect(_badge('4'), findsNothing);
    await _openNotifications(tester);
    expect(find.text('No notifications'), findsOneWidget);
    await tester.tap(find.text('Back to Home'));
    await tester.pumpAndSettle();

    (store.registryApiClient as TestRegistryApiClient).failNotifications = true;
    store.setDemoOptions(emptyRecords: false, failLoads: true);
    await tester.pump();
    await tester.pumpAndSettle();
    await _openNotifications(tester);
    expect(find.text('Notifications unavailable'), findsOneWidget);

    store.failLoads = false;
    final api = store.registryApiClient as TestRegistryApiClient;
    api.failNotifications = false;
    api.notifications = demoNotifications(demoNow);
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(find.bySemanticsLabel('4 unread'), findsOneWidget);
  });
}
