import 'dart:math';

import 'package:flutter/material.dart';

import '../district_access/access_format.dart';
import '../society_record/society_record_models.dart' show PickedDocument;
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/state_views.dart';
import 'incident_api.dart';
import 'incident_format.dart';

/// Tells the person the figures are fictional sample data (demo mode only).
class _SampleLabel extends StatelessWidget {
  const _SampleLabel();

  @override
  Widget build(BuildContext context) => DemoStore.demoMode
      ? const Padding(
          padding: EdgeInsets.only(bottom: 10),
          child: Text(
            'Sample data · fictional incident for demonstration',
            style: TextStyle(fontSize: 11, color: AppColors.muted),
          ),
        )
      : const SizedBox.shrink();
}

class _Card extends StatelessWidget {
  const _Card({required this.child, this.padding = 14});
  final Widget child;
  final double padding;

  // Material, so list tiles inside show their ink.
  @override
  Widget build(BuildContext context) => Material(
    color: AppColors.surface,
    shape: RoundedRectangleBorder(
      side: const BorderSide(color: AppColors.line),
      borderRadius: BorderRadius.circular(14),
    ),
    child: Padding(padding: EdgeInsets.all(padding), child: child),
  );
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(2, 16, 2, 8),
    child: Text(
      text.toUpperCase(),
      style: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.8,
        color: AppColors.muted,
      ),
    ),
  );
}

/// A status badge with a dot. Statuses are badges, never bars.
class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.label, required this.tone});
  final String label;
  final ({Color background, Color foreground}) tone;

  static const blue = (
    background: Color(0xFFE6EEF8),
    foreground: Color(0xFF24476B),
  );
  static const amber = (
    background: AppColors.warningSoft,
    foreground: AppColors.warning,
  );
  static const green = (
    background: AppColors.bannerEditBg,
    foreground: AppColors.bannerEditText,
  );
  static const red = (
    background: AppColors.dangerSoft,
    foreground: AppColors.danger,
  );

  static StatusBadge helper(HelperStatus status) => StatusBadge(
    label: helperStatusLabels[status]!,
    tone: switch (status) {
      HelperStatus.assigned => blue,
      HelperStatus.inProgress => amber,
      HelperStatus.delivered => green,
    },
  );

  static StatusBadge action(ActionState state) => StatusBadge(
    label: state == ActionState.delivered ? 'Done' : actionStateLabels[state]!,
    tone: switch (state) {
      ActionState.needed => red,
      ActionState.assigned => blue,
      ActionState.inProgress => amber,
      ActionState.delivered => green,
    },
  );

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(
      color: tone.background,
      borderRadius: BorderRadius.circular(999),
    ),
    child: Text(
      '● $label',
      style: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        color: tone.foreground,
      ),
    ),
  );
}

/// The red strip on incident screens: "INC-2026-09 · Floods — North Western · disaster record".
class _IncidentStrip extends StatelessWidget {
  const _IncidentStrip(this.incident);
  final IncidentSummary incident;

  @override
  Widget build(BuildContext context) => Container(
    color: AppColors.danger,
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
    child: Row(
      children: [
        const Icon(Icons.warning_amber_rounded, size: 16, color: Colors.white),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            '${incident.reference} · ${incident.title} · disaster record',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    ),
  );
}

class _TitledBar extends StatelessWidget implements PreferredSizeWidget {
  const _TitledBar({
    required this.title,
    this.subtitle,
    this.close = false,
    this.actions,
  });
  final String title;
  final String? subtitle;
  final bool close;
  final List<Widget>? actions;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight + 8);

  @override
  Widget build(BuildContext context) => AppBar(
    leading: close
        ? IconButton(
            tooltip: 'Close',
            icon: const Icon(Icons.close),
            onPressed: () => Navigator.of(context).maybePop(),
          )
        : null,
    title: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title),
        if (subtitle != null)
          Text(
            subtitle!,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w400),
          ),
      ],
    ),
    actions: actions,
  );
}

/// V5 M40: the red card on the home screen while an incident is live.
class ActiveIncidentCard extends StatelessWidget {
  const ActiveIncidentCard({
    super.key,
    required this.incident,
    required this.now,
    required this.onStart,
    this.onOpen,
  });
  final IncidentSummary incident;
  final DateTime now;
  final VoidCallback? onStart;
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context) {
    final due = incident.assessmentsDueAt;
    return Semantics(
      container: true,
      liveRegion: true,
      child: InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.danger,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(
                      Icons.warning_amber_rounded,
                      color: Colors.white,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'ACTIVE INCIDENT · ${incident.reference}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10.5,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.6,
                          ),
                        ),
                        Text(
                          incident.title,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text.rich(
                          TextSpan(
                            text:
                                'Opened by ${openedByLine(incident)} · ${accessDateTime(incident.openedAt)}',
                            children: [
                              if (due != null) ...[
                                const TextSpan(
                                  text: ' Send a rapid assessment by ',
                                ),
                                TextSpan(
                                  text: accessEnds(due),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                TextSpan(
                                  text: ' · ${accessTimeLeft(due, now)}.',
                                ),
                              ],
                            ],
                          ),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            height: 1.35,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              if (onStart != null) ...[
                const SizedBox(height: 12),
                FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: AppColors.danger,
                    minimumSize: const Size.fromHeight(44),
                  ),
                  onPressed: onStart,
                  icon: const Icon(Icons.checklist, size: 18),
                  label: const Text('Start rapid assessment'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

String _helpersLine(ResponseAction action) {
  if (action.helpers.isEmpty) return 'No helper yet';
  final names = action.helpers.map((h) => h.society.name).join(' and ');
  if (action.state == ActionState.inProgress) {
    return '$names helping · ${action.delivered} of ${action.quantity}';
  }
  if (action.state == ActionState.delivered) return '$names · delivered';
  return '$names helping · ${action.delivered} of ${quantityLine(action.quantity, action.unit)}';
}

IconData _needIcon(String need) => switch (need) {
  'DRINKING_WATER' => Icons.water_drop_outlined,
  'DRY_RATIONS' => Icons.local_shipping_outlined,
  'TEMPORARY_SHELTER' => Icons.home_outlined,
  'VOLUNTEERS' => Icons.person_outline,
  'MEDICAL_HELP' => Icons.medical_services_outlined,
  _ => Icons.inventory_2_outlined,
};

/// One response action row (M40, M45): what, how much, who helps, and its badge.
class _ActionRow extends StatelessWidget {
  const _ActionRow({required this.action, required this.subtitle});
  final ResponseAction action;
  final String subtitle;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 10),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(_needIcon(action.need), size: 18, color: AppColors.inkSoft),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${action.title} · ${quantityLine(action.quantity, action.unit)}',
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 13.5,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: const TextStyle(fontSize: 12, color: AppColors.muted),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        StatusBadge.action(action.state),
      ],
    ),
  );
}

/// V5 M40 on the home screens: the live incident and what HQ has arranged.
/// Shows nothing when no incident covers the user's societies.
class IncidentHomeSection extends StatefulWidget {
  const IncidentHomeSection({super.key, this.societyId});

  /// The Society Officer's own society, for "Response actions for your society".
  final String? societyId;

  @override
  State<IncidentHomeSection> createState() => _IncidentHomeSectionState();
}

class _IncidentHomeSectionState extends State<IncidentHomeSection> {
  IncidentDetail? _detail;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final api = DemoScope.read(context).incidents;
    try {
      final active = await api.active();
      final detail = active.isEmpty ? null : await api.detail(active.first.id);
      if (mounted) setState(() => _detail = detail);
    } on IncidentException {
      // The home still works without the incident card; the Incident tab shows the error.
    }
  }

  @override
  Widget build(BuildContext context) {
    final detail = _detail;
    if (detail == null) return const SizedBox.shrink();
    final store = DemoScope.of(context);
    final mine = widget.societyId == null
        ? const <ResponseAction>[]
        : detail.forSociety(widget.societyId!);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ActiveIncidentCard(
          incident: detail.incident,
          now: store.now,
          onOpen: () => openIncident(context, detail.incident.id),
          onStart: detail.canAssess
              ? () => startAssessment(
                  context,
                  detail,
                  societyId: widget.societyId,
                )
              : null,
        ),
        if (mine.isNotEmpty) ...[
          const _SectionLabel('Response actions for your society'),
          _Card(
            padding: 12,
            child: Column(
              children: [
                for (final (index, action) in mine.indexed) ...[
                  if (index > 0) const Divider(height: 1),
                  _ActionRow(action: action, subtitle: _helpersLine(action)),
                ],
              ],
            ),
          ),
        ],
        const SizedBox(height: 12),
      ],
    );
  }
}

