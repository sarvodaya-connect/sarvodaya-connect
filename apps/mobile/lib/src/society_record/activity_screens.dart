import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../format.dart';
import '../l10n/l10n.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/count_field.dart';
import '../widgets/state_views.dart';
import 'record_widgets.dart';
import 'sdg_widgets.dart';
import 'society_record_api.dart';
import 'society_record_models.dart';

const _dense = InputDecoration(
  isDense: true,
  contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
);

const _stepTitles = [
  'Details and sector',
  'Participants and Beneficiaries',
  'Resources and partners',
  'Check and send',
];

/// V5 M09a–M09d: the Society Officer plans an activity in four steps and
/// sends it to the SPC, who chooses the UN SDGs and approves it. Also used
/// to change an activity that is waiting or was sent back.
class ActivityWizardScreen extends StatefulWidget {
  const ActivityWizardScreen({
    super.key,
    required this.societyId,
    required this.societyName,
    required this.year,
    this.spcName,
    this.existing,
  });

  final String societyId;
  final String societyName;
  final int year;
  final String? spcName;

  /// The activity being changed, or null for a new one.
  final WorkPlanActivity? existing;

  @override
  State<ActivityWizardScreen> createState() => _ActivityWizardScreenState();
}

class _ActivityWizardScreenState extends State<ActivityWizardScreen> {
  late final _existing = widget.existing;
  late final _name = TextEditingController(text: _existing?.name);
  late final _description = TextEditingController(text: _existing?.description);
  late final _dates = TextEditingController(text: _existing?.datesLabel);
  late final _cost = TextEditingController(
    text: _existing == null ? '' : formatAmount(_existing.allocatedCost),
  );
  late final _partners = TextEditingController(text: _existing?.partners);
  late final _resources = TextEditingController(
    text: _existing?.resourcesNeeded,
  );
  late final _hours = TextEditingController(
    text: _existing?.volunteerHours?.toString(),
  );
  late int _month = _existing?.month ?? 1;
  late String _sector = _existing?.sector ?? sarvodayaSectors.first;
  late ActivityDimension _dimension =
      _existing?.dimension ?? ActivityDimension.social;
  late final _people = <String, int>{
    'female': _existing?.femaleParticipants ?? 0,
    'male': _existing?.maleParticipants ?? 0,
    'youth': _existing?.youthParticipants ?? 0,
    'households': _existing?.householdsBenefited ?? 0,
    'womenHeaded': _existing?.womenHeadedHouseholds ?? 0,
  };

  /// Issue #132: counts whose box does not hold a valid number right now.
  final _invalidCounts = <String>{};
  var _step = 0;
  var _attempted = false;
  var _saving = false;
  String? _error;
  ActivityDetail? _sent;

