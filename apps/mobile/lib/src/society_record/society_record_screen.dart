import 'package:flutter/material.dart';

import '../format.dart';
import '../models/society.dart';
import '../models/user.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/map_preview.dart';
import '../widgets/state_views.dart';
import 'annual_summary_screen.dart';
import 'audit_report_upload_screen.dart';
import 'edit_society_screen.dart';
import 'grade_change_request_screen.dart';
import 'grade_requests_screen.dart';
import 'nic_reveal_button.dart';
import 'record_widgets.dart';
import 'society_record_api.dart';
import 'society_record_models.dart';

/// M06 society detail (with M06v view only and M06fx summary not added).
/// Tabs: Overview, Exco, Work plan, Documents and History.
class SocietyRecordScreen extends StatefulWidget {
  const SocietyRecordScreen({
    super.key,
    required this.societyId,
    this.showBack = true,
  });

  final String societyId;

  /// False when the record is the Society Officer's home tab.
  final bool showBack;

  @override
  State<SocietyRecordScreen> createState() => _SocietyRecordScreenState();
}

class _SocietyRecordScreenState extends State<SocietyRecordScreen> {
  SocietyRecord? _record;
  SocietyRecordException? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final record = await DemoScope.read(context).societyRecords
          .fetchRecord(widget.societyId);
      if (mounted) setState(() => _record = record);
    } on SocietyRecordException catch (error) {
      if (mounted) setState(() => _error = error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Opens a screen and reloads the record when it reports a saved change.
  Future<void> _open(Widget screen) async {
    final changed = await Navigator.of(context)
        .push<bool>(MaterialPageRoute(builder: (_) => screen));
    if (changed == true && mounted) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final record = _record;
    final user = DemoScope.of(context).user!;
    return DefaultTabController(
      length: 5,
      child: Scaffold(
        appBar: AppBar(
          toolbarHeight: 58,
          automaticallyImplyLeading: widget.showBack,
          titleSpacing: widget.showBack ? 0 : 16,
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                record?.nameEn ?? 'Society record',
                style: RecordStyle.screenTitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              if (record != null)
                Text(
                  '${record.societyCode} · ${record.districtName}',
                  style: RecordStyle.screenSubtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
            ],
          ),
          actions: [
            if (record != null && record.permissions.canEdit)
              Padding(
                padding: const EdgeInsets.only(right: 12),
                child: OutlinedButton.icon(
                  style: compactOutlinedStyle,
                  onPressed: () => _open(EditSocietyScreen(record: record)),
                  icon: const Icon(Icons.edit_outlined, size: 14),
                  label: const Text('Edit'),
                ),
              )
            else if (record != null)
              const Padding(
                padding: EdgeInsets.only(right: 12),
                child: Center(
                  child: RecordChip('View only', icon: Icons.lock_outline),
                ),
              ),
          ],
          bottom: record == null
              ? null
              : const PreferredSize(
                  preferredSize: Size.fromHeight(40),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      border: Border(bottom: BorderSide(color: AppColors.line)),
                    ),
                    child: TabBar(
                      isScrollable: true,
                      tabAlignment: TabAlignment.start,
                      padding: EdgeInsets.symmetric(horizontal: 8),
                      labelPadding: EdgeInsets.symmetric(horizontal: 10),
                      labelColor: AppColors.ink,
                      unselectedLabelColor: AppColors.muted,
                      labelStyle: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                      unselectedLabelStyle: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                      indicatorColor: AppColors.leaf,
                      indicatorWeight: 2.5,
                      dividerHeight: 0,
                      tabs: [
                        Tab(height: 38, text: 'Overview'),
                        Tab(height: 38, text: 'Exco'),
                        Tab(height: 38, text: 'Work plan'),
                        Tab(height: 38, text: 'Documents'),
                        Tab(height: 38, text: 'History'),
                      ],
                    ),
                  ),
                ),
        ),
        body: _loading && record == null
            ? const LoadingSkeleton(label: 'Loading the society record')
            : _error != null && record == null
            ? StateMessage(
                icon: Icons.error_outline,
                tone: StateTone.error,
                isAlert: true,
                title: _error!.status == 404
                    ? 'Society not found'
                    : "Couldn't load the society record",
                message: _error!.status == 404
                    ? 'This society is not in your assigned scope.'
                    : '${_error!.message} Nothing you entered has been lost.',
                primaryLabel: _error!.status == 404 ? null : 'Try again',
                onPrimary: _load,
              )
            : Column(
                children: [
                  ScopeBanner(record: record!, user: user),
                  Expanded(
                    child: TabBarView(
                      children: [
                        RefreshIndicator(
                          onRefresh: _load,
                          child: _OverviewTab(record: record, open: _open),
                        ),
                        _ExcoTab(record: record),
                        _WorkPlanTab(societyId: record.id),
                        _DocumentsTab(record: record, open: _open),
                        _HistoryTab(societyId: record.id),
                      ],
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

const _gap = SizedBox(height: 10);

class _OverviewTab extends StatelessWidget {
  const _OverviewTab({required this.record, required this.open});

  final SocietyRecord record;
  final Future<void> Function(Widget screen) open;

  @override
  Widget build(BuildContext context) {
    final permissions = record.permissions;
    final viewOnly = !permissions.canEdit;
    final summary = record.annualSummary;
    final now = DemoScope.of(context).now;
    final spc = record.staffWithRole(UserRole.programmeCoordinator);
    final officer = record.staffWithRole(UserRole.societyOfficer);
    final address = [
      [
        record.addressLine,
        if (record.dsDivision != null) '${record.dsDivision} DS',
      ].whereType<String>().join(', '),
      if (record.gnDivision != null) '${record.gnDivision} GN',
    ].where((part) => part.isNotEmpty).join(' · ');

    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
      children: [
        _AnnualSummaryCard(record: record, open: open),
        _gap,
        if (!summary.complete && viewOnly == false && officer == null) ...[
          // M06fx: a short status card under a summary that is not added yet.
          RecordCard(
            children: [
              KeyValueGrid([
                KeyValue(
                  'Members',
                  record.memberCount == null
                      ? 'Not recorded'
                      : formatAmount(record.memberCount!.toDouble()),
                  missing: record.memberCount == null,
                ),
                KeyValue('Grade', record.grade ?? 'Not set'),
                const KeyValue(
                  'Society Officer',
                  'Not assigned',
                  missing: true,
                ),
                KeyValue(
                  'Last update',
                  record.lastChangeAt == null
                      ? 'No changes yet'
                      : formatWhen(record.lastChangeAt!, now),
                ),
              ]),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'The SPC can add the figures while this society has no Society Officer.',
            style: RecordStyle.caption,
          ),
          _gap,
        ],
        RecordCard(
          children: [
            const Text('Society name', style: RecordStyle.label),
            const SizedBox(height: 2),
            Text(record.nameEn, style: RecordStyle.value),
            if (record.nameLocal != null)
              Text(record.nameLocal!, style: RecordStyle.caption),
            const SizedBox(height: 12),
            KeyValueGrid([
              KeyValue(
                'S number',
                record.societyCode,
                trailing: const Icon(
                  Icons.lock_outline,
                  size: 12,
                  color: AppColors.muted,
                ),
              ),
              KeyValue(
                'Members',
                record.memberCount == null
                    ? 'Not recorded'
                    : formatAmount(record.memberCount!.toDouble()),
                missing: record.memberCount == null,
              ),
              KeyValue(
                'Assigned SPC',
                spc?.displayName ?? 'Not assigned',
                missing: spc == null,
              ),
              KeyValue(
                'Landline',
                record.landline ?? 'No landline',
                missing: record.landline == null,
              ),
            ]),
            if (viewOnly) ...[
              const SizedBox(height: 12),
              KeyValue(
                'Address',
                address.isEmpty ? 'Not recorded' : address,
                missing: address.isEmpty,
              ),
            ],
          ],
        ),
        _gap,
        _GradeCard(record: record, open: open),
        if (!viewOnly) ...[
          _gap,
          RecordCard(
            title: 'Address and location',
            children: [
              Text(
                address.isEmpty ? 'Address not recorded' : address,
                style: RecordStyle.body,
              ),
              if (record.latitude != null && record.longitude != null) ...[
                const SizedBox(height: 10),
                MapPreview(
                  height: 110,
                  location: GeoLocation(
                    latitude: record.latitude!,
                    longitude: record.longitude!,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  '${record.latitude!.toStringAsFixed(4)}° N, ${record.longitude!.toStringAsFixed(4)}° E',
                  style: RecordStyle.caption,
                ),
              ],
            ],
          ),
        ],
        _gap,
        RecordCard(
          title: 'Business run by the society',
          children: [
            Text(
              record.businessDescription ?? 'None recorded.',
              style: RecordStyle.body,
            ),
            if (record.businessDescription != null) ...[
              const SizedBox(height: 6),
              const Text(
                'Information only — the app keeps no sales, stock or business accounts.',
                style: RecordStyle.caption,
              ),
            ],
          ],
        ),
        if (!viewOnly) ...[
          _gap,
          _OfficeBearersCard(record: record),
          _gap,
          RecordCard(
            title: 'Responsible staff',
            trailing: const LockedNote('Assigned by HQ'),
            children: [
              KeyValueGrid([
                for (final role in const [
                  UserRole.districtManager,
                  UserRole.deputyDistrictManager,
                  UserRole.programmeCoordinator,
                  UserRole.societyOfficer,
                ])
                  KeyValue(
                    role == UserRole.districtManager
                        ? 'District Manager'
                        : role.recordLabel,
                    record.staffWithRole(role)?.displayName ?? 'Not assigned',
                    missing: record.staffWithRole(role) == null,
                  ),
              ]),
            ],
          ),
        ],
        if (viewOnly) ...[
          _gap,
          RecordNote(
            icon: Icons.lock_outline,
            message:
                permissions.viewOnlyReason ==
                    ViewOnlyReason.temporaryDistrictAccess
                ? 'You can look at this society while your temporary access lasts. You cannot edit it or request a grade change.'
                : 'District Managers view district societies. You cannot edit this society or request a grade change.',
          ),
        ],
        if (record.lastChangeAt != null && record.lastChangeBy != null) ...[
          const SizedBox(height: 12),
          Text(
            'Last changed by ${record.lastChangeBy!.label} · ${formatWhen(record.lastChangeAt!, now)}',
            style: RecordStyle.caption,
            textAlign: TextAlign.center,
          ),
        ],
      ],
    );
  }
}

class _GradeCard extends StatelessWidget {
  const _GradeCard({required this.record, required this.open});

  final SocietyRecord record;
  final Future<void> Function(Widget screen) open;

  @override
  Widget build(BuildContext context) {
    final permissions = record.permissions;
    final request = record.openGradeRequest;
    final now = DemoScope.of(context).now;
    return RecordCard(
      title: 'Grade',
      trailing: const LockedNote('Set by HQ'),
      children: [
        Row(
          children: [
            GradeBadge(record.grade),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    record.grade == null
                        ? 'Grade not set'
                        : 'Grade ${record.grade} · ${gradeLabels[record.grade]}',
                    style: RecordStyle.value,
                  ),
                  if (record.gradeChangedAt != null)
                    Text(
                      'Approved by HQ · ${formatDate(record.gradeChangedAt!)}',
                      style: RecordStyle.caption,
                    )
                  else if (request == null)
                    const Text(
                      'No open grade-change request',
                      style: RecordStyle.caption,
                    ),
                ],
              ),
            ),
          ],
        ),
        if (request != null) ...[
          const SizedBox(height: 10),
          Semantics(
            button: true,
            child: InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: () => open(GradeRequestsScreen(record: record)),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF6DA),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFEFD98F)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Padding(
                      padding: EdgeInsets.only(top: 1),
                      child: Icon(
                        Icons.schedule,
                        size: 14,
                        color: AppColors.warning,
                      ),
                    ),
                    const SizedBox(width: 7),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Request: ${request.change} · Waiting for HQ',
                            style: const TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w800,
                              color: AppColors.warning,
                            ),
                          ),
                          Text(
                            'Sent by ${request.requestedBy.label} · ${formatWhen(request.requestedAt, now)}',
                            style: const TextStyle(
                              fontSize: 10.5,
                              color: AppColors.warning,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ] else if (record.gradeChangedAt != null) ...[
          const SizedBox(height: 4),
          const Text(
            'No open grade-change request',
            style: RecordStyle.caption,
          ),
        ],
        // M06q opens from the request box while one is waiting.
        if (request == null) ...[
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              if (permissions.canRequestGradeChange)
                OutlinedButton(
                  style: compactOutlinedStyle,
                  onPressed: () =>
                      open(GradeChangeRequestScreen(record: record)),
                  child: const Text('Request a grade change'),
                ),
              TextButton(
                style: compactTextStyle,
                onPressed: () => open(GradeRequestsScreen(record: record)),
                child: const Text('Earlier requests'),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

/// M06 (2 of 2): the three office bearers and the Exco count.
class _OfficeBearersCard extends StatelessWidget {
  const _OfficeBearersCard({required this.record});

  final SocietyRecord record;

  @override
  Widget build(BuildContext context) {
    String bearer(String office) =>
        record.exco
            .where((member) => member.position == office)
            .firstOrNull
            ?.fullName ??
        'Not chosen';
    final complete = record.exco.length == 25;
    return RecordCard(
      title: 'Exco · office bearers',
      trailing: record.exco.isEmpty
          ? null
          : InkWell(
              onTap: () => DefaultTabController.of(context).animateTo(1),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'All ${record.exco.length} members',
                    style: RecordStyle.link,
                  ),
                  const Icon(
                    Icons.chevron_right,
                    size: 16,
                    color: AppColors.leaf,
                  ),
                ],
              ),
            ),
      children: [
        KeyValueGrid([
          KeyValue('President', bearer('President')),
          KeyValue('Secretary', bearer('Secretary')),
          KeyValue('Treasurer', bearer('Treasurer')),
          KeyValue(
            'Exco',
            record.exco.isEmpty
                ? 'Not entered yet'
                : '${record.exco.length} of 25',
            missing: record.exco.isEmpty,
            trailing: complete
                ? const Icon(Icons.check, size: 13, color: AppColors.leaf)
                : null,
          ),
        ]),
      ],
    );
  }
}

/// M06 annual financial summary card, or M06fx when the year is incomplete.
class _AnnualSummaryCard extends StatelessWidget {
  const _AnnualSummaryCard({required this.record, required this.open});

  final SocietyRecord record;
  final Future<void> Function(Widget screen) open;

  @override
  Widget build(BuildContext context) {
    final summary = record.annualSummary;
    final permissions = record.permissions;
    final report = summary.auditReport;
    final figuresMissing = !summary.figuresAdded;
    final now = DemoScope.of(context).now;

    Widget tile(String label, double? value, {required bool profit}) =>
        Expanded(
          child: Container(
            constraints: const BoxConstraints(minHeight: 70),
            padding: const EdgeInsets.fromLTRB(10, 8, 10, 9),
            decoration: BoxDecoration(
              color: value == null
                  ? AppColors.surface
                  : profit
                  ? const Color(0xFFEFF7F0)
                  : const Color(0xFFFFF8E8),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: value == null
                    ? AppColors.line
                    : profit
                    ? const Color(0xFFBFDCC6)
                    : const Color(0xFFEFD89A),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(label, style: RecordStyle.label),
                const SizedBox(height: 4),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    value == null ? 'Not added yet' : formatLkr(value),
                    style: TextStyle(
                      fontSize: value == null ? 13 : 16,
                      fontWeight: FontWeight.w800,
                      color: value == null
                          ? const Color(0xFF9AA39D)
                          : profit
                          ? AppColors.pine
                          : const Color(0xFF8A6400),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );

    return RecordCard(
      color: figuresMissing ? const Color(0xFFFFFCF2) : AppColors.surface,
      borderColor: figuresMissing ? const Color(0xFFEFD98F) : AppColors.line,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                'Annual financial summary · ${summary.financialYear.label}',
                style: RecordStyle.cardTitle,
              ),
            ),
            if (figuresMissing)
              const RecordChip('Not added', tone: ChipTone.warning)
            else if (permissions.canEditAnnualSummary)
              Semantics(
                button: true,
                label: 'Edit the yearly figures',
                child: InkWell(
                  borderRadius: BorderRadius.circular(6),
                  onTap: () => open(AnnualSummaryScreen(record: record)),
                  child: const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.edit_outlined,
                          size: 13,
                          color: AppColors.leaf,
                        ),
                        SizedBox(width: 3),
                        Text('Edit', style: RecordStyle.link),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 10),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              tile(
                'Total profit for the year',
                summary.totalProfit,
                profit: true,
              ),
              const SizedBox(width: 8),
              tile(
                'Total expenses for the year',
                summary.totalExpenses,
                profit: false,
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            const Icon(
              Icons.insert_drive_file_outlined,
              size: 18,
              color: AppColors.inkSoft,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Audit report ${summary.financialYear.label}',
                    style: RecordStyle.value,
                  ),
                  Text(
                    report == null
                        ? 'Not uploaded yet'
                        : '${report.fileName.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Photo'} · uploaded ${formatWhen(report.uploadedAt, now)} by ${report.uploadedBy.displayName}',
                    style: RecordStyle.caption,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 6),
            report == null
                ? const RecordChip('Missing', tone: ChipTone.danger)
                : const RecordChip('Uploaded', tone: ChipTone.success),
          ],
        ),
        if ((figuresMissing && permissions.canEditAnnualSummary) ||
            (report == null && permissions.canUploadAuditReport)) ...[
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (figuresMissing && permissions.canEditAnnualSummary)
                FilledButton.icon(
                  style: compactFilledStyle,
                  onPressed: () => open(AnnualSummaryScreen(record: record)),
                  icon: const Icon(Icons.add, size: 15),
                  label: const Text('Add figures'),
                ),
              if (report == null && permissions.canUploadAuditReport)
                OutlinedButton.icon(
                  style: compactOutlinedStyle,
                  onPressed: () =>
                      open(AuditReportUploadScreen(record: record)),
                  icon: const Icon(Icons.upload_outlined, size: 15),
                  label: const Text('Upload audit report'),
                ),
            ],
          ),
        ],
        if (summary.lastChange != null) ...[
          const SizedBox(height: 10),
          const Divider(height: 1),
          const SizedBox(height: 8),
          Text(
            'Updated by ${summary.lastChange!.updatedBy.label} · ${formatDate(summary.lastChange!.updatedAt)} · two yearly totals only',
            style: RecordStyle.caption,
          ),
        ],
      ],
    );
  }
}

class _ExcoTab extends StatelessWidget {
  const _ExcoTab({required this.record});

  final SocietyRecord record;

  @override
  Widget build(BuildContext context) {
    final members = [...record.exco]
      ..sort((a, b) {
        int rank(ExcoMember m) => m.isOfficeBearer
            ? const ['President', 'Secretary', 'Treasurer'].indexOf(m.position)
            : 9;
        return rank(a).compareTo(rank(b)) != 0
            ? rank(a).compareTo(rank(b))
            : a.seatNumber.compareTo(b.seatNumber);
      });
    if (members.isEmpty) {
      return const StateMessage(
        icon: Icons.groups_outlined,
        title: 'No Exco members yet',
        message: 'The 25 Exco members will appear here once they are entered.',
      );
    }
    final bearers = members.where((m) => m.isOfficeBearer).toList();
    final others = members.where((m) => !m.isOfficeBearer).toList();
    Widget row(ExcoMember member) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          CircleAvatar(
            radius: 15,
            backgroundColor: AppColors.mint,
            child: Text(
              member.fullName
                  .split(RegExp(r'[ .]+'))
                  .where((part) => part.isNotEmpty)
                  .take(2)
                  .map((part) => part[0])
                  .join(),
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: AppColors.forest,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(member.fullName, style: RecordStyle.value),
                Text(
                  [
                    if (member.age != null) '${member.age} yrs',
                    if (member.isOfficeBearer) member.position,
                  ].join(' · '),
                  style: RecordStyle.caption,
                ),
              ],
            ),
          ),
          NicRevealButton(
            societyId: record.id,
            memberId: member.id,
            masked: member.nicMasked,
          ),
        ],
      ),
    );
    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
      children: [
        RecordNote(
          icon: Icons.shield_outlined,
          tone: NoteTone.success,
          message:
              'Personal details · ${record.nameEn} · you can see them because this society is in your scope.',
        ),
        const SizedBox(height: 12),
        const Text('OFFICE BEARERS', style: RecordStyle.sectionLabel),
        const SizedBox(height: 6),
        RecordCard(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          children: [for (final member in bearers) row(member)],
        ),
        const SizedBox(height: 12),
        Text('MEMBERS · ${others.length}', style: RecordStyle.sectionLabel),
        const SizedBox(height: 6),
        RecordCard(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          children: [for (final member in others) row(member)],
        ),
      ],
    );
  }
}

