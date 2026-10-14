import 'dart:async';

import 'package:flutter/material.dart';

import '../data/demo_data.dart';
import '../format.dart';
import '../models/document.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/demo_loader.dart';
import '../widgets/section_card.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';
import 'review_submit_screen.dart';

/// Allowed demo formats and size from the SC-25 upload rules.
const allowedContentTypes = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
};
const maxUploadBytes = 10 * 1000 * 1000;

/// Returns an error for an invalid file, or null when it can be uploaded.
String? validateUpload({required String contentType, required int sizeBytes}) {
  if (!allowedContentTypes.containsKey(contentType)) {
    return 'This file type is not accepted. Choose a PDF, JPG or PNG file.';
  }
  if (sizeBytes > maxUploadBytes) {
    return 'The file is too large (${formatFileSize(sizeBytes)}). Choose a file of 10 MB or less.';
  }
  return null;
}

/// M13 · Documents. Also used inside the Council update flow ([inFlow]).
class DocumentsScreen extends StatelessWidget {
  const DocumentsScreen({super.key, this.inFlow = false});

  final bool inFlow;

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final hasDraft =
        store.draft != null && store.councilSubmission?.isLocked != true;
    return Scaffold(
      appBar: AppBar(title: Text(inFlow ? 'Supporting document' : 'Documents')),
      body: Column(
        children: [
          if (store.offline) const OfflineBanner(),
          Expanded(
            child: DemoLoader(
              loadingLabel: 'Loading documents',
              builder: (context) =>
                  _DocumentsContent(inFlow: inFlow, hasDraft: hasDraft),
            ),
          ),
        ],
      ),
      bottomNavigationBar: inFlow && hasDraft
          ? BottomActionBar(
              secondary: OutlinedButton(
                onPressed: () => showUploadSheet(context),
                child: const Text('Upload'),
              ),
              primary: FilledButton(
                onPressed: () {
                  if (store.draftDocuments.isEmpty) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text(
                          'Add the AGM minutes before you continue.',
                        ),
                      ),
                    );
                    return;
                  }
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => const ReviewSubmitScreen(),
                    ),
                  );
                },
                child: const Text('Next: review and submit'),
              ),
            )
          : null,
    );
  }
}

class _DocumentsContent extends StatelessWidget {
  const _DocumentsContent({required this.inFlow, required this.hasDraft});

  final bool inFlow;
  final bool hasDraft;

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final documents = store.documents;

    SocietyDocument? latest(DocumentType type) {
      final matches =
          documents.where((document) => document.documentType == type).toList()
            ..sort((a, b) => b.uploadedAt.compareTo(a.uploadedAt));
      return matches.firstOrNull;
    }

    final registrarRows = [
      (DocumentType.auditReport, 'Overdue · due 30 Sep 2026', true),
      (DocumentType.agmMinutes, 'Requested by HQ · due 14 Oct 2026', false),
      (DocumentType.officeBearerList, null, false),
      (DocumentType.membersList, null, false),
    ];
    final approvedCount = registrarRows.where((row) {
      final document = latest(row.$1);
      return document != null &&
          document.status == DocumentStatus.approved &&
          document.uploadedAt.year == 2026;
    }).length;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (hasDraft) ...[
          NoticeBanner(
            icon: Icons.attach_file,
            title: 'Supporting document for your Council update',
            message: store.draftDocuments.isEmpty
                ? 'Upload the AGM minutes that record the change. Files are attached as Draft until you submit.'
                : '${store.draftDocuments.length} file attached as Draft to your pending update.',
          ),
          const SizedBox(height: 12),
        ],
        SectionCard(
          title: 'Registrar documents · FY 2025/26',
          trailing: Text(
            '$approvedCount of 4 approved',
            style: const TextStyle(color: AppColors.muted),
          ),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
          children: [
            for (final (index, row) in registrarRows.indexed)
              _RegistrarRow(
                number: index + 1,
                type: row.$1,
                document: latest(row.$1)?.uploadedAt.year == 2026
                    ? latest(row.$1)
                    : null,
                dueLabel: row.$2,
                overdue: row.$3,
              ),
          ],
        ),
        const SizedBox(height: 12),
        SectionCard(
          title: 'All documents',
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
          children: [
            if (documents.isEmpty)
              const Padding(
                padding: EdgeInsets.only(bottom: 12),
                child: Text(
                  'No documents yet.',
                  style: TextStyle(color: AppColors.muted),
                ),
              ),
            for (final document in documents.reversed)
              _DocumentRow(document: document),
          ],
        ),
        if (!inFlow) ...[
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: () => showUploadSheet(context),
            icon: const Icon(Icons.upload_file),
            label: const Text('Upload document'),
          ),
        ],
      ],
    );
  }
}