  @override
  void dispose() {
    for (final controller in [
      _name,
      _description,
      _dates,
      _cost,
      _partners,
      _resources,
      _hours,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  double? get _costValue =>
      double.tryParse(_cost.text.replaceAll(',', '').trim());

  /// Plain-language problems with the current step, or empty when it is fine.
  List<String> _problems(int step) => switch (step) {
    0 => [
      if (_name.text.trim().length < 3) 'Enter the activity name.',
      if (_description.text.trim().length < 10)
        'Describe the activity in at least 10 characters.',
    ],
    1 => [
      if (_invalidCounts.isNotEmpty) context.l10n.countFixBeforeNext,
      if (_people['youth']! > _people['female']! + _people['male']!) 'Youth are counted inside the female and male participants, so they cannot be more than both together.',
      if (_people['womenHeaded']! > _people['households']!) 'Women-headed households are part of the households benefited, so they cannot be more.',
    ],
    2 => [
      if (_costValue == null || _costValue! < 0) 'Enter the allocated cost in LKR using numbers only, for example 55000.',
    ],
    _ => const [],
  };

  void _next() {
    setState(() => _attempted = true);
    if (_problems(_step).isNotEmpty) return;
    setState(() {
      _attempted = false;
      _step += 1;
    });
  }

  ActivityInput get _input => ActivityInput(
    year: _existing?.year ?? widget.year,
    month: _month,
    name: _name.text.trim(),
    description: _description.text.trim(),
    sector: _sector,
    dimension: _dimension,
    allocatedCost: _costValue ?? 0,
    datesLabel: _dates.text,
    femaleParticipants: _people['female'],
    maleParticipants: _people['male'],
    youthParticipants: _people['youth'],
    householdsBenefited: _people['households'],
    womenHeadedHouseholds: _people['womenHeaded'],
    partners: _partners.text,
    resourcesNeeded: _resources.text,
    volunteerHours: int.tryParse(_hours.text.trim()),
  );

  Future<void> _send() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    final api = DemoScope.read(context).societyRecords;
    try {
      final existing = _existing;
      final sent = existing == null
          ? await api.createActivity(widget.societyId, _input)
          : await api.updateActivity(widget.societyId, existing.id, _input);
      if (mounted) setState(() => _sent = sent);
    } on SocietyRecordException catch (error) {
      if (mounted) {
        setState(
          () => _error = error.offline
              ? 'You are offline. The activity was not sent. Nothing you entered has been lost.'
              : '${error.message}. Nothing you entered has been lost.',
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final sent = _sent;
    if (sent != null) return _SentScreen(detail: sent, spcName: widget.spcName);
    final problems = _attempted ? _problems(_step) : const <String>[];
    return Scaffold(
      appBar: recordFormAppBar(
        context,
        title: _existing == null ? 'New Activity' : 'Change Activity',
        subtitle:
            '${widget.societyName} · Work plan ${_existing?.year ?? widget.year}',
        onClose: _saving ? () {} : null,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        children: [
          Semantics(
            header: true,
            label: 'Step ${_step + 1} of 4: ${_stepTitles[_step]}',
            excludeSemantics: true,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('STEP ${_step + 1} OF 4', style: RecordStyle.sectionLabel),
                const SizedBox(height: 2),
                Text(_stepTitles[_step], style: RecordStyle.screenTitle),
              ],
            ),
          ),
          const SizedBox(height: 14),
          ...switch (_step) {
            0 => _details(),
            1 => _participants(),
            2 => _resourcesStep(),
            _ => _check(),
          },
          for (final problem in problems) ...[
            const SizedBox(height: 8),
            RecordNote(
              icon: Icons.error_outline,
              tone: NoteTone.error,
              message: problem,
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 10),
            RecordNote(
              icon: Icons.error_outline,
              tone: NoteTone.error,
              title: 'Not Sent',
              message: _error!,
            ),
          ],
        ],
      ),
      bottomNavigationBar: BottomActionBar(
        secondary: OutlinedButton(
          onPressed: _saving
              ? null
              : _step == 0
              ? () => Navigator.of(context).maybePop()
              : () => setState(() {
                  // Going back keeps the last valid numbers.
                  _invalidCounts.clear();
                  _step -= 1;
                }),
          child: Text(_step == 0 ? 'Cancel' : 'Back'),
        ),
        primary: FilledButton(
          onPressed: _saving ? null : (_step == 3 ? _send : _next),
          child: Text(
            _step == 3
                ? (_saving ? 'Sending…' : 'Send to SPC')
                : 'Next: ${_stepTitles[_step + 1].split(' and ').first}',
          ),
        ),
      ),
    );
  }

  List<Widget> _details() => [
    const FieldLabel('Activity name', required: true),
    TextField(
      controller: _name,
      maxLength: 150,
      style: recordInputStyle,
      decoration: _dense.copyWith(counterText: ''),
    ),
    const SizedBox(height: 12),
    const FieldLabel('Description', required: true),
    TextField(
      controller: _description,
      maxLength: 1000,
      minLines: 3,
      maxLines: 6,
      style: recordInputStyle,
      decoration: _dense.copyWith(counterText: ''),
    ),
    const SizedBox(height: 12),
    LayoutBuilder(
      builder: (context, constraints) {
        final month = Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const FieldLabel('Month', required: true),
            DropdownButtonFormField<int>(
              initialValue: _month,
              isExpanded: true,
              style: recordInputStyle,
              decoration: _dense,
              items: [
                for (var m = 1; m <= 12; m++)
                  DropdownMenuItem(value: m, child: Text(monthNames[m - 1])),
              ],
              onChanged: (value) => setState(() => _month = value ?? _month),
            ),
          ],
        );
        final dates = Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const FieldLabel('Dates (optional)'),
            TextField(
              controller: _dates,
              maxLength: 60,
              style: recordInputStyle,
              decoration: _dense.copyWith(
                hintText: '12–14 Sep',
                counterText: '',
              ),
            ),
          ],
        );
        if (constraints.maxWidth < 330) {
          return Column(children: [month, const SizedBox(height: 12), dates]);
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: month),
            const SizedBox(width: 10),
            Expanded(child: dates),
          ],
        );
      },
    ),
    const SizedBox(height: 12),
    const FieldLabel('Sector', required: true),
    DropdownButtonFormField<String>(
      initialValue: _sector,
      isExpanded: true,
      style: recordInputStyle,
      decoration: _dense.copyWith(
        helperText: 'One of the 10 Sarvodaya sectors.',
        helperStyle: RecordStyle.caption,
      ),
      items: [
        for (final (index, sector) in sarvodayaSectors.indexed)
          DropdownMenuItem(
            value: sector,
            child: Text('${index + 1} · $sector'),
          ),
      ],
      onChanged: (value) => setState(() => _sector = value ?? _sector),
    ),
    const SizedBox(height: 12),
    const FieldLabel('Dimension', required: true),
    Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final dimension in ActivityDimension.values)
          ChoiceChip(
            label: Text(dimension.label),
            selected: _dimension == dimension,
            onSelected: (_) => setState(() => _dimension = dimension),
          ),
      ],
    ),
  ];

  List<Widget> _participants() => [
    const Text(
      'How many people take part, and who benefits? Use your best count — you can change it until the SPC approves.',
      style: RecordStyle.body,
    ),
    const SizedBox(height: 10),
    for (final (key, label, note) in const [
      ('female', 'Female participants', 'Members and volunteers'),
      ('male', 'Male participants', 'Members and volunteers'),
      ('youth', 'Youth (15–25)', 'Included above'),
      ('households', 'Households benefited', 'Families using the result'),
      ('womenHeaded', 'Women-headed households', 'Of the households above'),
    ])
      _Counter(
        label: label,
        note: note,
        value: _people[key]!,
        onChanged: (value) => setState(() {
          if (value == null) {
            _invalidCounts.add(key);
          } else {
            _invalidCounts.remove(key);
            _people[key] = value;
          }
        }),
      ),
    const SizedBox(height: 6),
    RecordCard(
      color: AppColors.mintSoft,
      padding: const EdgeInsets.all(12),
      children: [
        Text(
          'Total participants ${_people['female']! + _people['male']!}',
          style: RecordStyle.value,
        ),
        Text(
          'Female ${_people['female']} + male ${_people['male']}. Youth are counted inside these numbers.',
          style: RecordStyle.caption,
        ),
      ],
    ),
    const SizedBox(height: 8),
    const RecordNote(
      icon: Icons.info_outline,
      message: 'Your SPC chooses the UN SDGs when they approve the activity.',
    ),
  ];

  List<Widget> _resourcesStep() => [
    const FieldLabel('Allocated cost (LKR)', required: true),
    TextField(
      controller: _cost,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9,.]'))],
      style: recordInputStyle,
      decoration: _dense.copyWith(
        helperText: 'Planning amount only — not a payment or spending record.',
        helperStyle: RecordStyle.caption,
      ),
    ),
    const SizedBox(height: 12),
    const FieldLabel('Partners (optional)'),
    TextField(
      controller: _partners,
      maxLength: 500,
      style: recordInputStyle,
      decoration: _dense.copyWith(counterText: ''),
    ),
    const SizedBox(height: 12),
    const FieldLabel('Resources needed (optional)'),
    TextField(
      controller: _resources,
      maxLength: 500,
      minLines: 2,
      maxLines: 4,
      style: recordInputStyle,
      decoration: _dense.copyWith(counterText: ''),
    ),
    const SizedBox(height: 12),
    const FieldLabel('Volunteer hours (optional)'),
    TextField(
      controller: _hours,
      keyboardType: TextInputType.number,
      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
      style: recordInputStyle,
      decoration: _dense,
    ),
  ];

  List<Widget> _check() {
    final input = _input;
    Widget section(String title, int step, List<KeyValue> values) => Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: RecordCard(
        title: title,
        trailing: TextButton(
          onPressed: _saving ? null : () => setState(() => _step = step),
          child: const Text('Change'),
        ),
        children: [KeyValueGrid(values)],
      ),
    );
    return [
      section('Details and sector', 0, [
        KeyValue('Activity', input.name),
        KeyValue(
          'When',
          [
            if (input.datesLabel?.trim().isNotEmpty ?? false)
              input.datesLabel!.trim(),
            '${monthNames[input.month - 1]} ${input.year}',
          ].join(' · '),
        ),
        KeyValue(
          'Sector',
          '${sarvodayaSectors.indexOf(input.sector) + 1} · ${input.sector}',
        ),
        KeyValue('Dimension', input.dimension.label),
      ]),
      section('Participants and Beneficiaries', 1, [
        KeyValue('Female participants', '${input.femaleParticipants}'),
        KeyValue('Male participants', '${input.maleParticipants}'),
        KeyValue('Youth (15–25)', '${input.youthParticipants}'),
        KeyValue('Households benefited', '${input.householdsBenefited}'),
        KeyValue('Women-headed households', '${input.womenHeadedHouseholds}'),
      ]),
      section('Resources and partners', 2, [
        KeyValue(
          'Allocated cost',
          '${formatLkr(input.allocatedCost)} (planning)',
        ),
        KeyValue(
          'Partners',
          (input.partners?.trim().isEmpty ?? true)
              ? '—'
              : input.partners!.trim(),
        ),
        KeyValue('Volunteer hours', input.volunteerHours?.toString() ?? '—'),
      ]),
      RecordNote(
        icon: Icons.send_outlined,
        tone: NoteTone.success,
        message:
            'This goes to ${widget.spcName == null ? 'your SPC' : '${widget.spcName} (SPC)'}. They choose the UN SDGs and approve it. Until then it shows as "Waiting for SPC" in your work plan.',
      ),
    ];
  }
}

