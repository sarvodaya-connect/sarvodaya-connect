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

class _LiveSocietiesState extends State<LiveSocietiesScreen> {
  List<SocietyListItem>? _rows;
  SocietyRecordException? _error;
  String _search = '';
  final _query = TextEditingController();

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

  Future<void> _load() async {
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
    return Scaffold(
      appBar: AppBar(title: const Text('Societies')),
      body: Column(
        children: [
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
            child: _error != null
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
