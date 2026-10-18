import 'package:flutter/material.dart';

import '../models/user.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/demo_loader.dart';
import '../widgets/state_views.dart';
import 'my_societies_screen.dart';

enum RoleWorkspace { societies, reviews, reports, alerts }

/// Small mobile work lists for the feature areas permitted to each role.
class RoleWorkspaceScreen extends StatelessWidget {
  const RoleWorkspaceScreen({
    super.key,
    required this.role,
    required this.workspace,
  });

  final UserRole role;
  final RoleWorkspace workspace;

  bool get _permitted => switch ((role, workspace)) {
    (UserRole.districtManager, RoleWorkspace.societies) ||
    (UserRole.districtManager, RoleWorkspace.reviews) ||
    (UserRole.districtManager, RoleWorkspace.alerts) ||
    (UserRole.hqAdmin, RoleWorkspace.societies) ||
    (UserRole.hqAdmin, RoleWorkspace.reports) ||
    (UserRole.hqAdmin, RoleWorkspace.alerts) => true,
    _ => false,
  };

  String get _title => switch (workspace) {
    RoleWorkspace.societies => 'Societies',
    RoleWorkspace.reviews => 'Review queue',
    RoleWorkspace.reports => 'Reports',
    RoleWorkspace.alerts => 'Alerts',
  };

  @override
  Widget build(BuildContext context) {
    if (workspace == RoleWorkspace.societies) {
      return const MySocietiesScreen();
    }
    final store = DemoScope.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(_title)),
      body: !_permitted
          ? const StateMessage(
              icon: Icons.lock_outline,
              title: 'No permission',
              message: 'Your role does not have access to this area.',
              tone: StateTone.error,
            )
          : DemoLoader(
              loadingLabel: 'Loading $_title',
              builder: (context) {
                if (store.emptyRecords) {
                  return StateMessage(
                    icon: Icons.inbox_outlined,
                    title: 'Nothing here yet',
                    message: 'New $_title information will appear here.',
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: 3,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, index) =>
                      _WorkspaceCard(workspace: workspace, index: index),
                );
              },
            ),
    );
  }
}

class _WorkspaceCard extends StatelessWidget {
  const _WorkspaceCard({required this.workspace, required this.index});

  final RoleWorkspace workspace;
  final int index;

  @override
  Widget build(BuildContext context) {
    final (icon, title, subtitle) = switch (workspace) {
      RoleWorkspace.societies => (
        Icons.holiday_village_outlined,
        ['Pahala Kosgama SSS', 'Mawathagama SSS', 'Wariyapola SSS'][index],
        [
          '86% complete · Active',
          '72% complete · Active',
          '94% complete · Active',
        ][index],
      ),
      RoleWorkspace.reviews => (
        Icons.fact_check_outlined,
        ['Council update', 'Audit report', 'Society profile update'][index],
        [
          'Pahala Kosgama SSS · 2 hours',
          'Mawathagama SSS · 1 day',
          'Wariyapola SSS · 2 days',
        ][index],
      ),
      RoleWorkspace.reports => (
        Icons.assessment_outlined,
        [
          'Societies by class',
          'Annual documents',
          'Activities by sector',
        ][index],
        [
          'National summary',
          'Registrar completion',
          'Plan compared with completed',
        ][index],
      ),
      RoleWorkspace.alerts => (
        Icons.notifications_outlined,
        [
          'Records need verification',
          'Annual documents overdue',
          'New submission activity',
        ][index],
        ['86 societies', '14 societies', 'Updated today'][index],
      ),
    };
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: AppColors.mint,
          foregroundColor: AppColors.leaf,
          child: Icon(icon),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right),
        onTap: () =>
            ScaffoldMessenger.of(context)
                .showSnackBar(SnackBar(content: Text('$title opened'))),
      ),
    );
  }
}