/// A count with − and + buttons and a number field (M09b). Issue #132: the
/// number can be typed straight in; [onChanged] gets null while it is not a
/// valid count.
class _Counter extends StatelessWidget {
  const _Counter({
    required this.label,
    required this.note,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final String note;
  final int value;
  final ValueChanged<int?> onChanged;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: RecordCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: RecordStyle.value),
                    Text(note, style: RecordStyle.caption),
                  ],
                ),
              ),
            ),
            CountField(
              label: label,
              value: value,
              onChanged: onChanged,
              max: maxActivityCount,
              decreaseTooltip: 'Fewer $label'.toLowerCase(),
              increaseTooltip: 'More $label'.toLowerCase(),
            ),
          ],
        ),
      ],
    ),
  );
}

/// The API's limit for each activity count (activities.dto.ts MAX_PEOPLE).
const maxActivityCount = 100000;

/// M09s: sent to the SPC.
class _SentScreen extends StatelessWidget {
  const _SentScreen({required this.detail, this.spcName});

  final ActivityDetail detail;
  final String? spcName;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: recordFormAppBar(
      context,
      title: 'New Activity',
      subtitle: detail.societyName,
      onClose: () => Navigator.of(context).pop(true),
    ),
    body: StateMessage(
      icon: Icons.check_circle_outline,
      title: 'Sent to Your SPC',
      message:
          '${detail.activity.name} is waiting for ${spcName == null ? 'your SPC' : '$spcName (SPC)'}. They will choose the UN SDGs and approve it. You get a notification when it is approved.',
      primaryLabel: 'Back to work plan',
      onPrimary: () => Navigator.of(context).pop(true),
    ),
  );
}