/// Loads one tab's data with the standard loading, error and empty states.
class _AsyncTab<T> extends StatefulWidget {
  const _AsyncTab({
    super.key,
    required this.load,
    required this.builder,
    required this.loadingLabel,
    required this.errorTitle,
  });

  final Future<T> Function(SocietyRecordApi api) load;
  final Widget Function(BuildContext context, T data, VoidCallback reload)
  builder;
  final String loadingLabel;
  final String errorTitle;

  @override
  State<_AsyncTab<T>> createState() => _AsyncTabState<T>();
}

class _AsyncTabState<T> extends State<_AsyncTab<T>>
    with AutomaticKeepAliveClientMixin {
  T? _data;
  SocietyRecordException? _error;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final data = await widget.load(DemoScope.read(context).societyRecords);
      if (mounted) setState(() => _data = data);
    } on SocietyRecordException catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    if (_error != null) {
      return StateMessage(
        icon: Icons.error_outline,
        tone: StateTone.error,
        isAlert: true,
        title: widget.errorTitle,
        message: '${_error!.message} Nothing you entered has been lost.',
        primaryLabel: 'Try again',
        onPrimary: _load,
      );
    }
    final data = _data;
    if (data == null) return LoadingSkeleton(label: widget.loadingLabel);
    return RefreshIndicator(
      onRefresh: _load,
      child: widget.builder(context, data, _load),
    );
  }
}

