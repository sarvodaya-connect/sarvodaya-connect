import 'dart:async';

import 'package:flutter/material.dart';

import '../format.dart';
import '../models/society.dart';
import '../models/user.dart';
import '../services/registry_api_client.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/map_preview.dart';
import '../widgets/state_views.dart';

/// M20 · Society directory. The API applies role and assignment scope.
class MySocietiesScreen extends StatefulWidget {
  const MySocietiesScreen({super.key, this.api});
  final RegistryApiClient? api;
  @override
  State<MySocietiesScreen> createState() => _MySocietiesScreenState();
}

class _MySocietiesScreenState extends State<MySocietiesScreen> {
  late final RegistryApiClient _api;
  final _search = TextEditingController();
  List<SocietyDetails> _societies = const [];
  List<SocietyDetails> _facetSocieties = const [];
  String _district = 'all';
  String _division = 'all';
  String _spc = 'all';
  String _grade = 'all';
  String _freshness = 'all';
  String _request = 'all';
  bool _showMap = false;
  bool _loading = true;
  String? _error;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _api =
        widget.api ??
        DemoScope.read(context).registryApiClient ??
        RegistryApiClient();
    _reload();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  Map<String, String> get _filters => {
    if (_search.text.trim().isNotEmpty) 'search': _search.text.trim(),
    if (_district != 'all') 'districtId': _district,
    if (_division != 'all') 'dsDivision': _division,
    if (_spc != 'all') 'spcUserId': _spc,
    if (_grade != 'all') 'grade': _grade,
    if (_freshness != 'all') 'freshness': _freshness.toUpperCase(),
    if (_request != 'all') 'gradeRequest': _request == 'open' ? 'OPEN' : 'NONE',
  };

