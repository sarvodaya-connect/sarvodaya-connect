import 'dart:async';

import 'package:flutter/material.dart';

import '../app.dart';
import '../format.dart';
import '../models/notification.dart';
import '../models/submission.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../services/registry_api_client.dart';
import '../widgets/state_views.dart';
import 'audit_screen.dart';
import 'changes_requested_screen.dart';
import 'submission_detail_screen.dart';

/// M16 · Notifications: incident alerts, grade updates, reminders and account events.
/// Unread notifications are tinted, bold and marked with a dot and the word
/// "Unread" for screen readers. Tapping one marks it read and opens its item.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key, this.api});
  final RegistryApiClient? api;

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  late final RegistryApiClient _api;
  late Future<List<AppNotification>> _future;
  @override
  void initState() {
    super.initState();
    _api =
        widget.api ??
        DemoScope.read(context).registryApiClient ??
        RegistryApiClient();
    _future = _load();
  }

  Future<List<AppNotification>> _load() async {
    final store = DemoScope.read(context);
    final items = await _api.listNotifications(store.activeRole);
    store.replaceNotificationsFromApi(items);
    return items;
  }
  Future<void> _markAll() async {
    final store = DemoScope.read(context);
    try {
      await _api.markAllRead(store.activeRole);
      store.markAllNotificationsRead();
      if (mounted) setState(() { _future = _load(); });
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not mark notifications read: $error')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<AppNotification>>(
      future: _future,
      builder: (context, snapshot) {
        final notifications = snapshot.data ?? const <AppNotification>[];
        final unread = notifications.where((item) => !item.read).length;
        return Scaffold(
          appBar: AppBar(
            title: const Text('Notifications'),
            actions: [
              TextButton(
                onPressed: unread == 0 ? null : _markAll,
                child: const Text('Mark all read'),
              ),
            ],
          ),
          body: Column(
            children: [
              Expanded(
                child: snapshot.connectionState == ConnectionState.waiting
                    ? const Center(child: CircularProgressIndicator())
                    : snapshot.hasError
                    ? StateMessage(
                        icon: Icons.cloud_off,
                        title: 'Notifications unavailable',
                        message: 'Check your connection and retry.',
                        tone: StateTone.error,
                        primaryLabel: 'Retry',
                        onPrimary: () => setState(() { _future = _load(); }),
                        isAlert: true,
                      )
                    : _NotificationsContent(
                        notifications: notifications,
                        onTap: _openNotification,
                        now: DemoScope.read(context).now,
                      ),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _openNotification(AppNotification notification) async {
    final store = DemoScope.read(context);
    try {
      await _api.markRead(store.activeRole, notification.id);
      if (!mounted) return;
      openNotification(context, notification);
      store.markNotificationRead(notification.id);
      setState(() { _future = _load(); });
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not mark notification read: $error')),
        );
      }
    }
  }
}

class _NotificationsContent extends StatelessWidget {
  const _NotificationsContent({
    required this.notifications,
    required this.onTap,
    required this.now,
  });
  final List<AppNotification> notifications;
  final ValueChanged<AppNotification> onTap;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    if (notifications.isEmpty) {
      return StateMessage(
        icon: Icons.notifications_none,
        title: 'No notifications',
        message: 'Incident alerts, grade requests and decisions, reminders and account updates will appear here.',
        secondaryLabel: 'Back to Home',
        onSecondary: () => HomeShell.openTab(context, HomeShell.homeTab),
      );
    }
    bool isToday(DateTime date) =>
        date.year == now.year && date.month == now.month && date.day == now.day;
    final today = notifications.where((n) => isToday(n.receivedAt)).toList();
    final earlier = notifications.where((n) => !isToday(n.receivedAt)).toList();
    final unread = notifications.where((item) => !item.read).length;

    return ListView(
      padding: EdgeInsets.zero,
      children: [
        // Spoken count only; the catalogue shows no visible counter.
        Semantics(
          container: true,
          liveRegion: true,
          label: unread == 0 ? 'All caught up' : '$unread unread',
          child: const SizedBox(width: double.infinity, height: 1),
        ),
        if (today.isNotEmpty) ...[
          const _GroupHeader('Today'),
          for (final notification in today)
            _NotificationTile(
              notification: notification,
              showTime: true,
              onTap: () => onTap(notification),
            ),
        ],
        if (earlier.isNotEmpty) ...[
          const _GroupHeader('Earlier'),
          for (final notification in earlier)
            _NotificationTile(
              notification: notification,
              showTime: false,
              onTap: () => onTap(notification),
            ),
        ],
      ],
    );
  }
}

class _GroupHeader extends StatelessWidget {
  const _GroupHeader(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.line)),
      ),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
      child: Semantics(
        header: true,
        child: Text(
          label.toUpperCase(),
          semanticsLabel: label,
          style: const TextStyle(
            color: AppColors.muted,
            fontSize: 10.5,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.6,
          ),
        ),
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({
    required this.notification,
    required this.showTime,
    required this.onTap,
  });

  final AppNotification notification;
  final bool showTime;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final (icon, foreground, background) = _kindStyle(notification.kind);
    final unread = !notification.read;
    final when = showTime
        ? '${notification.receivedAt.hour.toString().padLeft(2, '0')}:${notification.receivedAt.minute.toString().padLeft(2, '0')}'
        : formatDate(notification.receivedAt);
    return Semantics(
      button: true,
      label: [
        if (unread) 'Unread',
        notification.title,
        notification.message,
        when,
      ].join('. '),
      hint: notification.opensItem ? 'Opens the related item' : null,
      excludeSemantics: true,
      onTap: onTap,
      child: Material(
        color: unread ? AppColors.mintSoft : AppColors.surface,
        child: InkWell(
          onTap: onTap,
          child: Container(
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: AppColors.line)),
            ),
            padding: const EdgeInsets.fromLTRB(16, 11, 16, 11),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    color: background,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(icon, size: 16, color: foreground),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        notification.title,
                        style: TextStyle(
                          fontSize: 13,
                          height: 1.3,
                          fontWeight: unread
                              ? FontWeight.w700
                              : FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        when,
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                if (unread)
                  Container(
                    key: ValueKey('unread-${notification.id}'),
                    margin: const EdgeInsets.only(top: 4),
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: const Color(0xFFE0B03A),
                      shape: BoxShape.circle,
                      border: Border.all(color: const Color(0xFF8C6D12)),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static (IconData, Color, Color) _kindStyle(NotificationKind kind) =>
      switch (kind) {
        NotificationKind.incident => (
          Icons.warning_amber_rounded,
          AppColors.danger,
          AppColors.dangerSoft,
        ),
        NotificationKind.returned => (
          Icons.undo,
          const Color(0xFFA2470F),
          const Color(0xFFFFE9DA),
        ),
        NotificationKind.request => (
          Icons.move_to_inbox_outlined,
          const Color(0xFF2D5C88),
          const Color(0xFFE4EEF8),
        ),
        NotificationKind.reminder => (
          Icons.alarm,
          AppColors.danger,
          AppColors.dangerSoft,
        ),
        NotificationKind.review => (
          Icons.hourglass_top,
          AppColors.warning,
          AppColors.warningSoft,
        ),
        NotificationKind.approved => (
          Icons.check_circle_outline,
          AppColors.leaf,
          AppColors.mint,
        ),
        NotificationKind.notice => (
          Icons.campaign_outlined,
          AppColors.inkSoft,
          const Color(0xFFEEF0EC),
        ),
      };
}

/// Marks the notification read and opens the local item it refers to.
void openNotification(BuildContext context, AppNotification notification) {
  final store = DemoScope.read(context);
  final navigator = Navigator.of(context);
  switch (notification.target) {
    case NotificationTarget.none:
      return;
    case NotificationTarget.documents:
      HomeShell.openTab(context, HomeShell.documentsTab);
    case NotificationTarget.societyProfile:
      HomeShell.openTab(context, HomeShell.societyTab);
    case NotificationTarget.audit:
      navigator.push(
        MaterialPageRoute<void>(builder: (_) => const AuditScreen()),
      );
    case NotificationTarget.submission:
      final id = notification.targetId;
      final submission = id == null ? null : store.submissionById(id);
      if (submission == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('This item is no longer available.')),
        );
        return;
      }
      navigator.push(
        MaterialPageRoute<void>(
          builder: (_) => submission.status == SubmissionStatus.changesRequested
              ? ChangesRequestedScreen(submissionId: submission.id)
              : SubmissionDetailScreen(submissionId: submission.id),
        ),
      );
  }
}
