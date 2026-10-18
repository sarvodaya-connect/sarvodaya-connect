import 'package:flutter/material.dart';

import '../app.dart';
import '../models/user.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/demo_loader.dart';
import '../widgets/demo_options_sheet.dart';
import '../widgets/section_card.dart';
import '../widgets/state_views.dart';

/// Mobile role homes used by District Managers and HQ Administrators.
class RoleHomeScreen extends StatelessWidget {
  const RoleHomeScreen({super.key, required this.role});

  final UserRole role;

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final district = role == UserRole.districtManager;
    return Scaffold(
      appBar: AppBar(
        title: Text(district ? 'Kurunegala District' : 'National overview'),
        actions: [
          IconButton(
            tooltip: 'Demo options',
            icon: const Icon(Icons.tune),
            onPressed: () => showDemoOptions(context),
          ),
        ],
      ),
      body: Column(
        children: [
          if (store.offline)
            const OfflineBanner(message: 'Offline · showing saved information'),
          Expanded(
            child: DemoLoader(
              loadingLabel: district
                  ? 'Loading your district'
                  : 'Loading the national overview',
              builder: (context) {
                if (store.emptyRecords) {
                  return StateMessage(
                    icon: Icons.inbox_outlined,
                    title: district
                        ? 'No assigned societies'
                        : 'No national records yet',
                    message: district
                        ? 'Societies assigned to this district manager will appear here.'
                        : 'National totals will appear after district records are available.',
                    primaryLabel: 'Refresh',
                    onPrimary: () => store.setDemoOptions(emptyRecords: false),
                  );
                }
                return district
                    ? const _DistrictHomeContent()
                    : const _NationalHomeContent();
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _DistrictHomeContent extends StatelessWidget {
  const _DistrictHomeContent();

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          'Good ${_partOfDay(store.now)}, ${store.user?.displayName ?? 'Manager'}',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 4),
        const Text(
          'Your societies and reviews at a glance',
          style: TextStyle(color: AppColors.muted),
        ),
        const SizedBox(height: 16),
        const _MetricGrid(
          metrics: [
            _Metric('42', 'Active societies', Icons.holiday_village_outlined),
            _Metric('8', 'Pending reviews', Icons.fact_check_outlined),
            _Metric('31/42', 'Profiles complete', Icons.verified_outlined),
            _Metric('4', 'Overdue items', Icons.warning_amber_outlined),
          ],
        ),
        const SizedBox(height: 16),
        SectionCard(
          title: 'Needs your attention',
          children: [
            _RoleAction(
              icon: Icons.rate_review_outlined,
              title: '8 submissions waiting for review',
              subtitle: 'Oldest has waited 2 days',
              onTap: () => store.selectTab(HomeShell.roleWorkTab),
            ),
            _RoleAction(
              icon: Icons.person_search_outlined,
              title: '11 incomplete society profiles',
              subtitle: '3 are missing contact information',
              onTap: () => store.selectTab(HomeShell.societyTab),
            ),
          ],
        ),
        const SizedBox(height: 12),
        const SectionCard(
          title: 'District progress',
          children: [
            _ProgressRow(
              label: 'Annual documents',
              value: 0.74,
              valueLabel: '74%',
            ),
            SizedBox(height: 14),
            _ProgressRow(
              label: 'Profile completeness',
              value: 0.81,
              valueLabel: '81%',
            ),
          ],
        ),
      ],
    );
  }
}

class _NationalHomeContent extends StatelessWidget {
  const _NationalHomeContent();

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          'Welcome, ${store.user?.displayName ?? 'Administrator'}',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 4),
        const Text(
          'Sarvodaya societies across Sri Lanka',
          style: TextStyle(color: AppColors.muted),
        ),
        const SizedBox(height: 16),
        const _MetricGrid(
          metrics: [
            _Metric('5,340', 'Registered societies', Icons.groups_outlined),
            _Metric('1,076', 'Active societies', Icons.check_circle_outline),
            _Metric(
              '86',
              'Awaiting verification',
              Icons.pending_actions_outlined,
            ),
            _Metric('71%', 'Registrar complete', Icons.description_outlined),
          ],
        ),
        const SizedBox(height: 16),
        SectionCard(
          title: 'National priorities',
          children: [
            _RoleAction(
              icon: Icons.map_outlined,
              title: 'Review societies by district',
              subtitle: '25 districts · 1,076 active societies',
              onTap: () => store.selectTab(HomeShell.societyTab),
            ),
            _RoleAction(
              icon: Icons.assessment_outlined,
              title: 'Open national reports',
              subtitle: 'Membership, activities and annual documents',
              onTap: () => store.selectTab(HomeShell.roleWorkTab),
            ),
          ],
        ),
        const SizedBox(height: 12),
        const SectionCard(
          title: 'Data quality',
          children: [
            _ProgressRow(
              label: 'Verified society records',
              value: 0.83,
              valueLabel: '83%',
            ),
            SizedBox(height: 14),
            _ProgressRow(
              label: 'Annual documents received',
              value: 0.71,
              valueLabel: '71%',
            ),
          ],
        ),
      ],
    );
  }
}

String _partOfDay(DateTime now) {
  if (now.hour < 12) return 'morning';
  if (now.hour < 17) return 'afternoon';
  return 'evening';
}

class _Metric {
  const _Metric(this.value, this.label, this.icon);

  final String value;
  final String label;
  final IconData icon;
}

class _MetricGrid extends StatelessWidget {
  const _MetricGrid({required this.metrics});

  final List<_Metric> metrics;

  @override
  Widget build(BuildContext context) => GridView.builder(
    shrinkWrap: true,
    physics: const NeverScrollableScrollPhysics(),
    itemCount: metrics.length,
    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
      crossAxisCount: 2,
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 1.25,
    ),
    itemBuilder: (context, index) {
      final metric = metrics[index];
      return SectionCard(
        children: [
          Icon(metric.icon, color: AppColors.leaf),
          const SizedBox(height: 8),
          Text(metric.value, style: Theme.of(context).textTheme.titleLarge),
          Text(
            metric.label,
            style: const TextStyle(color: AppColors.muted, fontSize: 12),
          ),
        ],
      );
    },
  );
}

class _RoleAction extends StatelessWidget {
  const _RoleAction({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: EdgeInsets.zero,
    leading: Icon(icon, color: AppColors.leaf),
    title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
    subtitle: Text(subtitle),
    trailing: const Icon(Icons.chevron_right),
    onTap: onTap,
  );
}

class _ProgressRow extends StatelessWidget {
  const _ProgressRow({
    required this.label,
    required this.value,
    required this.valueLabel,
  });

  final String label;
  final double value;
  final String valueLabel;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Row(
        children: [
          Expanded(child: Text(label)),
          Text(valueLabel, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
      const SizedBox(height: 6),
      LinearProgressIndicator(
        value: value,
        minHeight: 8,
        borderRadius: BorderRadius.circular(8),
        backgroundColor: AppColors.mint,
        color: AppColors.leaf,
      ),
    ],
  );
}
