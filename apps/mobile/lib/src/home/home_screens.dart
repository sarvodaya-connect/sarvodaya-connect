import 'package:flutter/material.dart';

import '../district_access/district_access_screens.dart';
import '../incidents/incident_screens.dart';
import '../l10n/l10n.dart';
import '../l10n/l10n_format.dart';
import '../models/user.dart';
import '../national/national_screens.dart' show GradeBadge;
import '../society_record/activity_screens.dart';
import '../society_record/society_record_screen.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/state_views.dart';
import 'home_api.dart';

void _open(BuildContext context, Widget screen) =>
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));

String _roleLine(AppLocalizations l, UserRole role) => switch (role) {
  UserRole.programmeCoordinator => l.roleSpc,
  UserRole.deputyDistrictManager => l.roleDdm,
  UserRole.districtManager => l.roleDm,
  _ => role.label,
};

/// The message for a failed home request: the app's own wording in the
/// chosen language, or what the server said (still English, phase 9).
String _errorText(AppLocalizations l, Object? error, String fallback) =>
    error is HomeException
    ? (error.failure == null ? error.message : l.failure(error.failure!))
    : fallback;

/// V5 M05t: the DDM's temporary district-wide view, with the time left as
/// words. Their own societies stay editable; the rest open view only.
class TemporaryViewCard extends StatelessWidget {
  const TemporaryViewCard({
    super.key,
    required this.grant,
    required this.now,
    this.onBrowse,
  });

  final DistrictAccessGrant grant;
  final DateTime now;
  final VoidCallback? onBrowse;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Semantics(
      container: true,
      label: l.homeTempViewTitle,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFF1F3A5F),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.schedule, size: 16, color: Colors.white),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    l.homeTempViewTitle,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              grant.grantedByName == null
                  ? l.homeTempViewBody
                  : l.homeTempViewBodyGrantedBy(grant.grantedByName!),
              style: const TextStyle(color: Colors.white, fontSize: 12),
            ),
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                l.homeTempViewEnds(
                  l.accessEndsAt(grant.expiresAt),
                  l.accessTimeLeft(grant.expiresAt, now),
                ),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(height: 8),
            TextButton(
              style: TextButton.styleFrom(
                foregroundColor: AppColors.bannerTemporaryBg,
                padding: EdgeInsets.zero,
              ),
              onPressed: onBrowse,
              child: Text(l.homeTempViewBrowse),
            ),
          ],
        ),
      ),
    );
  }
}

/// Loads [load] with the V5 loading, error · retry and no-access states.
class _Loader<T> extends StatefulWidget {
  const _Loader({
    super.key,
    required this.load,
    required this.builder,
    required this.label,
    this.inline = false,
  });

  final Future<T> Function(HomeApi api) load;
  final Widget Function(BuildContext context, T data) builder;
  final String label;

  /// Inside another list: a short loading line and error instead of
  /// full-screen states.
  final bool inline;

  @override
  State<_Loader<T>> createState() => _LoaderState<T>();
}

class _LoaderState<T> extends State<_Loader<T>> {
  Future<T>? _future;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _future ??= widget.load(DemoScope.of(context).home);
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<T>(
    future: _future,
    builder: (context, snapshot) {
      final l = context.l10n;
      if (snapshot.connectionState != ConnectionState.done) {
        if (!widget.inline) return LoadingSkeleton(label: widget.label);
        return Semantics(
          liveRegion: true,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Row(
              children: [
                const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
                const SizedBox(width: 8),
                Text(
                  '${widget.label}…',
                  style: const TextStyle(color: AppColors.muted),
                ),
              ],
            ),
          ),
        );
      }
      final error = snapshot.error;
      if (error is HomeException &&
          (error.status == 403 || error.status == 404)) {
        return const NoAccessView();
      }
      if (error != null && widget.inline) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _errorText(l, error, l.homeErrorSocieties),
              style: const TextStyle(color: AppColors.danger),
            ),
            TextButton(
              onPressed: () => setState(
                () => _future = widget.load(DemoScope.of(context).home),
              ),
              child: Text(l.commonTryAgain),
            ),
          ],
        );
      }
      if (error != null) {
        return StateMessage(
          icon: Icons.error_outline,
          title: l.homeErrorTitle,
          message: _errorText(l, error, l.homeErrorOverview),
          tone: StateTone.error,
          isAlert: true,
          primaryLabel: l.commonTryAgain,
          onPrimary: () =>
              setState(() => _future = widget.load(DemoScope.of(context).home)),
        );
      }
      return widget.builder(context, snapshot.data as T);
    },
  );
}

