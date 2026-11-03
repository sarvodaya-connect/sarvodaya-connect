import 'package:flutter/material.dart';

import '../models/user.dart';
import '../society_record/society_record_api.dart';
import '../society_record/society_record_models.dart';
import '../society_record/society_record_screen.dart';
import '../state/demo_store.dart';
import '../widgets/state_views.dart';

/// Societies in the signed-in user's scope, from the API (or the fictional
/// demo records). A Society Officer has one society, so its record (M06)
/// opens directly; other roles choose from the list.
class LiveSocietiesScreen extends StatefulWidget {
  const LiveSocietiesScreen({super.key, this.initialTab = 0});

  /// Record tab a Society Officer's own society opens on (see
  /// [SocietyRecordScreen.initialTab]).
  final int initialTab;
  @override
  State<LiveSocietiesScreen> createState() => _LiveSocietiesState();
}

/// M05t / DD04 row of the DDM's district-wide, view-only list.
class _DistrictRow {
  const _DistrictRow(this.id, this.nameEn, this.societyCode, this.yours);
  final String id;
  final String nameEn;
  final String societyCode;
  final bool yours;
}

class _LiveSocietiesState extends State<LiveSocietiesScreen> {
  List<SocietyListItem>? _rows;
  SocietyRecordException? _error;
  String _search = '';
  final _query = TextEditingController();

  /// M05t: a DDM with temporary access switches between their own and the district.
  bool _district = false;
  List<_DistrictRow>? _districtRows;
  String? _districtError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  Future<void> _loadDistrict() async {
    setState(() {
      _districtRows = null;
      _districtError = null;
    });
    try {
      final query = Uri(
        queryParameters: {
          'scope': 'DISTRICT',
          'pageSize': '50',
          if (_search.isNotEmpty) 'q': _search,
        },
      ).query;
      final data = await DemoScope.read(
        context,
      ).identityApi.request('/home/societies?$query') as Map<String, dynamic>;
      final rows = (data['data'] as List)
          .map(
            (r) => _DistrictRow(
              r['id'] as String,
              r['nameEn'] as String,
              r['societyCode'] as String,
              r['yours'] == true,
            ),
          )
          .toList();
      if (mounted) setState(() => _districtRows = rows);
    } catch (error) {
      // The API answers 403 once the temporary access has ended (DD07).
      if (mounted) {
        setState(() {
          _district = false;
          _districtError = 'Your temporary district-wide view has ended. You are back to your own societies.';
        });
      }
    }
  }

  Future<void> _load() async {
    if (_district) return _loadDistrict();
    setState(() {
      _rows = null;
      _error = null;
    });
    try {
      final rows = await DemoScope.read(context).societyRecords
          .listSocieties(search: _search);
      if (mounted) setState(() => _rows = rows);
    } on SocietyRecordException catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  void _searchFor(String value) {
    _search = value;
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final user = DemoScope.of(context).user!;
    if (user.primaryRole == UserRole.societyOfficer &&
        user.societyIds.length == 1) {
      return SocietyRecordScreen(
        societyId: user.societyIds.single,
        showBack: false,
        initialTab: widget.initialTab,
      );
    }
    final store = DemoScope.of(context);
    final hasDistrictView =
        user.roles.contains(UserRole.deputyDistrictManager) &&
        user.delegatedDistrictAccess.any((g) => g.activeAt(store.now));
    return Scaffold(
      appBar: AppBar(title: const Text('Societies')),
      body: Column(
        children: [
          if (hasDistrictView)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: SegmentedButton<bool>(
                segments: [
                  ButtonSegment(
                    value: false,
                    label: Text('My ${user.societyIds.length} · edit'),
                  ),
                  const ButtonSegment(
                    value: true,
                    label: Text('District · view only'),
                  ),
                ],
                selected: {_district},
                showSelectedIcon: false,
                onSelectionChanged: (value) {
                  setState(() => _district = value.first);
                  _load();
                },
              ),
            ),
          if (_districtError != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: AccessBanner(
                tone: AccessBannerTone.viewOnly,
                child: Text(_districtError!),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _query,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                hintText: 'Search name or S number',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(
                  tooltip: 'Search',
                  icon: const Icon(Icons.arrow_forward),
                  onPressed: () => _searchFor(_query.text),
                ),
              ),
              onSubmitted: _searchFor,
            ),
          ),
          Expanded(
            child: _district
                ? _DistrictList(rows: _districtRows, onRefresh: _load)
                : _error != null
                ? StateMessage(
                    icon: Icons.error_outline,
                    tone: StateTone.error,
                    isAlert: true,
                    title: "Couldn't load your societies",
                    message: _error!.message,
                    primaryLabel: 'Try again',
                    onPrimary: _load,
                  )
                : _rows == null
                ? const LoadingSkeleton(label: 'Loading your societies')
                : _rows!.isEmpty
                ? StateMessage(
                    icon: Icons.holiday_village_outlined,
                    title: _search.isEmpty
                        ? 'No societies assigned yet'
                        : 'No societies match “$_search”',
                    message: 'HQ manages the societies assigned to you.',
                  )
                : RefreshIndicator(
                    onRefresh: _load,
                    child: ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                      itemCount: _rows!.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final row = _rows![index];
                        return Card(
                          child: ListTile(
                            title: Text(
                              row.nameEn,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            subtitle: Text(
                              '${row.societyCode} · ${row.districtName}',
                            ),
                            trailing: const Icon(Icons.chevron_right),
                            onTap: () => Navigator.of(context).push(
                              MaterialPageRoute<void>(
                                builder: (_) =>
                                    SocietyRecordScreen(societyId: row.id),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _DistrictList extends StatelessWidget {
  const _DistrictList({required this.rows, required this.onRefresh});
  final List<_DistrictRow>? rows;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final rows = this.rows;
    if (rows == null) {
      return const LoadingSkeleton(label: 'Loading district societies');
    }
    if (rows.isEmpty) {
      return const StateMessage(
        icon: Icons.holiday_village_outlined,
        title: 'No societies match',
        message: 'Try another name or S number.',
      );
    }
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        itemCount: rows.length,
        separatorBuilder: (_, _) => const SizedBox(height: 8),
        itemBuilder: (context, index) {
          final row = rows[index];
          return Card(
            child: ListTile(
              title: Text(
                row.nameEn,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              subtitle: Text(row.societyCode),
              trailing: Text(
                row.yours ? 'Yours · edit' : 'View only',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => SocietyRecordScreen(societyId: row.id),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
