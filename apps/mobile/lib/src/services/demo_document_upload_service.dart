import 'document_upload_service.dart';

/// Local-only upload service used until document storage is available.
///
/// Nothing leaves the phone: the file is only recorded in the demo library.
/// [shouldFail] lets the demo show a failed upload; it is checked once per
/// attempt, so the next attempt can succeed.
class DemoDocumentUploadService implements DocumentUploadService {
  DemoDocumentUploadService({
    this.isOnline = _always,
    this.shouldFail = _never,
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now;

  final bool Function() isOnline;
  final bool Function() shouldFail;
  final DateTime Function() _clock;
  int _nextId = 1;

  static bool _always() => true;
  static bool _never() => false;

  @override
  Future<DocumentUploadReceipt> upload(DocumentUploadRequest request) async {
    if (!isOnline()) {
      throw const DocumentUploadException(
        'You are offline. The file could not be uploaded.',
        offline: true,
      );
    }
    if (shouldFail()) {
      throw const DocumentUploadException(
        'The connection dropped before the upload finished.',
      );
    }
    return DocumentUploadReceipt(
      documentId: 'doc-local-${_nextId++}',
      receivedAt: _clock(),
    );
  }
}