Future<void> openIncident(BuildContext context, String id) => Navigator.of(
  context,
).push<void>(MaterialPageRoute(builder: (_) => IncidentScreen(incidentId: id)));

Future<bool?> startAssessment(
  BuildContext context,
  IncidentDetail detail, {
  String? societyId,
}) => Navigator.of(context).push<bool>(
  MaterialPageRoute(
    builder: (_) => RapidAssessmentScreen(
      incident: detail.incident,
      societies: detail.assessableSocieties,
      initialSocietyId: societyId,
    ),
  ),
);

/// The Incident tab: live incidents covering the user's societies, incident
/// notifications (M48n, in the app) and "Report an incident" (M48).
class IncidentsScreen extends StatefulWidget {
  const IncidentsScreen({super.key});

  @override
  State<IncidentsScreen> createState() => _IncidentsScreenState();
}

class _IncidentsScreenState extends State<IncidentsScreen> {
  List<IncidentSummary>? _incidents;
  List<IncidentNotification> _alerts = const [];
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final api = DemoScope.read(context).incidents;
    setState(() => _error = null);
    try {
      final incidents = await api.active();
      final alerts = await api.notifications().catchError(
        (_) => const <IncidentNotification>[],
      );
      if (mounted) {
        setState(() {
          _incidents = incidents;
          _alerts = alerts;
        });
      }
    } on IncidentException catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  Future<void> _report() async {
    final id = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const ReportIncidentScreen()),
    );
    if (id != null && mounted) {
      await _load();
      if (mounted) await openIncident(context, id);
    }
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final incidents = _incidents;
    return Scaffold(
      appBar: const _TitledBar(
        title: 'Disaster response',
        subtitle: 'Live incidents for your societies',
      ),
      body: _error != null
          ? StateMessage(
              icon: Icons.error_outline,
              tone: StateTone.error,
              isAlert: true,
              title: "Couldn't load incidents",
              message: _error!,
              primaryLabel: 'Try again',
              onPrimary: _load,
            )
          : incidents == null
          ? const LoadingSkeleton(label: 'Loading incidents')
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const _SampleLabel(),
                  if (incidents.isEmpty)
                    const _Card(
                      child: Text(
                        'No live incidents cover your societies. If something has happened, report it so the people covering the area are told straight away.',
                        style: TextStyle(fontSize: 13, height: 1.4),
                      ),
                    ),
                  for (final incident in incidents) ...[
                    ActiveIncidentCard(
                      incident: incident,
                      now: store.now,
                      onOpen: () => openIncident(context, incident.id),
                      onStart: null,
                    ),
                    const SizedBox(height: 10),
                  ],
                  const SizedBox(height: 6),
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.danger,
                      side: const BorderSide(
                        color: AppColors.bannerIncidentLine,
                      ),
                      minimumSize: const Size.fromHeight(46),
                    ),
                    onPressed: _report,
                    icon: const Icon(Icons.add),
                    label: const Text('Report an incident'),
                  ),
                  if (_alerts.isNotEmpty) ...[
                    const _SectionLabel('Incident notifications'),
                    for (final alert in _alerts)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: _Card(
                          padding: 12,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Icon(
                                    Icons.warning_amber_rounded,
                                    size: 14,
                                    color: AppColors.muted,
                                  ),
                                  const SizedBox(width: 6),
                                  const Expanded(
                                    child: Text(
                                      'SARVODAYA CONNECT',
                                      style: TextStyle(
                                        fontSize: 10.5,
                                        color: AppColors.muted,
                                        letterSpacing: 0.4,
                                      ),
                                    ),
                                  ),
                                  Text(
                                    accessDateTime(alert.at),
                                    style: const TextStyle(
                                      fontSize: 10.5,
                                      color: AppColors.muted,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                alert.title,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13.5,
                                ),
                              ),
                              if (alert.body.isNotEmpty)
                                Text(
                                  alert.body,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.inkBody,
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    const Text(
                      'Incident notifications go to everyone whose societies are in the incident area, and to HQ.',
                      style: TextStyle(fontSize: 11, color: AppColors.muted),
                    ),
                  ],
                ],
              ),
            ),
    );
  }
}

/// V5 M49 (with the incident's own page behind it): who opened it, how many
/// societies sent assessments, the user's response actions, the situation
/// report and "Close incident".
class IncidentScreen extends StatefulWidget {
  const IncidentScreen({super.key, required this.incidentId});
  final String incidentId;

  @override
  State<IncidentScreen> createState() => _IncidentScreenState();
}

