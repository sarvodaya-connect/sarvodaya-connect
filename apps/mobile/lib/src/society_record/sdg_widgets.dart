import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'record_widgets.dart';
import 'society_record_models.dart';

/// Official UN SDG colours, used only for the number circle on small chips.
const sdgColours = [
  Color(0xFFE5243B), Color(0xFFDDA63A), Color(0xFF4C9F38), Color(0xFFC5192D), //
  Color(0xFFFF3A21), Color(0xFF26BDE2), Color(0xFFFCC30B), Color(0xFFA21942),
  Color(0xFFFD6925), Color(0xFFDD1367), Color(0xFFFD9D24), Color(0xFFBF8B2E),
  Color(0xFF3F7E44), Color(0xFF0A97D9), Color(0xFF56C02B), Color(0xFF00689D),
  Color(0xFF19486A),
];

Color sdgColour(int sdg) => sdg >= 1 && sdg <= sdgColours.length
    ? sdgColours[sdg - 1]
    : AppColors.muted;

/// "SDG 4: Quality education, selected" — what a screen reader hears.
String sdgTileLabel(int sdg, {required bool selected}) =>
    'SDG $sdg: ${sdgTitle(sdg)}${selected ? ', selected' : ''}';

/// V5 M51: the 17 official icons in order, three per row. A chosen goal has
/// a dark ring and a tick. Tiles are at least 48 points so they are easy to tap.
class SdgGrid extends StatelessWidget {
  const SdgGrid({
    super.key,
    required this.selected,
    required this.onChanged,
    this.enabled = true,
  });

  final List<int> selected;
  final ValueChanged<List<int>> onChanged;
  final bool enabled;

  void _toggle(int sdg) {
    final next = selected.contains(sdg)
        ? (selected.where((value) => value != sdg).toList())
        : ([...selected, sdg]..sort());
    onChanged(next);
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      const columns = 3;
      const gap = 10.0;
      final width = (constraints.maxWidth - gap * (columns - 1)) / columns;
      return Wrap(
        spacing: gap,
        runSpacing: 14,
        children: [
          for (var sdg = 1; sdg <= 17; sdg++)
            SizedBox(
              width: width,
              child: _SdgTile(
                sdg: sdg,
                selected: selected.contains(sdg),
                onTap: enabled ? () => _toggle(sdg) : null,
              ),
            ),
        ],
      );
    },
  );
}

class _SdgTile extends StatelessWidget {
  const _SdgTile({required this.sdg, required this.selected, this.onTap});

  final int sdg;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    selected: selected,
    enabled: onTap != null,
    label: sdgTileLabel(sdg, selected: selected),
    excludeSemantics: true,
    child: InkWell(
      borderRadius: BorderRadius.circular(8),
      onTap: onTap,
      child: Column(
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  color: selected ? AppColors.ink : Colors.transparent,
                  borderRadius: BorderRadius.circular(7),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: AspectRatio(
                    aspectRatio: 1,
                    child: Image.asset(sdgAsset(sdg), fit: BoxFit.cover),
                  ),
                ),
              ),
              if (selected)
                Positioned(
                  right: -6,
                  top: -6,
                  child: Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      color: AppColors.action,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 2),
                    ),
                    child: const Icon(
                      Icons.check,
                      size: 14,
                      color: Colors.white,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 5),
          Text(
            '$sdg · ${sdgTitle(sdg)}',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 11,
              height: 1.25,
              color: selected ? AppColors.ink : AppColors.inkSoft,
              fontWeight: selected ? FontWeight.w700 : FontWeight.w400,
            ),
          ),
        ],
      ),
    ),
  );
}

/// The goal number in its colour and the full title, e.g. on M50 and M52.
class SdgChip extends StatelessWidget {
  const SdgChip(this.sdg, {super.key});

  final int sdg;

  @override
  Widget build(BuildContext context) {
    final colour = sdgColour(sdg);
    return Semantics(
      label: 'SDG $sdg: ${sdgTitle(sdg)}',
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.fromLTRB(2, 2, 9, 2),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: colour),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircleAvatar(
              radius: 9,
              backgroundColor: colour,
              child: Text(
                '$sdg',
                style: const TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
            ),
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                sdgTitle(sdg),
                style: const TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.ink,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Status pill for an activity: "Approved · SDG 6, 15", "Waiting for SPC".
class ActivityStatusChip extends StatelessWidget {
  const ActivityStatusChip(this.activity, {super.key});

  final WorkPlanActivity activity;

  @override
  Widget build(BuildContext context) => switch (activity.status) {
    ActivityStatus.approved => RecordChip(
      activity.sdgs.isEmpty
          ? 'Approved'
          : 'Approved · ${sdgShortList(activity.sdgs)}',
      tone: ChipTone.success,
      icon: Icons.check,
    ),
    ActivityStatus.waitingForSpc => const RecordChip(
      'Waiting for SPC',
      tone: ChipTone.warning,
    ),
    ActivityStatus.sentBack => const RecordChip(
      'Sent back',
      tone: ChipTone.danger,
    ),
  };
}
