import 'package:flutter/material.dart';

import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/state_views.dart';
import 'access_format.dart';
import 'district_access_api.dart';

/// V5 M32: the DM's temporary DDM access. Shows the current grant with the
/// time left as words, "End access now", and everything recorded against it.
class DistrictAccessScreen extends StatefulWidget {
  const DistrictAccessScreen({super.key});

  @override
  State<DistrictAccessScreen> createState() => _DistrictAccessScreenState();
}

class _DistrictAccessScreenState extends State<DistrictAccessScreen> {
  AccessList? _list;
  List<AccessEvent> _history = const [];
  String? _error;
  bool _ending = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final api = DemoScope.read(context).districtAccess;
    setState(() => _error = null);
    try {
      final list = await api.list();
      final shown = list.grants.isEmpty ? null : list.grants.first;
      final history = shown == null
          ? <AccessEvent>[]
          : await api.history(shown.id);
      if (mounted) {
        setState(() {
          _list = list;
          _history = history;
        });
      }
    } on DistrictAccessException catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  Future<void> _end(AccessGrant grant) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('End ${grant.deputyName}\'s Access Now?'),
        content: const Text(
          'They lose the district-wide view straight away. Their own assigned societies are not affected.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Keep access'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('End access now'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    setState(() => _ending = true);
    try {
      await DemoScope.read(context).districtAccess.end(grant.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            content: Text('Access ended. The DDM no longer sees the district.'),
          ),
        );
      await _load();
    } on DistrictAccessException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) setState(() => _ending = false);
    }
  }

  Future<void> _give() async {
    final given = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => GiveAccessScreen(maxDays: _list?.maxDays ?? 14),
      ),
    );
    if (given == true && mounted) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(content: Text('Temporary view-only access given.')),
        );
      await _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final list = _list;
    final current = list?.grants.where((g) => g.isCurrent).toList() ?? const [];
    final shown = list == null || list.grants.isEmpty
        ? null
        : list.grants.first;
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Temporary Access'),
            if (shown != null)
              Text(
                '${shown.districtName} District',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w400,
                ),
              ),
          ],
        ),
      ),
      body: _error != null
          ? StateMessage(
              icon: Icons.error_outline,
              tone: StateTone.error,
              isAlert: true,
              title: "Couldn't load temporary access",
              message: _error!,
              primaryLabel: 'Try again',
              onPrimary: _load,
            )
          : list == null
          ? const LoadingSkeleton(label: 'Loading temporary access')
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  for (final grant in current) ...[
                    _CurrentGrantCard(
                      grant: grant,
                      now: store.now,
                      ending: _ending,
                      onEnd: () => _end(grant),
                    ),
                    const SizedBox(height: 12),
                  ],
                  if (current.isEmpty) ...[
                    const AccessBanner(
                      tone: AccessBannerTone.viewOnly,
                      child: Text(
                        'No DDM has temporary access now. Give it when you are going to be away.',
                      ),
                    ),
                    const SizedBox(height: 12),
                    FilledButton.icon(
                      onPressed: _give,
                      icon: const Icon(Icons.key_outlined),
                      label: const Text('Give temporary access'),
                    ),
                    const SizedBox(height: 12),
                  ],
                  if (shown != null) _HistoryCard(events: _history),
                  if (list.grants.length > 1) ...[
                    const SizedBox(height: 12),
                    _EarlierGrants(grants: list.grants.skip(1).toList()),
                  ],
                ],
              ),
            ),
    );
  }
}

class _CurrentGrantCard extends StatelessWidget {
  const _CurrentGrantCard({
    required this.grant,
    required this.now,
    required this.ending,
    required this.onEnd,
  });

  final AccessGrant grant;
  final DateTime now;
  final bool ending;
  final VoidCallback onEnd;