  Future<void> _reload() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await _api.listSocieties(
        DemoScope.read(context).activeRole,
        filters: _filters,
      );
      if (!mounted) return;
      setState(() {
        if (_facetSocieties.isEmpty && _filters.isEmpty) {
          _facetSocieties = result;
        }
        _societies = result;
        _loading = false;
      });
    } on RegistryApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.statusCode == 403 ? 'permission' : error.toString();
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final role = store.activeRole;
    final allowed = store.user != null && store.user!.roles.contains(role);
    final facetRows = _facetSocieties.isEmpty ? _societies : _facetSocieties;
    final districts = {
      for (final society in facetRows) society.district.id: society.district,
    };
    final divisions =
        facetRows
            .map((society) => society.dsDivision)
            .whereType<String>()
            .toSet()
            .toList()
          ..sort();
    final spcs = {
      for (final society in facetRows)
        if (society.spcUserId != null)
          society.spcUserId!: society.spcName ?? 'Assigned SPC',
    };
    return Scaffold(
      appBar: AppBar(
        title: const Text('Societies'),
        backgroundColor: AppColors.forest,
        foregroundColor: Colors.white,
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: SegmentedButton<bool>(
              segments: const [
                ButtonSegment(value: false, label: Text('List')),
                ButtonSegment(value: true, label: Text('Map')),
              ],
              selected: {_showMap},
              showSelectedIcon: false,
              onSelectionChanged: (value) =>
                  setState(() => _showMap = value.first),
            ),
          ),
        ],
      ),
      body: !allowed
          ? const StateMessage(
              icon: Icons.lock_outline,
              title: 'No permission',
              message:
                  'Your signed-in role cannot access the society directory.',
              tone: StateTone.error,
            )
          : _loading && _societies.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : _error != null && _societies.isEmpty
          ? StateMessage(
              icon: _error == 'permission'
                  ? Icons.lock_outline
                  : Icons.cloud_off,
              title: _error == 'permission'
                  ? 'Permission denied'
                  : 'Societies unavailable',
              message: _error == 'permission'
                  ? 'Your account cannot access these society records.'
                  : 'Check your connection and try again.',
              tone: StateTone.error,
              primaryLabel: 'Retry',
              onPrimary: _reload,
              isAlert: true,
            )
          : RefreshIndicator(
              onRefresh: _reload,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  TextField(
                    controller: _search,
                    onChanged: (_) {
                      _debounce?.cancel();
                      _debounce = Timer(
                        const Duration(milliseconds: 350),
                        _reload,
                      );
                    },
                    onSubmitted: (_) => _reload(),
                    decoration: const InputDecoration(
                      hintText: 'Search name or S number',
                      prefixIcon: Icon(Icons.search, size: 20),
                      isDense: true,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _filter<String>('District', _district, [
                        const DropdownMenuItem(
                          value: 'all',
                          child: Text('All districts'),
                        ),
                        for (final district in districts.values)
                          DropdownMenuItem(
                            value: district.id,
                            child: Text(district.nameEn),
                          ),
                      ], (v) => setState(() => _district = v)),
                      _filter<String>('DS division', _division, [
                        const DropdownMenuItem(
                          value: 'all',
                          child: Text('DS: Any'),
                        ),
                        for (final division in divisions)
                          DropdownMenuItem(
                            value: division,
                            child: Text(division),
                          ),
                      ], (v) => setState(() => _division = v)),
                      _filter<String>('SPC', _spc, [
                        const DropdownMenuItem(
                          value: 'all',
                          child: Text('SPC: Any'),
                        ),
                        for (final entry in spcs.entries)
                          DropdownMenuItem(
                            value: entry.key,
                            child: Text(entry.value),
                          ),
                      ], (v) => setState(() => _spc = v)),
                      _filter<String>('Grade', _grade, const [
                        DropdownMenuItem(
                          value: 'all',
                          child: Text('Grade: All'),
                        ),
                        DropdownMenuItem(value: 'A', child: Text('Grade A')),
                        DropdownMenuItem(value: 'B', child: Text('Grade B')),
                        DropdownMenuItem(value: 'C', child: Text('Grade C')),
                      ], (v) => setState(() => _grade = v)),
                      _filter<String>('Updated', _freshness, const [
                        DropdownMenuItem(
                          value: 'all',
                          child: Text('Records: Any'),
                        ),
                        DropdownMenuItem(
                          value: 'recent',
                          child: Text('Updated recently'),
                        ),
                        DropdownMenuItem(
                          value: 'stale',
                          child: Text('90+ days'),
                        ),
                      ], (v) => setState(() => _freshness = v)),
                      _filter<String>('Grade request', _request, const [
                        DropdownMenuItem(
                          value: 'all',
                          child: Text('Requests: Any'),
                        ),
                        DropdownMenuItem(
                          value: 'open',
                          child: Text('Open requests'),
                        ),
                        DropdownMenuItem(
                          value: 'none',
                          child: Text('No open request'),
                        ),
                      ], (v) => setState(() => _request = v)),
                      TextButton(
                        onPressed: () {
                          _search.clear();
                          setState(() {
                            _district = 'all';
                            _division = 'all';
                            _spc = 'all';
                            _grade = 'all';
                            _freshness = 'all';
                            _request = 'all';
                          });
                          _reload();
                        },
                        child: const Text('Clear filters'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  if (_error != null)
                    MaterialBanner(
                      content: Text(
                        'Could not refresh societies. ${_error == 'permission' ? 'Access denied.' : 'Showing the last loaded results.'}',
                      ),
                      actions: [
                        TextButton(
                          onPressed: _reload,
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  if (_loading) const LinearProgressIndicator(),
                  Text(
                    '${_societies.length} ${_societies.length == 1 ? 'society' : 'societies'} in your permitted scope',
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 11.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (_societies.isEmpty && !_loading)
                    const StateMessage(
                      icon: Icons.search_off,
                      title: 'No matching societies',
                      message: 'Try changing the search or filters.',
                    )
                  else if (_showMap && _societies.isNotEmpty)
                    Card(
                      clipBehavior: Clip.antiAlias,
                      child: MapPreview(location: _societies.first.location),
                    )
                  else
                    Card(
                      clipBehavior: Clip.antiAlias,
                      child: Column(
                        children: [
                          for (final (index, society)
                              in _societies.indexed) ...[
                            if (index > 0) const Divider(height: 1),
                            _SocietyCard(
                              society: society,
                              role: role,
                              onRequest: () => _requestChange(society, role),
                            ),
                          ],
                        ],
                      ),
                    ),
                ],
              ),
            ),
    );
  }

  Widget _filter<T>(
    String label,
    T value,
    List<DropdownMenuItem<T>> items,
    ValueChanged<T> onChanged,
  ) => DropdownButton<T>(
    value: value,
    underline: const SizedBox.shrink(),
    borderRadius: BorderRadius.circular(10),
    items: items,
    onChanged: (next) {
      if (next != null) {
        onChanged(next);
        WidgetsBinding.instance.addPostFrameCallback((_) => _reload());
      }
    },
  );

  Future<void> _requestChange(SocietyDetails society, UserRole role) async {
    final grade = society.grade;
    if (grade == null || society.hasOpenGradeRequest) return;
    final choices = switch (grade) {
      'A' => const ['B'],
      'B' => const ['A', 'C'],
      _ => const ['B'],
    };
    final rationale = TextEditingController();
    String proposed = choices.first;
    final accepted = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, refresh) => AlertDialog(
          title: const Text('Request grade change'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                initialValue: proposed,
                decoration: const InputDecoration(labelText: 'Proposed grade'),
                items: [
                  for (final choice in choices)
                    DropdownMenuItem(
                      value: choice,
                      child: Text('Grade $choice'),
                    ),
                ],
                onChanged: (value) =>
                    refresh(() => proposed = value ?? proposed),
              ),
              TextField(
                controller: rationale,
                minLines: 3,
                maxLines: 5,
                maxLength: 2000,
                decoration: const InputDecoration(
                  labelText: 'Reason (at least 10 characters)',
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Submit request'),
            ),
          ],
        ),
      ),
    );
    if (accepted != true) {
      rationale.dispose();
      return;
    }
    if (rationale.text.trim().length < 10) {
      rationale.dispose();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please enter a reason of at least 10 characters.'),
          ),
        );
      }
      return;
    }
    try {
      await _api.requestGradeChange(
        role,
        society.id,
        proposed,
        rationale.text.trim(),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Grade request submitted for HQ review.'),
          ),
        );
        await _reload();
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Request not submitted: $error')),
        );
      }
    } finally {
      rationale.dispose();
    }
  }
}

