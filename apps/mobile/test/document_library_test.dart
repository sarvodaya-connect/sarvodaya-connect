import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/models/document.dart';
import 'package:sarvodaya_connect_mobile/src/services/demo_document_upload_service.dart';
import 'package:sarvodaya_connect_mobile/src/services/document_upload_service.dart';

import 'test_helpers.dart';

const _agmFile = 'AGM minutes 2026-09-28.pdf';

Future<void> _openDocuments(WidgetTester tester) async {
  await signInWithDemoAccount(tester);
  await tester.tap(find.text('Submit'));
  await tester.pumpAndSettle();
}

Future<void> _chooseAndUpload(WidgetTester tester) async {
  await tapVisible(tester, find.text('Upload document'));
  await tester.tap(find.text(_agmFile));
  await tester.tap(find.widgetWithText(FilledButton, 'Upload'));
  await tester.pumpAndSettle();
}

/// The library row for [fileName].
Finder _row(String fileName) => find.widgetWithText(ListTile, fileName);

void main() {
  testWidgets(
    'M13 library shows each document type, status, uploader and date',
    (tester) async {
      await pumpApp(tester);
      await _openDocuments(tester);

      expect(find.text('Registrar documents · FY 2025/26'), findsOneWidget);
      final officeBearers = _row('Office-bearer list 2026.pdf');
      expect(
        find.descendant(
          of: officeBearers,
          matching: find.textContaining(
            'Office-bearer list · 420 KB\nUploaded by N. Wijesinghe · 20 Mar 2026',
          ),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(of: officeBearers, matching: find.text('Approved')),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: _row('Members list 2026 (signed).pdf'),
          matching: find.textContaining('DM & HQ only'),
        ),
        findsOneWidget,
      );

      // Filter by type.
      await tapVisible(tester, find.widgetWithText(ChoiceChip, 'Audit report'));
      expect(find.text('Audit report FY 2024-25.pdf'), findsOneWidget);
      expect(find.text('Office-bearer list 2026.pdf'), findsNothing);
      expect(find.text('Registrar documents · FY 2025/26'), findsNothing);

      await tapVisible(tester, find.widgetWithText(ChoiceChip, 'Other'));
      expect(find.text('No other supporting document yet'), findsOneWidget);
      await tapVisible(tester, find.text('Show all'));
      expect(find.text('Office-bearer list 2026.pdf'), findsOneWidget);
    },
  );

  testWidgets('Choosing a fictional file records it in the library', (
    tester,
  ) async {
    final store = await pumpApp(tester);
    await _openDocuments(tester);

    await _chooseAndUpload(tester);

    expect(
      find.text('$_agmFile uploaded. The District Centre will review it.'),
      findsOneWidget,
    );
    final document = store.libraryDocuments.first;
    expect(document.fileName, _agmFile);
    expect(document.documentType, DocumentType.agmMinutes);
    expect(document.status, DocumentStatus.submitted);
    expect(document.uploadedBy, 'Nimali Wijesinghe');
    // Not attached to a Council update, because none is being prepared.
    expect(store.draftDocuments, isEmpty);

    await tester.scrollUntilVisible(
      _row(_agmFile),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(
      find.descendant(
        of: _row(_agmFile),
        matching: find.textContaining(
          'Uploaded by Nimali Wijesinghe · 13 Oct 2026',
        ),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(of: _row(_agmFile), matching: find.text('Under Review')),
      findsOneWidget,
    );
  });

  testWidgets('A failed upload keeps the choices and can be retried', (
    tester,
  ) async {
    final store = await pumpApp(tester);
    await _openDocuments(tester);
    store.setDemoOptions(failNextUpload: true);
    await tester.pump();
    await tester.pumpAndSettle();

    await _chooseAndUpload(tester);

    expect(find.text('Upload failed'), findsOneWidget);
    expect(
      find.descendant(
        of: find.byType(BottomSheet),
        matching: find.textContaining(
          'The connection dropped before the upload finished.',
        ),
      ),
      findsOneWidget,
    );
    expect(store.failedUploads.single.fileName, _agmFile);
    expect(
      store.libraryDocuments.where((d) => d.fileName == _agmFile),
      isEmpty,
    );

    await tester.tap(find.widgetWithText(FilledButton, 'Retry upload'));
    await tester.pumpAndSettle();

    expect(find.text('Upload failed'), findsNothing);
    expect(store.failedUploads, isEmpty);
    expect(store.libraryDocuments.first.fileName, _agmFile);
  });

  testWidgets('A failed upload stays in the library until it is retried', (
    tester,
  ) async {
    final store = await pumpApp(tester);
    await _openDocuments(tester);
    store.setDemoOptions(failNextUpload: true);
    await tester.pump();
    await tester.pumpAndSettle();

    await _chooseAndUpload(tester);
    // Close the upload sheet without retrying.
    await tester.tapAt(const Offset(20, 20));
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Not uploaded'),
      -300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(
      find.descendant(
        of: _row(_agmFile),
        matching: find.textContaining('Upload failed · AGM minutes'),
      ),
      findsOneWidget,
    );

    await tapVisible(
      tester,
      find.bySemanticsLabel('Retry upload of $_agmFile'),
    );
    expect(find.text('$_agmFile uploaded.'), findsOneWidget);
    expect(find.text('Not uploaded'), findsNothing);
    expect(store.failedUploads, isEmpty);
    expect(store.libraryDocuments.first.fileName, _agmFile);
  });

  testWidgets('A failed upload can be removed from the library', (
    tester,
  ) async {
    final store = await pumpApp(tester);
    await _openDocuments(tester);
    store.setDemoOptions(failNextUpload: true);
    await tester.pump();
    await tester.pumpAndSettle();

    await _chooseAndUpload(tester);
    await tester.tapAt(const Offset(20, 20));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Not uploaded'),
      -300,
      scrollable: find.byType(Scrollable).first,
    );
    await tapVisible(tester, find.byTooltip('Remove $_agmFile'));

    expect(find.text('Not uploaded'), findsNothing);
    expect(store.failedUploads, isEmpty);
  });

  testWidgets('M13 shows the empty library state', (tester) async {
    final store = await pumpApp(tester);
    store.setDemoOptions(emptyRecords: true);
    await _openDocuments(tester);

    expect(find.text('No documents yet'), findsOneWidget);
    expect(find.text('0 of 4 approved'), findsOneWidget);
    for (final type in [
      'Audit report',
      'AGM minutes',
      'Office-bearer list',
      'Members list',
    ]) {
      expect(find.bySemanticsLabel('Upload $type'), findsOneWidget);
    }
  });

  test(
    'Demo upload service never leaves the phone and can fail once',
    () async {
      var online = true;
      var failOnce = true;
      final service = DemoDocumentUploadService(
        isOnline: () => online,
        shouldFail: () {
          final fail = failOnce;
          failOnce = false;
          return fail;
        },
        clock: () => demoNow,
      );
      const request = DocumentUploadRequest(
        societyId: 'society-pahala-kosgama',
        documentType: DocumentType.agmMinutes,
        fileName: _agmFile,
        contentType: 'application/pdf',
        sizeBytes: 1400000,
      );

      await expectLater(
        service.upload(request),
        throwsA(isA<DocumentUploadException>()),
      );
      final receipt = await service.upload(request);
      expect(receipt.receivedAt, demoNow);
      expect(receipt.documentId, startsWith('doc-local-'));

      online = false;
      await expectLater(
        service.upload(request),
        throwsA(
          isA<DocumentUploadException>().having(
            (error) => error.offline,
            'offline',
            isTrue,
          ),
        ),
      );
    },
  );
}