  @override
  Widget build(BuildContext context) {
    final scheduled = grant.status == AccessStatus.scheduled;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.bannerTemporaryText, width: 2),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${grant.deputyName} · DDM',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
              ),
              _Chip(label: scheduled ? 'Starts later' : 'Active'),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _Fact(
                  label: scheduled ? 'Starts' : 'View only since',
                  value: accessDateTime(grant.startsAt),
                ),
              ),
              Expanded(
                child: _Fact(
                  label: 'Ends',
                  value: accessDateTime(grant.expiresAt),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            scheduled
                ? 'Starts ${accessEnds(grant.startsAt)}'
                : accessTimeLeft(grant.expiresAt, now),
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5),
          ),
          Text(
            'View only · all ${grant.societyCount} ${grant.districtName} societies · opened ${grant.societiesOpened} so far',
            style: const TextStyle(fontSize: 11.5, color: AppColors.muted),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.danger,
              side: const BorderSide(color: Color(0xFFE3B4AE)),
              minimumSize: const Size.fromHeight(44),
            ),
            onPressed: ending ? null : onEnd,
            icon: const Icon(Icons.highlight_off),
            label: Text(ending ? 'Ending…' : 'End access now'),
          ),
        ],
      ),
    );
  }
}

class _HistoryCard extends StatelessWidget {
  const _HistoryCard({required this.events});
  final List<AccessEvent> events;

  String _title(AccessEvent event) => switch (event.kind) {
    AccessEventKind.given => 'Access given · view only',
    AccessEventKind.started => 'Access started',
    AccessEventKind.opened => 'Opened ${event.societyName ?? 'a society'}',
    AccessEventKind.ended => 'Access ended on its own',
    AccessEventKind.endedEarly => 'Access ended early',
  };

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: AppColors.surface,
      border: Border.all(color: AppColors.line),
      borderRadius: BorderRadius.circular(14),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(
          children: [
            Expanded(
              child: Text(
                'Access History',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
            Text(
              'Recorded',
              style: TextStyle(fontSize: 11, color: AppColors.muted),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (events.isEmpty)
          const Text(
            'Nothing recorded yet.',
            style: TextStyle(fontSize: 12, color: AppColors.muted),
          ),
        for (final event in events)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 5),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.check_box_outline_blank,
                  size: 16,
                  color: event.kind == AccessEventKind.opened
                      ? AppColors.bannerTemporaryText
                      : AppColors.orangeChanged,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _title(event),
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 12.5,
                        ),
                      ),
                      Text(
                        [
                          if (event.actorName != null) event.actorName!,
                          accessDateTime(event.at),
                        ].join(' · '),
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.muted,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
      ],
    ),
  );
}

class _EarlierGrants extends StatelessWidget {
  const _EarlierGrants({required this.grants});
  final List<AccessGrant> grants;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const Text(
        'Earlier Grants',
        style: TextStyle(fontWeight: FontWeight.w700),
      ),
      for (final grant in grants)
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(grant.deputyName),
          subtitle: Text(
            '${accessDateTime(grant.startsAt)} → ${accessDateTime(grant.expiresAt)}',
          ),
          trailing: _Chip(
            label: switch (grant.status) {
              AccessStatus.endedEarly =>
                grant.endedEarlyByName == null
                    ? 'Ended early'
                    : 'Ended early by ${grant.endedEarlyByName}',
              AccessStatus.ended => 'Ended on its own',
              AccessStatus.scheduled => 'Starts later',
              AccessStatus.active => 'Active',
            },
          ),
        ),
    ],
  );
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(
      color: AppColors.bannerTemporaryBg,
      borderRadius: BorderRadius.circular(999),
    ),
    child: Text(
      '● $label',
      style: const TextStyle(
        fontSize: 10.5,
        fontWeight: FontWeight.w600,
        color: AppColors.bannerTemporaryText,
      ),
    ),
  );
}

class _Fact extends StatelessWidget {
  const _Fact({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
      Text(
        value,
        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
      ),
    ],
  );
}

/// V5 M30: choose the DDM, when access starts and ends, and an optional reason.
class GiveAccessScreen extends StatefulWidget {
  const GiveAccessScreen({super.key, required this.maxDays});
  final int maxDays;

  @override
  State<GiveAccessScreen> createState() => _GiveAccessScreenState();
}

