import 'package:flutter/material.dart';

import '../district_access/access_format.dart';
import '../district_access/district_access_screens.dart';
import '../format.dart';
import '../incidents/incident_screens.dart';
import '../models/user.dart';
import '../national/national_screens.dart' show GradeBadge, count;
import '../society_record/activity_screens.dart';
import '../society_record/society_record_screen.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/state_views.dart';
import 'home_api.dart';

void _open(BuildContext context, Widget screen) =>
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));

String _greeting(DateTime now) => now.hour < 12
    ? 'Good morning'
    : now.hour < 17
    ? 'Good afternoon'
    : 'Good evening';

String _roleLine(UserRole role) => switch (role) {
  UserRole.programmeCoordinator => 'Society Program Coordinator (SPC)',
  UserRole.deputyDistrictManager => 'Deputy District Manager (DDM)',
  UserRole.districtManager => 'District Manager (DM)',
  _ => role.label,
};

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
  Widget build(BuildContext context) => Semantics(
    container: true,
    label: 'Temporary district-wide view',
    child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1F3A5F),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.schedule, size: 16, color: Colors.white),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Temporary district-wide view',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'All societies in your district · view only.'
            '${grant.grantedByName == null ? '' : ' Granted by ${grant.grantedByName} (DM).'}',
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
              'Ends ${accessEnds(grant.expiresAt)} · ${accessTimeLeft(grant.expiresAt, now)}',
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
            child: const Text('Browse district societies'),
          ),
        ],
      ),
    ),
  );
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
              error is HomeException
                  ? error.message
                  : 'Could not load the societies.',
              style: const TextStyle(color: AppColors.danger),
            ),
            TextButton(
              onPressed: () => setState(
                () => _future = widget.load(DemoScope.of(context).home),
              ),
              child: const Text('Try again'),
            ),
          ],
        );
      }
      if (error != null) {
        return StateMessage(
          icon: Icons.error_outline,
          title: 'Something went wrong',
          message: error is HomeException
              ? error.message
              : 'Could not load your overview.',
          tone: StateTone.error,
          isAlert: true,
          primaryLabel: 'Try again',
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
  Widget build(BuildContext context) => ListTile(
    leading: GradeBadge(society.grade),
    title: Text(
      society.name,
      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
    ),
    subtitle: Text(
      '${society.code}${society.members == null ? '' : ' · ${count(society.members!)} members'} · updated ${formatDate(society.updatedAt)}',
      style: const TextStyle(fontSize: 12),
    ),
    trailing: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (showScope)
          society.yours
              ? const _Pill(
                  'Yours · edit',
                  colour: AppColors.leaf,
                  background: AppColors.mint,
                )
              : const _Pill(
                  'View only',
                  colour: AppColors.inkSoft,
                  background: AppColors.stateGrey,
                )
        else if (society.pending != null)
          const _Pill('Grade request')
        else if (society.stale)
          const _Pill(
            '90+ days',
            colour: AppColors.danger,
            background: AppColors.dangerSoft,
          ),
        const Icon(Icons.chevron_right),
      ],
    ),
    onTap: () => _open(context, SocietyRecordScreen(societyId: society.id)),
  );
}

/// The list of societies with search and filters (M05s, M05d, DD04, M20).
class _SocietyList extends StatefulWidget {
  const _SocietyList({
    required this.showScope,
    this.district = false,
    this.searchHint = 'Search name or S number',
  });

