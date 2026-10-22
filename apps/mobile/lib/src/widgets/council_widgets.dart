import 'package:flutter/material.dart';

import '../models/committee.dart';
import '../theme/app_theme.dart';

/// "Seats filled 23 / 25" with one chip per seat type (Screen Catalogue v2, M07b).
class SeatSummary extends StatelessWidget {
  const SeatSummary({super.key, required this.filled, required this.total});

  final Map<CouncilSeatType, int> filled;
  final int total;

  @override
  Widget build(BuildContext context) {
    final filledTotal = filled.values.fold(0, (sum, value) => sum + value);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            const Expanded(
              child: Text(
                'Seats filled',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
            Text(
              '$filledTotal / $total',
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            for (final (i, type) in CouncilSeatType.values.indexed) ...[
              if (i > 0) const SizedBox(width: 4),
              Expanded(
                child: _SeatChip(
                  label: _shortLabel(type),
                  filled: filled[type] ?? 0,
                  seats: type.seatCount,
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 8),
        const Text(
          '18 Executive Members (3 children, 3 youth, 3 mothers, 9 ordinary) + 7 Elders Council',
          style: TextStyle(color: AppColors.muted, fontSize: 11),
        ),
      ],
    );
  }
}

String _shortLabel(CouncilSeatType type) => switch (type) {
  CouncilSeatType.child => 'Children',
  CouncilSeatType.youth => 'Youth',
  CouncilSeatType.mother => 'Mothers',
  CouncilSeatType.ordinary => 'Ordinary',
  CouncilSeatType.elder => 'Elders',
};

class _SeatChip extends StatelessWidget {
  const _SeatChip({
    required this.label,
    required this.filled,
    required this.seats,
  });

  final String label;
  final int filled;
  final int seats;

  @override
  Widget build(BuildContext context) {
    final complete = filled >= seats;
    final color = complete ? AppColors.forest : AppColors.danger;
    return Semantics(
      label: '$label seats: $filled of $seats filled',
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 5),
        decoration: BoxDecoration(
          color: complete ? AppColors.mint : AppColors.dangerSoft,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Column(
          children: [
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 9.5, color: AppColors.inkSoft),
            ),
            Text(
              '$filled / $seats',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 13,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class MemberAvatar extends StatelessWidget {
  const MemberAvatar(this.member, {super.key, this.size = 40});

  final CommitteeMember member;
  final double size;

  @override
  Widget build(BuildContext context) {
    return CircleAvatar(
      radius: size / 2,
      backgroundColor: AppColors.mint,
      child: Text(
        member.initials,
        style: TextStyle(
          color: AppColors.forest,
          fontWeight: FontWeight.w700,
          fontSize: size * 0.32,
        ),
      ),
    );
  }
}

/// One Council seat in the list, with its seat type and an optional pending-change tag.
class MemberTile extends StatelessWidget {
  const MemberTile({
    super.key,
    required this.member,
    this.onTap,
    this.onReplace,
    this.pendingLabel,
  });

  final CommitteeMember member;
  final VoidCallback? onTap;
  final VoidCallback? onReplace;

  /// For example "Change waiting for District" or "Draft: S. Tharmalingam".
  final String? pendingLabel;

  @override
  Widget build(BuildContext context) {
    final seat = member.age == null
        ? '${member.seatType.label} seat'
        : '${member.seatType.label} (age ${member.age}) seat';
    final subtitle = '${member.position} · $seat';
    return Material(
      color: AppColors.surface,
      child: InkWell(
        onTap: onTap,
        child: Container(
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: AppColors.line)),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
          child: Row(
            children: [
              MemberAvatar(member, size: 34),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            member.fullName,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 13.5,
                            ),
                          ),
                        ),
                        if (member.isPrimaryContact) ...[
                          const SizedBox(width: 6),
                          const Tooltip(
                            message: 'Primary contact',
                            child: Icon(
                              Icons.star,
                              size: 16,
                              color: AppColors.leaf,
                              semanticLabel: 'Primary contact',
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 11.5,
                      ),
                    ),
                    if (pendingLabel != null) ...[
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.warningSoft,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          pendingLabel!,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.warning,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (onReplace != null)
                OutlinedButton(
                  onPressed: onReplace,
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(48, 36),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: Text(
                    'Replace',
                    semanticsLabel: 'Replace ${member.fullName}',
                    style: const TextStyle(fontSize: 12.5),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