const _months = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', //
  'August', 'September', 'October', 'November', 'December',
];

class _WorkPlanTab extends StatelessWidget {
  const _WorkPlanTab({required this.societyId});

  final String societyId;

  @override
  Widget build(BuildContext context) => _AsyncTab<WorkPlan>(
    load: (api) => api.fetchWorkPlan(societyId),
    loadingLabel: 'Loading the work plan',
    errorTitle: "Couldn't load the work plan",
    builder: (context, plan, _) => ListView(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
      children: [
        const RecordNote(
          icon: Icons.info_outline,
          tone: NoteTone.warning,
          dashed: true,
          title: 'Activity planning only',
          message: 'Costs are planned allocations for each activity. They are not payments or accounts — no loans, savings or transactions are kept.',
        ),
        const SizedBox(height: 10),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: RecordCard(
                  padding: const EdgeInsets.all(12),
                  children: [
                    const Text('Activities planned', style: RecordStyle.label),
                    const SizedBox(height: 2),
                    Text(
                      '${plan.activities.length}',
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        color: AppColors.pine,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: RecordCard(
                  padding: const EdgeInsets.all(12),
                  children: [
                    const Text(
                      'Allocated (planning)',
                      style: RecordStyle.label,
                    ),
                    const SizedBox(height: 2),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(
                        formatLkr(plan.totalAllocated),
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          color: AppColors.pine,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 6),
        if (plan.activities.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 24),
            child: Text(
              'No activities planned for ${plan.year} yet.',
              textAlign: TextAlign.center,
              style: RecordStyle.body,
            ),
          )
        else
          for (final month in {for (final a in plan.activities) a.month}) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(2, 10, 2, 6),
              child: Text(
                _months[month - 1].toUpperCase(),
                style: RecordStyle.sectionLabel,
              ),
            ),
            for (final activity in plan.activities.where(
              (a) => a.month == month,
            ))
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: RecordCard(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(activity.name, style: RecordStyle.value),
                              if (activity.datesLabel != null ||
                                  activity.sector != null)
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
                      ],
                    ),
                  ],
                ),
              ),
          ],
      ],
    ),
  );
}