/// Loads one activity with the standard loading, error and no-access states.
class _ActivityLoader extends StatefulWidget {
  const _ActivityLoader({required this.activityId, required this.builder});

  final String activityId;
  final Widget Function(
    BuildContext context,
    ActivityDetail detail,
    VoidCallback reload,
  )
  builder;

  @override
  State<_ActivityLoader> createState() => _ActivityLoaderState();
}

class _ActivityLoaderState extends State<_ActivityLoader> {
  ActivityDetail? _detail;
  SocietyRecordException? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final detail = await DemoScope.read(context).societyRecords
          .fetchActivity(widget.activityId);
      if (mounted) setState(() => _detail = detail);
    } on SocietyRecordException catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final error = _error;
    if (error != null) {
      if (error.status == 404 || error.status == 403) {
        return NoAccessView(
          title: "You can't open this activity",
          message: 'It belongs to a society outside your assigned access. Ask your DM or HQ if you need it.',
          backLabel: 'Back',
          onBack: () => Navigator.of(context).maybePop(),
        );
      }
      return StateMessage(
        icon: Icons.error_outline,
        tone: StateTone.error,
        isAlert: true,
        title: "Couldn't load the activity",
        message: '${error.message} Nothing has been changed.',
        primaryLabel: 'Try again',
        onPrimary: _load,
      );
    }
    final detail = _detail;
    if (detail == null) {
      return const LoadingSkeleton(label: 'Loading the activity');
    }
    return widget.builder(context, detail, _load);
  }
}