class _RegistrarRow extends StatelessWidget {
  const _RegistrarRow({
    required this.number,
    required this.type,
    this.document,
    this.dueLabel,
    required this.overdue,
  });

  final int number;
  final DocumentType type;
  final SocietyDocument? document;
  final String? dueLabel;
  final bool overdue;

  @override
  Widget build(BuildContext context) {
    final doc = document;
    final subtitle = doc == null
        ? (dueLabel ?? 'Not uploaded')
        : '${doc.status.style.label} · ${formatDate(doc.uploadedAt)}${doc.restrictedToReviewers ? ' · DM & HQ only' : ''}';
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: CircleAvatar(
        radius: 14,
        backgroundColor: doc == null
            ? (overdue ? AppColors.dangerSoft : AppColors.warningSoft)
            : AppColors.mint,
        child: Text(
          '$number',
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: AppColors.forest,
          ),
        ),
      ),
      title: Text(
        type.label,
        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
      ),
      subtitle: Text(
        subtitle,
        style: TextStyle(
          fontSize: 12,
          color: doc == null && overdue ? AppColors.danger : AppColors.muted,
        ),
      ),
      trailing: doc == null
          ? OutlinedButton(
              onPressed: () => showUploadSheet(context, initialType: type),
              style: OutlinedButton.styleFrom(minimumSize: const Size(48, 36)),
              child: Text('Upload', semanticsLabel: 'Upload ${type.label}'),
            )
          : doc.restrictedToReviewers
          ? const Icon(
              Icons.lock_outline,
              color: AppColors.muted,
              semanticLabel:
                  'Only the District Manager and HQ can open this file',
            )
          : StatusChip.document(doc.status, compact: true),
    );
  }
}

class _DocumentRow extends StatelessWidget {
  const _DocumentRow({required this.document});

  final SocietyDocument document;

  @override
  Widget build(BuildContext context) {
    final isDraft = document.status == DocumentStatus.draft;
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(
        document.contentType == 'application/pdf'
            ? Icons.picture_as_pdf_outlined
            : Icons.image_outlined,
        color: AppColors.leaf,
      ),
      title: Text(
        document.fileName,
        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
      ),
      subtitle: Text(
        '${document.documentType.label} · ${formatDate(document.uploadedAt)} · ${formatFileSize(document.sizeBytes)}'
        '${document.submissionReference == null ? '' : ' · ${document.submissionReference}'}',
        style: const TextStyle(fontSize: 12),
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          StatusChip.document(document.status, compact: true),
          if (isDraft)
            IconButton(
              tooltip: 'Remove ${document.fileName}',
              icon: const Icon(Icons.close, size: 20),
              onPressed: () =>
                  DemoScope.read(context).removeDocument(document.id),
            ),
        ],
      ),
    );
  }
}

/// Upload sheet: choose a type and a file, then upload with progress and cancel.
/// The demo offers fictional files instead of opening the phone's file picker.
Future<void> showUploadSheet(
  BuildContext context, {
  DocumentType? initialType,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) =>
        _UploadSheet(initialType: initialType ?? DocumentType.agmMinutes),
  );
}

class _UploadSheet extends StatefulWidget {
  const _UploadSheet({required this.initialType});

  final DocumentType initialType;

  @override
  State<_UploadSheet> createState() => _UploadSheetState();
}

