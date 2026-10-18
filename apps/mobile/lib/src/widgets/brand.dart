import 'package:flutter/material.dart';

/// Client-approved Sarvodaya Connect brand mark.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.compact = false});

  final bool compact;

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
          alignment: Alignment.center,
          child: Image.asset(
            'assets/branding/sarvodaya_connect_logo.jpg',
            width: compact ? 150 : 180,
            fit: BoxFit.contain,
          ),
        ),
      ),
    );
  }
}
