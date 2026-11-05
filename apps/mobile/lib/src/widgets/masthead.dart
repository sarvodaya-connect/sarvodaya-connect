import 'package:flutter/material.dart';

import '../screens/notifications_screen.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import 'brand.dart';

/// The small logo at the top of a home screen's masthead (M05, M05h).
class MastheadLogo extends StatelessWidget {
  const MastheadLogo({super.key});

  @override
  Widget build(BuildContext context) => const ColorFiltered(
    // Lifts the logo's off-white JPEG background to the header's white so no
    // box shows around it.
    colorFilter: ColorFilter.matrix([
      1.06, 0, 0, 0, 0, //
      0, 1.06, 0, 0, 0, //
      0, 0, 1.06, 0, 0, //
      0, 0, 0, 1, 0, //
    ]),
    child: BrandMark(width: 104),
  );
}

/// A round masthead button, with a comfortable target for a thumb.
class MastheadButton extends StatelessWidget {
  const MastheadButton({
    super.key,
    required this.tooltip,
    required this.icon,
    required this.onPressed,
  });

  final String tooltip;
  final Widget icon;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => Material(
    color: AppColors.surface,
    shape: const CircleBorder(side: BorderSide(color: AppColors.line)),
    child: IconButton(
      constraints: const BoxConstraints.tightFor(width: 44, height: 44),
      padding: EdgeInsets.zero,
      tooltip: tooltip,
      icon: icon,
      onPressed: onPressed,
    ),
  );
}

/// Opens M16 Notifications. The badge shows how many are unread, from the
/// signed-in user's own notifications, and is hidden when there are none or
/// the count could not be loaded.
class NotificationsButton extends StatefulWidget {
  const NotificationsButton({super.key});

  @override
  State<NotificationsButton> createState() => _NotificationsButtonState();
}

class _NotificationsButtonState extends State<NotificationsButton> {
  @override
  void initState() {
    super.initState();
    DemoScope.read(context).loadNotifications();
  }

  @override
  Widget build(BuildContext context) {
    final unread = DemoScope.of(context).unreadNotificationCount;
    return Semantics(
      value: unread == 0 ? null : '$unread unread',
      child: MastheadButton(
        tooltip: 'Notifications',
        icon: Badge(
          isLabelVisible: unread > 0,
          label: Text('$unread'),
          backgroundColor: const Color(0xFFC0392B),
          child: const Icon(
            Icons.notifications_none,
            size: 19,
            color: AppColors.ink,
          ),
        ),
        onPressed: () => Navigator.of(context).push(
          MaterialPageRoute<void>(builder: (_) => const NotificationsScreen()),
        ),
      ),
    );
  }
}

/// Pale hills and a cluster of trees at the right of the M05 header.
class HillsPainter extends CustomPainter {
  const HillsPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    final far = Path()
      ..moveTo(w * 0.50, h)
      ..lineTo(w * 0.80, h * 0.40)
      ..lineTo(w * 0.92, h * 0.58)
      ..lineTo(w, h * 0.50)
      ..lineTo(w, h)
      ..close();
    canvas.drawPath(far, Paint()..color = const Color(0xFFE2ECDC));
    final middle = Path()
      ..moveTo(w * 0.30, h)
      ..quadraticBezierTo(w * 0.62, h * 0.80, w, h * 0.80)
      ..lineTo(w, h)
      ..close();
    canvas.drawPath(middle, Paint()..color = const Color(0xFFC9DEBE));
    final front = Path()
      ..moveTo(w * 0.52, h)
      ..quadraticBezierTo(w * 0.80, h * 0.90, w, h * 0.90)
      ..lineTo(w, h)
      ..close();
    canvas.drawPath(front, Paint()..color = const Color(0xFF9CC48C));
    final r = h / 9;
    for (final (x, y, radius, color) in <(double, double, double, int)>[
      (0.885, 0.77, 0.75, 0xFF2F6B45),
      (0.935, 0.64, 1.15, 0xFF2F6B45),
      (0.965, 0.73, 0.80, 0xFF1F5236),
      (1.005, 0.64, 1.00, 0xFF2F6B45),
    ]) {
      canvas.drawCircle(
        Offset(w * x, h * y),
        r * radius,
        Paint()..color = Color(color),
      );
    }
  }

  @override
  bool shouldRepaint(covariant HillsPainter oldDelegate) => false;
}
