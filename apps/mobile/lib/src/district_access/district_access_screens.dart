import 'package:flutter/material.dart';

import '../l10n/l10n.dart';
import '../l10n/l10n_format.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/state_views.dart';
import 'district_access_api.dart';

/// The app's own wording in the chosen language, or what the server said
/// (still English until the API messages phase).
String _message(AppLocalizations l, DistrictAccessException error) =>
    error.failure == null ? error.message : l.failure(error.failure!);

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
      if (mounted) setState(() => _error = _message(context.l10n, error));
    }
  }

  Future<void> _end(AccessGrant grant) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) {
        final l = context.l10n;
        return AlertDialog(
          title: Text(l.accessEndConfirmTitle(grant.deputyName)),
          content: Text(l.accessEndConfirmBody),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: Text(l.accessKeep),
            ),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
              onPressed: () => Navigator.pop(context, true),
              child: Text(l.accessEndNow),
            ),
          ],
        );
      },
    );
    if (ok != true || !mounted) return;
    setState(() => _ending = true);
    try {
      await DemoScope.read(context).districtAccess.end(grant.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(context.l10n.accessEndedSnack)));
      await _load();
    } on DistrictAccessException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(_message(context.l10n, error))));
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
        ..showSnackBar(SnackBar(content: Text(context.l10n.accessGivenSnack)));
      await _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
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
            Text(l.accessTitle),
            if (shown != null)
              Text(
                l.accessDistrict(shown.districtName),
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
              title: l.accessLoadError,
              message: _error!,
              primaryLabel: l.commonTryAgain,
              onPrimary: _load,
            )
          : list == null
          ? LoadingSkeleton(label: l.accessLoading)
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
                    AccessBanner(
                      tone: AccessBannerTone.viewOnly,
                      child: Text(l.accessNoneNow),
                    ),
                    const SizedBox(height: 12),
                    FilledButton.icon(
                      onPressed: _give,
                      icon: const Icon(Icons.key_outlined),
                      label: Text(l.accessGive),
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
    final l = context.l10n;
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
              _Chip(label: scheduled ? l.accessStartsLater : l.accessActive),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _Fact(
                  label: scheduled ? l.accessStarts : l.accessViewOnlySince,
                  value: l.accessDateTime(grant.startsAt),
                ),
              ),
              Expanded(
                child: _Fact(
                  label: l.accessEnds,
                  value: l.accessDateTime(grant.expiresAt),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            scheduled
                ? l.accessStartsAt(l.accessEndsAt(grant.startsAt))
                : l.accessTimeLeft(grant.expiresAt, now),
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5),
          ),
          Text(
            l.accessGrantLine(
              grant.societyCount,
              grant.districtName,
              grant.societiesOpened,
            ),
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
            label: Text(ending ? l.accessEnding : l.accessEndNow),
          ),
        ],
      ),
    );
  }
}

class _HistoryCard extends StatelessWidget {
  const _HistoryCard({required this.events});
  final List<AccessEvent> events;

