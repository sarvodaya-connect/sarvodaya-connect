import 'package:flutter/material.dart';

import '../motion/app_motion.dart';

import '../l10n/l10n.dart';
import '../l10n/l10n_format.dart';
import '../l10n/record_l10n.dart';
import '../society_record/record_widgets.dart';
import '../society_record/society_record_api.dart';
import '../society_record/society_record_models.dart';
import '../society_record/society_record_screen.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/masthead.dart';
import '../widgets/state_views.dart';
import '../incidents/incident_screens.dart';

/// Number of Exco seats a society fills.
const _excoSeats = 25;

/// Bottom-bar tabs of the Society Officer shell in API mode (Prototype v4).
abstract final class OfficerTabs {
  static const society = 1;
  // V5 Nav: the red Incident button sits in the middle (PR 8).
  static const incident = 2;
  static const exco = 3;
  static const workPlan = 4;
}

/// M05 · Home: Society Officer (Prototype v4). Their one society at a glance —
/// grade, members, Exco and plan — with shortcuts to update its records and
/// the sync status. Data comes from the SC-65 society record API.
class SocietyOfficerHomeScreen extends StatefulWidget {
  const SocietyOfficerHomeScreen({super.key, required this.societyId});

  final String societyId;

  @override
  State<SocietyOfficerHomeScreen> createState() => _OfficerHomeState();
}

