import 'package:flutter/material.dart';

import '../format.dart';
import '../l10n/l10n.dart';
import '../l10n/l10n_format.dart';
import '../l10n/record_l10n.dart';
import '../models/society.dart';
import '../models/user.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/street_map.dart';
import '../widgets/state_views.dart';
import 'annual_summary_screen.dart';
import 'document_upload_screen.dart';
import 'work_plan_view.dart';
import 'edit_society_screen.dart';
import 'grade_change_request_screen.dart';
import 'grade_requests_screen.dart';
import 'exco_screens.dart';
import 'membership_widgets.dart';
import 'record_widgets.dart';
import 'society_record_api.dart';
import 'society_record_models.dart';

/// M06 society detail (with M06v view only and M06fx summary not added).
/// Tabs: Overview, Members & Exco, Work plan, Documents and History.
class SocietyRecordScreen extends StatefulWidget {
  const SocietyRecordScreen({
    super.key,
    required this.societyId,
    this.showBack = true,
    this.initialTab = 0,
  });

  final String societyId;

  /// False when the record is the Society Officer's home tab.
  final bool showBack;

  /// Tab shown first: 0 Overview, 1 Members & Exco, 2 Work plan, 3 Documents,
  /// 4 History.
  final int initialTab;

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
    final l = context.l10n;
    final record = _record;
    final user = DemoScope.of(context).user!;
    return DefaultTabController(
      length: 5,
      initialIndex: widget.initialTab,
      child: Scaffold(
        appBar: AppBar(
          toolbarHeight: 58,
          automaticallyImplyLeading: widget.showBack,
          titleSpacing: widget.showBack ? 0 : 16,
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                record?.nameEn ?? l.recTitle,
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
                  label: Text(l.recEdit),
                ),
              )
            else if (record != null)
              Padding(
                padding: const EdgeInsets.only(right: 12),
                child: Center(
                  child: RecordChip(l.recViewOnly, icon: Icons.lock_outline),
                ),
              ),
          ],
          bottom: record == null
              ? null
              : PreferredSize(
                  preferredSize: const Size.fromHeight(40),
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
                        Tab(height: recordTabHeight, text: l.recTabOverview),
                        Tab(height: recordTabHeight, text: l.recTabMembersExco),
                        Tab(height: recordTabHeight, text: l.recTabWorkPlan),
                        Tab(height: recordTabHeight, text: l.recTabDocuments),
                        Tab(height: recordTabHeight, text: l.recTabHistory),
                      ],
                    ),
                  ),
                ),
        ),
        body: _loading && record == null
            ? LoadingSkeleton(label: l.recLoading)
            : _error != null && record == null
            // The API answers 403 or 404 for a society outside the user's
            // scope; neither is shown as an error, and nothing is named.
            ? (_error!.status == 403 || _error!.status == 404)
                  ? NoAccessView(
                      title: l.recNoAccessSociety,
                      onBack: () => Navigator.maybePop(context),
                    )
                  : StateMessage(
                      icon: Icons.error_outline,
                      tone: StateTone.error,
                      isAlert: true,
                      title: l.recLoadError,
                      message: l.recNothingLost(l.recordError(_error!)),
                      primaryLabel: l.commonTryAgain,
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
                        _ExcoTab(record: record, open: _open),
                        _WorkPlanTab(record: record),
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

/// Height of each society record tab: a comfortable touch target (at least
/// 44 logical pixels), as in the V6 prototype.
const double recordTabHeight = 44;

const _gap = SizedBox(height: 10);

class _OverviewTab extends StatelessWidget {
  const _OverviewTab({required this.record, required this.open});

  final SocietyRecord record;
  final Future<void> Function(Widget screen) open;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final permissions = record.permissions;
    final viewOnly = !permissions.canEdit;
    final summary = record.annualSummary;
    final now = DemoScope.of(context).now;
    // Issue #141: the split with the total, or the total with a note.
    final members = record.memberCount == null
        ? l.recNotRecorded
        : record.hasMemberSplit
        ? l.recMembersSplit(
            record.memberCount!,
            record.femaleMembers!,
            record.maleMembers!,
          )
        : l.recMembersNoSplit(record.memberCount!);
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
                  l.recMembers,
                  members,
                  missing: record.memberCount == null,
                ),
                KeyValue(l.recGrade, record.grade ?? l.recNotSet),
                KeyValue(
                  l.recRoleSocietyOfficer,
                  l.recNotAssigned,
                  missing: true,
                ),
                KeyValue(
                  l.recLastUpdate,
                  record.lastChangeAt == null
                      ? l.recNoChanges
                      : l.recordWhen(record.lastChangeAt!, now),
                ),
              ]),
            ],
          ),
          const SizedBox(height: 6),
          Text(l.recSpcAddsFigures, style: RecordStyle.caption),
          _gap,
        ],
        RecordCard(
          children: [
            Text(l.recSocietyName, style: RecordStyle.label),
            const SizedBox(height: 2),
            Text(record.nameEn, style: RecordStyle.value),
            if (record.nameLocal != null)
              Text(record.nameLocal!, style: RecordStyle.caption),
            const SizedBox(height: 12),
            KeyValueGrid([
              KeyValue(
                l.recSNumber,
                record.societyCode,
                trailing: const Icon(
                  Icons.lock_outline,
                  size: 12,
                  color: AppColors.muted,
                ),
              ),
              KeyValue(
                l.recMembers,
                members,
                missing: record.memberCount == null,
              ),
              KeyValue(
                l.recAssignedSpc,
                spc?.displayName ?? l.recNotAssigned,
                missing: spc == null,
              ),
              KeyValue(
                l.recLandline,
                record.landline ?? l.recNoLandline,
                missing: record.landline == null,
              ),
            ]),
            if (viewOnly) ...[
              const SizedBox(height: 12),
              KeyValue(
                l.recAddress,
                address.isEmpty ? l.recNotRecorded : address,
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
            title: l.recAddressLocation,
            children: [
              Text(
                address.isEmpty ? l.recAddressNotRecorded : address,
                style: RecordStyle.body,
              ),
              if (record.latitude != null && record.longitude != null) ...[
                const SizedBox(height: 10),
                SocietyStreetMap(
                  height: 110,
                  location: GeoLocation(
                    latitude: record.latitude!,
                    longitude: record.longitude!,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  l.editCoordinates(
                    record.latitude!.toStringAsFixed(4),
                    record.longitude!.toStringAsFixed(4),
                  ),
                  style: RecordStyle.caption,
                ),
              ],
            ],
          ),
        ],
        _gap,
        RecordCard(
          title: l.recBusiness,
          children: [
            Text(
              record.businessDescription ?? l.recNoneRecorded,
              style: RecordStyle.body,
            ),
            if (record.businessDescription != null) ...[
              const SizedBox(height: 6),
              Text(l.recBusinessNote, style: RecordStyle.caption),
            ],
          ],
        ),
        if (!viewOnly) ...[
          _gap,
          _OfficeBearersCard(record: record),
          _gap,
          RecordCard(
            title: l.recStaffTitle,
            trailing: LockedNote(l.recAssignedByHq),
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
                        ? l.recRoleDistrictManager
                        : l.recordRole(role),
                    record.staffWithRole(role)?.displayName ?? l.recNotAssigned,
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
                ? l.recViewOnlyTemporary
                : l.recViewOnlyDm,
          ),
        ],
        if (record.lastChangeAt != null && record.lastChangeBy != null) ...[
          const SizedBox(height: 12),
          Text(
            l.recLastChangedBy(
              l.actor(record.lastChangeBy!),
              l.recordWhen(record.lastChangeAt!, now),
            ),
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
    final l = context.l10n;
    final request = record.openGradeRequest;
    final now = DemoScope.of(context).now;
    return RecordCard(
      title: l.recGrade,
      trailing: LockedNote(l.recSetByHq),
      children: [
        Row(
          children: [
            GradeBadge(record.grade),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l.gradeFull(record.grade), style: RecordStyle.value),
                  if (record.gradeChangedAt != null)
                    Text(
                      l.recApprovedByHq(l.date(record.gradeChangedAt!)),
                      style: RecordStyle.caption,
                    )
                  else if (request == null)
                    Text(l.recNoOpenRequest, style: RecordStyle.caption),
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
                            l.recRequestWaiting(request.change),
                            style: const TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w800,
                              color: AppColors.warning,
                            ),
                          ),
                          Text(
                            l.recSentBy(
                              l.actor(request.requestedBy),
                              l.recordWhen(request.requestedAt, now),
                            ),
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
          Text(l.recNoOpenRequest, style: RecordStyle.caption),
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
                  child: Text(l.recRequestChange),
                ),
              TextButton(
                style: compactTextStyle,
                onPressed: () => open(GradeRequestsScreen(record: record)),
                child: Text(l.recEarlierRequests),
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
    final l = context.l10n;
    String bearer(String office) =>
        record.exco
            .where((member) => member.position == office)
            .firstOrNull
            ?.fullName ??
        l.recNotChosen;
    final status = record.excoStatus;
    final complete = status.complete;
    return RecordCard(
      title: l.recOfficeBearers,
      // The link wraps under large text in Sinhala and Tamil rather than
      // pushing past the card's edge.
      trailing: record.exco.isEmpty
          ? null
          : Flexible(
              child: InkWell(
                onTap: () => DefaultTabController.of(context).animateTo(1),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Flexible(
                      child: Text(
                        l.recAllMembers(record.exco.length),
                        style: RecordStyle.link,
                        textAlign: TextAlign.end,
                      ),
                    ),
                    const Icon(
                      Icons.chevron_right,
                      size: 16,
                      color: AppColors.leaf,
                    ),
                  ],
                ),
              ),
            ),
      children: [
        KeyValueGrid([
          KeyValue(l.recOfficePresident, bearer('President')),
          KeyValue(l.recOfficeSecretary, bearer('Secretary')),
          KeyValue(l.recOfficeTreasurer, bearer('Treasurer')),
          KeyValue(
            'Exco',
            complete ? l.recExcoComplete : l.excoShort(status),
            missing: !complete,
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
                'Annual Financial Summary · ${summary.financialYear.label}',
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
                'Total Profit for the Year',
                summary.totalProfit,
                profit: true,
              ),
              const SizedBox(width: 8),
              tile(
                'Total Expenses for the Year',
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
                    'Audit Report ${summary.financialYear.label}',
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
                  onPressed: () => open(
                    DocumentUploadScreen(
                      record: record,
                      documentType: 'AUDIT_REPORT',
                    ),
                  ),
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

/// V5 M07 / M07s: the 25 Exco members, office bearers first. Tapping a
/// member opens M07v; people who may edit can change an office (M07o).
class _ExcoTab extends StatefulWidget {
  const _ExcoTab({required this.record, required this.open});

  final SocietyRecord record;
  final Future<void> Function(Widget screen) open;

  @override
  State<_ExcoTab> createState() => _ExcoTabState();
}

class _ExcoTabState extends State<_ExcoTab> {
  String _query = '';
  bool _showAll = false;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final record = widget.record;
    final members = [...record.exco]
      ..sort((a, b) => a.seatNumber.compareTo(b.seatNumber));
    final canEdit = record.permissions.canEdit;
    // Issue #143: the society's members come first, then the 25 Exco seats.
    final membership = [
      MembershipCard(
        record: record,
        onEdit: canEdit
            ? () => widget.open(EditMembershipScreen(record: record))
            : null,
      ),
      const SizedBox(height: 18),
      Semantics(
        header: true,
        child: Text(l.memExcoSection, style: RecordStyle.sectionLabel),
      ),
      const SizedBox(height: 8),
    ];
    if (members.isEmpty && !canEdit) {
      return ListView(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
        children: [
          ...membership,
          StateMessage(
            icon: Icons.groups_outlined,
            title: l.excoNoneTitle,
            message: l.excoNoneBody,
          ),
        ],
      );
    }
    final emptySeats = emptyExcoSeats(members);
    final query = _query.trim().toLowerCase();
    bool matches(ExcoMember m) =>
        query.isEmpty ||
        m.fullName.toLowerCase().contains(query) ||
        (m.profession ?? '').toLowerCase().contains(query);
    final others = members
        .where((m) => !m.isOfficeBearer && matches(m))
        .toList();
    final shownOthers = _showAll || query.isNotEmpty
        ? others
        : others.take(8).toList();
    // The API's completion: 25 seats, the seat groups and the three offices.
    final status = record.excoStatus;
    final complete = status.complete;
    final toFill = emptySeats.length;

    Widget row(ExcoMember member, {String? office}) => InkWell(
      onTap: () =>
          widget.open(ExcoMemberScreen(record: record, member: member)),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: [
            CircleAvatar(
              radius: 15,
              backgroundColor: AppColors.mint,
              child: Text(
                initialsOf(member.fullName),
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: AppColors.forest,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              flex: 3,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(member.fullName, style: RecordStyle.value),
                  Text(
                    [
                      if (member.dateOfBirth != null)
                        l.excoYears(
                          ageFrom(member.dateOfBirth!, DateTime.now()),
                        )
                      else if (member.age != null)
                        l.excoYears(member.age!),
                      if (member.profession != null) member.profession!,
                    ].join(' · '),
                    style: RecordStyle.caption,
                  ),
                ],
              ),
            ),
            if (office != null)
              // Longer Sinhala and Tamil labels scale down rather than overflow.
              Flexible(
                flex: 2,
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerRight,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      RecordChip(l.office(office), tone: ChipTone.info),
                      if (canEdit)
                        TextButton(
                          onPressed: () => widget.open(
                            ChooseOfficeBearerScreen(
                              record: record,
                              office: office,
                            ),
                          ),
                          child: Text(l.excoChange),
                        ),
                    ],
                  ),
                ),
              )
            else
              const Icon(Icons.chevron_right, color: AppColors.muted),
          ],
        ),
      ),
    );

    List<Widget> officeRow(String office) {
      final holder = members.where((m) => m.position == office).firstOrNull;
      if (holder != null) {
        return matches(holder) ? [row(holder, office: office)] : [];
      }
      return [
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(
            l.excoOfficeNotChosen(l.office(office)),
            style: RecordStyle.value,
          ),
          trailing: canEdit
              ? TextButton(
                  onPressed: () => widget.open(
                    ChooseOfficeBearerScreen(record: record, office: office),
                  ),
                  child: Text(l.excoChoose),
                )
              : null,
        ),
      ];
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
      children: [
        ...membership,
        Row(
          children: [
            Expanded(
              child: Text(
                complete ? l.excoAllFilled : l.excoEntered(members.length),
                style: RecordStyle.cardTitle,
              ),
            ),
            RecordChip(
              complete
                  ? l.recExcoShortComplete
                  : toFill > 0
                  ? l.excoIncompleteToFill(toFill)
                  : l.excoIncomplete,
              tone: complete ? ChipTone.success : ChipTone.warning,
            ),
          ],
        ),
        if (!complete) ...[
          const SizedBox(height: 8),
          RecordNote(
            icon: Icons.info_outline,
            title: l.excoIncompleteTitle,
            // What is missing, in the API's words (seats, groups, offices).
            // Those sentences stay as the API sends them until phase 9.
            message: [
              ...status.problems,
              if (canEdit && toFill > 0)
                l.excoAddUnderEmpty
              else if (canEdit && status.missingOffices.isNotEmpty)
                l.excoChooseUnderOffices
              else if (!canEdit)
                l.excoOfficerCompletes,
            ].join(' '),
          ),
        ],
        const SizedBox(height: 10),
        RecordNote(
          icon: Icons.shield_outlined,
          tone: NoteTone.success,
          message: l.excoPersonal(record.nameEn, l.excoAccessNote(record)),
        ),
        const SizedBox(height: 10),
        TextField(
          decoration: InputDecoration(
            hintText: l.excoSearch,
            prefixIcon: const Icon(Icons.search),
          ),
          onChanged: (value) => setState(() => _query = value),
        ),
        const SizedBox(height: 12),
        Text(l.excoOfficeBearersSection, style: RecordStyle.sectionLabel),
        const SizedBox(height: 6),
        RecordCard(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          children: [for (final office in officeBearers) ...officeRow(office)],
        ),
        const SizedBox(height: 12),
        Text(
          l.excoMembersSection(others.length),
          style: RecordStyle.sectionLabel,
        ),
        const SizedBox(height: 6),
        RecordCard(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          children: [
            if (others.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Text(l.excoNoMatch, style: RecordStyle.caption),
              ),
            for (final member in shownOthers) row(member),
          ],
        ),
        if (shownOthers.length < others.length)
          TextButton(
            onPressed: () => setState(() => _showAll = true),
            child: Text(l.excoShowAll(others.length)),
          ),
        if (canEdit && emptySeats.isNotEmpty) ...[
          const SizedBox(height: 12),
          Text(
            l.excoEmptySeats(emptySeats.length),
            style: RecordStyle.sectionLabel,
          ),
          const SizedBox(height: 6),
          RecordCard(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            children: [
              for (final seat in emptySeats)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  title: Text(
                    l.excoSeat(seat.seatNumber),
                    style: RecordStyle.value,
                  ),
                  subtitle: Text(
                    l.seatGroup(seat.seatType),
                    style: RecordStyle.caption,
                  ),
                  trailing: TextButton(
                    onPressed: () => widget.open(
                      ExcoMemberFormScreen(
                        record: record,
                        member: seat,
                        replace: true,
                      ),
                    ),
                    child: Text(
                      l.excoAdd,
                      semanticsLabel: l.excoAddToSeat(seat.seatNumber),
                    ),
                  ),
                ),
            ],
          ),
        ],
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
    final l = context.l10n;
    if (_error != null) {
      return StateMessage(
        icon: Icons.error_outline,
        tone: StateTone.error,
        isAlert: true,
        title: widget.errorTitle,
        message: l.recNothingLost(l.recordError(_error!)),
        primaryLabel: l.commonTryAgain,
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

class _WorkPlanTab extends StatelessWidget {
  const _WorkPlanTab({required this.record});

  final SocietyRecord record;

  @override
  Widget build(BuildContext context) => _AsyncTab<WorkPlan>(
    load: (api) => api.fetchWorkPlan(record.id),
    loadingLabel: 'Loading the work plan',
    errorTitle: "Couldn't load the work plan",
    builder: (context, plan, reload) => WorkPlanView(
      plan: plan,
      societyId: record.id,
      societyName: record.nameEn,
      spcName: record.staff
          .where((member) => member.role == UserRole.programmeCoordinator)
          .firstOrNull
          ?.displayName,
      reload: reload,
    ),
  );
}

/// M13 documents: the four annual Registrar documents for the year, then
/// every society file.
class _DocumentsTab extends StatelessWidget {
  const _DocumentsTab({required this.record, required this.open});

  final SocietyRecord record;
  final Future<void> Function(Widget screen) open;

  @override
  Widget build(BuildContext context) {
    final now = DemoScope.of(context).now;
    final canUpload = uploadableDocumentTypes(record.permissions).isNotEmpty;
    return _AsyncTab<(RegistrarDocuments, List<RecordDocument>)>(
      load: (api) async => (
        await api.fetchRegistrarDocuments(record.id),
        await api.fetchDocuments(record.id),
      ),
      loadingLabel: 'Loading documents',
      errorTitle: "Couldn't load documents",
      builder: (context, data, reload) {
        final (registrar, documents) = data;
        final annualIds = {
          for (final document in registrar.documents.values) ?document?.id,
        };
        final others = documents
            .where((d) => !annualIds.contains(d.id))
            .toList();
        return ListView(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
          children: [
            if (canUpload) ...[
              Align(
                alignment: Alignment.centerRight,
                child: FilledButton.icon(
                  style: compactFilledStyle,
                  onPressed: () async {
                    await open(DocumentUploadScreen(record: record));
                    reload();
                  },
                  icon: const Icon(Icons.upload_outlined, size: 15),
                  label: const Text('Upload'),
                ),
              ),
              const SizedBox(height: 8),
            ],
            RecordCard(
              color: const Color(0xFFF3F8F3),
              children: [
                Text(
                  'Annual Documents · ${registrar.yearLabel}',
                  style: RecordStyle.cardTitle,
                ),
                Text(
                  '${registrar.submitted} of ${registrarDocumentTypes.length} uploaded',
                  style: RecordStyle.caption,
                ),
                const SizedBox(height: 8),
                for (final (index, type) in registrarDocumentTypes.indexed)
                  _RegistrarRow(
                    number: index + 1,
                    type: type,
                    document: registrar.documents[type],
                    now: now,
                    onUpload:
                        canUpload &&
                            uploadableDocumentTypes(record.permissions)
                                .contains(type)
                        ? () async {
                            await open(
                              DocumentUploadScreen(
                                record: record,
                                documentType: type,
                                financialYear: registrar.startYear,
                              ),
                            );
                            reload();
                          }
                        : null,
                  ),
              ],
            ),
            const SizedBox(height: 14),
            const Text('All Documents', style: RecordStyle.sectionLabel),
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
                          Icon(
                            document.documentType == 'ACTIVITY_EVIDENCE'
                                ? Icons.photo_outlined
                                : Icons.insert_drive_file_outlined,
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
                                    document.financialYearLabel ??
                                        documentTypeLabels[document
                                            .documentType] ??
                                        'Document',
                                    if (document.uploadedAt != null)
                                      formatDate(document.uploadedAt!),
                                  ].join(' · '),
                                  style: RecordStyle.caption,
                                ),
                              ],
                            ),
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

/// One of the four Registrar documents: uploaded with who and when, or
/// "Not submitted".
class _RegistrarRow extends StatelessWidget {
  const _RegistrarRow({
    required this.number,
    required this.type,
    required this.document,
    required this.now,
    this.onUpload,
  });

  final int number;
  final String type;
  final RegistrarDocument? document;
  final DateTime now;
  final VoidCallback? onUpload;

  @override
  Widget build(BuildContext context) {
    final document = this.document;
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: document != null ? const Color(0xFFE4F1E6) : AppColors.surface,
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
              '$number',
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
                Text(documentTypeLabels[type]!, style: RecordStyle.value),
                Text(
                  document == null
                      ? 'Not submitted'
                      : '${document.fileName} · ${formatFileSize(document.sizeBytes)}\nUploaded ${formatWhen(document.uploadedAt, now)} by ${document.uploadedBy.label}${document.canOpen ? '' : '\nOnly the DM and HQ can open this file'}',
                  style: RecordStyle.caption,
                ),
                if (document == null && onUpload != null)
                  TextButton(
                    style: TextButton.styleFrom(
                      padding: EdgeInsets.zero,
                      minimumSize: const Size(0, 32),
                    ),
                    onPressed: onUpload,
                    child: const Text('Upload'),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 6),
          document != null
              ? const RecordChip('Uploaded', tone: ChipTone.success)
              : const RecordChip('Not submitted', tone: ChipTone.danger),
        ],
      ),
    );
  }
}

/// The history filters: the API's category, and its label in the language.
List<(String?, String)> _historyFilters(AppLocalizations l) => [
  (null, l.recHistoryAll),
  ('SOCIETY', l.recHistorySociety),
  ('EXCO', l.navExco),
  ('WORK_PLAN', l.recTabWorkPlan),
  ('ANNUAL_SUMMARY', l.recHistoryAnnual),
  ('GRADE', l.recGrade),
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
    final l = context.l10n;
    final now = DemoScope.of(context).now;
    return Column(
      children: [
        SizedBox(
          height: 48,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 4),
            children: [
              for (final (value, label) in _historyFilters(l))
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
            loadingLabel: l.recHistoryLoading,
            errorTitle: l.recHistoryError,
            builder: (context, events, _) => ListView(
              padding: const EdgeInsets.fromLTRB(14, 8, 14, 24),
              children: [
                if (events.isEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 24),
                    child: Text(
                      l.recHistoryNone,
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
                          // The API writes the summary, so it stays as sent.
                          title: event.summary,
                          detail:
                              '${l.actor(event.actor)} · ${l.recordWhen(event.occurredAt, now)}',
                          ringColor: event.category == 'GRADE'
                              ? AppColors.orangeChanged
                              : AppColors.forest,
                          last: index == events.length - 1,
                        ),
                    ],
                  ),
                const SizedBox(height: 10),
                Text(
                  l.recHistoryFooter,
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
