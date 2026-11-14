import 'package:flutter/material.dart';

import '../l10n/l10n.dart';
import '../screens/notifications_screen.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import 'brand.dart';

/// Shared M05 masthead for every role. Text determines the height so long
/// names, translated copy and accessibility text sizes are never truncated.
class HomeMasthead extends StatelessWidget {
  const HomeMasthead({
    super.key,
    required this.title,
    required this.subtitle,
    this.actions = const [],
  });

  final String title;
  final String subtitle;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) => ColoredBox(
    color: AppColors.surface,
    child: SafeArea(
      bottom: false,
      child: ClipRect(
        child: Stack(
          children: [
            // Fixed artwork height: trees do not grow over long names when
            // the text wraps. Decoration cannot intercept taps or be read.
            const Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              height: 120,
              child: IgnorePointer(
                child: ExcludeSemantics(
                  child: CustomPaint(painter: HillsPainter()),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 6, 12, 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const MastheadLogo(),
                      const Spacer(),
                      ...actions,
                      if (actions.isNotEmpty) const SizedBox(width: 8),
                      NotificationsButton(
                        key: ValueKey(DemoScope.of(context).user?.id),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  // Keep text clear of the tree cluster at the right edge.
                  Padding(
                    padding: const EdgeInsets.only(right: 48),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Semantics(
                          header: true,
                          child: Text(
                            title,
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              color: AppColors.ink,
                              height: 1.15,
                            ),
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          subtitle,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.muted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

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
    final l = context.l10n;
    final unread = DemoScope.of(context).unreadNotificationCount;
    return Semantics(
      value: unread == 0 ? null : l.moreUnread(unread),
      child: MastheadButton(
        tooltip: l.moreNotifications,
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