class _OfficerHomeState extends State<SocietyOfficerHomeScreen> {
  SocietyRecord? _record;
  WorkPlan? _plan;
  DateTime? _syncedAt;
  SocietyRecordException? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final api = DemoScope.read(context).societyRecords;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final record = await api.fetchRecord(widget.societyId);
      WorkPlan? plan;
      try {
        plan = await api.fetchWorkPlan(widget.societyId);
      } on SocietyRecordException {
        // The plan tile shows a dash; the rest of the home still works.
      }
      if (!mounted) return;
      setState(() {
        _record = record;
        _plan = plan;
        _syncedAt = DateTime.now();
      });
    } on SocietyRecordException catch (error) {
      if (mounted) setState(() => _error = error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Opens a record tab that has no bottom-bar entry, then refreshes.
  Future<void> _openRecordTab(int tab) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) =>
            SocietyRecordScreen(societyId: widget.societyId, initialTab: tab),
      ),
    );
    if (mounted) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final store = DemoScope.of(context);
    final user = store.user!;
    final record = _record;
    return Scaffold(
      body: LayoutBuilder(
        builder: (context, constraints) => Column(
          children: [
            // Match HQ: keep the header readable and scrollable even in
            // landscape or at large text sizes without hiding the body.
            ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: constraints.maxHeight * 0.6,
              ),
              child: SingleChildScrollView(
                child: Column(
                  children: [
                    MotionEntrance(
                      id: 'officer.header',
                      child: HomeMasthead(
                        title: l.greeting(store.now, user.displayName),
                        subtitle: [
                          l.recRoleSocietyOfficer,
                          ?record?.nameEn,
                        ].join(' · '),
                      ),
                    ),
                    if (record != null)
                      MotionEntrance(
                        id: 'officer.access',
                        order: 1,
                        child: _AccessStrip(record: record),
                      ),
                  ],
                ),
              ),
            ),
            Expanded(child: _body(record)),
          ],
        ),
      ),
    );
  }

  Widget _body(SocietyRecord? record) {
    final l = context.l10n;
    if (record == null) {
      if (_error != null) {
        return StateMessage(
          icon: Icons.cloud_off_outlined,
          title: l.officerLoadError,
          message: l.recordError(_error!),
          primaryLabel: l.commonTryAgain,
          onPrimary: _load,
        );
      }
      return Center(
        child: Semantics(
          label: l.officerLoading,
          child: const CircularProgressIndicator(),
        ),
      );
    }
    final store = DemoScope.of(context);
    final plan = _plan;
    final exco = record.exco.length;
    final summary = record.annualSummary;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
        children: [
          if (_loading)
            Row(
              children: [
                const SizedBox.square(
                  dimension: 14,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
                const SizedBox(width: 8),
                Text(l.officerRefreshing),
              ],
            ),
          // V5 M40: the live incident and what HQ has arranged for this society.
          IncidentHomeSection(societyId: widget.societyId),
          MotionEntrance(
            id: 'officer.summary',
            order: 2,
            child: _SocietySummaryCard(
              record: record,
              plan: plan,
              syncedAt: _syncedAt,
              onRequest: () => store.selectTab(OfficerTabs.society),
            ),
          ),
          const SizedBox(height: 18),
          Padding(
            padding: const EdgeInsets.only(left: 2, bottom: 8),
            child: Text(l.officerUpdate, style: _HomeStyle.section),
          ),
          MotionEntrance(
            id: 'officer.tiles',
            order: 3,
            child: _TileGrid(
              tiles: [
                _UpdateTile(
                  icon: Icons.apartment_outlined,
                  title: l.officerInfo,
                  subtitle: l.officerInfoSub,
                  onTap: () => store.selectTab(OfficerTabs.society),
                ),
                _UpdateTile(
                  icon: Icons.people_outline,
                  title: l.officerExco,
                  subtitle: exco == _excoSeats
                      ? l.officerExcoComplete(exco)
                      : exco == 0
                      ? l.officerExcoNone
                      : l.officerExcoOf(exco),
                  onTap: () => store.selectTab(OfficerTabs.exco),
                ),
                _UpdateTile(
                  icon: Icons.calendar_today_outlined,
                  title: l.officerPlan,
                  subtitle: plan == null
                      ? l.officerPlanSub
                      : l.officerPlanLine(
                          '${plan.year}',
                          plan.activities.length,
                        ),
                  onTap: () => store.selectTab(OfficerTabs.workPlan),
                ),
                _UpdateTile(
                  icon: Icons.history,
                  title: l.officerHistory,
                  subtitle: record.lastChangeAt == null
                      ? l.recNoChanges
                      : l.officerLastChange(
                          l.recordWhen(record.lastChangeAt!, DateTime.now()),
                        ),
                  onTap: () => _openRecordTab(4),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          MotionEntrance(
            id: 'officer.audit',
            order: 4,
            child: _LinkCard(
              title: l.officerSummaryAudit(summary.financialYear.label),
              subtitle: [
                summary.totalProfit != null && summary.totalExpenses != null
                    ? l.officerFiguresAdded
                    : l.officerFiguresMissing,
                summary.auditReport != null
                    ? l.officerAuditUploaded
                    : l.officerAuditMissing,
              ].join(' · '),
              attention:
                  summary.totalProfit == null ||
                  summary.totalExpenses == null ||
                  summary.auditReport == null,
              onTap: () => store.selectTab(OfficerTabs.society),
            ),
          ),
        ],
      ),
    );
  }
}

/// Prototype M05 type scale (compact phone scale, as in the record screens).
abstract final class _HomeStyle {
  static const name = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w800,
    color: AppColors.ink,
  );
  static const meta = TextStyle(fontSize: 11.5, color: AppColors.muted);
  static const statLabel = TextStyle(fontSize: 11, color: AppColors.muted);
  static const statValue = TextStyle(
    fontSize: 21,
    fontWeight: FontWeight.w800,
    color: AppColors.pine,
    height: 1.15,
  );
  static const section = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w800,
    color: AppColors.muted,
    letterSpacing: 1.1,
  );
  static const tileTitle = TextStyle(
    fontSize: 13.5,
    fontWeight: FontWeight.w700,
    color: AppColors.ink,
  );
  static const tileSubtitle = TextStyle(
    fontSize: 11,
    color: AppColors.muted,
    height: 1.35,
  );
}

/// "Your access: Pahala Kosgama SSS only · view and edit".
class _AccessStrip extends StatelessWidget {
  const _AccessStrip({required this.record});

  final SocietyRecord record;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    decoration: const BoxDecoration(
      color: Color(0xFFE4EFE5),
      border: Border(
        top: BorderSide(color: Color(0xFFD3E3D5)),
        bottom: BorderSide(color: Color(0xFFD3E3D5)),
      ),
    ),
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
    child: Row(
      children: [
        const Icon(Icons.shield_outlined, size: 13, color: AppColors.pine),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            record.permissions.canEdit
                ? context.l10n.officerAccess(record.nameEn)
                : context.l10n.officerAccessViewOnly(record.nameEn),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppColors.pine,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    ),
  );
}

/// The society at a glance: name, grade, members, Exco, plan, the waiting
/// grade request and the sync status.
class _SocietySummaryCard extends StatelessWidget {
  const _SocietySummaryCard({
    required this.record,
    required this.plan,
    required this.syncedAt,
    required this.onRequest,
  });