class _Tile extends StatelessWidget {
  const _Tile(this.label, this.value, {this.colour = AppColors.ink});

  final String label;
  final String value;
  final Color colour;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(10),
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: AppColors.line),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 11.5, color: AppColors.muted),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(
            fontSize: 21,
            fontWeight: FontWeight.w700,
            color: colour,
          ),
        ),
      ],
    ),
  );
}

/// Tiles in a row with equal height.
class _TileRow extends StatelessWidget {
  const _TileRow(this.tiles);

  final List<Widget> tiles;

  @override
  Widget build(BuildContext context) => IntrinsicHeight(
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (index, tile) in tiles.indexed) ...[
          if (index > 0) const SizedBox(width: 8),
          Expanded(child: tile),
        ],
      ],
    ),
  );
}

class _Pill extends StatelessWidget {
  const _Pill(
    this.text, {
    this.colour = AppColors.warning,
    this.background = AppColors.warningSoft,
  });

  final String text;
  final Color colour;
  final Color background;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
    decoration: BoxDecoration(
      color: background,
      borderRadius: BorderRadius.circular(20),
    ),
    child: Text(
      text,
      style: TextStyle(
        fontSize: 11,
        color: colour,
        fontWeight: FontWeight.w700,
      ),
    ),
  );
}

/// One society row: grade, S number, members and when it was updated.
class _SocietyRow extends StatelessWidget {
  const _SocietyRow(this.society, {required this.showScope});

  final HomeSociety society;
  final bool showScope;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return ListTile(
      leading: GradeBadge(society.grade),
      title: Text(
        society.name,
        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
      ),
      subtitle: Text(
        society.members == null
            ? l.homeSocietyLineNoMembers(
                society.code,
                l.date(society.updatedAt),
              )
            : l.homeSocietyLine(
                society.code,
                society.members!,
                l.date(society.updatedAt),
              ),
        style: const TextStyle(fontSize: 12),
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (showScope)
            society.yours
                ? _Pill(
                    l.homeYoursEdit,
                    colour: AppColors.leaf,
                    background: AppColors.mint,
                  )
                : _Pill(
                    l.homeViewOnly,
                    colour: AppColors.inkSoft,
                    background: AppColors.stateGrey,
                  )
          else if (society.pending != null)
            _Pill(l.homeGradeRequest)
          else if (society.stale)
            _Pill(
              l.homeStale,
              colour: AppColors.danger,
              background: AppColors.dangerSoft,
            ),
          const Icon(Icons.chevron_right),
        ],
      ),
      onTap: () => _open(context, SocietyRecordScreen(societyId: society.id)),
    );
  }
}

/// The list of societies with search and filters (M05s, M05d, DD04, M20).
class _SocietyList extends StatefulWidget {
  const _SocietyList({
    required this.showScope,
    this.district = false,
    this.searchHint,
  });

  final bool showScope;
  final bool district;

  /// Defaults to "Search name or S number" in the chosen language.
  final String? searchHint;

  @override
  State<_SocietyList> createState() => _SocietyListState();
}

class _SocietyListState extends State<_SocietyList> {
  late HomeSocietyQuery _query = HomeSocietyQuery(district: widget.district);
  int _version = 0;
  HomeSocietyList? _last;

  @override
  void didUpdateWidget(_SocietyList old) {
    super.didUpdateWidget(old);
    if (old.district != widget.district) {
      _set(_query.copyWith(district: widget.district));
    }
  }

  void _set(HomeSocietyQuery query) => setState(() {
    _query = query;
    _version++;
  });

