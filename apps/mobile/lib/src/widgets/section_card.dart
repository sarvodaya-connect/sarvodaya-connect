import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// White card with an optional title row, used by every screen for grouped content.
class SectionCard extends StatelessWidget {
  const SectionCard({
    super.key,
    this.title,
    this.trailing,
    required this.children,
    this.padding = const EdgeInsets.all(16),
    this.highlight = false,
  });

  final String? title;
  final Widget? trailing;
  final List<Widget> children;
  final EdgeInsets padding;

  /// Draws a soft green border to mark draft or changed content.
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(
          color: highlight ? AppColors.leaf : AppColors.line,
          width: highlight ? 1.5 : 1,
        ),
      ),
      child: Padding(
        padding: padding,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (title != null) ...[
              Row(
                children: [
                  Expanded(
                    child: Semantics(
                      header: true,
                      child: Text(
                        title!,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                  ),
                  ?trailing,
                ],
              ),
              const SizedBox(height: 12),
            ],
            ...children,
          ],
        ),
      ),
    );
  }
}

/// Label and value pair. Missing values are labelled "Missing", never hidden.
class InfoRow extends StatelessWidget {
  const InfoRow({super.key, required this.label, this.value, this.trailing});

  final String label;
  final String? value;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final missing = value == null || value!.trim().isEmpty;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: Theme.of(context).textTheme.bodySmall),
                const SizedBox(height: 2),
                if (missing)
                  const Row(
                    children: [
                      Icon(
                        Icons.error_outline,
                        size: 16,
                        color: AppColors.danger,
                      ),
                      SizedBox(width: 4),
                      Text(
                        'Missing',
                        style: TextStyle(
                          color: AppColors.danger,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  )
                else
                  Text(
                    value!,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
              ],
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }
}

/// Before/after pair used on the review and returned-submission screens.
class ChangeValue extends StatelessWidget {
  const ChangeValue({
    super.key,
    required this.label,
    this.previous,
    required this.proposed,
    this.note,
  });

  final String label;
  final String? previous;
  final String proposed;
  final Widget? note;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 4),
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 8,
            runSpacing: 4,
            children: [
              if (previous != null && previous!.isNotEmpty)
                Text(
                  previous!,
                  semanticsLabel: 'Was $previous',
                  style: const TextStyle(
                    color: AppColors.muted,
                    decoration: TextDecoration.lineThrough,
                  ),
                ),
              if (previous != null && previous!.isNotEmpty)
                const Icon(
                  Icons.arrow_forward,
                  size: 16,
                  color: AppColors.muted,
                ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.mint,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  proposed,
                  semanticsLabel: 'New value $proposed',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    color: AppColors.forest,
                  ),
                ),
              ),
            ],
          ),
          if (note != null) ...[const SizedBox(height: 6), note!],
        ],
      ),
    );
  }
}
