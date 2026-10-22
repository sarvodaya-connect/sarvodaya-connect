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
    void done(String message) =>
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(message)));
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
                  : const MembershipContent(editable: true),
            ),
          ),
        ],
      ),
      bottomNavigationBar: store.emptyRecords
          ? null
          : BottomActionBar(
              secondary: OutlinedButton(
                onPressed: () => done('Membership counts saved as a draft.'),
                child: const Text('Save draft'),
              ),
              primary: FilledButton(
                onPressed: () => done(
                  'Membership counts sent to the District Centre (demonstration).',
                ),
                child: const Text('Send to District'),
              ),
            ),
    );
  }
}

/// M08 body: reporting period, total with the female/male split, then
/// counts for the five categories. Also shown on the Society "Members" tab.
class MembershipContent extends StatefulWidget {
  const MembershipContent({
    super.key,
    this.summary = demoMembership,
    this.editable = false,
  });

  final MembershipSummary summary;

  /// Shows − / + steppers; the Society tab shows the counts only.
  final bool editable;

  @override
  State<MembershipContent> createState() => _MembershipContentState();
}

class _MembershipContentState extends State<MembershipContent> {
  static const _periods = ['Apr–Jun 2026', 'Jul–Sep 2026'];

  late String _period = widget.summary.period;
  late final List<(int, int)> _counts = [
    for (final c in widget.summary.categories) (c.female, c.male),
  ];
  late int _families = widget.summary.familiesWithMember;

  int get _female => _counts.fold(0, (sum, c) => sum + c.$1);
  int get _male => _counts.fold(0, (sum, c) => sum + c.$2);

  void _set(int index, {int? female, int? male}) => setState(() {
    final (f, m) = _counts[index];
    _counts[index] = (
      (female ?? f).clamp(0, 99999),
      (male ?? m).clamp(0, 99999),
    );
  });

  @override
  Widget build(BuildContext context) {
    final summary = widget.summary;
    final total = _female + _male;
    final familyShare = summary.villageFamilies == 0
        ? 0
        : (_families * 100 / summary.villageFamilies).round();
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text(
          'Reporting period',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          initialValue: _period,
          isDense: true,
          items: [
            for (final period in _periods)
              DropdownMenuItem(value: period, child: Text(period)),
          ],
          onChanged: (value) => setState(() => _period = value ?? _period),
        ),
        const SizedBox(height: 12),
        SectionCard(
          padding: const EdgeInsets.all(14),
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Total members',
                        style: TextStyle(color: AppColors.muted, fontSize: 11),
                      ),
                      Text(
                        _formatCount(total),
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                Text(
                  '+${summary.changeSincePrevious} since ${summary.previousPeriod}',
                  style: const TextStyle(
                    color: AppColors.leaf,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Semantics(
              label:
                  'Female ${_formatCount(_female)}, male ${_formatCount(_male)}',
              child: ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: SizedBox(
                  height: 6,
                  child: Row(
                    children: [
                      Expanded(
                        flex: _female,
                        child: Container(color: _femaleColor),
                      ),
                      Expanded(
                        flex: _male,
                        child: Container(color: _maleColor),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 6),
            Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 4,
              runSpacing: 2,
              children: [
                const _Dot(_femaleColor),
                Text('Female ${_formatCount(_female)}', style: _legendStyle),
                const SizedBox(width: 6),
                const _Dot(_maleColor),
                Text('Male ${_formatCount(_male)}', style: _legendStyle),
                const SizedBox(width: 6),
                Text(
                  '$_families of ${summary.villageFamilies} village families ($familyShare%)',
                  style: _legendStyle,
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 12),
        Card(
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              Container(
                color: AppColors.background,
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                child: const Row(
                  children: [
                    Expanded(child: Text('Members', style: _headerStyle)),
                    _CountColumn(child: Text('Female', style: _headerStyle)),
                    SizedBox(width: 6),
                    _CountColumn(child: Text('Male', style: _headerStyle)),
                  ],
                ),
              ),
              for (final (i, category) in summary.categories.indexed) ...[
                const Divider(height: 1),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              category.category,
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            if (category.note != null)
                              Text(
                                category.note!,
                                style: const TextStyle(
                                  color: AppColors.muted,
                                  fontSize: 10.5,
                                ),
                              ),
                          ],
                        ),
                      ),
                      _CountColumn(
                        child: _Stepper(
                          label: '${category.category} female',
                          value: _counts[i].$1,
                          editable: widget.editable,
                          onChanged: (v) => _set(i, female: v),
                        ),
                      ),
                      const SizedBox(width: 6),
                      _CountColumn(
                        child: _Stepper(
                          label: '${category.category} male',
                          value: _counts[i].$2,
                          editable: widget.editable,
                          onChanged: (v) => _set(i, male: v),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),
        SectionCard(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Families with a member',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                  ),
                ),
                _CountColumn(
                  child: _Stepper(
                    label: 'Families with a member',
                    value: _families,
                    editable: widget.editable,
                    onChanged: (v) =>
                        setState(() => _families = v.clamp(0, 99999)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }
}

class _CountColumn extends StatelessWidget {
  const _CountColumn({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) =>
      SizedBox(width: 104, child: Center(child: child));
}

/// "− 30 +" counter. Shows the number only when not editable.
class _Stepper extends StatelessWidget {
  const _Stepper({
    required this.label,
    required this.value,
    required this.editable,
    required this.onChanged,
  });

  final String label;
  final int value;
  final bool editable;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final number = Text(
      _formatCount(value),
      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
    );
    if (!editable) return number;
    Widget button(IconData icon, String tip, int delta) => SizedBox(
      width: 30,
      height: 32,
      child: IconButton(
        tooltip: '$tip $label',
        padding: EdgeInsets.zero,
        iconSize: 16,
        onPressed: () => onChanged(value + delta),
        icon: Icon(icon),
      ),
    );
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          button(Icons.remove, 'Decrease', -1),
          Container(
            width: 40,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              border: Border.symmetric(
                vertical: BorderSide(color: AppColors.line),
              ),
            ),
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: number,
          ),
          button(Icons.add, 'Increase', 1),
        ],
      ),
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot(this.color);

  final Color color;

  @override
  Widget build(BuildContext context) => Container(
    width: 7,
    height: 7,
    decoration: BoxDecoration(color: color, shape: BoxShape.circle),
  );
}

const _legendStyle = TextStyle(color: AppColors.inkSoft, fontSize: 11);

const _femaleColor = Color(0xFF7B3F8C);
const _maleColor = Color(0xFF2D5C88);

const _headerStyle = TextStyle(
  color: AppColors.muted,
  fontWeight: FontWeight.w600,
  fontSize: 11,
);

String _formatCount(int value) => value.toString().replaceAllMapped(
  RegExp(r'\B(?=(\d{3})+(?!\d))'),
  (_) => ',',
);