  Future<void> _filters() async {
    final options = _last;
    final chosen = await showModalBottomSheet<HomeSocietyQuery>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => _FilterSheet(query: _query, list: options),
    );
    if (chosen != null) _set(chosen);
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          decoration: InputDecoration(
            prefixIcon: const Icon(Icons.search),
            hintText: widget.searchHint ?? l.homeSearchHint,
            suffixIcon: IconButton(
              tooltip: l.homeFilterTitle,
              onPressed: _filters,
              icon: const Icon(Icons.tune),
            ),
          ),
          textInputAction: TextInputAction.search,
          onSubmitted: (value) => _set(_query.copyWith(search: value.trim())),
        ),
        const SizedBox(height: 8),
        _Loader<HomeSocietyList>(
          key: ValueKey(_version),
          inline: true,
          label: l.homeLoadingSocieties,
          load: (api) => api.fetchSocieties(_query),
          builder: (context, list) {
            _last = list;
            if (list.rows.isEmpty) {
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Column(
                  children: [
                    const Icon(Icons.search, color: AppColors.forest),
                    const SizedBox(height: 8),
                    Text(
                      l.homeNoMatchTitle,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                      ),
                    ),
                    Text(
                      _query.filtered
                          ? l.homeNoMatchFiltered
                          : l.homeNoMatchEmpty,
                      style: const TextStyle(color: AppColors.inkBody),
                    ),
                    if (_query.filtered)
                      TextButton(
                        onPressed: () => _set(_query.cleared()),
                        child: Text(l.homeClearAllFilters),
                      ),
                  ],
                ),
              );
            }
            return Material(
              color: AppColors.surface,
              clipBehavior: Clip.antiAlias,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: AppColors.line),
              ),
              child: Column(
                children: [
                  for (final (index, society) in list.rows.indexed) ...[
                    if (index > 0) const Divider(height: 1),
                    _SocietyRow(society, showScope: widget.showScope),
                  ],
                  if (list.total > list.rows.length)
                    Padding(
                      padding: const EdgeInsets.all(10),
                      child: Text(
                        l.homeShowingOf(list.rows.length, list.total),
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.muted,
                        ),
                      ),
                    ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }
}

/// V5 M20 "Filter societies": grade, SPC, DS division, not updated, grade request.
class _FilterSheet extends StatefulWidget {
  const _FilterSheet({required this.query, required this.list});

  final HomeSocietyQuery query;
  final HomeSocietyList? list;

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  late HomeSocietyQuery _query = widget.query;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final list = widget.list;
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    l.homeFilterTitle,
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                TextButton(
                  onPressed: () => setState(
                    () => _query = _query.cleared().copyWith(
                      search: _query.search,
                    ),
                  ),
                  child: Text(l.homeFilterClearAll),
                ),
              ],
            ),
            Text(
              l.homeFilterGrade,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              children: [
                for (final grade in ['A', 'B', 'C'])
                  ChoiceChip(
                    label: Text(grade),
                    selected: _query.grade == grade,
                    onSelected: (on) => setState(
                      () => _query = _query.copyWith(
                        grade: () => on ? grade : null,
                      ),
                    ),
                  ),
              ],
            ),
            if (list != null && list.spcs.isNotEmpty) ...[
              const SizedBox(height: 12),
              DropdownButtonFormField<String?>(
                // Longer Sinhala and Tamil labels wrap instead of overflowing.
                isExpanded: true,
                initialValue: _query.spcId,
                decoration: InputDecoration(labelText: l.homeFilterSpc),
                items: [
                  DropdownMenuItem(
                    value: null,
                    child: Text(l.homeFilterAnySpc),
                  ),
                  for (final (id, name) in list.spcs)
                    DropdownMenuItem(value: id, child: Text(name)),
                ],
                onChanged: (value) => setState(
                  () => _query = _query.copyWith(spcId: () => value),
                ),
              ),
            ],
            if (list != null && list.dsDivisions.isNotEmpty) ...[
              const SizedBox(height: 12),
              DropdownButtonFormField<String?>(
                isExpanded: true,
                initialValue: _query.dsDivision,
                decoration: InputDecoration(labelText: l.homeFilterDs),
                items: [
                  DropdownMenuItem(value: null, child: Text(l.homeFilterAnyDs)),
                  for (final ds in list.dsDivisions)
                    DropdownMenuItem(value: ds, child: Text(ds)),
                ],
                onChanged: (value) => setState(
                  () => _query = _query.copyWith(dsDivision: () => value),
                ),
              ),
            ],
            const SizedBox(height: 8),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(l.homeFilterNotUpdated),
              value: _query.needsUpdate,
              onChanged: (value) =>
                  setState(() => _query = _query.copyWith(needsUpdate: value)),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(l.homeFilterHasRequest),
              value: _query.gradeRequest,
              onChanged: (value) =>
                  setState(() => _query = _query.copyWith(gradeRequest: value)),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.of(context).pop(_query),
                child: Text(l.homeFilterShow),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// V5 M05s (SPC), M05d / M05t (DDM) and M05m (DM): the home from `GET /home`.
