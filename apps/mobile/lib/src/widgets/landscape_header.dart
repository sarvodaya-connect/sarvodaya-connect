import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'brand.dart';

/// Shared village landscape masthead used by the mobile role homes.
class LandscapeHeader extends StatelessWidget {
  const LandscapeHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.actions = const [],
  });

  final String title;
  final String? subtitle;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) => Container(
    color: const Color(0xFFFCFCF8),
    child: SafeArea(
      bottom: false,
      child: SizedBox(
        height: subtitle == null ? 178 : 194,
        child: Stack(
          fit: StackFit.expand,
          children: [
            const ExcludeSemantics(
              child: CustomPaint(painter: _VillageLandscapePainter()),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 8, 12, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      const BrandMark(compact: true),
                      const Spacer(),
                      ...actions,
                    ],
                  ),
                  const Spacer(),
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      color: AppColors.ink,
                      fontSize: 25,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 3),
                    Text(
                      subtitle!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _VillageLandscapePainter extends CustomPainter {
  const _VillageLandscapePainter();

  @override
  void paint(Canvas canvas, Size size) {
    final bounds = Offset.zero & size;
    canvas.drawRect(bounds, Paint()..color = const Color(0xFFFCFCF8));

    final farHills = Path()
      ..moveTo(0, size.height * 0.82)
      ..lineTo(size.width * 0.32, size.height * 0.69)
      ..lineTo(size.width * 0.54, size.height * 0.48)
      ..lineTo(size.width * 0.76, size.height * 0.71)
      ..lineTo(size.width, size.height * 0.58)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(farHills, Paint()..color = const Color(0xFFD9E8D2));

    final middleHill = Path()
      ..moveTo(0, size.height * 0.91)
      ..quadraticBezierTo(
        size.width * 0.42,
        size.height * 0.63,
        size.width,
        size.height * 0.70,
      )
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(middleHill, Paint()..color = const Color(0xFFA9CE9D));

    final frontHill = Path()
      ..moveTo(size.width * 0.42, size.height)
      ..quadraticBezierTo(
        size.width * 0.73,
        size.height * 0.77,
        size.width,
        size.height * 0.73,
      )
      ..lineTo(size.width, size.height)
      ..close();
    canvas.drawPath(frontHill, Paint()..color = const Color(0xFF80B56F));

    final treePaint = Paint()..color = const Color(0xFF286A43);
    final darkTreePaint = Paint()..color = const Color(0xFF174A32);
    final trees = <(double, double, double, Paint)>[
      (0.79, 0.76, 15, treePaint),
      (0.86, 0.69, 22, treePaint),
      (0.91, 0.79, 16, darkTreePaint),
      (0.97, 0.68, 28, treePaint),
      (1.04, 0.77, 19, darkTreePaint),
    ];
    for (final (x, y, radius, paint) in trees) {
      canvas.drawCircle(
        Offset(size.width * x, size.height * y),
        size.height * radius / 150,
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _VillageLandscapePainter oldDelegate) => false;
}