/// Kept as a small pure helper for local widget tests; API scope is authoritative.
List<SocietyDetails> societiesVisibleToRole(
  UserRole role,
  AuthenticatedUser user,
  Iterable<SocietyDetails> societies,
) {
  if (!user.roles.contains(role)) return const [];
  return societies
      .where(
        (society) => switch (role) {
          UserRole.societyOfficer ||
          UserRole.programmeCoordinator ||
          UserRole.deputyDistrictManager => user.societyIds.contains(
            society.id,
          ),
          UserRole.districtManager => user.districtIds.contains(
            society.district.id,
          ),
          UserRole.hqAdmin => true,
        },
      )
      .toList();
}

class _SocietyCard extends StatelessWidget {
  const _SocietyCard({
    required this.society,
    required this.role,
    required this.onRequest,
  });
  final SocietyDetails society;
  final UserRole role;
  final VoidCallback onRequest;
  @override
  Widget build(BuildContext context) {
    final mayRequest =
        role == UserRole.societyOfficer ||
        role == UserRole.programmeCoordinator ||
        role == UserRole.deputyDistrictManager;
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 10, 12, 10),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  society.nameEn,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
                Text(
                  [
                    society.societyCode,
                    if (society.grade != null) 'Grade ${society.grade}',
                    if (society.memberCount != null)
                      '${society.memberCount} members',
                    if (society.spcName != null) 'SPC ${society.spcName}',
                    if (society.hasOpenGradeRequest) 'Grade request pending',
                    'updated ${formatDate(society.updatedAt)}',
                  ].join(' · '),
                  style: const TextStyle(color: AppColors.muted, fontSize: 11),
                ),
              ],
            ),
          ),
          if (society.hasOpenGradeRequest)
            const Icon(
              Icons.mark_chat_unread_outlined,
              color: AppColors.leaf,
              size: 20,
            ),
          if (mayRequest &&
              society.grade != null &&
              !society.hasOpenGradeRequest)
            IconButton(
              tooltip: 'Request grade change',
              onPressed: onRequest,
              icon: const Icon(Icons.upgrade_outlined, color: AppColors.forest),
            ),
        ],
      ),
    );
  }
}