  final bool showScope;
  final bool district;
  final String searchHint;

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
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      TextField(
        decoration: InputDecoration(
          prefixIcon: const Icon(Icons.search),
          hintText: widget.searchHint,
          suffixIcon: IconButton(
            tooltip: 'Filter societies',
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
        label: 'Loading societies',
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
                  const Text(
                    'No societies match',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                  ),
                  Text(
                    _query.filtered
                        ? 'Try fewer filters.'
                        : 'No society is in your view yet.',
                    style: const TextStyle(color: AppColors.inkBody),
                  ),
                  if (_query.filtered)
                    TextButton(
                      onPressed: () => _set(_query.cleared()),
                      child: const Text('Clear all filters'),
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
                      'Showing ${list.rows.length} of ${count(list.total)} · search to narrow the list',
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
    final list = widget.list;
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Filter societies',
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
                  ),
                ),
                TextButton(
                  onPressed: () => setState(
                    () => _query = _query.cleared().copyWith(
                      search: _query.search,
                    ),
                  ),
                  child: const Text('Clear all'),
                ),
              ],
            ),
            const Text('Grade', style: TextStyle(fontWeight: FontWeight.w600)),
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
                initialValue: _query.spcId,
                decoration: const InputDecoration(labelText: 'Assigned SPC'),
                items: [
                  const DropdownMenuItem(value: null, child: Text('Any SPC')),
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
                initialValue: _query.dsDivision,
                decoration: const InputDecoration(labelText: 'DS division'),
                items: [
                  const DropdownMenuItem(
                    value: null,
                    child: Text('Any DS division'),
                  ),
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
              title: const Text('Not updated in 90 days'),
              value: _query.needsUpdate,
              onChanged: (value) =>
                  setState(() => _query = _query.copyWith(needsUpdate: value)),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Has a grade-change request'),
              value: _query.gradeRequest,
              onChanged: (value) =>
                  setState(() => _query = _query.copyWith(gradeRequest: value)),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.of(context).pop(_query),
                child: const Text('Show societies'),
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
          label: 'Loading your home',
          load: (api) => api.fetchHome(),
          builder: (context, home) => ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              Semantics(
                header: true,
                child: Text(
                  '${_greeting(store.now)}, $name',
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Text(
                '${_roleLine(user.primaryRole)}${home.districtName == null ? '' : ' · ${home.districtName}'}',
                style: const TextStyle(fontSize: 12.5, color: AppColors.muted),
              ),
              const SizedBox(height: 10),
              ..._body(context, store, user, home),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _body(
    BuildContext context,
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
            ? 'Your access: all ${count(home.total)} ${home.districtName ?? ''} societies · view only'
            : 'Your access: ${count(home.total)} assigned societies · view and edit',
      ),
    );
    switch (user.primaryRole) {
      case UserRole.districtManager:
        return [
          banner,
          const SizedBox(height: 12),
          const IncidentHomeSection(),
          _Card(
            title: 'District overview',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _TileRow([
                  _Tile('Societies', count(home.total)),
                  _Tile(
                    'Members',
                    home.members == null ? '—' : count(home.members!),
                  ),
                  _Tile(
                    'Not updated 90d',
                    count(home.notUpdated),
                    colour: AppColors.danger,
                  ),
                ]),
                const SizedBox(height: 8),
                Text(
                  'Grades: A ${home.gradeA}, B ${home.gradeB}, C ${home.gradeC}, ${home.notActive} not active',
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 12.5,
                  ),
                ),
                Text(
                  '${home.gradeRequests} grade requests with HQ',
                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _Card(
            title: 'Temporary access for your DDM',
            trailing: home.temporaryAccess.isEmpty
                ? const _Pill(
                    'None active',
                    colour: AppColors.inkSoft,
                    background: AppColors.stateGrey,
                  )
                : _Pill(
                    '${home.temporaryAccess.length} active',
                    colour: AppColors.bannerTemporaryText,
                    background: AppColors.bannerTemporaryBg,
                  ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (home.temporaryAccess.isEmpty)
                  const Text(
                    'When you are away, give a DDM view-only access to all societies in your district for a set time.',
                    style: TextStyle(fontSize: 12.5),
                  )
                else
                  for (final grant in home.temporaryAccess)
                    Text(
                      '${grant.deputyName} · view only · ends ${accessEnds(grant.expiresAt)}',
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
                          ? 'Give temporary access'
                          : 'Manage temporary access',
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (home.needsAttention.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Text(
              'NEEDS ATTENTION',
              style: TextStyle(
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
                          if (item.pending != null)
                            const _Pill('Grade request'),
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
                label: Text('My ${home.total} · edit'),
              ),
              ButtonSegment(
                value: true,
                label: Text(
                  'District ${home.districtViewCount ?? ''} · view only',
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
                ? 'Search ${home.districtName ?? 'district'} societies'
                : 'Search my ${home.total} societies',
          ),
        ];
      case UserRole.deputyDistrictManager:
        return [
          banner,
          const SizedBox(height: 12),
          const IncidentHomeSection(),
          _TileRow([
            _Tile('Assigned', count(home.total)),
            _Tile(
              'Grade requests',
              count(home.gradeRequests),
              colour: AppColors.warning,
            ),
            _Tile(
              'Not updated 90d',
              count(home.notUpdated),
              colour: AppColors.danger,
            ),
          ]),
          const SizedBox(height: 12),
          _SocietyList(
            showScope: false,
            searchHint: 'Search my ${home.total} societies',
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
                  '${home.activitiesWaiting} ${home.activitiesWaiting == 1 ? 'activity' : 'activities'} to approve',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                subtitle: const Text('Choose the UN SDGs and approve'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _open(context, const ActivitiesToApproveScreen()),
              ),
            ),
            const SizedBox(height: 12),
          ],
          Row(
            children: [
              const Expanded(
                child: Text(
                  'My societies',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                ),
              ),
              Text(
                '${home.total} assigned',
                style: const TextStyle(fontSize: 12, color: AppColors.muted),
              ),
            ],
          ),
          Text(
            'Grade A ${home.gradeA} · B ${home.gradeB} · C ${home.gradeC} · ${home.notUpdated} need an update',
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
    final user = DemoScope.of(context).user!;
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            const Text(
              'Societies',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
            ),
            Text(
              user.primaryRole == UserRole.districtManager
                  ? 'Your district · view only'
                  : 'Your societies',
              style: const TextStyle(fontSize: 12, color: AppColors.muted),
            ),
            const SizedBox(height: 10),
            _SocietyList(
              showScope: false,
              searchHint: 'Search name or S number',
            ),
          ],
        ),
      ),
    );
  }
}
