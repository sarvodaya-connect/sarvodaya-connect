import 'package:file_picker/file_picker.dart';

import 'society_record_models.dart';

/// Chooses the audit report file (M13a). Tests and demo mode use a fake.
abstract interface class DocumentPicker {
  /// Null when the user cancels.
  Future<PickedDocument?> pick();
}

const _contentTypes = {
  'pdf': 'application/pdf',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
};

/// The phone's own file picker, limited to PDF, JPG and PNG.
class DeviceDocumentPicker implements DocumentPicker {
  const DeviceDocumentPicker();

  @override
  Future<PickedDocument?> pick() async {
    final file = await FilePicker.pickFile(
      type: FileType.custom,
      allowedExtensions: _contentTypes.keys.toList(),
    );
    if (file == null) return null;
    final extension = (file.extension ?? '')
        .replaceFirst('.', '')
        .toLowerCase();
    return PickedDocument(
      name: file.name,
      bytes: await file.readAsBytes(),
      contentType: _contentTypes[extension] ?? 'application/octet-stream',
    );
  }
}

/// Demo mode: a fictional PDF, so the upload can be shown without real files.
class DemoDocumentPicker implements DocumentPicker {
  const DemoDocumentPicker({
    this.name = 'Audit_Report_FY.pdf',
    this.sizeBytes = 1800000,
  });

  final String name;
  final int sizeBytes;

  @override
  Future<PickedDocument?> pick() async => PickedDocument(
    name: name,
    bytes: List<int>.filled(sizeBytes, 0x20),
    contentType: 'application/pdf',
  );
}