class RoleHomeScreen extends StatefulWidget {
  const RoleHomeScreen({super.key});

  @override
  State<RoleHomeScreen> createState() => _RoleHomeScreenState();
}

class _RoleHomeScreenState extends State<RoleHomeScreen> {
  bool _district = false;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final store = DemoScope.of(context);
    final user = store.user!;
    final name =
        user.displayName
            .split(' ')
            .where((part) => !part.endsWith('.'))
            .firstOrNull ??
        user.displayName;
    return Scaffold(
      body: SafeArea(
        child: _Loader<RoleHome>(
          label: l.homeLoading,
          load: (api) => api.fetchHome(),
          builder: (context, home) => ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              Semantics(
                header: true,
                child: Text(
                  l.greeting(store.now, name),
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Text(
                [
                  _roleLine(l, user.primaryRole),
                  ?home.districtName,
                ].join(' · '),
                style: const TextStyle(fontSize: 12.5, color: AppColors.muted),
              ),
              const SizedBox(height: 10),
              ..._body(context, l, store, user, home),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _body(
    BuildContext context,
    AppLocalizations l,
    DemoStore store,
    AuthenticatedUser user,
    RoleHome home,
  ) {
    final grant = user.delegatedDistrictAccess
        .where((g) => g.activeAt(store.now))
        .firstOrNull;
    final banner = AccessBanner(
      tone: home.viewOnly ? AccessBannerTone.viewOnly : AccessBannerTone.edit,
      child: Text(
        home.viewOnly
            ? (home.districtName == null
                  ? l.homeAccessAll(home.total)
                  : l.homeAccessAllDistrict(home.total, home.districtName!))
            : l.homeAccessAssigned(home.total),
      ),
    );
    switch (user.primaryRole) {
      case UserRole.districtManager:
        return [
          banner,
          const SizedBox(height: 12),
          const IncidentHomeSection(),
          _Card(
            title: l.homeDistrictOverview,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _TileRow([
                  _Tile(l.homeTileSocieties, l.number(home.total)),
                  _Tile(
                    l.homeTileMembers,
                    home.members == null ? '—' : l.number(home.members!),
                  ),
                  _Tile(
                    l.homeTileNotUpdated,
                    l.number(home.notUpdated),
                    colour: AppColors.danger,
                  ),
                ]),
                const SizedBox(height: 8),
                Text(
                  l.homeGradesLine(
                    home.gradeA,
                    home.gradeB,
                    home.gradeC,
                    home.notActive,
                  ),
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 12.5,
                  ),
                ),
                Text(
                  l.homeGradeRequestsWithHq(home.gradeRequests),
                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _Card(
            title: l.homeTempAccessTitle,
            trailing: home.temporaryAccess.isEmpty
                ? _Pill(
                    l.homeNoneActive,
                    colour: AppColors.inkSoft,
                    background: AppColors.stateGrey,
                  )
                : _Pill(
                    l.homeActiveCount(home.temporaryAccess.length),
                    colour: AppColors.bannerTemporaryText,
                    background: AppColors.bannerTemporaryBg,
                  ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (home.temporaryAccess.isEmpty)
                  Text(
                    l.homeTempAccessIntro,
                    style: const TextStyle(fontSize: 12.5),
                  )
                else
                  for (final grant in home.temporaryAccess)
                    Text(
                      l.homeTempAccessLine(
                        grant.deputyName,
                        l.accessEndsAt(grant.expiresAt),
                      ),
                      style: const TextStyle(fontSize: 12.5),
                    ),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () =>
                        _open(context, const DistrictAccessScreen()),
                    icon: const Icon(Icons.key_outlined),
                    label: Text(
                      home.temporaryAccess.isEmpty
                          ? l.homeGiveAccess
                          : l.homeManageAccess,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (home.needsAttention.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text(
              l.homeNeedsAttention,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.6,
                color: AppColors.inkSoft,
              ),
            ),
            const SizedBox(height: 6),
            Material(
              color: AppColors.surface,
              clipBehavior: Clip.antiAlias,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: AppColors.line),
              ),
              child: Column(
                children: [
                  for (final (index, item) in home.needsAttention.indexed) ...[
                    if (index > 0) const Divider(height: 1),
                    ListTile(
                      leading: GradeBadge(item.grade),
                      title: Text(
                        item.name,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                        ),
                      ),
                      subtitle: Text(
                        item.reason,
                        style: const TextStyle(fontSize: 12),
                      ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (item.pending != null) _Pill(l.homeGradeRequest),
                          const Icon(Icons.chevron_right),
                        ],
                      ),
                      onTap: () => _open(
                        context,
                        SocietyRecordScreen(societyId: item.societyId),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ];
      case UserRole.deputyDistrictManager when grant != null:
        return [
          TemporaryViewCard(
            grant: grant,
            now: store.now,
            onBrowse: () => setState(() => _district = true),
          ),
          const SizedBox(height: 12),
          const IncidentHomeSection(),
          SegmentedButton<bool>(
            segments: [
              ButtonSegment(
                value: false,
                label: Text(l.homeMyEdit(home.total)),
              ),
              ButtonSegment(
                value: true,
                label: Text(
                  home.districtViewCount == null
                      ? l.homeDistrictViewOnly
                      : l.homeDistrictCountViewOnly(home.districtViewCount!),
                ),
              ),
            ],
            selected: {_district},
            onSelectionChanged: (value) =>
                setState(() => _district = value.first),
          ),
          const SizedBox(height: 10),
          _SocietyList(
            showScope: true,
            district: _district,
            searchHint: _district
                ? (home.districtName == null
                      ? l.homeSearchDistrictPlain
                      : l.homeSearchDistrict(home.districtName!))
                : l.homeSearchMine(home.total),
          ),
        ];
      case UserRole.deputyDistrictManager:
        return [
          banner,
          const SizedBox(height: 12),
          const IncidentHomeSection(),
          _TileRow([
            _Tile(l.homeTileAssigned, l.number(home.total)),
            _Tile(
              l.homeTileGradeRequests,
              l.number(home.gradeRequests),
              colour: AppColors.warning,
            ),
            _Tile(
              l.homeTileNotUpdated,
              l.number(home.notUpdated),
              colour: AppColors.danger,
            ),
          ]),
          const SizedBox(height: 12),
          _SocietyList(
            showScope: false,
            searchHint: l.homeSearchMine(home.total),
          ),
        ];
      default:
        return [
          banner,
          const SizedBox(height: 12),
          const IncidentHomeSection(),
          if (home.activitiesWaiting > 0) ...[
            Material(
              color: AppColors.warningSoft,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: Color(0xFFE8D28A)),
              ),
              child: ListTile(
                leading: const Icon(Icons.task_alt, color: AppColors.warning),
                title: Text(
                  l.homeActivitiesToApprove(home.activitiesWaiting),
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                subtitle: Text(l.homeChooseSdgs),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _open(context, const ActivitiesToApproveScreen()),
              ),
            ),
            const SizedBox(height: 12),
          ],
          Row(
            children: [
              Expanded(
                child: Text(
                  l.homeMySocieties,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Text(
                l.homeAssignedCount(home.total),
                style: const TextStyle(fontSize: 12, color: AppColors.muted),
              ),
            ],
          ),
          Text(
            l.homeGradeSummary(
              home.gradeA,
              home.gradeB,
              home.gradeC,
              home.notUpdated,
            ),
            style: const TextStyle(fontSize: 12, color: AppColors.muted),
          ),
          const SizedBox(height: 8),
          const _SocietyList(showScope: false),
        ];
    }
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.title, required this.child, this.trailing});

  final String title;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: AppColors.line),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            ?trailing,
          ],
        ),
        const SizedBox(height: 8),
        child,
      ],
    ),
  );
}

/// V5 M20 for the DM: every society in the district, view only, with filters.
class DistrictSocietiesScreen extends StatelessWidget {
  const DistrictSocietiesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final user = DemoScope.of(context).user!;
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            Text(
              l.listTitle,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
            ),
            Text(
              user.primaryRole == UserRole.districtManager
                  ? l.listDistrictViewOnly
                  : l.listYours,
              style: const TextStyle(fontSize: 12, color: AppColors.muted),
            ),
            const SizedBox(height: 10),
            const _SocietyList(showScope: false),
          ],
        ),
      ),
    );
  }
}