class _UploadSheetState extends State<_UploadSheet> {
  late DocumentType? _type = widget.initialType;
  DemoFile? _file;
  String? _typeError;
  String? _fileError;
  double? _progress;
  Timer? _timer;
  bool _offlineError = false;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _start() {
    final store = DemoScope.read(context);
    setState(() {
      _typeError = _type == null ? 'Choose the document type first.' : null;
      _fileError = _file == null
          ? 'Choose a file to upload.'
          : validateUpload(
              contentType: _file!.contentType,
              sizeBytes: _file!.sizeBytes,
            );
    });
    if (_typeError != null || _fileError != null) return;
    _offlineError = false;
    if (store.offline) {
      _offlineError = true;
      setState(
        () => _fileError = 'You are offline. The file could not be uploaded. Try again when you are connected.',
      );
      return;
    }
    if (store.loadDelay == Duration.zero) {
      _finish();
      return;
    }
    setState(() => _progress = 0);
    final tick = Duration(
      milliseconds: (store.loadDelay.inMilliseconds / 10).ceil().clamp(30, 200),
    );
    _timer = Timer.periodic(tick, (timer) {
      setState(() => _progress = (_progress! + 0.1).clamp(0, 1));
      if (_progress! >= 1) {
        timer.cancel();
        _finish();
      }
    });
  }

  void _cancel() {
    _timer?.cancel();
    setState(() => _progress = null);
  }

  void _finish() {
    final store = DemoScope.read(context);
    final document = store.addDraftDocument(
      type: _type!,
      fileName: _file!.name,
      contentType: _file!.contentType,
      sizeBytes: _file!.sizeBytes,
    );
    final messenger = ScaffoldMessenger.of(context);
    Navigator.of(context).pop();
    messenger.showSnackBar(
      SnackBar(content: Text('${document.fileName} added as a Draft.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final uploading = _progress != null;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          0,
          20,
          16 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Upload supporting document',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 4),
              const Text(
                'PDF, JPG or PNG, up to 10 MB.',
                style: TextStyle(color: AppColors.muted),
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<DocumentType>(
                isExpanded: true,
                initialValue: _type,
                decoration: InputDecoration(
                  labelText: 'Document type *',
                  errorText: _typeError,
                ),
                items: [
                  for (final type in DocumentType.values)
                    DropdownMenuItem(value: type, child: Text(type.label)),
                ],
                onChanged: uploading
                    ? null
                    : (value) => setState(() => _type = value),
              ),
              const SizedBox(height: 16),
              const Text(
                'Choose a file (demonstration files)',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 4),
              RadioGroup<DemoFile>(
                groupValue: _file,
                onChanged: (value) {
                  if (uploading) return;
                  setState(() {
                    _file = value;
                    _fileError = null;
                  });
                },
                child: Column(
                  children: [
                    for (final file in demoFiles)
                      RadioListTile<DemoFile>(
                        value: file,
                        contentPadding: EdgeInsets.zero,
                        title: Text(
                          file.name,
                          style: const TextStyle(fontSize: 14),
                        ),
                        subtitle: Text(
                          '${formatFileSize(file.sizeBytes)} · ${file.description}',
                          style: const TextStyle(fontSize: 12),
                        ),
                      ),
                  ],
                ),
              ),
              if (_fileError != null) ...[
                const SizedBox(height: 4),
                NoticeBanner(
                  icon: Icons.error_outline,
                  tone: NoticeTone.error,
                  title: "Couldn't upload",
                  message: '$_fileError Your other answers are safe.',
                ),
              ],
              if (uploading) ...[
                const SizedBox(height: 12),
                Text('Uploading ${_file!.name}…'),
                const SizedBox(height: 6),
                LinearProgressIndicator(
                  value: _progress,
                  minHeight: 6,
                  color: AppColors.leaf,
                  backgroundColor: AppColors.mint,
                ),
              ],
              const SizedBox(height: 16),
              if (uploading)
                OutlinedButton(
                  onPressed: _cancel,
                  child: const Text('Cancel upload'),
                )
              else
                FilledButton(
                  onPressed: _start,
                  child: Text(_offlineError ? 'Try again' : 'Upload'),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
