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
import '../services/document_upload_service.dart';
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

/// M13 · Documents: the four Registrar documents, then the society's document
/// library. Also used inside the Council update flow ([inFlow]).
class DocumentsScreen extends StatelessWidget {
  const DocumentsScreen({super.key, this.inFlow = false, this.initialFilter});

  final bool inFlow;

  /// Opens the library showing only this document type.
  final DocumentType? initialFilter;

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final hasDraft = store.uploadsAttachToCouncilDraft;
    return Scaffold(
      appBar: AppBar(title: Text(inFlow ? 'Supporting document' : 'Documents')),
      body: Column(
        children: [
          if (store.offline) const OfflineBanner(),
          Expanded(
            child: DemoLoader(
              loadingLabel: 'Loading documents',
              builder: (context) => _DocumentsContent(
                inFlow: inFlow,
                hasDraft: hasDraft,
                initialFilter: initialFilter,
              ),
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
          : inFlow
          ? null
          : BottomActionBar(
              primary: FilledButton(
                onPressed: () => showUploadSheet(
                  context,
                  initialType: initialFilter ?? DocumentType.agmMinutes,
                ),
                child: const Text('Upload document'),
              ),
            ),
    );
  }
}

class _DocumentsContent extends StatefulWidget {
  const _DocumentsContent({
    required this.inFlow,
    required this.hasDraft,
    this.initialFilter,
  });

  final bool inFlow;
  final bool hasDraft;
  final DocumentType? initialFilter;

  @override
  State<_DocumentsContent> createState() => _DocumentsContentState();
}

class _DocumentsContentState extends State<_DocumentsContent> {
  /// Null shows every document type.
  late DocumentType? _filter = widget.initialFilter;

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final documents = store.libraryDocuments;
    final failedUploads = store.failedUploads;
    final visible = _filter == null
        ? documents
        : documents.where((d) => d.documentType == _filter).toList();

    SocietyDocument? latest(DocumentType type) => documents
        .where((document) => document.documentType == type)
        .firstOrNull;

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
        if (widget.hasDraft) ...[
          NoticeBanner(
            icon: Icons.attach_file,
            title: 'Supporting document for your Council update',
            message: store.draftDocuments.isEmpty
                ? 'Upload the AGM minutes that record the change. Files are attached as Draft until you submit.'
                : '${store.draftDocuments.length} file attached as Draft to your pending update.',
          ),
          const SizedBox(height: 12),
        ],
        if (!widget.inFlow) ...[
          _TypeFilter(
            selected: _filter,
            onSelected: (type) => setState(() => _filter = type),
          ),
          const SizedBox(height: 12),
        ],
        if (failedUploads.isNotEmpty) ...[
          SectionCard(
            title: 'Not uploaded',
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
            children: [
              for (final upload in failedUploads)
                _FailedUploadRow(upload: upload),
            ],
          ),
          const SizedBox(height: 12),
        ],
        if (_filter == null) ...[
          SectionCard(
            title: 'Registrar documents · FY 2025/26',
            trailing: Text(
              '$approvedCount of 4\napproved',
              textAlign: TextAlign.end,
              style: const TextStyle(color: AppColors.muted, fontSize: 11),
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
        ],
        Padding(
          padding: const EdgeInsets.fromLTRB(2, 4, 2, 8),
          child: Semantics(
            header: true,
            label:
                '${_filter == null ? 'All documents' : _filter!.label}, ${visible.length} ${visible.length == 1 ? 'document' : 'documents'}',
            excludeSemantics: true,
            child: Text(
              (_filter == null ? 'All documents' : _filter!.label)
                  .toUpperCase(),
              style: const TextStyle(
                color: AppColors.muted,
                fontSize: 10.5,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.6,
              ),
            ),
          ),
        ),
        SectionCard(
          padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
          children: [
            if (visible.isEmpty)
              _EmptyLibrary(
                filter: _filter,
                onShowAll: () => setState(() => _filter = null),
              ),
            for (final (i, document) in visible.indexed) ...[
              if (i > 0) const Divider(height: 1),
              _DocumentRow(document: document),
            ],
          ],
        ),
      ],
    );
  }
}

/// Filter chips by document type (Screen Catalogue v3, M13).
class _TypeFilter extends StatelessWidget {
  const _TypeFilter({required this.selected, required this.onSelected});

  final DocumentType? selected;
  final ValueChanged<DocumentType?> onSelected;

  @override
  Widget build(BuildContext context) {
    final options = <(DocumentType?, String)>[
      (null, 'All'),
      for (final type in DocumentType.values)
        (type, type == DocumentType.other ? 'Other' : type.label),
    ];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final (type, label) in options)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(label),
                selected: selected == type,
                showCheckmark: false,
                labelStyle: TextStyle(
                  color: selected == type ? Colors.white : null,
                ),
                onSelected: (_) => onSelected(type),
              ),
            ),
        ],
      ),
    );
  }
}