  final SocietyRecord record;
  final WorkPlan? plan;
  final DateTime? syncedAt;
  final VoidCallback onRequest;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final request = record.openGradeRequest;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Semantics(
                      header: true,
                      child: Text(record.nameEn, style: _HomeStyle.name),
                    ),
                    if (record.nameLocal != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        record.nameLocal!,
                        style: const TextStyle(
                          fontSize: 11.5,
                          color: AppColors.inkSoft,
                        ),
                      ),
                    ],
                    const SizedBox(height: 2),
                    Text(
                      '${record.societyCode} · ${record.districtName}',
                      style: _HomeStyle.meta,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              GradeBadge(record.grade, size: 30),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _Stat(
                  label: l.recMembers,
                  value: record.memberCount == null
                      ? '—'
                      : l.localeName == 'en'
                      ? record.memberCount.toString()
                      : l.number(record.memberCount!),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _Stat(
                  label: 'Exco',
                  value: '${record.exco.length}/$_excoSeats',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _Stat(
                  label: plan == null
                      ? l.recTabWorkPlan
                      : l.officerPlanYear('${plan!.year}'),
                  value: plan?.activities.length.toString() ?? '—',
                ),
              ),
            ],
          ),
          if (request != null) ...[
            const SizedBox(height: 12),
            _GradeRequestBanner(request: request, onTap: onRequest),
          ],
          if (syncedAt != null) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                const Icon(
                  Icons.cloud_done_outlined,
                  size: 15,
                  color: AppColors.leaf,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    l.officerSynced(l.recordWhen(syncedAt!, DateTime.now())),
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.leaf,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => MergeSemantics(
    child: Container(
      padding: const EdgeInsets.fromLTRB(10, 9, 8, 9),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: _HomeStyle.statLabel,
          ),
          const SizedBox(height: 3),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(value, style: _HomeStyle.statValue),
          ),
        ],
      ),
    ),
  );
}

/// "Grade change B → A requested by S. Karunaratne. Waiting for HQ."
class _GradeRequestBanner extends StatelessWidget {
  const _GradeRequestBanner({required this.request, required this.onTap});

  final GradeRequest request;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: const Color(0xFFFFF4D6),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(10),
      side: const BorderSide(color: Color(0xFFF0D98A)),
    ),
    child: InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(10, 9, 10, 9),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.only(top: 1),
              child: Icon(Icons.schedule, size: 13, color: AppColors.warning),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text.rich(
                TextSpan(
                  children: styledSpans(
                    context.l10n.officerGradeRequest(
                      '${request.fromGrade ?? '–'} → ${request.toGrade}',
                      request.requestedBy.displayName,
                      styledSlot,
                    ),
                    TextSpan(
                      text: context.l10n.officerWaitingHq,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                ),
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.warning,
                  height: 1.35,
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

/// Two tiles per row with equal heights, whatever the text length.
class _TileGrid extends StatelessWidget {
  const _TileGrid({required this.tiles});

  final List<Widget> tiles;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      for (var i = 0; i < tiles.length; i += 2) ...[
        if (i > 0) const SizedBox(height: 10),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(child: tiles[i]),
              const SizedBox(width: 10),
              Expanded(
                child: i + 1 < tiles.length
                    ? tiles[i + 1]
                    : const SizedBox.shrink(),
              ),
            ],
          ),
        ),
      ],
    ],
  );
}

class _UpdateTile extends StatelessWidget {
  const _UpdateTile({
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
  Widget build(BuildContext context) => Material(
    color: AppColors.surface,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(12),
      side: const BorderSide(color: AppColors.line),
    ),
    child: MotionPress(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 10, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: AppColors.mint,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 17, color: AppColors.leaf),
              ),
              const SizedBox(height: 10),
              Text(title, style: _HomeStyle.tileTitle),
              const SizedBox(height: 4),
              Text(subtitle, style: _HomeStyle.tileSubtitle),
            ],
          ),
        ),
      ),
    ),
  );
}

/// Full-width card row that opens another screen.
class _LinkCard extends StatelessWidget {
  const _LinkCard({
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.attention = false,
  });

  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final bool attention;

  @override
  Widget build(BuildContext context) => Material(
    color: AppColors.surface,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(12),
      side: const BorderSide(color: AppColors.line),
    ),
    child: InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: _HomeStyle.tileTitle),
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    style: _HomeStyle.tileSubtitle.copyWith(
                      color: attention ? AppColors.warning : AppColors.muted,
                      fontWeight: attention ? FontWeight.w600 : null,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: AppColors.muted),
          ],
        ),
      ),
    ),
  );
}
