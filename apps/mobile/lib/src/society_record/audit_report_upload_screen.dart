import 'package:flutter/material.dart';

import '../format.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/state_views.dart';
import 'record_widgets.dart';
import 'society_record_api.dart';
import 'society_record_models.dart';

/// Matches the API upload rules: PDF, JPG or PNG, up to 10 MB.
const maxAuditReportBytes = 10000000;
const _allowedTypes = {'application/pdf', 'image/jpeg', 'image/png'};

/// Plain-language problem with a chosen file, or null when it can be sent.
String? validateAuditReport(PickedDocument file) {
  if (!_allowedTypes.contains(file.contentType)) {
    return 'Choose a PDF or a photo (JPG or PNG).';
  }
  if (file.sizeBytes == 0) return 'This file is empty. Choose another file.';
  if (file.sizeBytes > maxAuditReportBytes) {
    return 'This file is ${formatFileSize(file.sizeBytes)}. Choose a file up to 10 MB.';
  }
  return null;
}

/// M13a: choose the financial year and the file. The uploader and upload
/// date are recorded; the file is kept privately with the society record.
class AuditReportUploadScreen extends StatefulWidget {
  const AuditReportUploadScreen({
    super.key,
    required this.record,
    this.financialYear,
  });

  final SocietyRecord record;
  final int? financialYear;

  @override
  State<AuditReportUploadScreen> createState() =>
      _AuditReportUploadScreenState();
}

const _dense = InputDecoration(
  isDense: true,
  contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
);

class _AuditReportUploadScreenState extends State<AuditReportUploadScreen> {
  late int _year =
      widget.financialYear ??
      widget.record.annualSummary.financialYear.startYear;
  PickedDocument? _file;
  String? _fileError;
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
      _fileError = validateAuditReport(file);
      _uploadError = null;
    });
  }

  Future<void> _upload() async {
    setState(() {
      _submitted = true;
      _uploadError = null;
    });
    final file = _file;
    if (file == null || _fileError != null) return;
    setState(() => _progress = 0);
    try {
      await DemoScope.read(context).societyRecords.uploadAuditReport(
        widget.record.id,
        financialYear: _year,
        file: file,
        onProgress: (progress) {
          if (mounted) setState(() => _progress = progress);
        },
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Audit report uploaded. HQ can open it from the society record.',
          ),
        ),
      );
      Navigator.of(context).pop(true);
    } on SocietyRecordException catch (error) {
      if (mounted) {
        setState(() {
          _progress = null;
          _uploadError = error.offline
              ? 'You are offline. The file was not uploaded. Try again when you are connected.'
              : '${error.message} The file you chose is still selected.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final uploading = _progress != null;
    final file = _file;
    return Scaffold(
      appBar: recordFormAppBar(
        context,
        title: 'Upload audit report',
        subtitle: '${widget.record.nameEn} · Documents',
        onClose: uploading ? () {} : null,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
        children: [
          const FieldLabel('Document type', required: true),
          DropdownButtonFormField<String>(
            initialValue: 'AUDIT_REPORT',
            isExpanded: true,
            style: recordInputStyle,
            decoration: _dense,
            // Only audit reports are uploaded here (M13a).
            items: const [
              DropdownMenuItem(
                value: 'AUDIT_REPORT',
                child: Text('Audit report', style: recordInputStyle),
              ),
            ],
            onChanged: (_) {},
          ),
          const SizedBox(height: 12),
          const FieldLabel('Financial year', required: true),
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
          const FieldLabel('File', required: true),
          Semantics(
            button: true,
            label: file == null ? 'Choose a PDF or photo' : 'Change the file',
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: uploading ? null : _choose,
              child: RecordCard(
                padding: const EdgeInsets.all(12),
                borderColor: (_submitted && file == null) || _fileError != null
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
                              file?.name ?? 'Choose a PDF or photo',
                              style: RecordStyle.value,
                            ),
                            if (file != null)
                              Text(
                                '${file.contentType == 'application/pdf' ? 'PDF' : 'Photo'} · ${formatFileSize(file.sizeBytes)}',
                                style: RecordStyle.caption,
                              ),
                            if (uploading) ...[
                              const SizedBox(height: 7),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(3),
                                child: LinearProgressIndicator(
                                  value: _progress,
                                  minHeight: 5,
                                  color: AppColors.forest,
                                  backgroundColor: AppColors.mint,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        uploading
                            ? '${(_progress! * 100).round()}%'
                            : file == null
                            ? 'Choose'
                            : 'Change',
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
            _fileError ??
                (_submitted && file == null
                    ? 'Choose the audit report file.'
                    : 'PDF or photo, up to 10 MB. You need a connection to upload.'),
            style: _fileError != null || (_submitted && file == null)
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
                KeyValue('Uploaded by', store.user?.displayName ?? '—'),
                KeyValue('Upload date', formatDate(store.now)),
              ]),
            ],
          ),
          const SizedBox(height: 10),
          const RecordNote(
            icon: Icons.info_outline,
            message:
                'HQ can open and download this report from the society record.',
          ),
          if (_uploadError != null) ...[
            const SizedBox(height: 10),
            RecordNote(
              icon: Icons.error_outline,
              tone: NoteTone.error,
              title: 'Not uploaded',
              message: _uploadError!,
            ),
          ],
        ],
      ),
      bottomNavigationBar: BottomActionBar(
        secondary: OutlinedButton(
          onPressed: uploading ? null : () => Navigator.of(context).maybePop(),
          child: const Text('Cancel'),
        ),
        primary: FilledButton(
          onPressed: uploading ? null : _upload,
          child: Text(uploading ? 'Uploading…' : 'Upload'),
        ),
      ),
    );
  }
}