class _EmptyLibrary extends StatelessWidget {
  const _EmptyLibrary({required this.filter, required this.onShowAll});

  final DocumentType? filter;
  final VoidCallback onShowAll;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: const BoxDecoration(
              color: AppColors.mint,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.folder_open_outlined,
              color: AppColors.leaf,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            filter == null
                ? 'No documents yet'
                : 'No ${filter!.label.toLowerCase()} yet',
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: 4),
          Text(
            filter == null
                ? 'Files you upload appear here with their status. Only your society and the District Centre can see them.'
                : 'Upload one, or show every document type.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.muted, fontSize: 13),
          ),
          if (filter != null)
            TextButton(onPressed: onShowAll, child: const Text('Show all')),
        ],
      ),
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
    final (subtitle, tone) = switch (doc?.status) {
      null => (
        dueLabel ?? 'Not uploaded',
        overdue ? AppColors.danger : AppColors.warning,
      ),
      DocumentStatus.approved => (
        'Approved · ${doc!.restrictedToReviewers ? 'DM & HQ only' : formatDate(doc.uploadedAt)}',
        AppColors.leaf,
      ),
      DocumentStatus.submitted => (
        'Under Review · sent ${formatDate(doc!.uploadedAt)}',
        AppColors.warning,
      ),
      final status => (
        '${status.style.label} · ${formatDate(doc!.uploadedAt)}',
        AppColors.muted,
      ),
    };
    final (circleFg, circleBg) = switch (doc?.status) {
      null when overdue => (AppColors.danger, AppColors.dangerSoft),
      null ||
      DocumentStatus.submitted => (AppColors.warning, AppColors.warningSoft),
      DocumentStatus.approved => (AppColors.forest, AppColors.mint),
      _ => (AppColors.inkSoft, const Color(0xFFEEF0EC)),
    };
    return ListTile(
      contentPadding: EdgeInsets.zero,
      dense: true,
      leading: CircleAvatar(
        radius: 12,
        backgroundColor: circleBg,
        child: Text(
          '$number',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: circleFg,
          ),
        ),
      ),
      minLeadingWidth: 24,
      title: Text(
        type.label,
        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
      ),
      subtitle: Text(subtitle, style: TextStyle(fontSize: 11, color: tone)),
      trailing: doc == null
          ? OutlinedButton(
              onPressed: () => showUploadSheet(context, initialType: type),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(48, 34),
                foregroundColor: AppColors.forest,
                side: const BorderSide(color: AppColors.leaf),
                padding: const EdgeInsets.symmetric(horizontal: 12),
                textStyle: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              child: Text('Upload', semanticsLabel: 'Upload ${type.label}'),
            )
          : doc.restrictedToReviewers
          ? const Icon(
              Icons.lock_outline,
              size: 18,
              color: AppColors.muted,
              semanticLabel:
                  'Only the District Manager and HQ can open this file',
            )
          : null,
    );
  }
}

/// A library document with its type, status, uploader and upload date.
class _DocumentRow extends StatelessWidget {
  const _DocumentRow({required this.document});

  final SocietyDocument document;

