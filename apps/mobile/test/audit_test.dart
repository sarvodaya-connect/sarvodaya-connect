import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/models/audit.dart';
import 'package:sarvodaya_connect_mobile/src/models/document.dart';
import 'package:sarvodaya_connect_mobile/src/screens/documents_screen.dart';

import 'test_helpers.dart';

Future<void> _openAudit(WidgetTester tester) async {
  await signInWithDemoAccount(tester);
  await tapVisible(tester, find.text('Audit FY 2025/26'));
  // The checklist is folded under "Required steps", as in the catalogue.
  await tapVisible(tester, find.text('Required steps'));
}

/// The status chip shown on one checklist row.
Finder _rowStatus(String title, String status) => find.descendant(
  of: find.widgetWithText(ListTile, title),
  matching: find.text(status),
);

void main() {
  testWidgets('M12 shows each required audit step and its status', (
    tester,
  ) async {
    await pumpApp(tester);
    await _openAudit(tester);

    expect(find.widgetWithText(AppBar, 'Audit'), findsOneWidget);
    expect(find.text('FY 2025/26'), findsOneWidget);
    expect(find.text('3 of 6 complete'), findsOneWidget);
    expect(find.text('The report is 13 days late'), findsOneWidget);

    expect(_rowStatus('Accounts closed for the year', 'Complete'), findsOne);
    expect(_rowStatus('Auditor appointed', 'Complete'), findsOne);
    expect(_rowStatus('Records given to the auditor', 'Complete'), findsOne);
    expect(
      _rowStatus('Audit report signed by the auditor', 'In progress'),
      findsOne,
    );
    expect(_rowStatus('Audit report uploaded', 'Overdue'), findsOne);
    expect(
      _rowStatus('Checked by the District Centre', 'Not started'),
      findsOne,
    );

    // Last year's audit is approved, with the reviewer's comment.
    await tester.scrollUntilVisible(
      find.text('FY 2024/25'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(
      find.textContaining('Approved 06 Oct 2025 by R. Fernando'),
      findsOneWidget,
    );
    expect(
      find.text('“Clear and complete. Keep receipts with the cash book.”'),
      findsOneWidget,
    );
  });

  testWidgets('Uploading the audit report completes the report steps', (
    tester,
  ) async {
    final store = await pumpApp(tester);
    await _openAudit(tester);

    await tapVisible(tester, find.text('Upload audit report'));
    // The sheet opens with the audit report type already chosen.
    expect(
      find.descendant(
        of: find.byType(DropdownButtonFormField<DocumentType>),
        matching: find.text('Audit report'),
      ),
      findsOneWidget,
    );
    await tester.tap(find.text('Audit report FY 2025-26 (signed).pdf'));
    await tester.tap(find.widgetWithText(FilledButton, 'Upload'));
    await tester.pumpAndSettle();

    expect(store.currentAudit.status, AuditStatus.underReview);
    expect(find.text('5 of 6 complete'), findsOneWidget);
    if (find.text('Audit report uploaded').evaluate().isEmpty) {
      await tapVisible(tester, find.text('Required steps'));
    }
    expect(find.text('Audit report received'), findsOneWidget);
    expect(find.textContaining('days late'), findsNothing);
    expect(_rowStatus('Audit report uploaded', 'Complete'), findsOne);
    expect(
      _rowStatus('Audit report signed by the auditor', 'Complete'),
      findsOne,
    );
    expect(
      _rowStatus('Checked by the District Centre', 'In progress'),
      findsOne,
    );

    // The report is in the document library, filtered to audit reports.
    await tapVisible(tester, find.text('View in Documents'));
    expect(find.byType(DocumentsScreen), findsOneWidget);
    expect(find.text('Audit report FY 2025-26 (signed).pdf'), findsOneWidget);
    expect(find.text('Audit report FY 2024-25.pdf'), findsOneWidget);
    expect(find.text('Office-bearer list 2026.pdf'), findsNothing);
  });

  testWidgets('M12 shows the error, retry and empty states', (tester) async {
    final store = await pumpApp(tester);
    await _openAudit(tester);

    store.setDemoOptions(failLoads: true);
    await tester.pump();
    await tester.pumpAndSettle();
    expect(find.text('Something went wrong'), findsOneWidget);

    store.failLoads = false;
    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();
    expect(find.text('3 of 6 complete'), findsOneWidget);

    store.setDemoOptions(emptyRecords: true);
    await tester.pump();
    await tester.pumpAndSettle();
    expect(find.text('No audits yet'), findsOneWidget);
  });
}