class _IncidentScreenState extends State<IncidentScreen> {
  IncidentDetail? _detail;
  String? _error;
  bool _closing = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final detail = await DemoScope.read(context).incidents
          .detail(widget.incidentId);
      if (mounted) setState(() => _detail = detail);
    } on IncidentException catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  Future<void> _close(IncidentDetail detail) async {
    final store = DemoScope.read(context);
    final user = store.user;
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        title: const Text('Close this incident?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Everyone covering the area is told it is closed. Your name and the time are recorded. You can\'t undo this from the phone.',
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: _Fact(
                      label: 'Closed by',
                      value: user?.displayName ?? 'You',
                    ),
                  ),
                  Expanded(
                    child: _Fact(
                      label: 'When',
                      value: 'Now · ${accessDateTime(store.now)}',
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actionsOverflowDirection: VerticalDirection.down,
        actionsOverflowButtonSpacing: 8,
        actions: [
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.danger,
              minimumSize: const Size.fromHeight(46),
            ),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Close incident'),
          ),
          OutlinedButton(
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(46),
            ),
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Keep open'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    setState(() => _closing = true);
    try {
      await store.incidents.close(detail.incident.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            content: Text(
              'Incident closed. Your name and the time are recorded.',
            ),
          ),
        );
      await _load();
    } on IncidentException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) setState(() => _closing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final detail = _detail;
    final store = DemoScope.of(context);
    final mySocieties = store.user?.societyIds ?? const <String>[];
    final helping = detail == null
        ? const <ResponseAction>[]
        : detail.actions
              .where((a) => a.helpers.any((h) => h.canUpdate))
              .toList();
    // Response actions for the societies the user looks after (M45).
    final ownSocieties = detail == null
        ? const <SocietyRef>[]
        : {
            for (final a in detail.actions)
              if (a.forSociety != null &&
                  (mySocieties.contains(a.forSociety!.id) ||
                      detail.assessableSocieties.any(
                        (s) => s.id == a.forSociety!.id,
                      )))
                a.forSociety!.id: a.forSociety!,
          }.values.toList();
    return Scaffold(
      appBar: _TitledBar(
        title: 'Incident',
        subtitle: detail == null
            ? null
            : '${detail.incident.reference} · ${detail.incident.title}',
        actions: [
          if (detail != null)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(
                child: detail.incident.isClosed
                    ? const StatusBadge(
                        label: 'Closed',
                        tone: (
                          background: AppColors.stateGrey,
                          foreground: AppColors.inkSoft,
                        ),
                      )
                    : const StatusBadge(label: 'Active', tone: StatusBadge.red),
              ),
            ),
        ],
      ),
      body: _error != null
          ? StateMessage(
              icon: Icons.lock_outline,
              tone: StateTone.noAccess,
              title: "Can't open this incident",
              message: _error!,
              primaryLabel: 'Try again',
              onPrimary: _load,
            )
          : detail == null
          ? const LoadingSkeleton(label: 'Loading the incident')
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const _SampleLabel(),
                  _Card(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: _Fact(
                                label: 'Opened by',
                                value: detail.incident.openedByName ?? '—',
                              ),
                            ),
                            Expanded(
                              child: _Fact(
                                label: 'Opened',
                                value: accessDateTime(detail.incident.openedAt),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: _Fact(
                                label: 'Assessed',
                                value:
                                    '${detail.incident.assessed} of ${detail.incident.societiesInArea}',
                              ),
                            ),
                            Expanded(
                              child: _Fact(
                                label: 'Actions',
                                value: '${detail.totals.actions}',
                              ),
                            ),
                          ],
                        ),
                        if (detail.incident.isClosed) ...[
                          const SizedBox(height: 10),
                          _Fact(
                            label: 'Closed',
                            value:
                                '${detail.incident.closedByName ?? 'Someone'} · ${accessDateTime(detail.incident.closedAt!)}',
                          ),
                        ] else if (dueLine(detail.incident, store.now)
                            case final due?) ...[
                          const SizedBox(height: 10),
                          _Fact(label: 'Assessments due', value: due),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (detail.canAssess)
                    FilledButton.icon(
                      style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(46),
                      ),
                      onPressed: () async {
                        final sent = await startAssessment(context, detail);
                        if (sent == true) await _load();
                      },
                      icon: const Icon(Icons.checklist),
                      label: const Text('Start rapid assessment'),
                    ),
                  for (final society in ownSocieties)
                    _LinkTile(
                      icon: Icons.inventory_2_outlined,
                      title: 'Response actions',
                      subtitle: society.name,
                      onTap: () => Navigator.of(context).push<void>(
                        MaterialPageRoute(
                          builder: (_) => SocietyActionsScreen(
                            detail: detail,
                            society: society,
                          ),
                        ),
                      ),
                    ),
                  if (helping.isNotEmpty)
                    _LinkTile(
                      icon: Icons.volunteer_activism_outlined,
                      title: 'Helping another society',
                      subtitle:
                          '${helping.length} ${helping.length == 1 ? 'request' : 'requests'} from HQ',
                      onTap: () async {
                        await Navigator.of(context).push<void>(
                          MaterialPageRoute(
                            builder: (_) => HelpingScreen(detail: detail),
                          ),
                        );
                        await _load();
                      },
                    ),
                  if (detail.reports.isNotEmpty)
                    _LinkTile(
                      icon: Icons.description_outlined,
                      title: 'Situation report',
                      subtitle:
                          'Report ${detail.reports.first.number} · ${accessDateTime(detail.reports.first.asOf)}',
                      onTap: () => Navigator.of(context).push<void>(
                        MaterialPageRoute(
                          builder: (_) => SituationReportScreen(
                            reportId: detail.reports.first.id,
                          ),
                        ),
                      ),
                    ),
                  if (detail.canClose) ...[
                    const SizedBox(height: 16),
                    OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.danger,
                        side: const BorderSide(
                          color: AppColors.bannerIncidentLine,
                        ),
                        minimumSize: const Size.fromHeight(46),
                      ),
                      onPressed: _closing ? null : () => _close(detail),
                      child: Text(_closing ? 'Closing…' : 'Close incident'),
                    ),
                  ],
                ],
              ),
            ),
    );
  }
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

