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
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.mint,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: AppColors.leaf.withValues(alpha: 0.5),
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.check, color: AppColors.leaf, size: 16),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text(
                            'Village profile 2026 · Approved',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 12.5,
                              color: AppColors.forest,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Update once a year. District and HQ use it to plan programmes and write project proposals.',
                            style: TextStyle(
                              color: AppColors.forest,
                              fontSize: 12,
                              height: 1.35,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              _TitledCard(
                title: 'People · ${village.name}',
                child: Column(
                  children: [
                    IntrinsicHeight(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _VillageMetric(
                            value: _number(village.households),
                            label: 'Households',
                          ),
                          const VerticalDivider(width: 1),
                          _VillageMetric(
                            value: _number(village.population),
                            label: 'Population',
                          ),
                          const VerticalDivider(width: 1),
                          _VillageMetric(
                            value:
                                '${village.femaleShare}% · ${village.maleShare}%',
                            label: 'Female · male',
                          ),
                        ],
                      ),
                    ),
                    const Divider(height: 1),
                    IntrinsicHeight(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _VillageMetric(
                            value: _number(village.womenHeadedHouseholds),
                            label: 'Women-headed',
                          ),
                          const VerticalDivider(width: 1),
                          _VillageMetric(
                            value: _number(village.residentsWithDisabilities),
                            label: 'Disabilities',
                          ),
                          const VerticalDivider(width: 1),
                          _VillageMetric(
                            value: _number(village.eldersOverSixty),
                            label: 'Elders 60+',
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              _TitledCard(
                title: 'Key stats',
                child: Column(
                  children: [
                    for (final (i, statistic)
                        in village.keyStatistics.indexed) ...[
                      if (i > 0) const Divider(height: 1),
                      _StatisticRow(
                        label: statistic.label,
                        value: statistic.value,
                      ),
                    ],
                  ],
                ),
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
                  for (
                    var index = 0;
                    index < village.priorityIssues.length;
                    index++
                  )
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
          ),
        ),
        BottomActionBar(
          primary: FilledButton(
            onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text(
                  'The 2027 village profile update opens in January 2027.',
                ),
              ),
            ),
            child: const Text('Start 2027 update'),
          ),
        ),
      ],
    );
  }
}

/// Card with a title row and hairline, its body flush to the edges.
class _TitledCard extends StatelessWidget {
  const _TitledCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) => Card(
    clipBehavior: Clip.antiAlias,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
          child: Semantics(
            header: true,
            child: Text(
              title,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
            ),
          ),
        ),
        const Divider(height: 1),
        child,
      ],
    ),
  );
}

class _VillageMetric extends StatelessWidget {
  const _VillageMetric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Padding(
      padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(color: AppColors.muted, fontSize: 11),
          ),
        ],
      ),
    ),
  );
}

class _StatisticRow extends StatelessWidget {
  const _StatisticRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
    child: Row(
      children: [
        Expanded(child: Text(label, style: const TextStyle(fontSize: 13))),
        const SizedBox(width: 12),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
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
