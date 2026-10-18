import '../models/document.dart';

/// A file the officer has chosen, ready to be sent to document storage.
class DocumentUploadRequest {
  const DocumentUploadRequest({
    required this.societyId,
    required this.documentType,
    required this.fileName,
    required this.contentType,
    required this.sizeBytes,
  });

  final String societyId;
  final DocumentType documentType;
  final String fileName;
  final String contentType;
  final int sizeBytes;
}

/// Confirmation that a file was stored.
class DocumentUploadReceipt {
  const DocumentUploadReceipt({
    required this.documentId,
    required this.receivedAt,
  });

  final String documentId;
  final DateTime receivedAt;
}

/// The upload did not complete. [message] is safe to show to the officer.
class DocumentUploadException implements Exception {
  const DocumentUploadException(this.message, {this.offline = false});

  final String message;
  final bool offline;
}

/// Boundary for sending documents to storage. The demo uses a local
/// implementation; the API integration replaces it without changing screens.
abstract interface class DocumentUploadService {
  Future<DocumentUploadReceipt> upload(DocumentUploadRequest request);
}
