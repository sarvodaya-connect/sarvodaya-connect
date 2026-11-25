import 'package:flutter/material.dart';

import '../l10n/l10n.dart';
import '../l10n/l10n_format.dart';
import '../l10n/record_l10n.dart';
import '../format.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/state_views.dart';
import 'record_widgets.dart';
import 'society_record_api.dart';
import 'society_record_models.dart';

/// Matches the API upload rules: PDF, JPG or PNG, up to 10 MB.
const maxDocumentBytes = 10000000;
const _allowedTypes = {'application/pdf', 'image/jpeg', 'image/png'};

/// Plain-language problem with a chosen file, or null when it can be sent.
String? validateDocument(PickedDocument file, [AppLocalizations? l]) {
  if (!_allowedTypes.contains(file.contentType)) {
    return l?.rdInvalidFile ?? 'Choose a PDF or a photo (JPG or PNG).';
  }
  if (file.sizeBytes == 0) {
    return l?.rdEmptyFile ?? 'This file is empty. Choose another file.';
  }
  if (file.sizeBytes > maxDocumentBytes) {
    return l?.rdLargeFile(l.recordFileSize(file.sizeBytes)) ??
        'This file is ${formatFileSize(file.sizeBytes)}. Choose a file up to 10 MB.';
  }
  return null;
}

/// The document types the signed-in person may upload, in V5 order: the
/// audit report only for the Society Officer or assigned SPC.
List<String> uploadableDocumentTypes(RecordPermissions permissions) => [
  if (permissions.canUploadAuditReport) 'AUDIT_REPORT',
  if (permissions.canUploadDocuments) ...[
    'AGM_MINUTES',
    'OFFICE_BEARER_LIST',
    'MEMBERS_LIST',
    'REGISTRATION',
    'ACTIVITY_EVIDENCE',
    'OTHER',
  ],
];

/// M13a: choose the document type, the financial year (for the four
/// Registrar documents) and the file. The uploader and date are recorded;
/// the file goes to private storage with its checksum.
class DocumentUploadScreen extends StatefulWidget {
  const DocumentUploadScreen({
    super.key,
    required this.record,
    this.documentType,
    this.financialYear,
  });

  final SocietyRecord record;
  final String? documentType;
  final int? financialYear;

  @override
  State<DocumentUploadScreen> createState() => _DocumentUploadScreenState();
}

const _dense = InputDecoration(
  isDense: true,
  contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
);

class _DocumentUploadScreenState extends State<DocumentUploadScreen> {
  late final _types = uploadableDocumentTypes(widget.record.permissions);
  late String _type = _types.contains(widget.documentType)
      ? widget.documentType!
      : _types.first;
  late int _year =
      widget.financialYear ??
      widget.record.annualSummary.financialYear.startYear;
  final _title = TextEditingController();

  bool get _yearly => registrarDocumentTypes.contains(_type);

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  PickedDocument? _file;
  String? _uploadError;
  double? _progress;
  bool _submitted = false;

  List<FinancialYear> get _years {
    final latest = widget.record.annualSummary.financialYear.startYear;
    return [for (var i = 0; i < 5; i++) FinancialYear.starting(latest - i)];
  }

  Future<void> _choose() async {
    final store = DemoScope.read(context);
    final file = await store.documentPicker.pick();
    if (!mounted || file == null) return;
    setState(() {
      _file = file;
      _uploadError = null;
    });
  }

