import 'package:flutter/material.dart';

import '../l10n/l10n.dart';
import '../theme/app_theme.dart';
import 'record_widgets.dart';
import 'sdg_widgets.dart';
import 'society_record_models.dart';

class DevelopmentGoalsCard extends StatelessWidget {
  const DevelopmentGoalsCard({super.key, required this.activity});

  final WorkPlanActivity activity;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final classification = activity.classification;
    final dimensions = ActivityDimension.values.where(
      (item) => classification?.dimensions.contains(item) ?? false,
    );
    final categories = ActivityCategory.values.where(
      (item) => classification?.categories.contains(item) ?? false,
    );
    final sdgs = activity.sdgs.toSet().toList()..sort();

    return RecordCard(
      title: l.dgHeading,
      children: [
        if (activity.status != ActivityStatus.approved)
          Text(
            activity.status == ActivityStatus.sentBack
                ? l.dgSentBack
                : l.dgPending,
            style: RecordStyle.body,
          )
        else ...[
          if (dimensions.isNotEmpty && categories.isNotEmpty) ...[
            Text(l.dgDimensions, style: RecordStyle.cardTitle),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final dimension in dimensions)
                  Chip(
                    avatar: Image.asset(
                      'assets/development_goals/${dimension.name}.png',
                      excludeFromSemantics: true,
                    ),
                    backgroundColor: AppColors.mintSoft,
                    label: Text(switch (dimension) {
                      ActivityDimension.social => l.progDimSocial,
                      ActivityDimension.economic => l.progDimEconomic,
                      ActivityDimension.governance => l.progDimGovernance,
                    }),
                  ),
              ],
            ),
            const Divider(height: 20),
            Text(l.dgCategories, style: RecordStyle.cardTitle),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final category in categories)
                  Chip(
                    label: Text(switch (category) {
                      ActivityCategory.communityEducation => l.progSector1,
                      ActivityCategory.childWellbeing => l.progSector2,
                      ActivityCategory.culture => l.progSector3,
                      ActivityCategory.economy => l.progSector4,
                      ActivityCategory.governance => l.progSector5,
                      ActivityCategory.healthAndNutrition => l.progSector6,
                      ActivityCategory.housingAndInfrastructure =>
                        l.progSector7,
                      ActivityCategory.spiritualDevelopment => l.progSector8,
                      ActivityCategory.agriculture => l.progSector9,
                      ActivityCategory.environment => l.progSector10,
                    }),
                  ),
              ],
            ),
          ] else
            Text(l.dgLegacy, style: RecordStyle.body),
          const Divider(height: 20),
          Text(l.dgSdgs, style: RecordStyle.cardTitle),
          const SizedBox(height: 8),
          if (sdgs.isEmpty)
            Text(l.dgNoSdgs, style: RecordStyle.body)
          else
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [for (final sdg in sdgs) SdgChip(sdg)],
            ),
        ],
      ],
    );
  }
}
