import 'package:flutter/material.dart';

/// Client-approved Sarvodaya Connect brand mark.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.compact = false, this.width});

  final bool compact;

  /// Overrides the compact/full width, for example in the v4 home header.
  final double? width;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Sarvodaya Connect',
      image: true,
      child: ClipRect(
        child: Align(
          // Remove only the unused vertical whitespace in the square source
          // image while keeping every part of the approved logo visible.
          heightFactor: 0.44,
          widthFactor: 1,
          alignment: Alignment.center,
          child: Image.asset(
            'assets/branding/sarvodaya_connect_logo.jpg',
            width: width ?? (compact ? 150 : 180),
            fit: BoxFit.contain,
          ),
        ),
      ),
    );
  }
}
