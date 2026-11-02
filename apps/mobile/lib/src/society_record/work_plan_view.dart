import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../widgets/state_views.dart';
import 'activity_screens.dart';
import 'record_widgets.dart';
import 'sdg_widgets.dart';
import 'society_record_models.dart';

/// V5 M09 (list) and M09c (calendar): the year's activities with their SPC
/// status. Allocated costs are planning figures, not payments.
class WorkPlanView extends StatefulWidget {
  const WorkPlanView({
    super.key,
    required this.plan,
    required this.societyId,
    required this.societyName,
    required this.reload,
    this.spcName,
  });

  final WorkPlan plan;
  final String societyId;
  final String societyName;
  final String? spcName;
  final VoidCallback reload;

  @override
  State<WorkPlanView> createState() => _WorkPlanViewState();
}

class _WorkPlanViewState extends State<WorkPlanView> {
  var _calendar = false;
  int? _month;

  Future<void> _add() async {
    final added = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => ActivityWizardScreen(
          societyId: widget.societyId,
          societyName: widget.societyName,
          year: widget.plan.year,
          spcName: widget.spcName,
        ),
      ),
    );
    if (added == true) widget.reload();
  }

  Future<void> _open(WorkPlanActivity activity) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => ActivityDetailScreen(
          activityId: activity.id,
          societyName: widget.societyName,
          spcName: widget.spcName,
        ),
      ),
    );
    widget.reload();
  }

  @override
  Widget build(BuildContext context) {
    final plan = widget.plan;
    final approved = plan.count(ActivityStatus.approved);
    final waiting = plan.count(ActivityStatus.waitingForSpc);
    final sentBack = plan.count(ActivityStatus.sentBack);
    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Annual work plan · ${plan.year}',
                style: RecordStyle.cardTitle,
              ),
            ),
            if (plan.canAddActivities)
              FilledButton.icon(
                style: compactFilledStyle,
                onPressed: _add,
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Add'),
              ),
          ],
        ),
        const SizedBox(height: 10),
        if (plan.activities.isEmpty)
          StateMessage(
            icon: Icons.event_note_outlined,
            title: 'No activities planned for ${plan.year} yet',
            message: 'Add the activities the society plans for the year, with a short description and the cost allocated to each.',
            primaryLabel: plan.canAddActivities ? 'Add first activity' : null,
            onPrimary: plan.canAddActivities ? _add : null,
          )
        else ...[
          SegmentedButton<bool>(
            showSelectedIcon: false,
            segments: const [
              ButtonSegment(value: false, label: Text('List')),
              ButtonSegment(value: true, label: Text('Calendar')),
            ],
            selected: {_calendar},
            onSelectionChanged: (value) =>
                setState(() => _calendar = value.first),
          ),
          const SizedBox(height: 10),
          if (!_calendar) ...[
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    child: _Figure(
                      label: 'Activities planned',
                      value: '${plan.activities.length}',
                      note: [
                        '$approved approved',
                        if (waiting > 0) '$waiting waiting',
                        if (sentBack > 0) '$sentBack sent back',
                      ].join(' · '),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _Figure(
                      label: 'Allocated (planning)',
                      value: formatLkr(plan.totalAllocated),
                      note: 'Not payments',
                    ),
                  ),
                ],
              ),
            ),
            for (final month in {for (final a in plan.activities) a.month}) ...[
              Padding(
                padding: const EdgeInsets.fromLTRB(2, 14, 2, 6),
                child: Text(
                  monthNames[month - 1].toUpperCase(),
                  style: RecordStyle.sectionLabel.copyWith(
                    color: AppColors.pine,
                  ),
                ),
              ),
              RecordCard(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                children: [
                  for (final (index, activity)
                      in plan.activities
                          .where((a) => a.month == month)
                          .indexed) ...[
                    if (index > 0) const Divider(height: 1),
                    _ActivityRow(
                      activity: activity,
                      onTap: () => _open(activity),
                    ),
                  ],
                ],
              ),
            ],
          ] else
            _Calendar(
              plan: plan,
              selected: _month,
              onSelect: (month) => setState(() => _month = month),
              onOpen: _open,
            ),
        ],
      ],
    );
  }
}

class _Figure extends StatelessWidget {
  const _Figure({required this.label, required this.value, required this.note});

  final String label;
  final String value;
  final String note;