/// Activity summary and participants, view only (M09d, M51).
class ActivityDetailsCards extends StatelessWidget {
  const ActivityDetailsCards({super.key, required this.detail});

  final ActivityDetail detail;

  @override
  Widget build(BuildContext context) {
    final activity = detail.activity;
    final sentBy = activity.createdBy;
    final submitted = activity.submittedAt;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        RecordCard(
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(activity.name, style: RecordStyle.cardTitle),
                ),
                const SizedBox(width: 8),
                ActivityStatusChip(activity),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              [
                detail.societyName,
                if (sentBy != null) 'sent by ${sentBy.label}',
                if (submitted != null) formatDateTime(submitted),
              ].join(' · '),
              style: RecordStyle.caption,
            ),
            const SizedBox(height: 8),
            Text(activity.description, style: RecordStyle.body),
            const SizedBox(height: 10),
            KeyValueGrid([
              KeyValue('When', activity.whenLabel),
              KeyValue(
                'Sector',
                activity.sector == null
                    ? '—'
                    : '${sarvodayaSectors.indexOf(activity.sector!) + 1} · ${activity.sector}',
              ),
              KeyValue('Dimension', activity.dimension?.label ?? '—'),
              KeyValue(
                'Allocated cost',
                '${formatLkr(activity.allocatedCost)} (planning)',
              ),
              if (activity.partners != null)
                KeyValue('Partners', activity.partners!),
              if (activity.volunteerHours != null)
                KeyValue('Volunteer hours', '${activity.volunteerHours}'),
            ]),
          ],
        ),
        const SizedBox(height: 10),
        RecordCard(
          title: 'Participants and Beneficiaries',
          children: [
            KeyValueGrid([
              KeyValue(
                'Female participants',
                '${activity.femaleParticipants ?? '—'}',
              ),
              KeyValue(
                'Male participants',
                '${activity.maleParticipants ?? '—'}',
              ),
              KeyValue('Youth (15–25)', '${activity.youthParticipants ?? '—'}'),
              KeyValue(
                'Households benefited',
                '${activity.householdsBenefited ?? '—'}',
              ),
              KeyValue(
                'Women-headed households',
                '${activity.womenHeadedHouseholds ?? '—'}',
              ),
            ]),
          ],
        ),
      ],
    );
  }
}

/// M09 activity: what the Society Officer sent, its SPC status and, when it
/// is waiting or was sent back, a way to change it.
class ActivityDetailScreen extends StatelessWidget {
  const ActivityDetailScreen({
    super.key,
    required this.activityId,
    required this.societyName,
    this.spcName,
  });

