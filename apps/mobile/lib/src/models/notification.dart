// Notifications for the Society Officer (Screen Catalogue v3, M16).
// UI model for the provisional demo. Replace it with the shared API contract
// when notifications are added to packages/api-contracts.

enum NotificationKind { returned, request, reminder, review, approved, notice }

/// The local item a notification opens when tapped.
enum NotificationTarget { none, documents, audit, submission, societyProfile }

class AppNotification {
  const AppNotification({
    required this.id,
    required this.kind,
    required this.title,
    required this.message,
    required this.receivedAt,
    this.read = false,
    this.target = NotificationTarget.none,
    this.targetId,
  });

  final String id;
  final NotificationKind kind;
  final String title;
  final String message;
  final DateTime receivedAt;
  final bool read;
  final NotificationTarget target;

  /// Identifies the item to open, for example a submission id.
  final String? targetId;

  bool get opensItem => target != NotificationTarget.none;

  AppNotification markedRead() => AppNotification(
    id: id,
    kind: kind,
    title: title,
    message: message,
    receivedAt: receivedAt,
    read: true,
    target: target,
    targetId: targetId,
  );
}