  @override
  Widget build(BuildContext context) => RecordCard(
    padding: const EdgeInsets.all(12),
    children: [
      Text(label, style: RecordStyle.label),
      const SizedBox(height: 2),
      FittedBox(
        fit: BoxFit.scaleDown,
        alignment: Alignment.centerLeft,
        child: Text(
          value,
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: AppColors.ink,
          ),
        ),
      ),
      Text(note, style: RecordStyle.caption),
    ],
  );
}

class _ActivityRow extends StatelessWidget {
  const _ActivityRow({required this.activity, required this.onTap});

  final WorkPlanActivity activity;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 11),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(activity.name, style: RecordStyle.value),
                Text(
                  [
                    ?activity.sector,
                    formatLkr(activity.allocatedCost),
                  ].join(' · '),
                  style: RecordStyle.caption,
                ),
                const SizedBox(height: 4),
                ActivityStatusChip(activity),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, size: 18, color: AppColors.muted),
        ],
      ),
    ),
  );
}

/// M09c: twelve month tiles with the allocation and number of activities.
class _Calendar extends StatelessWidget {
  const _Calendar({
    required this.plan,
    required this.selected,
    required this.onSelect,
    required this.onOpen,
  });

  final WorkPlan plan;
  final int? selected;
  final ValueChanged<int> onSelect;
  final ValueChanged<WorkPlanActivity> onOpen;

  @override
  Widget build(BuildContext context) {
    final chosen = selected;
    final inMonth = chosen == null
        ? const <WorkPlanActivity>[]
        : plan.activities.where((a) => a.month == chosen).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          '${plan.year}',
          textAlign: TextAlign.center,
          style: RecordStyle.cardTitle,
        ),
        const SizedBox(height: 8),
        LayoutBuilder(
          builder: (context, constraints) {
            final columns = constraints.maxWidth < 300 ? 3 : 4;
            final width = (constraints.maxWidth - 8 * (columns - 1)) / columns;
            return Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (var month = 1; month <= 12; month++)
                  SizedBox(
                    width: width,
                    child: _MonthTile(
                      month: month,
                      activities: plan.activities
                          .where((a) => a.month == month)
                          .toList(),
                      selected: chosen == month,
                      onTap: () => onSelect(month),
                    ),
                  ),
              ],
            );
          },
        ),
        if (chosen != null) ...[
          const SizedBox(height: 12),
          RecordCard(
            title: monthNames[chosen - 1],
            trailing: Text(
              '${inMonth.length} ${inMonth.length == 1 ? 'activity' : 'activities'}',
              style: RecordStyle.caption,
            ),
            children: [
              if (inMonth.isEmpty)
                const Text('Nothing planned.', style: RecordStyle.body),
              for (final activity in inMonth)
                InkWell(
                  onTap: () => onOpen(activity),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(activity.name, style: RecordStyle.value),
                              Text(
                                [
                                  ?activity.datesLabel,
                                  ?activity.sector,
                                ].join(' · '),
                                style: RecordStyle.caption,
                              ),
                            ],
                          ),
                        ),
                        Text(
                          formatLkr(activity.allocatedCost),
                          style: RecordStyle.value,
                        ),
                        const Icon(
                          Icons.chevron_right,
                          size: 18,
                          color: AppColors.muted,
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ],
        const SizedBox(height: 10),
        Text(
          'Allocated in the plan: ${formatLkr(plan.totalAllocated)} across ${plan.activities.length} activities. Planning figures only.',
          style: RecordStyle.caption,
        ),
      ],
    );
  }
}

class _MonthTile extends StatelessWidget {
  const _MonthTile({
    required this.month,
    required this.activities,
    required this.selected,
    required this.onTap,
  });

  final int month;
  final List<WorkPlanActivity> activities;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final total = activities.fold<double>(0, (sum, a) => sum + a.allocatedCost);
    final planned = activities.isNotEmpty;
    final name = monthNames[month - 1].substring(0, 3);
    return Semantics(
      button: true,
      selected: selected,
      label: planned
          ? '$name: ${activities.length} ${activities.length == 1 ? 'activity' : 'activities'}, ${formatLkr(total)}'
          : '$name: nothing planned',
      excludeSemantics: true,
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: 76),
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: planned ? AppColors.mintSoft : AppColors.surface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: selected ? AppColors.pine : AppColors.line,
              width: selected ? 2 : 1,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(name, style: RecordStyle.value),
              Text(
                planned ? formatLkr(total) : 'Nothing planned',
                style: RecordStyle.caption,
              ),
              if (planned)
                Text(
                  '${activities.length} ${activities.length == 1 ? 'activity' : 'activities'}',
                  style: RecordStyle.caption.copyWith(
                    color: AppColors.pine,
                    fontWeight: FontWeight.w700,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
