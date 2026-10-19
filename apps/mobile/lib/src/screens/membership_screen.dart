import 'package:flutter/material.dart';

import '../data/demo_data.dart';
import '../models/membership.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/demo_loader.dart';
import '../widgets/section_card.dart';
import '../widgets/state_views.dart';

/// M08 · Approved membership totals by category and gender.
class MembershipScreen extends StatelessWidget {
  const MembershipScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Membership')),
      body: Column(
        children: [
          if (store.offline)
            const OfflineBanner(message: 'Offline · showing saved information'),
          Expanded(
            child: DemoLoader(
              loadingLabel: 'Loading membership totals',
              builder: (context) => store.emptyRecords
                  ? const StateMessage(
                      icon: Icons.groups_outlined,
                      title: 'Membership not available',
                      message: 'No approved member counts have been added yet.',
                    )
                  : const _MembershipContent(summary: demoMembership),
            ),
          ),
        ],
      ),
    );
  }
}

class _MembershipContent extends StatelessWidget {
  const _MembershipContent({required this.summary});

  final MembershipSummary summary;

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      SectionCard(
        children: [
          Row(
            children: [
              const Icon(Icons.verified_outlined, color: AppColors.leaf),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Membership ${summary.year} · Approved',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'Approved member counts by category, separated by female and male totals.',
            style: TextStyle(color: AppColors.inkSoft, height: 1.4),
          ),
        ],
      ),
      const SizedBox(height: 12),
      SectionCard(
        title: 'Members by category',
        children: [
          const _MembershipHeader(),
          const Divider(height: 18),
          for (final category in summary.categories)
            _CategoryRow(category: category),
          const Divider(height: 24),
          _TotalRow(
            label: 'Female total',
            value: _formatCount(summary.femaleTotal),
          ),
          const SizedBox(height: 8),
          _TotalRow(
            label: 'Male total',
            value: _formatCount(summary.maleTotal),
          ),
        ],
      ),
      const SizedBox(height: 12),
      SectionCard(
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Overall membership',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              Text(
                _formatCount(summary.overallTotal),
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: AppColors.forest,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
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

class _MembershipHeader extends StatelessWidget {
  const _MembershipHeader();

  @override
  Widget build(BuildContext context) => const Row(
    children: [
      Expanded(child: Text('Category', style: _headerStyle)),
      SizedBox(
        width: 64,
        child: Text('Female', textAlign: TextAlign.end, style: _headerStyle),
      ),
      SizedBox(
        width: 64,
        child: Text('Male', textAlign: TextAlign.end, style: _headerStyle),
      ),
      SizedBox(
        width: 58,
        child: Text('Total', textAlign: TextAlign.end, style: _headerStyle),
      ),
    ],
  );
}

class _CategoryRow extends StatelessWidget {
  const _CategoryRow({required this.category});

  final MembershipCategoryCounts category;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 9),
    child: Row(
      children: [
        Expanded(child: Text(category.category)),
        SizedBox(
          width: 64,
          child: Text(_formatCount(category.female), textAlign: TextAlign.end),
        ),
        SizedBox(
          width: 64,
          child: Text(_formatCount(category.male), textAlign: TextAlign.end),
        ),
        SizedBox(
          width: 58,
          child: Text(
            _formatCount(category.total),
            textAlign: TextAlign.end,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
        ),
      ],
    ),
  );
}

class _TotalRow extends StatelessWidget {
  const _TotalRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: Text(label, style: const TextStyle(color: AppColors.inkSoft)),
      ),
      Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
    ],
  );
}

const _headerStyle = TextStyle(
  color: AppColors.muted,
  fontWeight: FontWeight.w700,
  fontSize: 12,
);

String _formatCount(int value) => value.toString().replaceAllMapped(
  RegExp(r'\B(?=(\d{3})+(?!\d))'),
  (_) => ',',
);
