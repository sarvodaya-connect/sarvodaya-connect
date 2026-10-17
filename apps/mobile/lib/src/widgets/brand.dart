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
      child: Image.asset(
        'assets/branding/sarvodaya_connect_logo.jpg',
        height: compact ? 46 : 64,
        width: compact ? 150 : 210,
        fit: BoxFit.contain,
        alignment: Alignment.centerLeft,
      ),
    );
  }
}
