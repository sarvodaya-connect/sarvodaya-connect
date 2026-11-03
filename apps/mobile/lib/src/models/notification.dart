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

  /// A notification from the API (`GET /notifications`, V5 M16). Its link
  /// points at a dashboard page, so on the phone it opens nothing.
  factory AppNotification.fromApi(Map<String, dynamic> json) {
    final topic = json['topic'] as String?;
    final category = json['category'] as String?;
    return AppNotification(
      id: json['id'] as String,
      kind: category == 'RETURNED'
          ? NotificationKind.returned
          : switch (topic) {
              'GRADE_REQUEST' => NotificationKind.review,
              'ACTIVITY' => NotificationKind.approved,
              'RECORDS' => NotificationKind.reminder,
              'INFORMATION_REQUEST' => NotificationKind.request,
              _ => NotificationKind.notice,
            },
      title: json['title'] as String,
      message: (json['body'] as String?) ?? '',
      receivedAt: DateTime.parse(json['createdAt'] as String),
      read: json['read'] == true,
    );
  }

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
