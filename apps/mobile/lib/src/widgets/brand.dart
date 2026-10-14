import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Placeholder mark for "Sarvodaya Connect". The official emblem will be added as an
/// asset once the team has the approved artwork.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: compact ? 32 : 40,
          height: compact ? 32 : 40,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: const Color(0xFFF5DF53),
            border: Border.all(color: const Color(0xFFF6C744), width: 2),
          ),
          alignment: Alignment.center,
          child: Text(
            'S',
            style: TextStyle(
              fontWeight: FontWeight.w900,
              color: AppColors.forest,
              fontSize: compact ? 14 : 18,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Flexible(
          child: Text.rich(
            TextSpan(
              children: [
                const TextSpan(
                  text: 'Sarvodaya ',
                  style: TextStyle(color: AppColors.ink),
                ),
                const TextSpan(
                  text: 'Connect',
                  style: TextStyle(color: AppColors.leaf),
                ),
              ],
            ),
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: compact ? 15 : 18,
            ),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}