class _LinkTile extends StatelessWidget {
  const _LinkTile({
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
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 10),
    child: Material(
      color: AppColors.surface,
      shape: RoundedRectangleBorder(
        side: const BorderSide(color: AppColors.line),
        borderRadius: BorderRadius.circular(14),
      ),
      child: ListTile(
        leading: Icon(icon, color: AppColors.inkSoft),
        title: Text(
          title,
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
        ),
        subtitle: Text(subtitle, style: const TextStyle(fontSize: 12)),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    ),
  );
}

/// − 6 + : whole numbers only, never below zero.
class _Stepper extends StatelessWidget {
  const _Stepper({
    required this.label,
    required this.value,
    required this.onChanged,
    this.detail,
  });
  final String label;
  final String? detail;
  final int value;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 13.5,
                ),
              ),
              if (detail != null)
                Text(
                  detail!,
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: AppColors.muted,
                  ),
                ),
            ],
          ),
        ),
        Container(
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.line),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              IconButton(
                tooltip: 'Fewer: $label',
                visualDensity: VisualDensity.compact,
                onPressed: value == 0 ? null : () => onChanged(value - 1),
                icon: const Icon(Icons.remove, size: 18),
              ),
              SizedBox(
                width: 44,
                child: Text(
                  '$value',
                  textAlign: TextAlign.center,
                  semanticsLabel: '$label: $value',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              IconButton(
                tooltip: 'More: $label',
                visualDensity: VisualDensity.compact,
                onPressed: () => onChanged(min(1000000, value + 1)),
                icon: const Icon(Icons.add, size: 18),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _Choice extends StatelessWidget {
  const _Choice({
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Material(
      color: selected ? AppColors.mintSoft : AppColors.surface,
      shape: RoundedRectangleBorder(
        side: BorderSide(
          color: selected ? AppColors.leaf : AppColors.line,
          width: selected ? 1.5 : 1,
        ),
        borderRadius: BorderRadius.circular(12),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              Icon(
                selected ? Icons.check_circle : Icons.circle_outlined,
                size: 18,
                color: selected ? AppColors.leaf : AppColors.muted,
              ),
              const SizedBox(width: 10),
              Text(
                label,
                style: TextStyle(
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

String _newClientMutationId() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

/// V5 M41–M43: a rapid assessment, one question at a time, then "Check before
/// sending" and "Assessment sent". The answers stay on this screen until they
/// are sent; they are never saved for later or sent offline.
class RapidAssessmentScreen extends StatefulWidget {
  const RapidAssessmentScreen({
    super.key,
    required this.incident,
    required this.societies,
    this.initialSocietyId,
  });
  final IncidentSummary incident;
  final List<SocietyRef> societies;
  final String? initialSocietyId;

  @override
  State<RapidAssessmentScreen> createState() => _RapidAssessmentScreenState();
}

class _RapidAssessmentScreenState extends State<RapidAssessmentScreen> {
  final _answers = AssessmentAnswers();
  late final _note = TextEditingController();
  // One id per assessment: sending again after a dropped connection is safe.
  final _clientMutationId = _newClientMutationId();
  late String? _societyId =
      widget.societies.any((s) => s.id == widget.initialSocietyId)
      ? widget.initialSocietyId
      : widget.societies.length == 1
      ? widget.societies.single.id
      : null;
  int _step = 0;
  bool _sending = false;
  String? _error;
  List<AssessmentUpdate>? _sent;
  String _status = '';

  static const _questions = 10;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  SocietyRef? get _society =>
      widget.societies.where((s) => s.id == _societyId).firstOrNull;

  Future<void> _addPhoto() async {
    final picked = await DemoScope.read(context).documentPicker.pick();
    if (picked == null || !mounted) return;
    if (picked.sizeBytes > 10000000) {
      setState(() => _error = 'Choose a photo or PDF of 10 MB or less.');
      return;
    }
    setState(() {
      _error = null;
      _answers.photos.add(picked);
    });
  }

  Future<void> _send() async {
    final society = _society;
    if (society == null) return;
    final api = DemoScope.read(context).incidents;
    _answers.note = _note.text;
    setState(() {
      _sending = true;
      _error = null;
      _status = 'Sending…';
    });
    try {
      final id = await api.sendAssessment(
        widget.incident.id,
        society.id,
        _clientMutationId,
        _answers,
      );
      var failed = 0;
      for (final (index, photo) in _answers.photos.indexed) {
        setState(
          () => _status =
              'Adding photo ${index + 1} of ${_answers.photos.length}…',
        );
        try {
          await api.addPhoto(id, photo);
        } on IncidentException {
          failed++;
        }
      }
      final updates = await api.updates(widget.incident.id, society.id);
      if (!mounted) return;
      setState(() {
        _sent = updates;
        _status = failed == 0
            ? ''
            : '$failed ${failed == 1 ? 'photo' : 'photos'} could not be added. Send them with the next update.';
      });
    } on IncidentException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Widget _question() {
    final a = _answers;
    void set(VoidCallback change) => setState(change);
    return switch (_step) {
      0 => Column(
        children: [
          for (final impact in impactLabels.keys)
            _Choice(
              label: impactLabels[impact]!,
              selected: a.impact == impact,
              onTap: () => set(() => a.impact = impact),
            ),
        ],
      ),
      1 => _Stepper(
        label: 'Families affected',
        value: a.families,
        onChanged: (v) => set(() => a.families = v),
      ),
      2 => _Stepper(
        label: 'People affected',
        value: a.people,
        onChanged: (v) => set(() => a.people = v),
      ),
      3 => _Stepper(
        label: 'Injured',
        value: a.injured,
        onChanged: (v) => set(() => a.injured = v),
      ),
      4 => _Card(
        padding: 6,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: _Stepper(
                label: 'Fully damaged',
                detail: 'Cannot be lived in',
                value: a.housesFully,
                onChanged: (v) => set(() => a.housesFully = v),
              ),
            ),
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: _Stepper(
                label: 'Partly damaged',
                detail: 'Can be lived in after repair',
                value: a.housesPartly,
                onChanged: (v) => set(() => a.housesPartly = v),
              ),
            ),
          ],
        ),
      ),
      5 => _Stepper(
        label: 'In safety centres',
        value: a.displaced,
        onChanged: (v) => set(() => a.displaced = v),
      ),
      6 => Column(
        children: [
          for (final road in roadLabels.keys)
            _Choice(
              label: roadLabels[road]!,
              selected: a.roadAccess == road,
              onTap: () => set(() => a.roadAccess = road),
            ),
        ],
      ),
      7 => Column(
        children: [
          for (final need in needLabels.keys)
            _Choice(
              label: needLabels[need]!,
              selected: a.needs.contains(need),
              onTap: () => set(
                () => a.needs.contains(need)
                    ? a.needs.remove(need)
                    : a.needs.add(need),
              ),
            ),
        ],
      ),
      8 => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final (index, _) in a.photos.indexed)
                InputChip(
                  avatar: const Icon(Icons.image_outlined, size: 18),
                  label: Text('Photo ${index + 1}'),
                  onDeleted: () => set(() => a.photos.removeAt(index)),
                ),
              if (a.photos.length < 10)
                OutlinedButton.icon(
                  onPressed: _addPhoto,
                  icon: const Icon(Icons.add_a_photo_outlined),
                  label: const Text('Add a photo'),
                ),
            ],
          ),
        ],
      ),
      _ => const SizedBox.shrink(),
    };
  }

  static const _titles = [
    ('Is the society affected?', "Choose how the society's village is now."),
    (
      'How many families are affected?',
      "Count families in the society's village only. Give your best estimate.",
    ),
    ('How many people are affected?', 'Everyone in the affected families.'),
    ('How many people are injured?', 'Numbers only. Never names.'),
    (
      'How many houses were damaged?',
      "Count houses in the society's village only. Give your best estimate.",
    ),
    (
      'How many people are in safety centres?',
      'People who had to leave their homes.',
    ),
    ('Can vehicles reach the village?', 'Road access now.'),
    (
      'What is most urgently needed?',
      'Choose all that apply. Items, people or tasks only — no money.',
    ),
    (
      'Add photos (optional)',
      "PDF, JPG or PNG, up to 10 MB each. Don't photograph faces or documents.",
    ),
    (
      'Anything else HQ should know?',
      'Optional. Do not include names or NIC numbers.',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final society = _society;
    final subtitle =
        '${society?.name ?? 'Choose a society'} · ${widget.incident.reference}';
    if (_sent != null) return _sentView(subtitle);
    final reviewing = _step == _questions;
    return Scaffold(
      appBar: _TitledBar(
        title: reviewing ? 'Check before sending' : 'Rapid assessment',
        subtitle: subtitle,
        close: !reviewing,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_step == 0 && widget.societies.length > 1) ...[
            DropdownButtonFormField<String>(
              isExpanded: true,
              initialValue: _societyId,
              decoration: const InputDecoration(labelText: 'Society *'),
              items: [
                for (final s in widget.societies)
                  DropdownMenuItem(
                    value: s.id,
                    child: Text('${s.name} · ${s.code}'),
                  ),
              ],
              onChanged: (value) => setState(() => _societyId = value),
            ),
            const SizedBox(height: 12),
          ],
          if (reviewing)
            ..._review()
          else ...[
            Text(
              'QUESTION ${_step + 1} OF $_questions',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.8,
                color: AppColors.muted,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              _titles[_step].$1,
              style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            Text(
              _titles[_step].$2,
              style: const TextStyle(fontSize: 12.5, color: AppColors.inkBody),
            ),
            const SizedBox(height: 12),
            _question(),
            const SizedBox(height: 12),
            TextField(
              controller: _note,
              maxLength: 1000,
              decoration: const InputDecoration(labelText: 'Note (optional)'),
            ),
            const NoticeBanner(
              icon: Icons.info_outline,
              title: 'This is a disaster record. It does not change the society record (members, Exco or plan).',
              tone: NoticeTone.info,
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 12),
            NoticeBanner(
              icon: Icons.error_outline,
              title: _error!,
              tone: NoticeTone.error,
            ),
          ],
          if (_status.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(_status, style: const TextStyle(fontWeight: FontWeight.w600)),
          ],
        ],
      ),
      bottomNavigationBar: BottomActionBar(
        secondary: OutlinedButton(
          onPressed: _sending
              ? null
              : _step == 0
              ? () => Navigator.of(context).maybePop()
              : () => setState(() => _step--),
          child: Text(_step == 0 ? 'Cancel' : 'Back'),
        ),
        primary: FilledButton(
          onPressed: society == null || _sending
              ? null
              : reviewing
              ? _send
              : () => setState(() => _step++),
          child: Text(
            reviewing
                ? (_sending ? 'Sending…' : 'Send assessment')
                : _step == _questions - 1
                ? 'Check answers'
                : 'Next',
          ),
        ),
      ),
    );
  }

  List<Widget> _review() {
    final a = _answers;
    final rows = [
      ('What happened', incidentTypeLabels[widget.incident.type] ?? 'Incident'),
      ('Society', impactLabels[a.impact]!),
      ('Families affected', '${a.families}'),
      ('People affected', '${a.people}'),
      ('Houses fully / partly damaged', '${a.housesFully} / ${a.housesPartly}'),
      ('Injured', '${a.injured}'),
      ('In safety centres', '${a.displaced}'),
      ('Road access', roadLabels[a.roadAccess]!),
      (
        'Most urgent needs',
        a.needs.isEmpty ? 'None' : a.needs.map((n) => needLabels[n]).join(', '),
      ),
      ('Photos', '${a.photos.length}'),
    ];
    return [
      _Card(
        padding: 0,
        child: Column(
          children: [
            for (final (index, row) in rows.indexed) ...[
              if (index > 0) const Divider(height: 1),
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 11,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        row.$1,
                        style: const TextStyle(
                          fontSize: 12.5,
                          color: AppColors.inkBody,
                        ),
                      ),
                    ),
                    Flexible(
                      child: Text(
                        row.$2,
                        textAlign: TextAlign.right,
                        style: const TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                        ),
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
      const NoticeBanner(
        icon: Icons.info_outline,
        title: 'Only counts are sent — no names or NIC numbers of affected families.',
        tone: NoticeTone.warning,
      ),
      CheckboxListTile(
        contentPadding: EdgeInsets.zero,
        controlAffinity: ListTileControlAffinity.leading,
        value: a.confirmedWithPresident,
        onChanged: (value) =>
            setState(() => a.confirmedWithPresident = value ?? false),
        title: const Text(
          'I checked these answers with the society President.',
          style: TextStyle(fontSize: 13),
        ),
      ),
    ];
  }

  Widget _sentView(String subtitle) {
    final updates = _sent!;
    final latest = updates.isEmpty ? null : updates.first;
    return Scaffold(
      appBar: _TitledBar(
        title: 'Rapid assessment',
        subtitle: subtitle,
        close: true,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const SizedBox(height: 16),
          const Center(
            child: CircleAvatar(
              radius: 24,
              backgroundColor: AppColors.navIndicator,
              child: Icon(Icons.check_circle_outline, color: AppColors.forest),
            ),
          ),
          const SizedBox(height: 10),
          const Text(
            'Assessment sent',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text(
            'Received${latest == null ? '' : ' at ${accessDateTime(latest.sentAt)}'}. HQ and everyone following ${widget.incident.reference} can see it in the live incident.',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 12.5, color: AppColors.inkBody),
          ),
          if (_status.isNotEmpty) ...[
            const SizedBox(height: 8),
            NoticeBanner(
              icon: Icons.info_outline,
              title: _status,
              tone: NoticeTone.warning,
            ),
          ],
          const SizedBox(height: 14),
          _Card(
            padding: 4,
            child: Column(
              children: [
                for (final (index, update) in updates.indexed) ...[
                  if (index > 0) const Divider(height: 1),
                  ListTile(
                    dense: true,
                    leading: const Icon(
                      Icons.check_circle_outline,
                      color: AppColors.leaf,
                      size: 20,
                    ),
                    title: Text(
                      'Update ${update.number} · ${incidentTypeLabels[widget.incident.type] ?? 'Incident'}',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    subtitle: Text(
                      'Sent ${accessDateTime(update.sentAt)}${update.photos == 0 ? '' : ' · ${update.photos} ${update.photos == 1 ? 'photo' : 'photos'}'}',
                    ),
                    trailing: const StatusBadge(
                      label: 'Received',
                      tone: StatusBadge.green,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: BottomActionBar(
        primary: OutlinedButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: const Text('Done'),
        ),
      ),
    );
  }
}

/// V5 M45: what HQ has arranged for one society, and who is helping.
class SocietyActionsScreen extends StatelessWidget {
  const SocietyActionsScreen({
    super.key,
    required this.detail,
    required this.society,
  });
  final IncidentDetail detail;
  final SocietyRef society;

  @override
  Widget build(BuildContext context) {
    final actions = detail.forSociety(society.id);
    final helpers = {
      for (final a in actions)
        for (final h in a.helpers) h.society.name,
    };
    return Scaffold(
      appBar: _TitledBar(
        title: 'Response actions',
        subtitle: '${society.name} · ${detail.incident.reference}',
      ),
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          _IncidentStrip(detail.incident),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const _SampleLabel(),
                _Card(
                  padding: 12,
                  child: actions.isEmpty
                      ? const Text(
                          'HQ has not assigned any response actions for this society yet.',
                        )
                      : Column(
                          children: [
                            for (final (index, action) in actions.indexed) ...[
                              if (index > 0) const Divider(height: 1),
                              _ActionRow(
                                action: action,
                                subtitle: action.helpers.isEmpty
                                    ? 'No helper yet'
                                    : 'Helping: ${action.helpers.map((h) => h.society.name).join(' and ')}'
                                          '${action.state == ActionState.inProgress
                                              ? ' · ${action.delivered} of ${action.quantity} delivered'
                                              : action.state == ActionState.assigned
                                              ? ' · assigned by HQ ${accessDateTime(action.helpers.first.assignedAt)}'
                                              : ''}',
                              ),
                            ],
                          ],
                        ),
                ),
                const SizedBox(height: 12),
                _Card(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Societies helping you',
                              style: TextStyle(fontWeight: FontWeight.w700),
                            ),
                          ),
                          Text(
                            'Coordinated by HQ',
                            style: TextStyle(
                              fontSize: 11.5,
                              color: AppColors.muted,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        helpers.isEmpty ? 'None yet' : helpers.join(' · '),
                        style: const TextStyle(fontSize: 12.5),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                const NoticeBanner(
                  icon: Icons.info_outline,
                  title: 'Needs and items or tasks delivered only. No money, prices, payments or contributions are recorded.',
                  tone: NoticeTone.warning,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// V5 M45h: what HQ asked the user's society to provide for another society.
class HelpingScreen extends StatefulWidget {
  const HelpingScreen({super.key, required this.detail});
  final IncidentDetail detail;

  @override
  State<HelpingScreen> createState() => _HelpingScreenState();
}

class _HelpingScreenState extends State<HelpingScreen> {
  late IncidentDetail _detail = widget.detail;

  Future<void> _update(ResponseAction action, Helper helper) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => DeliveryUpdateScreen(action: action, helper: helper),
      ),
    );
    if (saved == true && mounted) {
      final detail = await DemoScope.read(context).incidents
          .detail(_detail.incident.id);
      if (mounted) setState(() => _detail = detail);
    }
  }

  @override
  Widget build(BuildContext context) {
    final rows = [
      for (final action in _detail.actions)
        for (final helper in action.helpers)
          if (helper.canUpdate) (action: action, helper: helper),
    ];
    final first = rows.firstOrNull;
    return Scaffold(
      appBar: _TitledBar(
        title: 'Helping another society',
        subtitle:
            '${first?.helper.society.name ?? ''} · ${_detail.incident.reference}',
      ),
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          _IncidentStrip(_detail.incident),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const _SampleLabel(),
                if (first != null && first.action.forSociety != null)
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      border: Border.all(
                        color: AppColors.bannerTemporaryText,
                        width: 2,
                      ),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'HQ asked your society to help',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.inkBody,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            const Icon(Icons.person_outline, size: 18),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                first.action.forSociety!.name,
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ],
                        ),
                        Text(
                          '${first.action.forSociety!.code} · ${first.action.forSociety!.districtName}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.muted,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Assigned by ${first.helper.assignedBy} (HQ) · ${accessDateTime(first.helper.assignedAt)}',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: AppColors.bannerTemporaryText,
                          ),
                        ),
                      ],
                    ),
                  ),
                const _SectionLabel('What your society provides'),
                _Card(
                  padding: 4,
                  child: Column(
                    children: [
                      for (final (index, row) in rows.indexed) ...[
                        if (index > 0) const Divider(height: 1),
                        ListTile(
                          leading: Icon(_needIcon(row.action.need)),
                          title: Text(
                            '${row.action.title} · ${row.helper.deliveredQuantity > 0 && row.helper.status != HelperStatus.delivered ? '${row.helper.deliveredQuantity} of ' : ''}${quantityLine(row.helper.quantity, row.action.unit)}',
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 13.5,
                            ),
                          ),
                          subtitle: Text(
                            'To ${row.action.forSociety?.name ?? 'the society in need'}${row.action.dueAt == null ? '' : ' · by ${accessDateTime(row.action.dueAt!)}'}${row.helper.note.isEmpty ? '' : '\n${row.helper.note}'}',
                          ),
                          trailing: StatusBadge.helper(row.helper.status),
                          onTap: _detail.incident.isClosed
                              ? null
                              : () => _update(row.action, row.helper),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                const NoticeBanner(
                  icon: Icons.info_outline,
                  title: 'Items, people and tasks only — no payments, prices or financial contributions.',
                  tone: NoticeTone.warning,
                ),
                const SizedBox(height: 8),
                const Text(
                  "This help is a disaster record. It does not change either society's record. Tap a row to update the delivery.",
                  style: TextStyle(fontSize: 11.5, color: AppColors.muted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// V5 M46: the helping society records what it has delivered.
class DeliveryUpdateScreen extends StatefulWidget {
  const DeliveryUpdateScreen({
    super.key,
    required this.action,
    required this.helper,
  });
  final ResponseAction action;
  final Helper helper;

  @override
  State<DeliveryUpdateScreen> createState() => _DeliveryUpdateScreenState();
}

class _DeliveryUpdateScreenState extends State<DeliveryUpdateScreen> {
  late HelperStatus _status = widget.helper.status;
  late final _delivered = TextEditingController(
    text: '${widget.helper.deliveredQuantity}',
  );
  late final _note = TextEditingController(text: widget.helper.deliveryNote);
  // Calendar fields in Sri Lanka time.
  late DateTime _deliveredOn = sriLanka(DemoScope.read(context).now);
  PickedDocument? _photo;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _delivered.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final delivered = int.tryParse(_delivered.text.trim());
    if (delivered == null ||
        delivered < 0 ||
        delivered > widget.helper.quantity) {
      setState(
        () => _error = 'Enter a number from 0 to ${widget.helper.quantity}.',
      );
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final local = _deliveredOn;
    // Something delivered means the delivery has started.
    final status = _status == HelperStatus.assigned && delivered > 0
        ? HelperStatus.inProgress
        : _status;
    try {
      await DemoScope.read(context).incidents.updateDelivery(
        widget.helper.id,
        status: status,
        delivered: delivered,
        deliveredOn: status == HelperStatus.delivered
            ? '${local.year}-${local.month.toString().padLeft(2, '0')}-${local.day.toString().padLeft(2, '0')}'
            : null,
        note: _note.text,
        photo: _photo,
      );
      if (mounted) Navigator.of(context).pop(true);
    } on IncidentException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final local = _deliveredOn;
    return Scaffold(
      appBar: _TitledBar(
        title: 'Update delivery',
        subtitle:
            '${widget.action.title} · ${widget.helper.society.name} → ${widget.action.forSociety?.name ?? ''}',
        close: true,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          DropdownButtonFormField<HelperStatus>(
            isExpanded: true,
            initialValue: _status,
            decoration: const InputDecoration(labelText: 'Status *'),
            items: [
              for (final status in HelperStatus.values)
                DropdownMenuItem(
                  value: status,
                  child: Text(helperStatusLabels[status]!),
                ),
            ],
            onChanged: (value) => setState(() => _status = value ?? _status),
          ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: TextField(
                  controller: _delivered,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: 'Delivered so far *',
                    helperText: 'Was ${widget.helper.deliveredQuantity}',
                  ),
                ),
              ),
              const Padding(
                padding: EdgeInsets.fromLTRB(10, 18, 10, 0),
                child: Text('of'),
              ),
              Expanded(
                child: InputDecorator(
                  decoration: const InputDecoration(
                    labelText: 'Read only',
                    enabled: false,
                  ),
                  child: Text(
                    quantityLine(widget.helper.quantity, widget.action.unit),
                  ),
                ),
              ),
            ],
          ),
          if (_status == HelperStatus.delivered) ...[
            const SizedBox(height: 14),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(46),
                alignment: Alignment.centerLeft,
              ),
              onPressed: () async {
                final store = DemoScope.read(context);
                final picked = await showDatePicker(
                  context: context,
                  initialDate: _deliveredOn,
                  firstDate: sriLanka(store.now)
                      .subtract(const Duration(days: 30)),
                  lastDate: sriLanka(store.now),
                );
                if (picked != null) setState(() => _deliveredOn = picked);
              },
              icon: const Icon(Icons.calendar_today_outlined, size: 18),
              label: Text(
                'Delivered on ${local.day}/${local.month}/${local.year}',
              ),
            ),
          ],
          const SizedBox(height: 14),
          TextField(
            controller: _note,
            maxLength: 1000,
            maxLines: 2,
            decoration: const InputDecoration(labelText: 'Note (optional)'),
          ),
          Row(
            children: [
              if (_photo != null)
                InputChip(
                  avatar: const Icon(Icons.image_outlined, size: 18),
                  label: const Text('Photo'),
                  onDeleted: () => setState(() => _photo = null),
                )
              else
                OutlinedButton.icon(
                  onPressed: () async {
                    final picked = await DemoScope.read(context).documentPicker
                        .pick();
                    if (picked != null && mounted) {
                      setState(() => _photo = picked);
                    }
                  },
                  icon: const Icon(Icons.add_a_photo_outlined),
                  label: const Text('Photo (optional)'),
                ),
            ],
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            NoticeBanner(
              icon: Icons.error_outline,
              title: _error!,
              tone: NoticeTone.error,
            ),
          ],
        ],
      ),
      bottomNavigationBar: BottomActionBar(
        secondary: OutlinedButton(
          onPressed: _saving ? null : () => Navigator.of(context).maybePop(),
          child: const Text('Cancel'),
        ),
        primary: FilledButton(
          onPressed: _saving ? null : _save,
          child: Text(_saving ? 'Saving…' : 'Save update'),
        ),
      ),
    );
  }
}

/// V5 M47: the latest situation report. Counts only, no personal details.
class SituationReportScreen extends StatefulWidget {
  const SituationReportScreen({super.key, required this.reportId});
  final String reportId;

  @override
  State<SituationReportScreen> createState() => _SituationReportScreenState();
}

class _SituationReportScreenState extends State<SituationReportScreen> {
  SituationReport? _report;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final report = await DemoScope.read(context).incidents
          .report(widget.reportId);
      if (mounted) setState(() => _report = report);
    } on IncidentException catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final report = _report;
    Widget tile(String label, String value, {Color colour = AppColors.ink}) =>
        Expanded(
          child: _Card(
            padding: 12,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: AppColors.inkBody,
                  ),
                ),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: colour,
                  ),
                ),
              ],
            ),
          ),
        );
    return Scaffold(
      appBar: _TitledBar(
        title: 'Situation report',
        subtitle: report == null
            ? null
            : '${report.incident.reference} · report ${report.number} · ${accessDateTime(report.asOf)}',
      ),
      body: _error != null
          ? StateMessage(
              icon: Icons.error_outline,
              tone: StateTone.error,
              isAlert: true,
              title: "Couldn't load the report",
              message: _error!,
              primaryLabel: 'Try again',
              onPrimary: _load,
            )
          : report == null
          ? const LoadingSkeleton(label: 'Loading the situation report')
          : ListView(
              padding: EdgeInsets.zero,
              children: [
                _IncidentStrip(report.incident),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const _SampleLabel(),
                      IntrinsicHeight(
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            tile(
                              'Societies affected',
                              grouped(report.totals.affected),
                              colour: AppColors.danger,
                            ),
                            const SizedBox(width: 10),
                            tile(
                              'People affected',
                              grouped(report.totals.people),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 10),
                      IntrinsicHeight(
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            tile(
                              'Houses fully / partly',
                              '${report.totals.housesFully} / ${report.totals.housesPartly}',
                            ),
                            const SizedBox(width: 10),
                            tile(
                              'Not yet assessed',
                              grouped(report.totals.notAssessed),
                              colour: AppColors.warning,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 10),
                      _Card(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'By district',
                              style: TextStyle(fontWeight: FontWeight.w700),
                            ),
                            for (final (index, d)
                                in report.totals.byDistrict.indexed) ...[
                              if (index > 0) const Divider(),
                              Padding(
                                padding: const EdgeInsets.fromLTRB(12, 6, 0, 2),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      d.name,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    Text(
                                      '${d.affected} affected · ${grouped(d.people)} people',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.inkBody,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: 10),
                      _Card(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Urgent needs',
                              style: TextStyle(fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              report.totals.needs.isEmpty
                                  ? 'None reported yet.'
                                  : [
                                      for (final (index, n)
                                          in report.totals.needs.indexed)
                                        '${index == 0 ? needLabels[n.need] : needLabels[n.need]!.toLowerCase()} (${n.societies}${index == 0 ? ' societies' : ''})',
                                    ].join(' · '),
                              style: const TextStyle(fontSize: 12.5),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 10),
                      _Card(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Societies helping',
                              style: TextStyle(fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${report.helpingSocieties} ${report.helpingSocieties == 1 ? 'society is' : 'societies are'} helping ${report.helpedSocieties} affected ${report.helpedSocieties == 1 ? 'society' : 'societies'}.',
                              style: const TextStyle(fontSize: 12.5),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 10),
                      const Text(
                        'Counts only, from received assessments. No personal details.',
                        style: TextStyle(
                          fontSize: 11.5,
                          color: AppColors.muted,
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

/// V5 M48: report an incident for a society the user looks after. People
/// covering the area are notified straight away (M48n).
class ReportIncidentScreen extends StatefulWidget {
  const ReportIncidentScreen({super.key});

  @override
  State<ReportIncidentScreen> createState() => _ReportIncidentScreenState();
}

class _ReportIncidentScreenState extends State<ReportIncidentScreen> {
  ReportOptions? _options;
  String _type = 'FLOOD';
  String? _societyId;
  final Set<String> _districts = {};
  final _description = TextEditingController();
  late DateTime _startedAt = DemoScope.read(context).now;
  bool _opening = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _description.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final options = await DemoScope.read(context).incidents.reportOptions();
      if (!mounted) return;
      setState(() {
        _options = options;
        if (options.societies.length == 1) {
          _chooseSociety(options.societies.single);
        }
      });
    } on IncidentException catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  void _chooseSociety(SocietyRef society) {
    _societyId = society.id;
    // The reporting society's district is always in the area.
    final district =
        society.districtId ??
        _options?.districts
            .where((d) => d.name == society.districtName)
            .firstOrNull
            ?.id;
    if (district != null) _districts.add(district);
  }

  Future<void> _open() async {
    if (_societyId == null ||
        _districts.isEmpty ||
        _description.text.trim().isEmpty) {
      setState(
        () => _error = 'Fill in what happened, the society, the area and a short description.',
      );
      return;
    }
    setState(() {
      _opening = true;
      _error = null;
    });
    try {
      final id = await DemoScope.read(context).incidents.open(
        type: _type,
        reportingSocietyId: _societyId!,
        districtIds: _districts.toList(),
        description: _description.text,
        startedAt: _startedAt,
      );
      if (mounted) Navigator.of(context).pop(id);
    } on IncidentException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _opening = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final options = _options;
    return Scaffold(
      appBar: const _TitledBar(
        title: 'Report an incident',
        subtitle: 'Opens a disaster incident',
        close: true,
      ),
      body: options == null && _error == null
          ? const LoadingSkeleton(label: 'Loading your societies')
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const NoticeBanner(
                  icon: Icons.info_outline,
                  title: 'Any signed-in user can open an incident for a society they look after. Everyone whose societies are in the area is notified straight away.',
                  tone: NoticeTone.info,
                ),
                const SizedBox(height: 14),
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  initialValue: _type,
                  decoration: const InputDecoration(
                    labelText: 'What happened *',
                  ),
                  items: [
                    for (final type in incidentTypeLabels.keys)
                      DropdownMenuItem(
                        value: type,
                        child: Text(incidentTypeLabels[type]!),
                      ),
                  ],
                  onChanged: (value) => setState(() => _type = value ?? _type),
                ),
                const SizedBox(height: 14),
                if (options != null && options.societies.isEmpty)
                  const NoticeBanner(
                    icon: Icons.lock_outline,
                    title: 'You have no assigned societies to report for. Ask HQ to check your account.',
                    tone: NoticeTone.warning,
                  )
                else if (options != null)
                  DropdownButtonFormField<String>(
                    isExpanded: true,
                    initialValue: _societyId,
                    decoration: const InputDecoration(
                      labelText: 'Society reporting *',
                    ),
                    items: [
                      for (final s in options.societies)
                        DropdownMenuItem(
                          value: s.id,
                          child: Text('${s.name} · ${s.code}'),
                        ),
                    ],
                    onChanged: (value) => setState(
                      () => _chooseSociety(
                        options.societies.firstWhere((s) => s.id == value),
                      ),
                    ),
                  ),
                const SizedBox(height: 14),
                if (options != null) ...[
                  const Text(
                    'Area affected *',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final d in options.districts)
                        FilterChip(
                          label: Text(d.name),
                          selected: _districts.contains(d.id),
                          onSelected: (on) => setState(
                            () => on
                                ? _districts.add(d.id)
                                : _districts.remove(d.id),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Choose all districts you know are affected.',
                    style: TextStyle(fontSize: 11.5, color: AppColors.muted),
                  ),
                ],
                const SizedBox(height: 14),
                TextField(
                  controller: _description,
                  maxLength: 1000,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'Short description *',
                  ),
                ),
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(46),
                    alignment: Alignment.centerLeft,
                  ),
                  onPressed: () async {
                    final store = DemoScope.read(context);
                    final day = await showDatePicker(
                      context: context,
                      initialDate: _startedAt,
                      firstDate: store.now.subtract(const Duration(days: 30)),
                      lastDate: store.now,
                    );
                    if (day == null || !context.mounted) return;
                    final time = await showTimePicker(
                      context: context,
                      initialTime: TimeOfDay.fromDateTime(_startedAt),
                    );
                    if (time == null) return;
                    final picked = DateTime(
                      day.year,
                      day.month,
                      day.day,
                      time.hour,
                      time.minute,
                    );
                    setState(
                      () => _startedAt = picked.isAfter(store.now)
                          ? store.now
                          : picked,
                    );
                  },
                  icon: const Icon(Icons.calendar_today_outlined, size: 18),
                  label: Text('Started ${accessDateTime(_startedAt)}'),
                ),
                const SizedBox(height: 12),
                const AccessBanner(
                  tone: AccessBannerTone.edit,
                  child: Text(
                    'Your name and the time are recorded as the person who opened it.',
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  NoticeBanner(
                    icon: Icons.error_outline,
                    title: _error!,
                    tone: NoticeTone.error,
                  ),
                ],
              ],
            ),
      bottomNavigationBar: BottomActionBar(
        secondary: OutlinedButton(
          onPressed: _opening ? null : () => Navigator.of(context).maybePop(),
          child: const Text('Cancel'),
        ),
        primary: FilledButton(
          style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
          onPressed: _opening || options == null || options.societies.isEmpty
              ? null
              : _open,
          child: Text(_opening ? 'Opening…' : 'Open incident'),
        ),
      ),
    );
  }
}