  @override
  Widget build(BuildContext context) {
    final isDraft = document.status == DocumentStatus.draft;
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Container(
        width: 34,
        height: 34,
        decoration: BoxDecoration(
          color: AppColors.mint,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(
          document.contentType == 'application/pdf'
              ? Icons.description_outlined
              : Icons.image_outlined,
          color: AppColors.forest,
          size: 18,
        ),
      ),
      title: Text(
        document.fileName,
        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
      ),
      subtitle: Text(
        [
          document.documentType.label,
          formatDate(document.uploadedAt),
          if (document.restrictedToReviewers)
            'DM & HQ only'
          else
            document.status.style.label,
          ?document.submissionReference,
        ].join(' · '),
        semanticsLabel:
            '${document.documentType.label}, uploaded by ${document.uploadedBy} on ${formatDate(document.uploadedAt)}, status ${document.status.style.label}',
        style: const TextStyle(fontSize: 11, color: AppColors.muted),
      ),
      trailing: isDraft
          ? IconButton(
              tooltip: 'Remove ${document.fileName}',
              icon: const Icon(Icons.close, size: 20),
              onPressed: () =>
                  DemoScope.read(context).removeDocument(document.id),
            )
          : null,
    );
  }
}

/// A file that did not reach the library, with Retry and Remove.
class _FailedUploadRow extends StatelessWidget {
  const _FailedUploadRow({required this.upload});

  final FailedUpload upload;

  Future<void> _retry(BuildContext context) async {
    final store = DemoScope.read(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final document = await store.retryFailedUpload(upload.id);
      messenger.showSnackBar(
        SnackBar(content: Text('${document.fileName} uploaded.')),
      );
    } on DocumentUploadException catch (error) {
      messenger.showSnackBar(
        SnackBar(content: Text('Upload failed again. ${error.message}')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final retrying = DemoScope.of(context).isRetrying(upload.id);
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: const Icon(Icons.error_outline, color: AppColors.danger),
      title: Text(
        upload.fileName,
        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
      ),
      subtitle: Text(
        retrying
            ? 'Uploading again…'
            : 'Upload failed · ${upload.documentType.label}\n${upload.reason}',
        style: TextStyle(
          fontSize: 12,
          height: 1.35,
          color: retrying ? AppColors.muted : AppColors.danger,
        ),
      ),
      isThreeLine: !retrying,
      trailing: retrying
          ? const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextButton(
                  onPressed: () => _retry(context),
                  child: Text(
                    'Retry',
                    semanticsLabel: 'Retry upload of ${upload.fileName}',
                  ),
                ),
                IconButton(
                  tooltip: 'Remove ${upload.fileName}',
                  icon: const Icon(Icons.close, size: 20),
                  onPressed: () =>
                      DemoScope.read(context).removeFailedUpload(upload.id),
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

  /// Set when the upload service could not finish; the chosen type and file
  /// are kept so the officer can retry.
  String? _uploadFailure;

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
    _uploadFailure = null;
    if (store.offline) {
      _offlineError = true;
      setState(
        () => _fileError = 'You are offline. The file could not be uploaded. Try again when you are connected.',
      );
      return;
    }
    if (store.loadDelay == Duration.zero) {
      unawaited(_finish());
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
        unawaited(_finish());
      }
    });
  }

  void _cancel() {
    _timer?.cancel();
    setState(() => _progress = null);
  }

  Future<void> _finish() async {
    final store = DemoScope.read(context);
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    final attachToDraft = store.uploadsAttachToCouncilDraft;
    try {
      final document = await store.uploadDocument(
        type: _type!,
        fileName: _file!.name,
        contentType: _file!.contentType,
        sizeBytes: _file!.sizeBytes,
      );
      if (!mounted) return;
      navigator.pop();
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            attachToDraft
                ? '${document.fileName} added as a Draft.'
                : '${document.fileName} uploaded. The District Centre will review it.',
          ),
        ),
      );
    } on DocumentUploadException catch (error) {
      if (!mounted) return;
      setState(() {
        _progress = null;
        if (error.offline) {
          _offlineError = true;
          _fileError = '${error.message} Try again when you are connected.';
        } else {
          _uploadFailure = error.message;
        }
      });
    }
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
                    _uploadFailure = null;
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
              if (_uploadFailure != null) ...[
                const SizedBox(height: 4),
                NoticeBanner(
                  icon: Icons.cloud_off_outlined,
                  tone: NoticeTone.error,
                  title: 'Upload failed',
                  message:
                      '$_uploadFailure ${_file!.name} was not saved. Your choices are kept, so you can retry now or later from Documents.',
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
                  child: Text(
                    _uploadFailure != null
                        ? 'Retry upload'
                        : _offlineError
                        ? 'Try again'
                        : 'Upload',
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
