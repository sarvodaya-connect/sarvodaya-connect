import 'package:flutter/material.dart';

import '../data/demo_data.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/demo_loader.dart';
import '../widgets/section_card.dart';
import '../widgets/state_views.dart';

/// M06b · Annual, read-only village profile tab.
class VillageProfileTab extends StatelessWidget {
  const VillageProfileTab({super.key});

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    if (store.emptyRecords) return const _VillageEmptyState();
    return const _VillageContent();
  }
}

/// Standalone route for places that need to open the M06b profile directly.
class VillageProfileScreen extends StatelessWidget {
  const VillageProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Village profile')),
      body: Column(
        children: [
          if (store.offline) const OfflineBanner(),
          Expanded(
            child: DemoLoader(
              loadingLabel: 'Loading the village profile',
              builder: (context) => const VillageProfileTab(),
            ),
          ),
        ],
      ),
    );
  }
}

class _VillageEmptyState extends StatelessWidget {
  const _VillageEmptyState();

  @override
  Widget build(BuildContext context) => const Center(
    child: Padding(
      padding: EdgeInsets.all(24),
      child: StateMessage(
        icon: Icons.holiday_village_outlined,
        title: 'Village profile not available',
        message: 'Village demographics and community information have not been added yet.',
      ),
    ),
  );
}

class _VillageContent extends StatelessWidget {
  const _VillageContent();

  @override
  Widget build(BuildContext context) {
    final village = demoVillageProfile;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        SectionCard(
          children: [
            Row(
              children: [
                const Icon(
                  Icons.verified_outlined,
                  color: AppColors.leaf,
                  size: 22,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Village profile 2026 · Approved',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            const Text(
              'Reviewed once a year by the District Centre and HQ to plan programmes and write project proposals.',
              style: TextStyle(color: AppColors.inkSoft, height: 1.4),
            ),
          ],
        ),
        const SizedBox(height: 12),
        SectionCard(
          title: 'People · ${village.name}',
          children: [
            Row(
              children: [
                Expanded(
                  child: _VillageMetric(
                    label: 'Households',
                    value: _number(village.households),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _VillageMetric(
                    label: 'Population',
                    value: _number(village.population),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _VillageMetric(
                    label: 'Women-headed',
                    value: _number(village.womenHeadedHouseholds),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _VillageMetric(
                    label: 'Disabilities',
                    value: _number(village.residentsWithDisabilities),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            _VillageMetric(
              label: 'Elders 60+',
              value: _number(village.eldersOverSixty),
              fullWidth: true,
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: _GenderShare(
                    label: 'Female',
                    percent: village.femaleShare,
                    color: AppColors.leaf,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _GenderShare(
                    label: 'Male',
                    percent: village.maleShare,
                    color: AppColors.actionPressed,
                  ),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 12),
        SectionCard(
          title: 'Key statistics',
          children: [
            for (final statistic in village.keyStatistics)
              _StatisticRow(label: statistic.label, value: statistic.value),
          ],
        ),
        const SizedBox(height: 12),
        SectionCard(
          title: 'Main income · households',
          trailing: const Text(
            'Share',
            style: TextStyle(fontSize: 12, color: AppColors.muted),
          ),
          children: [
            for (final livelihood in village.livelihoods)
              _LivelihoodRow(
                name: livelihood.name,
                percent: livelihood.percent,
              ),
          ],
        ),
        const SizedBox(height: 12),
        SectionCard(
          title: 'Priority issues',
          children: [
            for (var index = 0; index < village.priorityIssues.length; index++)
              _PriorityIssue(
                index: index + 1,
                text: village.priorityIssues[index],
                isLast: index == village.priorityIssues.length - 1,
              ),
          ],
        ),
        const SizedBox(height: 8),
        const Center(
          child: Text(
            'Fictional information for demonstration only',
            style: TextStyle(fontSize: 12, color: AppColors.muted),
          ),
        ),
      ],
    );
  }
}

class _VillageMetric extends StatelessWidget {
  const _VillageMetric({
    required this.label,
    required this.value,
    this.fullWidth = false,
  });

  final String label;
  final String value;
  final bool fullWidth;

  @override
  Widget build(BuildContext context) => Container(
    width: fullWidth ? double.infinity : null,
    padding: const EdgeInsets.all(10),
    decoration: BoxDecoration(
      color: AppColors.mintSoft,
      borderRadius: BorderRadius.circular(10),
      border: Border.all(color: AppColors.line),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 3),
        Text(
          value,
          style: Theme.of(context).textTheme.titleMedium
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
      ],
    ),
  );
}

class _GenderShare extends StatelessWidget {
  const _GenderShare({
    required this.label,
    required this.percent,
    required this.color,
  });

  final String label;
  final int percent;
  final Color color;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text('$label · $percent%', style: Theme.of(context).textTheme.bodySmall),
      const SizedBox(height: 5),
      ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: LinearProgressIndicator(
          value: percent / 100,
          minHeight: 8,
          color: color,
          backgroundColor: AppColors.line,
        ),
      ),
    ],
  );
}

class _StatisticRow extends StatelessWidget {
  const _StatisticRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 9),
    child: Row(
      children: [
        Expanded(child: Text(label)),
        const SizedBox(width: 12),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
        ),
      ],
    ),
  );
}

class _LivelihoodRow extends StatelessWidget {
  const _LivelihoodRow({required this.name, required this.percent});

  final String name;
  final int percent;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Row(
      children: [
        Expanded(child: Text(name, style: const TextStyle(fontSize: 14))),
        const SizedBox(width: 10),
        SizedBox(
          width: 62,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: percent / 100,
              minHeight: 7,
              color: AppColors.leaf,
              backgroundColor: AppColors.mintSoft,
            ),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 34,
          child: Text(
            '$percent%',
            textAlign: TextAlign.end,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
        ),
      ],
    ),
  );
}

class _PriorityIssue extends StatelessWidget {
  const _PriorityIssue({
    required this.index,
    required this.text,
    required this.isLast,
  });

  final int index;
  final String text;
  final bool isLast;

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: isLast ? 0 : 12),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        CircleAvatar(
          radius: 12,
          backgroundColor: AppColors.mint,
          foregroundColor: AppColors.forest,
          child: Text(
            '$index',
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(child: Text(text, style: const TextStyle(height: 1.4))),
      ],
    ),
  );
}

String _number(int value) => value.toString().replaceAllMapped(
  RegExp(r'\B(?=(\d{3})+(?!\d))'),
  (_) => ',',
);
