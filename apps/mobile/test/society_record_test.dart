import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/annual_summary_screen.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/audit_report_upload_screen.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/document_picker.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/record_widgets.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_models.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_screen.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';

import 'test_helpers.dart';

const _pahala = 'society-pahala-kosgama';
const _wellawa = 'society-wellawa';

/// Pumps one society record (SC-65, M06) for a demo role with no delays.
Future<DemoStore> _openRecord(
  WidgetTester tester, {
  required UserRole role,
  String societyId = _pahala,
  DocumentPicker? picker,
}) async {
  tester.view.physicalSize = const Size(412 * 3, 3200 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final store = DemoStore(
    loadDelay: Duration.zero,
    clock: () => demoNow,
    documentPicker: picker,
  )..switchDemoRole(role);
  await tester.pumpWidget(
    DemoScope(
      store: store,
      child: MaterialApp(
        theme: AppTheme.light(),
        home: SocietyRecordScreen(societyId: societyId),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return store;
}

Future<void> _tapText(WidgetTester tester, String text) async {
  final finder = find.text(text).last;
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

class _FixedPicker implements DocumentPicker {
  const _FixedPicker(this.file);

  final PickedDocument file;

  @override
  Future<PickedDocument?> pick() async => file;
}

void main() {
  group('M06 society detail', () {
    testWidgets(
      'shows the yearly summary, grade request and record for the Society Officer',
      (tester) async {
        await _openRecord(tester, role: UserRole.societyOfficer);

        expect(find.text('Pahala Kosgama SSS'), findsWidgets);
        expect(
          find.text('Your access: this society only · view and edit'),
          findsOneWidget,
        );
        expect(
          find.text('Annual financial summary · FY 2025/26'),
          findsOneWidget,
        );
        expect(find.text('LKR 412,500'), findsOneWidget);
        expect(find.text('LKR 1,286,000'), findsOneWidget);
        expect(find.text('Audit report FY 2025/26'), findsOneWidget);
        expect(find.text('● Uploaded'), findsOneWidget);
        expect(find.text('Request: B → A · Waiting for HQ'), findsOneWidget);
        expect(find.widgetWithText(OutlinedButton, 'Edit'), findsOneWidget);
        // A request is already waiting, so a second one is not offered.
        expect(find.text('Request a grade change'), findsNothing);
        expect(find.text('Business run by the society'), findsOneWidget);
        expect(find.text('A. Jayasekara'), findsOneWidget);
      },
    );

    testWidgets('M06v keeps the District Manager view only', (tester) async {
      await _openRecord(tester, role: UserRole.districtManager);

      expect(find.text('View only'), findsOneWidget);
      expect(
        find.text('District Manager · Kurunegala · view only'),
        findsOneWidget,
      );
      expect(find.widgetWithText(OutlinedButton, 'Edit'), findsNothing);
      expect(find.text('Request a grade change'), findsNothing);
      expect(find.text('Add figures'), findsNothing);
      expect(
        find.textContaining('You cannot edit this society'),
        findsOneWidget,
      );
    });

    testWidgets('hides societies outside the user scope', (tester) async {
      await _openRecord(
        tester,
        role: UserRole.societyOfficer,
        societyId: 'society-wariyapola',
      );
      expect(find.text('Society not found'), findsOneWidget);
      expect(find.text('Try again'), findsNothing);
    });

    testWidgets('M06fx says the summary is missing and the SPC can add it', (
      tester,
    ) async {
      await _openRecord(
        tester,
        role: UserRole.programmeCoordinator,
        societyId: _wellawa,
      );

      expect(find.text('● Not added'), findsOneWidget);
      expect(find.text('Not added yet'), findsNWidgets(2));
      expect(find.text('● Missing'), findsOneWidget);
      expect(find.text('Add figures'), findsOneWidget);
      expect(find.text('Upload audit report'), findsOneWidget);
      expect(
        find.text(
          'The SPC can add the figures while this society has no Society Officer.',
        ),
        findsOneWidget,
      );
    });
  });

  group('M06f annual financial summary', () {
    testWidgets(
      'validates numbers, then saves both totals with a history entry',
      (tester) async {
        await _openRecord(
          tester,
          role: UserRole.programmeCoordinator,
          societyId: _wellawa,
        );
        await _tapText(tester, 'Add figures');
        expect(find.text('Yearly summary'), findsOneWidget);
        expect(
          find.text('FY 2025/26 · 1 Apr 2025 – 31 Mar 2026'),
          findsOneWidget,
        );

        final fields = find.byType(TextField);
        await tester.enterText(fields.at(0), '412500');
        await tester.enterText(fields.at(1), '1,286,000.5O');
        await tester.pumpAndSettle();
        expect(
          find.text('Use numbers only, for example 1286000.'),
          findsOneWidget,
        );
        expect(find.text('● Unsaved changes'), findsOneWidget);
        expect(
          tester
              .widget<FilledButton>(find.widgetWithText(FilledButton, 'Save'))
              .onPressed,
          isNull,
        );

        await tester.enterText(fields.at(1), '1,286,000.50');
        await tester.pumpAndSettle();
        await tester.tap(find.widgetWithText(FilledButton, 'Save'));
        await tester.pumpAndSettle();

        expect(find.text('Yearly summary'), findsNothing);
        expect(find.text('LKR 412,500'), findsOneWidget);
        expect(find.text('LKR 1,286,000.5'), findsOneWidget);

        await _tapText(tester, 'History');
        expect(find.text('FY 2025/26 profit entered'), findsOneWidget);
        expect(find.textContaining('S. Karunaratne (SPC)'), findsWidgets);
      },
    );

    testWidgets(
      'is not offered to the DDM, whose entry is still to be confirmed',
      (tester) async {
        await _openRecord(tester, role: UserRole.deputyDistrictManager);
        expect(find.widgetWithText(OutlinedButton, 'Edit'), findsOneWidget);
        expect(find.bySemanticsLabel('Edit the yearly figures'), findsNothing);
        expect(find.text('Add figures'), findsNothing);
      },
    );
  });

  group('M06e edit society and M06u unsaved changes', () {
    testWidgets('marks changes, checks the landline and warns before leaving', (
      tester,
    ) async {
      await _openRecord(tester, role: UserRole.societyOfficer);
      await tester.tap(find.widgetWithText(OutlinedButton, 'Edit'));
      await tester.pumpAndSettle();

      expect(find.text('Edit society information'), findsOneWidget);
      expect(find.text('S-104233'), findsOneWidget);
      expect(find.text('Read only'), findsNWidgets(2));

      final members = find.widgetWithText(TextField, '412');
      await tester.enterText(members, '418');
      await tester.enterText(find.byType(TextField).at(3), '037 22');
      await tester.pumpAndSettle();
      expect(find.text('Was 412'), findsOneWidget);
      expect(
        find.text(
          'Enter a 10-digit number, for example 037 000 0000, or leave it empty.',
        ),
        findsOneWidget,
      );
      expect(find.text('● Unsaved changes'), findsOneWidget);

      await tester.tap(find.byTooltip('Close'));
      await tester.pumpAndSettle();
      expect(find.text('Leave without saving?'), findsOneWidget);
      expect(
        find.textContaining('number of members and landline'),
        findsOneWidget,
      );
      await tester.tap(find.text('Keep editing'));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField).at(3), '037 000 0123');
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Save changes'));
      await tester.pumpAndSettle();

      expect(find.text('Edit society information'), findsNothing);
      expect(find.text('418'), findsOneWidget);
      expect(find.text('037 000 0123'), findsOneWidget);
    });

    testWidgets('Discard changes leaves the record unchanged', (tester) async {
      await _openRecord(tester, role: UserRole.societyOfficer);
      await tester.tap(find.widgetWithText(OutlinedButton, 'Edit'));
      await tester.pumpAndSettle();
      await tester.enterText(find.widgetWithText(TextField, '412'), '500');
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Close'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Discard changes'));
      await tester.pumpAndSettle();
      expect(find.text('412'), findsOneWidget);
      expect(find.text('500'), findsNothing);
    });
  });

  group('M06g and M06q grade changes', () {
    testWidgets(
      'the SPC requests a new grade; the grade stays until HQ decides',
      (tester) async {
        await _openRecord(
          tester,
          role: UserRole.programmeCoordinator,
          societyId: _wellawa,
        );
        await _tapText(tester, 'Request a grade change');
        expect(find.text('C · Needs strengthening'), findsOneWidget);
        expect(find.text('Current'), findsOneWidget);

        await tester.tap(find.widgetWithText(FilledButton, 'Send to HQ'));
        await tester.pumpAndSettle();
        expect(find.text('Choose the grade you propose.'), findsOneWidget);

        await tester.tap(find.bySemanticsLabel(RegExp('Grade B, Developing')));
        await tester.enterText(find.byType(TextField), 'Too short');
        await tester.pumpAndSettle();
        expect(
          find.text('Explain the reason in at least 10 characters.'),
          findsOneWidget,
        );
        await tester.enterText(
          find.byType(TextField),
          'The Exco was re-formed at the AGM and all activities took place.',
        );
        await tester.tap(find.widgetWithText(FilledButton, 'Send to HQ'));
        await tester.pumpAndSettle();

        expect(find.text('Request: C → B · Waiting for HQ'), findsOneWidget);
        expect(find.text('Grade C · Needs strengthening'), findsOneWidget);
      },
    );

    testWidgets('M06q shows who sent and decided each request', (tester) async {
      await _openRecord(tester, role: UserRole.districtManager);
      await _tapText(tester, 'Request: B → A · Waiting for HQ');

      expect(find.text('● Waiting for HQ'), findsOneWidget);
      expect(find.text('● Approved'), findsOneWidget);
      expect(find.text('● Rejected'), findsOneWidget);
      expect(find.text('Waiting for an HQ decision'), findsOneWidget);
      expect(
        find.text('“Move one grade at a time. Please apply for B first.”'),
        findsOneWidget,
      );
      expect(find.text('Rejected by K. Mendis (HQ)'), findsOneWidget);
    });
  });

  group('M13 documents and M13a audit report upload', () {
    testWidgets('lists the audit report with its year and uploader', (
      tester,
    ) async {
      await _openRecord(tester, role: UserRole.districtManager);
      await _tapText(tester, 'Documents');

      expect(find.text('Audit report · FY 2025/26'), findsOneWidget);
      expect(
        find.textContaining('Nimali Wijesinghe (Society Officer)'),
        findsWidgets,
      );
      // The District Manager views documents but cannot upload.
      expect(find.widgetWithText(FilledButton, 'Upload'), findsNothing);
    });

    testWidgets('the SPC uploads the year’s audit report with progress', (
      tester,
    ) async {
      await _openRecord(
        tester,
        role: UserRole.programmeCoordinator,
        societyId: _wellawa,
        picker: const DemoDocumentPicker(name: 'Audit_Report_Wellawa.pdf'),
      );
      await _tapText(tester, 'Upload audit report');
      expect(find.text('Upload audit report'), findsOneWidget);
      expect(find.text('S. Karunaratne'), findsOneWidget);

      await tester.tap(find.widgetWithText(FilledButton, 'Upload'));
      await tester.pumpAndSettle();
      expect(find.text('Choose the audit report file.'), findsOneWidget);

      await tester.tap(find.text('Choose a PDF or photo'));
      await tester.pumpAndSettle();
      expect(find.text('Audit_Report_Wellawa.pdf'), findsOneWidget);
      expect(find.text('PDF · 1.8 MB'), findsOneWidget);

      await tester.tap(find.widgetWithText(FilledButton, 'Upload'));
      await tester.pumpAndSettle();
      expect(find.text('Upload audit report'), findsNothing);

      await _tapText(tester, 'Overview');
      expect(find.text('● Uploaded'), findsOneWidget);
      expect(find.text('● Missing'), findsNothing);
    });

    testWidgets('rejects files that are too large or the wrong type', (
      tester,
    ) async {
      await _openRecord(
        tester,
        role: UserRole.programmeCoordinator,
        societyId: _wellawa,
        picker: _FixedPicker(
          PickedDocument(
            name: 'scan.pdf',
            bytes: List<int>.filled(maxAuditReportBytes + 1, 0),
            contentType: 'application/pdf',
          ),
        ),
      );
      await _tapText(tester, 'Upload audit report');
      await tester.tap(find.text('Choose a PDF or photo'));
      await tester.pumpAndSettle();
      expect(
        find.text('This file is 10.0 MB. Choose a file up to 10 MB.'),
        findsOneWidget,
      );
      expect(
        validateAuditReport(
          const PickedDocument(
            name: 'notes.docx',
            bytes: [1],
            contentType: 'application/octet-stream',
          ),
        ),
        'Choose a PDF or a photo (JPG or PNG).',
      );
    });
  });

  group('M06h change history', () {
    testWidgets('filters changes by tab and names who made them', (
      tester,
    ) async {
      await _openRecord(tester, role: UserRole.societyOfficer);
      await _tapText(tester, 'History');

      expect(find.text('Grade change B → A requested'), findsOneWidget);
      expect(
        find.text('Exco member replaced: K. Perera → D. Ratnayake'),
        findsOneWidget,
      );
      final gradeChip = find.widgetWithText(ChoiceChip, 'Grade');
      await tester.scrollUntilVisible(
        gradeChip,
        150,
        scrollable: find.descendant(
          of: find.byWidgetPredicate(
            (widget) =>
                widget is ListView && widget.scrollDirection == Axis.horizontal,
          ),
          matching: find.byType(Scrollable),
        ),
      );
      await tester.tap(gradeChip);
      await tester.pumpAndSettle();
      expect(find.text('Grade change B → A requested'), findsOneWidget);
      expect(
        find.text('Exco member replaced: K. Perera → D. Ratnayake'),
        findsNothing,
      );
      expect(
        find.text('Every change shows who made it and when.'),
        findsOneWidget,
      );
    });
  });

  group('amount formatting and parsing', () {
    test('formats LKR totals and parses typed numbers', () {
      expect(formatLkr(1286000), 'LKR 1,286,000');
      expect(formatLkr(412500.5), 'LKR 412,500.5');
      expect(formatAmount(-2500), '-2,500');
      expect(parseAmount('1,286,000'), 1286000);
      expect(parseAmount('1286000.50'), 1286000.5);
      expect(parseAmount('1,286,000.5O'), isNull);
      expect(parseAmount('-10'), isNull);
      expect(parseAmount('-10', allowNegative: true), -10);
      expect(parseAmount('12.345'), isNull);
    });
  });
}