  String _title(AppLocalizations l, AccessEvent event) => switch (event.kind) {
    AccessEventKind.given => l.accessEventGiven,
    AccessEventKind.started => l.accessEventStarted,
    AccessEventKind.opened =>
      event.societyName == null
          ? l.accessEventOpenedUnnamed
          : l.accessEventOpened(event.societyName!),
    AccessEventKind.ended => l.accessEventEnded,
    AccessEventKind.endedEarly => l.accessEventEndedEarly,
  };

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  l.accessHistory,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              Text(
                l.accessRecorded,
                style: const TextStyle(fontSize: 11, color: AppColors.muted),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (events.isEmpty)
            Text(
              l.accessNothingRecorded,
              style: const TextStyle(fontSize: 12, color: AppColors.muted),
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
                          _title(l, event),
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 12.5,
                          ),
                        ),
                        Text(
                          [
                            if (event.actorName != null) event.actorName!,
                            l.accessDateTime(event.at),
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
}

class _EarlierGrants extends StatelessWidget {
  const _EarlierGrants({required this.grants});
  final List<AccessGrant> grants;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          l.accessEarlier,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        for (final grant in grants)
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(grant.deputyName),
            subtitle: Text(
              '${l.accessDateTime(grant.startsAt)} → ${l.accessDateTime(grant.expiresAt)}',
            ),
            trailing: _Chip(
              label: switch (grant.status) {
                AccessStatus.endedEarly =>
                  grant.endedEarlyByName == null
                      ? l.accessEndedEarly
                      : l.accessEndedEarlyBy(grant.endedEarlyByName!),
                AccessStatus.ended => l.accessEndedOnItsOwn,
                AccessStatus.scheduled => l.accessStartsLater,
                AccessStatus.active => l.accessActive,
              },
            ),
          ),
      ],
    );
  }
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
        if (mounted) setState(() => _error = _message(context.l10n, error));
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
    final l = context.l10n;
    final problem = !_end.isAfter(_start)
        ? l.accessErrorEndBeforeStart
        : _end.difference(_start) > Duration(days: widget.maxDays)
        ? l.accessErrorTooLong(widget.maxDays)
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
    final l = context.l10n;
    final deputies = _deputies;
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: l.commonClose,
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.maybePop(context),
        ),
        title: Text(l.accessGiveTitle),
      ),
      body: deputies == null && _error == null
          ? LoadingSkeleton(label: l.accessLoadingDeputies)
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                AccessBanner(
                  tone: AccessBannerTone.temporary,
                  child: Text(l.accessGiveIntro),
                ),
                const SizedBox(height: 14),
                if (deputies != null && deputies.isEmpty)
                  Text(l.accessNoDeputies)
                else if (deputies != null) ...[
                  DropdownButtonFormField<String>(
                    // Longer Sinhala and Tamil text wraps instead of overflowing.
                    isExpanded: true,
                    initialValue: _deputyId,
                    decoration: InputDecoration(
                      labelText: 'DDM *',
                      helperText: l.accessDeputyHelp,
                    ),
                    items: [
                      for (final d in deputies)
                        DropdownMenuItem(value: d.id, child: Text(d.name)),
                    ],
                    onChanged: (value) => setState(() => _deputyId = value),
                  ),
                  const SizedBox(height: 14),
                  InputDecorator(
                    decoration: InputDecoration(
                      labelText: l.accessScopeField,
                      suffixIcon: const Icon(Icons.lock_outline, size: 16),
                    ),
                    child: Text(l.accessScopeValue),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: _DateField(
                          label: l.accessStartsField,
                          value: l.accessDateTime(_start),
                          onTap: () => _pick(true),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _DateField(
                          label: l.accessEndsField,
                          value: l.accessDateTime(_end),
                          onTap: () => _pick(false),
                        ),
                      ),
                    ],
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      l.accessEndsHelp,
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.muted,
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _reason,
                    maxLength: 1000,
                    decoration: InputDecoration(
                      labelText: l.accessReasonField,
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
                  child: Text(l.commonCancel),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: FilledButton(
                  onPressed: _deputyId == null ? null : _continue,
                  child: Text(l.commonContinue),
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
      setState(() => _error = context.l10n.accessNoDistrict);
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
      if (mounted) setState(() => _error = _message(context.l10n, error));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
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
      appBar: AppBar(title: Text(l.accessConfirmTitle)),
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
                  Text(
                    l.accessDeputyRole,
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: AppColors.muted,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: _Fact(
                          label: l.accessStarts,
                          value: l.accessEndsAt(widget.startsAt),
                        ),
                      ),
                      Expanded(
                        child: _Fact(
                          label: l.accessEnds,
                          value: l.accessEndsAt(widget.expiresAt),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: _Fact(
                          label: l.accessLength,
                          value: l.accessDuration(
                            widget.startsAt,
                            widget.expiresAt,
                          ),
                        ),
                      ),
                      Expanded(
                        child: _Fact(
                          label: l.accessReason,
                          value: widget.reason.isEmpty
                              ? l.accessReasonNone
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
                    l.accessWillBeAbleTo(name),
                    style: const TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.leaf,
                    ),
                  ),
                  line(
                    Icons.check_circle_outline,
                    l.accessCanView,
                    AppColors.leaf,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    l.accessWillNotBeAbleTo,
                    style: const TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.danger,
                    ),
                  ),
                  line(Icons.close, l.accessCannotEdit, AppColors.muted),
                  line(Icons.close, l.accessCannotRequest, AppColors.muted),
                  line(Icons.close, l.accessCannotShare, AppColors.muted),
                ],
              ),
            ),
          ),
          AccessBanner(
            tone: AccessBannerTone.edit,
            child: Text(l.accessRecordedNote),
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
                  child: Text(l.commonBack),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: FilledButton(
                  onPressed: _saving ? null : _give,
                  child: Text(_saving ? l.accessGiving : l.accessGiveButton),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
