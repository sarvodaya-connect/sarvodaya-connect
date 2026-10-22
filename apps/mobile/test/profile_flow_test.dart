import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/models/submission.dart';
import 'package:sarvodaya_connect_mobile/src/widgets/state_views.dart';
import 'package:sarvodaya_connect_mobile/src/widgets/status_chip.dart';

import 'test_helpers.dart';

/// The SC-25 minimum demonstration path, end to end:
/// Sign in -> Home -> Society profile -> Committee -> Replace Treasurer -> Documents -> Review
/// -> Submit -> Tracker -> Changes Requested -> Correct -> Resubmit -> Approved.
void main() {
  testWidgets('Society Officer can complete the accepted demo flow', (
    tester,
  ) async {
    final store = await pumpApp(tester);
    await signInWithDemoAccount(tester);

    // Home -> Society profile -> Council tab -> Update Committee.
    await tester.tap(find.text('View society profile'));
    await tester.pumpAndSettle();
    expect(find.text('SSS-104233'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Missing'),
      300,
      scrollable: find.byType(Scrollable).last,
    ); // Society email is labelled, not hidden.
    await tester.tap(find.text('Council'));
    await tester.pumpAndSettle();
    await tapVisible(
      tester,
      find.widgetWithText(FilledButton, 'Update Committee'),
    );

    // Replace the Treasurer.
    await tapVisible(tester, find.bySemanticsLabel('Replace K. Perera'));
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Full name *'),
      'S. Tharmalingam',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Phone *'),
      '+94 00 000 0040',
    );
    await tester.tap(find.widgetWithText(TextFormField, 'Start date *'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Save as draft'));
    await tester.pumpAndSettle();

    // Supporting document: an oversized file is refused, then the PDF is accepted.
    await tester.tap(find.text('Next: add supporting document'));
    await tester.pumpAndSettle();
    await tester.tap(
      find.descendant(
        of: find.byType(BottomActionBar),
        matching: find.text('Upload'),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('AGM minutes photo.jpg'));
    await tester.tap(find.widgetWithText(FilledButton, 'Upload'));
    await tester.pumpAndSettle();
    expect(
      find.textContaining('The file is too large (14.0 MB)'),
      findsOneWidget,
    );
    await tester.tap(find.text('AGM minutes 2026-09-28.pdf'));
    await tester.pumpAndSettle();
    // Choosing another file clears the error.
    expect(find.textContaining('The file is too large'), findsNothing);
    await tester.tap(find.widgetWithText(FilledButton, 'Upload'));
    await tester.pumpAndSettle();
    expect(store.draftDocuments, hasLength(1));

    // Review and submit, with confirmation.
    await tester.tap(find.text('Next: review and submit'));
    await tester.pumpAndSettle();
    expect(find.text('K. Perera'), findsOneWidget);
    expect(find.text('S. Tharmalingam'), findsOneWidget);
    await tapVisible(tester, find.text('Send to District'));
    expect(find.text('Confirm this before you submit.'), findsOneWidget);
    await tapVisible(tester, find.byType(Checkbox));
    await tapVisible(tester, find.text('Send to District'));
    await tester.tap(find.text('Yes, submit'));
    await tester.pumpAndSettle();

    expect(find.text('Sent to District Centre'), findsOneWidget);
    expect(find.textContaining('SUB-2026-0143'), findsOneWidget);
    expect(store.councilSubmission?.status, SubmissionStatus.submitted);

    // Tracker: the District Manager's review is simulated with the demo controls.
    await tester.tap(find.text('Track it'));
    await tester.pumpAndSettle();
    expect(find.text('Waiting for review'), findsOneWidget);
    await tapVisible(tester, find.text('Start review'));
    expect(find.text('Locked during review'), findsOneWidget);
    await tapVisible(tester, find.text('Return start date'));
    expect(store.councilSubmission?.status, SubmissionStatus.changesRequested);

    // Changes Requested: only the returned field is editable.
    await tapVisible(tester, find.text('Open returned submission'));
    expect(find.bySemanticsLabel(RegExp('No Correction Required · read-only')), findsWidgets);
    await tester.tap(
      find.widgetWithText(TextFormField, 'Corrected treasurer start date *'),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Send corrected update'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Yes, resubmit'));
    await tester.pumpAndSettle();
    expect(store.councilSubmission?.status, SubmissionStatus.resubmitted);

    // Final review and approval.
    await tapVisible(tester, find.text('Start review'));
    await tapVisible(tester, find.text('Approve'));
    expect(store.councilSubmission?.status, SubmissionStatus.approved);
    await tester.scrollUntilVisible(
      find.textContaining('Approved by R. Fernando'),
      -300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.textContaining('Approved by R. Fernando'), findsOneWidget);
    expect(
      store.council
          .firstWhere((member) => member.position == 'Treasurer')
          .fullName,
      'S. Tharmalingam',
    );
    expect(store.councilHistory.single.fullName, 'K. Perera');
  });

  test(
    'Draft, Submitted and Under Review have distinct labels, icons and colours',
    () {
      final styles = [
        SubmissionStatus.draft,
        SubmissionStatus.submitted,
        SubmissionStatus.underReview,
      ].map((status) => status.style).toList();
      expect(styles.map((style) => style.label).toSet(), {
        'Draft',
        'Submitted',
        'Under Review',
      });
      expect(styles.map((style) => style.icon).toSet(), hasLength(3));
      expect(styles.map((style) => style.background).toSet(), hasLength(3));
    },
  );
}