  Future<void> _upload() async {
    final l = context.l10n;
    setState(() {
      _submitted = true;
      _uploadError = null;
    });
    final file = _file;
    if (file == null || validateDocument(file, l) != null) return;
    if (!_yearly && _title.text.trim().isEmpty) return;
    setState(() => _progress = 0);
    try {
      await DemoScope.read(context).societyRecords.uploadDocument(
        widget.record.id,
        documentType: _type,
        financialYear: _yearly ? _year : null,
        title: _yearly ? null : _title.text.trim(),
        file: file,
        onProgress: (progress) {
          if (mounted) setState(() => _progress = progress);
        },
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l.rdUploadSuccess(l.documentType(_type)))),
      );
      Navigator.of(context).pop(true);
    } on SocietyRecordException catch (error) {
      if (mounted) {
        setState(() {
          _progress = null;
          _uploadError = error.offline
              ? l.rdOffline
              : l.rdSelectedFile(error.message);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final store = DemoScope.of(context);
    final uploading = _progress != null;
    final file = _file;
    final fileError = file == null ? null : validateDocument(file, l);
    return Scaffold(
      appBar: recordFormAppBar(
        context,
        title: _type == 'AUDIT_REPORT' ? l.rdUploadAudit : l.rdUploadDocument,
        subtitle: l.rdDocumentsCaption(widget.record.nameEn),
        onClose: uploading ? () {} : null,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
        children: [
          FieldLabel(l.rdDocumentType, required: true),
          DropdownButtonFormField<String>(
            initialValue: _type,
            isExpanded: true,
            style: recordInputStyle,
            decoration: _dense,
            items: [
              for (final type in _types)
                DropdownMenuItem(
                  value: type,
                  child: Text(l.documentType(type), style: recordInputStyle),
                ),
            ],
            onChanged: uploading
                ? null
                : (type) => setState(() => _type = type ?? _type),
          ),
          const SizedBox(height: 12),
          if (!_yearly) ...[
            FieldLabel(l.rdName, required: true),
            TextField(
              controller: _title,
              enabled: !uploading,
              maxLength: 150,
              style: recordInputStyle,
              decoration: _dense.copyWith(
                hintText: l.rdTitleHint,
                counterText: '',
                errorText: _submitted && _title.text.trim().isEmpty
                    ? l.rdEnterName
                    : null,
              ),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 12),
          ],
          if (_yearly) FieldLabel(l.rdFinancialYear, required: true),
          if (_yearly)
            DropdownButtonFormField<int>(
              initialValue: _year,
              isExpanded: true,
              style: recordInputStyle,
              decoration: _dense,
              items: [
                for (final year in _years)
                  DropdownMenuItem(
                    value: year.startYear,
                    child: Text(year.label),
                  ),
              ],
              onChanged: uploading
                  ? null
                  : (year) => setState(() => _year = year ?? _year),
            ),
          const SizedBox(height: 12),
          FieldLabel(l.rdFile, required: true),
          Semantics(
            button: true,
            label: file == null ? l.rdChooseFile : l.rdChangeFile,
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: uploading ? null : _choose,
              child: RecordCard(
                padding: const EdgeInsets.all(12),
                borderColor: (_submitted && file == null) || fileError != null
                    ? AppColors.danger
                    : AppColors.line,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.insert_drive_file_outlined,
                        size: 20,
                        color: AppColors.inkSoft,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              file?.name ?? l.rdChooseFile,
                              style: RecordStyle.value,
                            ),
                            if (file != null)
                              Text(
                                '${file.contentType == 'application/pdf' ? 'PDF' : l.rdPhoto} · ${l.recordFileSize(file.sizeBytes)}',
                                style: RecordStyle.caption,
                              ),
                            if (uploading) ...[
                              const SizedBox(height: 7),
                              // A real loading state: a small spinner and text, no bar.
                              Row(
                                children: [
                                  const SizedBox.square(
                                    dimension: 14,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: AppColors.forest,
                                    ),
                                  ),
                                  const SizedBox(width: 7),
                                  Text(
                                    l.rdUploading,
                                    style: RecordStyle.caption,
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        uploading
                            ? '${l.number((_progress! * 100).round())}%'
                            : file == null
                            ? l.rdChoose
                            : l.rdChange,
                        style: uploading
                            ? RecordStyle.caption
                            : RecordStyle.link,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 5),
          Text(
            fileError ??
                (_submitted && file == null
                    ? l.rdFileRequired
                    : l.rdUploadHint),
            style: fileError != null || (_submitted && file == null)
                ? RecordStyle.caption.copyWith(
                    color: AppColors.danger,
                    fontWeight: FontWeight.w600,
                  )
                : RecordStyle.caption,
          ),
          const SizedBox(height: 12),
          RecordCard(
            padding: const EdgeInsets.all(12),
            children: [
              KeyValueGrid([
                KeyValue(l.rdUploader, store.user?.displayName ?? '—'),
                KeyValue(l.rdUploadDate, l.date(store.now)),
              ]),
            ],
          ),
          const SizedBox(height: 10),
          RecordNote(icon: Icons.info_outline, message: l.rdHqAccess),
          if (_uploadError != null) ...[
            const SizedBox(height: 10),
            RecordNote(
              icon: Icons.error_outline,
              tone: NoteTone.error,
              title: l.rdNotUploaded,
              message: _uploadError!,
            ),
          ],
        ],
      ),
      bottomNavigationBar: BottomActionBar(
        secondary: OutlinedButton(
          onPressed: uploading ? null : () => Navigator.of(context).maybePop(),
          child: Text(l.rdCancel),
        ),
        primary: FilledButton(
          onPressed: uploading ? null : _upload,
          child: Text(uploading ? l.rdUploading : l.rdUpload),
        ),
      ),
    );
  }
}