  final String activityId;
  final String societyName;
  final String? spcName;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Activity')),
    body: _ActivityLoader(
      activityId: activityId,
      builder: (context, detail, reload) {
        final activity = detail.activity;
        return ListView(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
          children: [
            if (activity.status == ActivityStatus.sentBack) ...[
              RecordNote(
                icon: Icons.undo,
                tone: NoteTone.warning,
                title:
                    'Sent Back by ${activity.reviewedBy?.label ?? 'the SPC'}',
                message:
                    activity.reviewComment ??
                    'Change the activity and send it again.',
              ),
              const SizedBox(height: 10),
            ],
            if (activity.status == ActivityStatus.approved) ...[
              RecordCard(
                title: 'UN SDGs Chosen by the SPC',
                children: [
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [for (final sdg in activity.sdgs) SdgChip(sdg)],
                  ),
                ],
              ),
              const SizedBox(height: 10),
            ],
            ActivityDetailsCards(detail: detail),
            if (detail.canEdit) ...[
              const SizedBox(height: 14),
              FilledButton(
                onPressed: () async {
                  final changed = await Navigator.of(context).push<bool>(
                    MaterialPageRoute(
                      builder: (_) => ActivityWizardScreen(
                        societyId: detail.societyId,
                        societyName: societyName,
                        year: activity.year,
                        spcName: spcName,
                        existing: activity,
                      ),
                    ),
                  );
                  if (changed == true) reload();
                },
                child: Text(
                  activity.status == ActivityStatus.sentBack
                      ? 'Change and send again'
                      : 'Change Activity',
                ),
              ),
            ],
          ],
        );
      },
    ),
  );
}

/// V5 M50: the SPC's activities waiting for approval and recent approvals.
class ActivitiesToApproveScreen extends StatefulWidget {
  const ActivitiesToApproveScreen({super.key});

  @override
  State<ActivitiesToApproveScreen> createState() =>
      _ActivitiesToApproveScreenState();
}