class _GiveAccessScreenState extends State<GiveAccessScreen> {
  List<Deputy>? _deputies;
  String? _deputyId;
  late DateTime _start;
  late DateTime _end;
  final _reason = TextEditingController();
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final store = DemoScope.read(context);
      final now = store.now;
      setState(() {
        _start = DateTime.fromMillisecondsSinceEpoch(
          (now.millisecondsSinceEpoch ~/ 60000) * 60000,
        );
        _end = _start.add(const Duration(days: 4));
      });
      try {
        final deputies = await store.districtAccess.deputies();
        if (mounted) {
          setState(() {
            _deputies = deputies;
            if (deputies.length == 1) _deputyId = deputies.single.id;
          });
        }
      } on DistrictAccessException catch (error) {
        if (mounted) setState(() => _error = error.message);
      }
    });
    final now = DateTime.now();
    _start = now;
    _end = now.add(const Duration(days: 4));
  }

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _pick(bool start) async {
    final current = start ? _start : _end;
    final day = await showDatePicker(
      context: context,
      initialDate: current,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(Duration(days: widget.maxDays + 30)),
    );
    if (day == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(current),
    );
    if (time == null) return;
    final value = DateTime(
      day.year,
      day.month,
      day.day,
      time.hour,
      time.minute,
    );
    setState(() => start ? _start = value : _end = value);
  }

  void _continue() {
    final problem = !_end.isAfter(_start)
        ? 'The end time must be after the start time.'
        : _end.difference(_start) > Duration(days: widget.maxDays)
        ? 'Temporary access can last at most ${widget.maxDays} days.'
        : null;
    setState(() => _error = problem);
    if (problem != null) return;
    final deputy = _deputies!.firstWhere((d) => d.id == _deputyId);
    Navigator.of(context)
        .push<bool>(
          MaterialPageRoute(
            builder: (_) => ConfirmAccessScreen(
              deputy: deputy,
              startsAt: _start,
              expiresAt: _end,
              reason: _reason.text.trim(),
            ),
          ),
        )
        .then((given) {
          if (given == true && mounted) Navigator.of(context).pop(true);
        });
  }

  @override
  Widget build(BuildContext context) {
    final deputies = _deputies;
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Close',
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.maybePop(context),
        ),
        title: const Text('Give Temporary Access'),
      ),
      body: deputies == null && _error == null
          ? const LoadingSkeleton(label: 'Loading DDMs')
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const AccessBanner(
                  tone: AccessBannerTone.temporary,
                  child: Text(
                    'Use this when you are away. Your DDM can view all societies in your district until the end time. They cannot edit them.',
                  ),
                ),
                const SizedBox(height: 14),
                if (deputies != null && deputies.isEmpty)
                  const Text(
                    'There are no active DDM accounts in your district yet. Ask HQ to create one.',
                  )
                else if (deputies != null) ...[
                  DropdownButtonFormField<String>(
                    initialValue: _deputyId,
                    decoration: const InputDecoration(
                      labelText: 'DDM *',
                      helperText: 'Only DDMs in your district are listed.',
                    ),
                    items: [
                      for (final d in deputies)
                        DropdownMenuItem(value: d.id, child: Text(d.name)),
                    ],
                    onChanged: (value) => setState(() => _deputyId = value),
                  ),
                  const SizedBox(height: 14),
                  const InputDecorator(
                    decoration: InputDecoration(
                      labelText: 'Access',
                      suffixIcon: Icon(Icons.lock_outline, size: 16),
                    ),
                    child: Text('View only · all societies in your district'),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: _DateField(
                          label: 'Starts *',
                          value: accessDateTime(_start),
                          onTap: () => _pick(true),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _DateField(
                          label: 'Ends *',
                          value: accessDateTime(_end),
                          onTap: () => _pick(false),
                        ),
                      ),
                    ],
                  ),
                  const Padding(
                    padding: EdgeInsets.only(top: 4),
                    child: Text(
                      'Access ends on its own at this time. You can end it earlier.',
                      style: TextStyle(fontSize: 11, color: AppColors.muted),
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _reason,
                    maxLength: 1000,
                    decoration: const InputDecoration(
                      labelText: 'Reason (optional)',
                      counterText: '',
                    ),
                  ),
                ],
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(
                      _error!,
                      style: const TextStyle(
                        color: AppColors.danger,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
              ],
            ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.maybePop(context),
                  child: const Text('Cancel'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: FilledButton(
                  onPressed: _deputyId == null ? null : _continue,
                  child: const Text('Continue'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DateField extends StatelessWidget {
  const _DateField({
    required this.label,
    required this.value,
    required this.onTap,
  });
  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    child: InputDecorator(
      decoration: InputDecoration(
        labelText: label,
        suffixIcon: const Icon(Icons.calendar_today_outlined, size: 16),
      ),
      child: Text(value, style: const TextStyle(fontSize: 13)),
    ),
  );
}

/// V5 M31: check and confirm before access is given.
class ConfirmAccessScreen extends StatefulWidget {
  const ConfirmAccessScreen({
    super.key,
    required this.deputy,
    required this.startsAt,
    required this.expiresAt,
    required this.reason,
  });
  final Deputy deputy;
  final DateTime startsAt;
  final DateTime expiresAt;
  final String reason;

  @override
  State<ConfirmAccessScreen> createState() => _ConfirmAccessScreenState();
}

class _ConfirmAccessScreenState extends State<ConfirmAccessScreen> {
  bool _saving = false;
  String? _error;

  Future<void> _give() async {
    final store = DemoScope.read(context);
    final districtId = store.user?.districtIds.firstOrNull;
    if (districtId == null) {
      setState(
        () => _error = 'Your account has no district. Ask HQ to check it.',
      );
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await store.districtAccess.give(
        deputyId: widget.deputy.id,
        districtId: districtId,
        startsAt: widget.startsAt,
        expiresAt: widget.expiresAt,
        reason: widget.reason,
      );
      if (mounted) Navigator.of(context).pop(true);
    } on DistrictAccessException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final name = widget.deputy.name;
    Widget line(IconData icon, String text, Color color) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 8),
          Expanded(child: Text(text)),
        ],
      ),
    );
    return Scaffold(
      appBar: AppBar(title: const Text('Check and Confirm')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                    ),
                  ),
                  const Text(
                    'Deputy District Manager',
                    style: TextStyle(fontSize: 11.5, color: AppColors.muted),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: _Fact(
                          label: 'Starts',
                          value: accessEnds(widget.startsAt),
                        ),
                      ),
                      Expanded(
                        child: _Fact(
                          label: 'Ends',
                          value: accessEnds(widget.expiresAt),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: _Fact(
                          label: 'Length',
                          value: accessLength(
                            widget.startsAt,
                            widget.expiresAt,
                          ),
                        ),
                      ),
                      Expanded(
                        child: _Fact(
                          label: 'Reason',
                          value: widget.reason.isEmpty
                              ? 'Not given'
                              : widget.reason,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$name Will Be Able To',
                    style: const TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.leaf,
                    ),
                  ),
                  line(
                    Icons.check_circle_outline,
                    'View all societies in your district',
                    AppColors.leaf,
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'They Will Not Be Able To',
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.danger,
                    ),
                  ),
                  line(
                    Icons.close,
                    'Edit societies outside their own',
                    AppColors.muted,
                  ),
                  line(
                    Icons.close,
                    'Request grade changes for those societies',
                    AppColors.muted,
                  ),
                  line(
                    Icons.close,
                    'Give access to anyone else',
                    AppColors.muted,
                  ),
                ],
              ),
            ),
          ),
          const AccessBanner(
            tone: AccessBannerTone.edit,
            child: Text(
              'The grant, any early end and the societies opened are recorded in the access history. HQ can see it too.',
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(
                _error!,
                style: const TextStyle(
                  color: AppColors.danger,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _saving ? null : () => Navigator.maybePop(context),
                  child: const Text('Back'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: FilledButton(
                  onPressed: _saving ? null : _give,
                  child: Text(_saving ? 'Giving access…' : 'Give access'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
