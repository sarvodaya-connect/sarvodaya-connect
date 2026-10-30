import 'package:flutter/material.dart';

import '../models/user.dart';
import '../society_record/record_widgets.dart';
import '../society_record/society_record_api.dart';
import '../society_record/society_record_models.dart';
import '../society_record/society_record_screen.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/brand.dart';
import '../widgets/state_views.dart';
import 'emergency_response_screen.dart';
import 'notifications_screen.dart';

/// Number of Exco seats a society fills.
const _excoSeats = 25;

/// Bottom-bar tabs of the Society Officer shell in API mode (Prototype v4).
abstract final class OfficerTabs {
  static const society = 1;
  static const exco = 2;
  static const workPlan = 3;
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
    final store = DemoScope.of(context);
    final user = store.user!;
    final record = _record;
    final firstName = user.displayName.split(' ').first;
    return Scaffold(
      body: Column(
        children: [
          _OfficerHeader(
            title: '${_greeting(DateTime.now())}, $firstName',
            subtitle: [
              UserRole.societyOfficer.label,
              ?record?.nameEn,
            ].join(' · '),
          ),
          if (record != null) _AccessStrip(record: record),
          Expanded(child: _body(record)),
        ],
      ),
    );
  }

  Widget _body(SocietyRecord? record) {
    if (record == null) {
      if (_error != null) {
        return StateMessage(
          icon: Icons.cloud_off_outlined,
          title: 'Your society could not be loaded',
          message: _error!.message,
          primaryLabel: 'Try again',
          onPrimary: _load,
        );
      }
      return Center(
        child: Semantics(
          label: 'Loading your society',
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
          if (_loading) const LinearProgressIndicator(minHeight: 2),
          _SocietySummaryCard(
            record: record,
            plan: plan,
            syncedAt: _syncedAt,
            onRequest: () => store.selectTab(OfficerTabs.society),
          ),
          const SizedBox(height: 18),
          const Padding(
            padding: EdgeInsets.only(left: 2, bottom: 8),
            child: Text('UPDATE YOUR SOCIETY', style: _HomeStyle.section),
          ),
          _TileGrid(
            tiles: [
              _UpdateTile(
                icon: Icons.apartment_outlined,
                title: 'Society information',
                subtitle: 'Details, yearly profit and expenses',
                onTap: () => store.selectTab(OfficerTabs.society),
              ),
              _UpdateTile(
                icon: Icons.people_outline,
                title: 'Exco members',
                subtitle: exco == _excoSeats
                    ? '$exco of $_excoSeats · complete'
                    : exco == 0
                    ? 'Not entered yet'
                    : '$exco of $_excoSeats',
                onTap: () => store.selectTab(OfficerTabs.exco),
              ),
              _UpdateTile(
                icon: Icons.calendar_today_outlined,
                title: 'Annual work plan',
                subtitle: plan == null
                    ? 'Activities and allocations'
                    : '${plan.year} · ${plan.activities.length} '
                          '${plan.activities.length == 1 ? 'activity' : 'activities'}',
                onTap: () => store.selectTab(OfficerTabs.workPlan),
              ),
              _UpdateTile(
                icon: Icons.history,
                title: 'Change history',
                subtitle: record.lastChangeAt == null
                    ? 'No changes yet'
                    : 'Last change ${formatWhen(record.lastChangeAt!, DateTime.now())}',
                onTap: () => _openRecordTab(4),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _LinkCard(
            title: '${summary.financialYear.label} summary and audit report',
            subtitle: [
              summary.totalProfit != null && summary.totalExpenses != null
                  ? 'Yearly figures added'
                  : 'Yearly figures not added',
              summary.auditReport != null
                  ? 'audit report uploaded'
                  : 'audit report missing',
            ].join(' · '),
            attention:
                summary.totalProfit == null ||
                summary.totalExpenses == null ||
                summary.auditReport == null,
            onTap: () => store.selectTab(OfficerTabs.society),
          ),
          const SizedBox(height: 10),
          _LinkCard(
            icon: Icons.warning_amber_outlined,
            title: 'Disaster response',
            subtitle: 'Live incidents and rapid assessments',
            onTap: () => Navigator.of(context).push<void>(
              MaterialPageRoute(
                builder: (_) => const EmergencyResponseScreen(),
              ),
            ),
          ),
        ],
      ),
    );
  }

  static String _greeting(DateTime now) => now.hour < 12
      ? 'Good morning'
      : now.hour < 17
      ? 'Good afternoon'
      : 'Good evening';
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

/// M05 masthead: small logo and bell, greeting, and hills on the right.
class _OfficerHeader extends StatelessWidget {
  const _OfficerHeader({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) => ColoredBox(
    color: AppColors.surface,
    child: SafeArea(
      bottom: false,
      child: Stack(
        children: [
          const Positioned.fill(
            child: ExcludeSemantics(
              child: CustomPaint(painter: _HillsPainter()),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 6, 12, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    // Lifts the logo's off-white JPEG background to the
                    // header's white so no box shows around it.
                    ColorFiltered(
                      colorFilter: ColorFilter.matrix([
                        1.06, 0, 0, 0, 0, //
                        0, 1.06, 0, 0, 0, //
                        0, 0, 1.06, 0, 0, //
                        0, 0, 0, 1, 0, //
                      ]),
                      child: BrandMark(width: 104),
                    ),
                    Spacer(),
                    _NotificationsButton(),
                  ],
                ),
                const SizedBox(height: 10),
                Semantics(
                  header: true,
                  child: Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: AppColors.ink,
                      height: 1.15,
                    ),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

/// Pale hills and a cluster of trees at the right of the M05 header.
class _HillsPainter extends CustomPainter {
  const _HillsPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    final far = Path()
      ..moveTo(w * 0.50, h)
      ..lineTo(w * 0.80, h * 0.40)
      ..lineTo(w * 0.92, h * 0.58)
      ..lineTo(w, h * 0.50)
      ..lineTo(w, h)
      ..close();
    canvas.drawPath(far, Paint()..color = const Color(0xFFE2ECDC));
    final middle = Path()
      ..moveTo(w * 0.30, h)
      ..quadraticBezierTo(w * 0.62, h * 0.80, w, h * 0.80)
      ..lineTo(w, h)
      ..close();
    canvas.drawPath(middle, Paint()..color = const Color(0xFFC9DEBE));
    final front = Path()
      ..moveTo(w * 0.52, h)
      ..quadraticBezierTo(w * 0.80, h * 0.90, w, h * 0.90)
      ..lineTo(w, h)
      ..close();
    canvas.drawPath(front, Paint()..color = const Color(0xFF9CC48C));
    final r = h / 9;
    for (final (x, y, radius, color) in <(double, double, double, int)>[
      (0.885, 0.77, 0.75, 0xFF2F6B45),
      (0.935, 0.64, 1.15, 0xFF2F6B45),
      (0.965, 0.73, 0.80, 0xFF1F5236),
      (1.005, 0.64, 1.00, 0xFF2F6B45),
    ]) {
      canvas.drawCircle(
        Offset(w * x, h * y),
        r * radius,
        Paint()..color = Color(color),
      );
    }
  }

  @override
  bool shouldRepaint(covariant _HillsPainter oldDelegate) => false;
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
            'Your access: ${record.nameEn} only · '
            '${record.permissions.canEdit ? 'view and edit' : 'view only'}',
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
                  label: 'Members',
                  value: record.memberCount?.toString() ?? '—',
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
                  label: plan == null ? 'Work plan' : '${plan!.year} plan',
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
                    'All changes synced · ${formatWhen(syncedAt!, DateTime.now())}',
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
                  text:
                      'Grade change ${request.fromGrade ?? '–'} → '
                      '${request.toGrade} requested by '
                      '${request.requestedBy.displayName}. ',
                  children: const [
                    TextSpan(
                      text: 'Waiting for HQ.',
                      style: TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ],
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
  );
}

/// Full-width card row that opens another screen.
class _LinkCard extends StatelessWidget {
  const _LinkCard({
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.icon,
    this.attention = false,
  });

  final IconData? icon;
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
            if (icon != null) ...[
              Icon(icon, size: 20, color: AppColors.inkSoft),
              const SizedBox(width: 12),
            ],
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

/// Opens M16 Notifications. The badge shows how many are unread.
class _NotificationsButton extends StatelessWidget {
  const _NotificationsButton();

  @override
  Widget build(BuildContext context) {
    final unread = DemoScope.of(context).unreadNotificationCount;
    return Semantics(
      value: unread == 0 ? null : '$unread unread',
      child: Material(
        color: AppColors.surface,
        shape: const CircleBorder(side: BorderSide(color: AppColors.line)),
        child: IconButton(
          constraints: const BoxConstraints.tightFor(width: 38, height: 38),
          padding: EdgeInsets.zero,
          tooltip: 'Notifications',
          icon: Badge(
            isLabelVisible: unread > 0,
            label: Text('$unread'),
            backgroundColor: const Color(0xFFC0392B),
            child: const Icon(
              Icons.notifications_none,
              size: 19,
              color: AppColors.ink,
            ),
          ),
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => const NotificationsScreen(),
            ),
          ),
        ),
      ),
    );
  }
}