class _ActivitiesToApproveScreenState extends State<ActivitiesToApproveScreen> {
  ActivityQueue? _queue;
  SocietyRecordException? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final queue = await DemoScope.read(context).societyRecords
          .fetchActivityQueue();
      if (mounted) setState(() => _queue = queue);
    } on SocietyRecordException catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  Future<void> _review(ActivityQueueItem item) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => ActivityReviewScreen(
          activityId: item.id,
          waitingAfter: (_queue?.waiting.length ?? 1) - 1,
        ),
      ),
    );
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final queue = _queue;
    final error = _error;
    final now = DemoScope.of(context).now;
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Activities to Approve', style: RecordStyle.screenTitle),
            if (queue != null)
              Text(
                '${queue.waiting.length} waiting · your ${queue.societyCount} ${queue.societyCount == 1 ? 'society' : 'societies'}',
                style: RecordStyle.screenSubtitle,
              ),
          ],
        ),
      ),
      body: error != null
          ? (error.status == 403
                ? NoAccessView(
                    title: 'Only SPCs Approve Activities',
                    message: 'Activities are approved by the SPC assigned to each society.',
                    backLabel: 'Back',
                    onBack: () => Navigator.of(context).maybePop(),
                  )
                : StateMessage(
                    icon: Icons.error_outline,
                    tone: StateTone.error,
                    isAlert: true,
                    title: "Couldn't load activities",
                    message: '${error.message} Nothing has been changed.',
                    primaryLabel: 'Try again',
                    onPrimary: _load,
                  ))
          : queue == null
          ? const LoadingSkeleton(label: 'Loading activities to approve')
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
                children: [
                  RecordNote(
                    icon: Icons.verified_user_outlined,
                    tone: NoteTone.success,
                    message:
                        'SPC · you approve activities for your ${queue.societyCount} assigned societies',
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Waiting for You',
                    style: RecordStyle.sectionLabel,
                  ),
                  const SizedBox(height: 6),
                  if (queue.waiting.isEmpty)
                    const RecordCard(
                      children: [
                        Text(
                          'Nothing is waiting. New activities appear here when a Society Officer sends one.',
                          style: RecordStyle.body,
                        ),
                      ],
                    )
                  else
                    RecordCard(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      children: [
                        for (final (index, item) in queue.waiting.indexed) ...[
                          if (index > 0) const Divider(height: 1),
                          InkWell(
                            onTap: () => _review(item),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 11),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          item.name,
                                          style: RecordStyle.value,
                                        ),
                                        Text(
                                          [
                                            item.societyName,
                                            ?item.sentBy?.displayName,
                                            if (item.submittedAt != null)
                                              'sent ${formatWhen(item.submittedAt!, now)}',
                                          ].join(' · '),
                                          style: RecordStyle.caption,
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  RecordChip(
                                    _waitingLabel(item.submittedAt, now),
                                    tone: ChipTone.warning,
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
                      ],
                    ),
                  const SizedBox(height: 14),
                  const Text(
                    'Approved Recently',
                    style: RecordStyle.sectionLabel,
                  ),
                  const SizedBox(height: 6),
                  if (queue.approvedRecently.isEmpty)
                    const Text(
                      'No activities approved in the last 30 days.',
                      style: RecordStyle.body,
                    )
                  else
                    RecordCard(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      children: [
                        for (final (index, item)
                            in queue.approvedRecently.indexed) ...[
                          if (index > 0) const Divider(height: 1),
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(item.name, style: RecordStyle.value),
                                Text(
                                  [
                                    item.societyName,
                                    if (item.approvedAt != null)
                                      'approved ${formatDate(item.approvedAt!)}',
                                  ].join(' · '),
                                  style: RecordStyle.caption,
                                ),
                                const SizedBox(height: 5),
                                Wrap(
                                  spacing: 6,
                                  runSpacing: 6,
                                  children: [
                                    for (final sdg in item.sdgs) SdgChip(sdg),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  const SizedBox(height: 12),
                  const Text(
                    'Society Officers create activities. You choose the UN SDGs and approve them. Only approved activities count in the dashboards.',
                    style: RecordStyle.caption,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
    );
  }
}

/// "New" for today, otherwise "2 days".
String _waitingLabel(DateTime? submittedAt, DateTime now) {
  if (submittedAt == null) return 'Waiting';
  final days = now.difference(submittedAt).inDays;
  return days <= 0 ? 'New' : '$days ${days == 1 ? 'day' : 'days'}';
}

/// V5 M51 (choose the UN SDGs and approve), M51b (send back) and M52
/// (approved).
class ActivityReviewScreen extends StatefulWidget {
  const ActivityReviewScreen({
    super.key,
    required this.activityId,
    this.waitingAfter = 0,
  });

  final String activityId;

  /// How many activities stay waiting after this one, for "Next activity".
  final int waitingAfter;

  @override
  State<ActivityReviewScreen> createState() => _ActivityReviewScreenState();
}

class _ActivityReviewScreenState extends State<ActivityReviewScreen> {
  var _sdgs = <int>[];
  var _saving = false;
  String? _error;
  ActivityDetail? _approved;

  Future<void> _approve(ActivityDetail detail) async {
    if (_sdgs.isEmpty) {
      setState(() => _error = 'Choose at least one UN SDG to approve.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final approved = await DemoScope.read(context).societyRecords
          .approveActivity(detail.activity.id, _sdgs);
      if (mounted) setState(() => _approved = approved);
    } on SocietyRecordException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _sendBack(ActivityDetail detail) async {
    final officer =
        detail.activity.createdBy?.displayName ?? 'the Society Officer';
    final comment = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => _SendBackSheet(officer: officer),
    );
    if (comment == null || !mounted) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await DemoScope.read(context).societyRecords
          .sendBackActivity(detail.activity.id, comment: comment);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Sent back to $officer.')));
      Navigator.of(context).pop();
    } on SocietyRecordException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final approved = _approved;
    if (approved != null) {
      return _ApprovedScreen(
        detail: approved,
        waitingAfter: widget.waitingAfter,
      );
    }
    return _ActivityLoader(
      activityId: widget.activityId,
      builder: (context, detail, _) => Scaffold(
        appBar: AppBar(
          titleSpacing: 0,
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Review Activity', style: RecordStyle.screenTitle),
              Text(detail.societyName, style: RecordStyle.screenSubtitle),
            ],
          ),
        ),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
          children: [
            ActivityDetailsCards(detail: detail),
            const SizedBox(height: 10),
            if (!detail.canReview)
              RecordNote(
                icon: Icons.lock_outline,
                message: detail.activity.status == ActivityStatus.waitingForSpc
                    ? "Only the society's SPC approves its activities."
                    : 'This activity is no longer waiting for approval.',
              )
            else
              RecordCard(
                children: [
                  Row(
                    children: [
                      const Expanded(
                        child: Text.rich(
                          TextSpan(
                            text: 'UN SDGs',
                            children: [
                              TextSpan(
                                text: ' *',
                                style: TextStyle(color: AppColors.danger),
                              ),
                            ],
                          ),
                          style: RecordStyle.cardTitle,
                        ),
                      ),
                      Flexible(
                        child: Text(
                          'Tap every goal that applies (${_sdgs.length} chosen)',
                          textAlign: TextAlign.end,
                          style: RecordStyle.caption,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SdgGrid(
                    selected: _sdgs,
                    enabled: !_saving,
                    onChanged: (sdgs) => setState(() {
                      _sdgs = sdgs;
                      _error = null;
                    }),
                  ),
                ],
              ),
            if (_error != null) ...[
              const SizedBox(height: 10),
              RecordNote(
                icon: Icons.error_outline,
                tone: NoteTone.error,
                message: _error!,
              ),
            ],
          ],
        ),
        bottomNavigationBar: detail.canReview
            ? BottomActionBar(
                secondary: OutlinedButton(
                  onPressed: _saving ? null : () => _sendBack(detail),
                  child: const Text('Send back'),
                ),
                primary: FilledButton.icon(
                  onPressed: _saving ? null : () => _approve(detail),
                  icon: const Icon(Icons.check_circle_outline, size: 18),
                  label: Text(_saving ? 'Saving…' : 'Approve'),
                ),
              )
            : null,
      ),
    );
  }
}

/// M51b: what should change (optional).
class _SendBackSheet extends StatefulWidget {
  const _SendBackSheet({required this.officer});

  final String officer;

  @override
  State<_SendBackSheet> createState() => _SendBackSheetState();
}

class _SendBackSheetState extends State<_SendBackSheet> {
  final _comment = TextEditingController();

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(
      20,
      0,
      20,
      20 + MediaQuery.viewInsetsOf(context).bottom,
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Send Back to ${widget.officer}?', style: RecordStyle.screenTitle),
        const SizedBox(height: 6),
        const Text(
          'The activity goes back to the Society Officer to change. It stays out of the dashboards until you approve it.',
          style: RecordStyle.body,
        ),
        const SizedBox(height: 12),
        const FieldLabel('What should change? (optional)'),
        TextField(
          controller: _comment,
          maxLength: 500,
          minLines: 3,
          maxLines: 5,
          style: recordInputStyle,
          decoration: _dense.copyWith(counterText: ''),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Cancel'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: FilledButton(
                onPressed: () => Navigator.of(context).pop(_comment.text),
                child: const Text('Send back'),
              ),
            ),
          ],
        ),
      ],
    ),
  );
}

/// M52: approved, with the chosen goals.
class _ApprovedScreen extends StatelessWidget {
  const _ApprovedScreen({required this.detail, required this.waitingAfter});

  final ActivityDetail detail;
  final int waitingAfter;

  @override
  Widget build(BuildContext context) {
    final activity = detail.activity;
    final officer = activity.createdBy?.displayName;
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Review Activity', style: RecordStyle.screenTitle),
            Text(detail.societyName, style: RecordStyle.screenSubtitle),
          ],
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 32, 20, 24),
        children: [
          const Icon(
            Icons.check_circle_outline,
            size: 56,
            color: AppColors.leaf,
          ),
          const SizedBox(height: 10),
          Semantics(
            liveRegion: true,
            child: const Text(
              'Activity approved',
              textAlign: TextAlign.center,
              style: RecordStyle.screenTitle,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '${activity.name} · ${detail.societyName}.${officer == null ? '' : ' $officer is notified.'} It now counts in the activity figures for your societies, the district and HQ.',
            textAlign: TextAlign.center,
            style: RecordStyle.body,
          ),
          const SizedBox(height: 16),
          for (final sdg in activity.sdgs)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: Image.asset(sdgAsset(sdg), width: 44, height: 44),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'SDG $sdg · ${sdgTitle(sdg)}',
                      style: RecordStyle.value,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
      bottomNavigationBar: BottomActionBar(
        secondary: waitingAfter > 0
            ? OutlinedButton(
                onPressed: () => Navigator.of(context).pop(),
                child: Text('Next activity ($waitingAfter left)'),
              )
            : null,
        primary: FilledButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Done'),
        ),
      ),
    );
  }
}
