import 'package:flutter/material.dart';

import '../models/user.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/demo_loader.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';
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
    (UserRole.programmeCoordinator, RoleWorkspace.alerts) ||
    (UserRole.deputyDistrictManager, RoleWorkspace.alerts) ||
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
    final reviews = workspace == RoleWorkspace.reviews;
    return Scaffold(
      appBar: AppBar(
        title: Text(_title),
        backgroundColor: reviews ? AppColors.forest : null,
        foregroundColor: reviews ? Colors.white : null,
        titleTextStyle: reviews
            ? const TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.w700,
              )
            : null,
        actions: [
          if (reviews)
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Center(
                child: Text(
                  store.society.district.nameEn,
                  style: const TextStyle(color: Colors.white, fontSize: 12),
                ),
              ),
            ),
        ],
      ),
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
                if (reviews) return const _ReviewQueue();
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

enum _QueueFilter { all, late, dueToday }

/// M18 · District review queue, oldest first, with target-time pills.
class _ReviewQueue extends StatefulWidget {
  const _ReviewQueue();

  @override
  State<_ReviewQueue> createState() => _ReviewQueueState();
}

class _ReviewQueueState extends State<_ReviewQueue> {
  static const _items = [
    ('Pahala Kosgama SSS', 'Council update · waiting 2 days', _Timing.dueToday),
    ('Polgahawela SSS', 'Activity report · waiting 6 days', _Timing.late),
    ('Wariyapola SSS', 'Activity report · waiting 4 days', _Timing.late),
    ('Ibbagamuwa SSS', 'Payment record · waiting 3 days', _Timing.dueToday),
    ('Nikaweratiya SSS', 'Membership Jul–Sep · waiting 1 day', _Timing.onTime),
  ];

  var _filter = _QueueFilter.all;

  @override
  Widget build(BuildContext context) {
    final late = _items.where((i) => i.$3 == _Timing.late).length;
    final visible = _items.where(
      (i) => switch (_filter) {
        _QueueFilter.all => true,
        _QueueFilter.late => i.$3 == _Timing.late,
        _QueueFilter.dueToday => i.$3 == _Timing.dueToday,
      },
    );
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Wrap(
          spacing: 8,
          children: [
            for (final filter in _QueueFilter.values)
              ChoiceChip(
                label: Text(switch (filter) {
                  _QueueFilter.all => 'All (${_items.length})',
                  _QueueFilter.late => 'Late ($late)',
                  _QueueFilter.dueToday => 'Due today',
                }),
                selected: _filter == filter,
                showCheckmark: false,
                shape: const StadiumBorder(),
                visualDensity: VisualDensity.compact,
                labelStyle: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: _filter == filter ? Colors.white : AppColors.ink,
                ),
                onSelected: (_) => setState(() => _filter = filter),
              ),
          ],
        ),
        const SizedBox(height: 10),
        Card(
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              for (final (i, item) in visible.indexed) ...[
                if (i > 0) const Divider(height: 1),
                ListTile(
                  dense: true,
                  title: Text(
                    item.$1,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                  subtitle: Text(
                    item.$2,
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.muted,
                    ),
                  ),
                  trailing: StatusChip(item.$3.style, compact: true, dot: true),
                  onTap: () => ScaffoldMessenger.of(
                    context,
                  ).showSnackBar(SnackBar(content: Text('${item.$1} opened'))),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 8),
        const Text(
          'Tap a submission to review it. Oldest first.',
          style: TextStyle(color: AppColors.muted, fontSize: 11),
        ),
      ],
    );
  }
}

enum _Timing {
  late,
  dueToday,
  onTime;

  StatusStyle get style => switch (this) {
    _Timing.late => const StatusStyle(
      'Late',
      Icons.warning_amber,
      Color(0xFFA8312A),
      Color(0xFFFBE9E7),
    ),
    _Timing.dueToday => const StatusStyle(
      'Due today',
      Icons.schedule,
      Color(0xFF7A5A00),
      Color(0xFFFFF2CC),
    ),
    _Timing.onTime => const StatusStyle(
      'On time',
      Icons.check_circle_outline,
      Color(0xFF25643F),
      Color(0xFFE5F3E8),
    ),
  };
}