const _annualTypes = [
  ('AGM_MINUTES', 'AGM minutes'),
  ('OFFICE_BEARER_LIST', 'Office-bearer list'),
  ('MEMBERS_LIST', 'Signed members list'),
];

/// M13 documents: the audit report with its year and uploader, the other
/// annual documents, then every society file.
class _DocumentsTab extends StatelessWidget {
  const _DocumentsTab({required this.record, required this.open});

  final SocietyRecord record;
  final Future<void> Function(Widget screen) open;

  @override
  Widget build(BuildContext context) {
    final now = DemoScope.of(context).now;
    return _AsyncTab<List<RecordDocument>>(
      load: (api) => api.fetchDocuments(record.id),
      loadingLabel: 'Loading documents',
      errorTitle: "Couldn't load documents",
      builder: (context, documents, reload) {
        final year = record.annualSummary.financialYear;
        final audit = documents
            .where(
              (d) =>
                  d.documentType == 'AUDIT_REPORT' &&
                  d.financialYearLabel == year.label,
            )
            .firstOrNull;
        RecordDocument? latest(String type) => documents
            .where(
              (d) => d.documentType == type && d.uploadedAt?.year == now.year,
            )
            .firstOrNull;
        String uploader(RecordDocument document) =>
            '${document.uploadedBy}${document.uploadedByRole == null ? '' : ' (${document.uploadedByRole!.recordLabel})'}';
        final annual = [
          (
            'Audit report · ${year.label}',
            audit,
            audit == null
                ? 'Not uploaded yet'
                : '${audit.fileName} · ${formatFileSize(audit.sizeBytes)}\nUploaded ${formatDate(audit.uploadedAt!)} by ${uploader(audit)}',
          ),
          for (final (type, label) in _annualTypes)
            (
              '$label ${now.year}',
              latest(type),
              latest(type) == null
                  ? (type == 'MEMBERS_LIST'
                        ? 'Only the DM and HQ can open this file'
                        : 'Not uploaded yet')
                  : 'Uploaded ${formatWhen(latest(type)!.uploadedAt!, now)} by ${latest(type)!.uploadedBy}',
            ),
        ];
        final uploaded = annual.where((row) => row.$2 != null).length;
        final others = documents
            .where((d) => !annual.any((row) => row.$2?.id == d.id))
            .toList();
        return ListView(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
          children: [
            if (record.permissions.canUploadAuditReport)
              Align(
                alignment: Alignment.centerRight,
                child: FilledButton.icon(
                  style: compactFilledStyle,
                  onPressed: () async {
                    await open(AuditReportUploadScreen(record: record));
                    reload();
                  },
                  icon: const Icon(Icons.upload_outlined, size: 15),
                  label: const Text('Upload'),
                ),
              ),
            if (record.permissions.canUploadAuditReport)
              const SizedBox(height: 8),
            RecordCard(
              color: const Color(0xFFF3F8F3),
              children: [
                Text(
                  'Annual documents · ${now.year}',
                  style: RecordStyle.cardTitle,
                ),
                Text(
                  '$uploaded of ${annual.length} uploaded',
                  style: RecordStyle.caption,
                ),
                const SizedBox(height: 8),
                for (final (index, row) in annual.indexed)
                  Container(
                    margin: const EdgeInsets.only(bottom: 6),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: index == 0 && row.$2 != null
                          ? const Color(0xFFE4F1E6)
                          : AppColors.surface,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.line),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        CircleAvatar(
                          radius: 10,
                          backgroundColor: AppColors.mint,
                          child: Text(
                            '${index + 1}',
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: AppColors.forest,
                            ),
                          ),
                        ),
                        const SizedBox(width: 9),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(row.$1, style: RecordStyle.value),
                              Text(row.$3, style: RecordStyle.caption),
                            ],
                          ),
                        ),
                        const SizedBox(width: 6),
                        row.$2 != null
                            ? const RecordChip(
                                'Uploaded',
                                tone: ChipTone.success,
                              )
                            : row.$3.startsWith('Only the DM')
                            ? const RecordChip('Restricted')
                            : const RecordChip(
                                'Missing',
                                tone: ChipTone.danger,
                              ),
                      ],
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 14),
            const Text('ALL DOCUMENTS', style: RecordStyle.sectionLabel),
            const SizedBox(height: 6),
            if (others.isEmpty)
              const Text('No other documents yet.', style: RecordStyle.body)
            else
              RecordCard(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                children: [
                  for (final (index, document) in others.indexed) ...[
                    if (index > 0) const Divider(height: 1),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.insert_drive_file_outlined,
                            size: 18,
                            color: AppColors.inkSoft,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(document.title, style: RecordStyle.value),
                                Text(
                                  [
                                    document.financialYearLabel ?? 'PDF',
                                    if (document.uploadedAt != null)
                                      formatDate(document.uploadedAt!),
                                  ].join(' · '),
                                  style: RecordStyle.caption,
                                ),
                              ],
                            ),
                          ),
                          const Icon(
                            Icons.chevron_right,
                            size: 18,
                            color: AppColors.muted,
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            const SizedBox(height: 10),
            const Text(
              'Uploads are stored privately for the society record. Nothing here needs District approval.',
              style: RecordStyle.caption,
              textAlign: TextAlign.center,
            ),
          ],
        );
      },
    );
  }
}

