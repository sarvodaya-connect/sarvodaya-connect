import 'package:flutter/material.dart';

import '../models/society.dart';
import '../theme/app_theme.dart';

/// Area shown on the demonstration map, centred on the fictional society.
class DemoMapArea {
  const DemoMapArea._();

  static const north = 7.4722;
  static const south = 7.4622;
  static const west = 80.0352;
  static const east = 80.0472;

  /// Position of [location] on the map as fractions (0–1) of its width and height.
  static Offset? fractionOf(GeoLocation? location) {
    if (location == null) return null;
    final x = (location.longitude - west) / (east - west);
    final y = (north - location.latitude) / (north - south);
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return Offset(x, y);
  }

  /// Location for a tap at [fraction] of the map's width and height.
  static GeoLocation locationAt(Offset fraction) {
    double round(double value) => (value * 10000).roundToDouble() / 10000;
    return GeoLocation(
      latitude: round(north - fraction.dy.clamp(0, 1) * (north - south)),
      longitude: round(west + fraction.dx.clamp(0, 1) * (east - west)),
    );
  }
}

/// Simple drawn map used in the demo (no map package or network tiles needed).
/// Shows a pin at [location] when it falls inside the demo area.
class MapPreview extends StatelessWidget {
  const MapPreview({
    super.key,
    this.location,
    this.height = 140,
    this.onTapFraction,
    this.semanticLabel,
  });

  final GeoLocation? location;
  final double height;

  /// Called with the tapped position (fractions of width and height), for placing a pin.
  final ValueChanged<Offset>? onTapFraction;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final pin = DemoMapArea.fractionOf(location);
    return Semantics(
      label: semanticLabel ?? 'Map showing the society location',
      child: ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: SizedBox(
          height: height,
          child: LayoutBuilder(
            builder: (context, constraints) {
              final size = Size(constraints.maxWidth, height);
              return GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTapUp: onTapFraction == null
                    ? null
                    : (details) => onTapFraction!(
                        Offset(
                          details.localPosition.dx / size.width,
                          details.localPosition.dy / size.height,
                        ),
                      ),
                child: Stack(
                  children: [
                    Positioned.fill(child: CustomPaint(painter: _MapPainter())),
                    if (pin != null)
                      Positioned(
                        left: pin.dx * size.width - 18,
                        top: pin.dy * size.height - 34,
                        child: const Icon(
                          Icons.location_on,
                          color: AppColors.action,
                          size: 36,
                        ),
                      ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _MapPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(
      Offset.zero & size,
      Paint()..color = const Color(0xFFE7F0DF),
    );
    final road = Paint()
      ..color = Colors.white
      ..strokeWidth = 6
      ..style = PaintingStyle.stroke;
    canvas.drawLine(
      Offset(0, size.height * 0.7),
      Offset(size.width, size.height * 0.35),
      road,
    );
    canvas.drawLine(
      Offset(size.width * 0.35, 0),
      Offset(size.width * 0.55, size.height),
      road..strokeWidth = 4,
    );
    final water = Paint()..color = const Color(0xFFCFE3EA);
    canvas.drawOval(
      Rect.fromLTWH(
        size.width * 0.72,
        size.height * 0.55,
        size.width * 0.22,
        size.height * 0.3,
      ),
      water,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
