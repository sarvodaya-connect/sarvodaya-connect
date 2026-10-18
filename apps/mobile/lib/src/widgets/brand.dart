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
        height: compact ? 110 : 135,
        width: compact ? 200 : 250,
        // The approved source image is square with generous white space around
        // the horizontal wordmark. This frame removes the outer whitespace but
        // is tall enough to retain the complete orbit and "connect" lettering.
        fit: BoxFit.cover,
        alignment: Alignment.center,
      ),
    );
  }
}