const _historyFilters = [
  (null, 'All'),
  ('SOCIETY', 'Society'),
  ('EXCO', 'Exco'),
  ('WORK_PLAN', 'Work plan'),
  ('ANNUAL_SUMMARY', 'Annual summary'),
  ('GRADE', 'Grade'),
];

/// M06h change history: every change with who made it and when.
class _HistoryTab extends StatefulWidget {
  const _HistoryTab({required this.societyId});

  final String societyId;

  @override
  State<_HistoryTab> createState() => _HistoryTabState();
}

class _HistoryTabState extends State<_HistoryTab> {
  String? _category;

  @override
  Widget build(BuildContext context) {
    final now = DemoScope.of(context).now;
    return Column(
      children: [
        SizedBox(
          height: 48,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 4),
            children: [
              for (final (value, label) in _historyFilters)
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ChoiceChip(
                    label: Text(label),
                    selected: _category == value,
                    showCheckmark: false,
                    visualDensity: VisualDensity.compact,
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    shape: const StadiumBorder(),
                    side: BorderSide(
                      color: _category == value
                          ? AppColors.forest
                          : AppColors.line,
                    ),
                    labelStyle: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      color: _category == value
                          ? Colors.white
                          : AppColors.inkSoft,
                    ),
                    onSelected: (_) => setState(() => _category = value),
                  ),
                ),
            ],
          ),
        ),
        Expanded(
          child: _AsyncTab<List<HistoryEvent>>(
            key: ValueKey(_category),
            load: (api) =>
                api.fetchHistory(widget.societyId, category: _category),
            loadingLabel: 'Loading the change history',
            errorTitle: "Couldn't load the change history",
            builder: (context, events, _) => ListView(
              padding: const EdgeInsets.fromLTRB(14, 8, 14, 24),
              children: [
                if (events.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 24),
                    child: Text(
                      'No changes recorded here yet.',
                      textAlign: TextAlign.center,
                      style: RecordStyle.body,
                    ),
                  )
                else
                  RecordCard(
                    padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
                    children: [
                      for (final (index, event) in events.indexed)
                        RecordTimelineEntry(
                          title: event.summary,
                          detail:
                              '${event.actor.label} · ${formatWhen(event.occurredAt, now)}',
                          ringColor: event.category == 'GRADE'
                              ? AppColors.orangeChanged
                              : AppColors.forest,
                          last: index == events.length - 1,
                        ),
                    ],
                  ),
                const SizedBox(height: 10),
                const Text(
                  'Every change shows who made it and when.',
                  style: RecordStyle.caption,
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
