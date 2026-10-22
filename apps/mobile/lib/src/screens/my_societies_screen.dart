import 'package:flutter/material.dart';

import '../data/demo_data.dart';
import '../format.dart';
import '../models/society.dart';
import '../models/user.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/demo_loader.dart';
import '../widgets/map_preview.dart';
import '../widgets/state_views.dart';

/// M20 · Lists only the society records allowed by the signed-in role.
class MySocietiesScreen extends StatefulWidget {
  const MySocietiesScreen({super.key});

  @override
  State<MySocietiesScreen> createState() => _MySocietiesScreenState();
}

class _MySocietiesScreenState extends State<MySocietiesScreen> {
  var _showMap = false;

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final user = store.user;
    final role = store.activeRole;
    final permitted = user != null && user.roles.contains(role);
    final societies = permitted
        ? societiesVisibleToRole(role, user, demoSocieties)
        : const <SocietyDetails>[];

    return Scaffold(
      appBar: AppBar(
        title: const Text('My societies'),
        backgroundColor: AppColors.forest,
        foregroundColor: Colors.white,
        titleTextStyle: const TextStyle(
          color: Colors.white,
          fontSize: 16,
          fontWeight: FontWeight.w700,
        ),
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
              style: SegmentedButton.styleFrom(
                visualDensity: VisualDensity.compact,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                backgroundColor: AppColors.forest,
                foregroundColor: Colors.white,
                selectedBackgroundColor: Colors.white,
                selectedForegroundColor: AppColors.forest,
                side: const BorderSide(color: Colors.white54),
                textStyle: const TextStyle(fontSize: 12),
              ),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          if (store.offline)
            const OfflineBanner(message: 'Offline · showing saved information'),
          Expanded(
            child: !permitted
                ? const StateMessage(
                    icon: Icons.lock_outline,
                    title: 'No permission',
                    message: 'Your signed-in role cannot access the society directory.',
                    tone: StateTone.error,
                  )
                : DemoLoader(
                    loadingLabel: 'Loading your societies',
                    builder: (context) {
                      if (store.emptyRecords || societies.isEmpty) {
                        return StateMessage(
                          icon: Icons.holiday_village_outlined,
                          title: 'No societies assigned',
                          message: 'Societies available to your role will appear here.',
                        );
                      }
                      return _SocietyList(
                        societies: societies,
                        showMap: _showMap,
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

/// Applies the same authorization rule used by M20 to each directory record.
List<SocietyDetails> societiesVisibleToRole(
  UserRole role,
  AuthenticatedUser user,
  Iterable<SocietyDetails> societies,
) {
  if (!user.roles.contains(role)) return const [];
  return societies.where((society) {
    return switch (role) {
      UserRole.societyOfficer => user.societyIds.contains(society.id),
      UserRole.districtManager => user.districtIds.contains(
        society.district.id,
      ),
      UserRole.hqAdmin => true,
    };
  }).toList();
}

class _SocietyList extends StatefulWidget {
  const _SocietyList({required this.societies, required this.showMap});

  final List<SocietyDetails> societies;
  final bool showMap;

  @override
  State<_SocietyList> createState() => _SocietyListState();
}

class _SocietyListState extends State<_SocietyList> {
  var _query = '';

  @override
  Widget build(BuildContext context) {
    final q = _query.trim().toLowerCase();
    final visible =
        widget.societies
            .where(
              (s) =>
                  q.isEmpty ||
                  s.nameEn.toLowerCase().contains(q) ||
                  s.societyCode.toLowerCase().contains(q),
            )
            .toList()
          ..sort(
            (a, b) => a.profileCompleteness.compareTo(b.profileCompleteness),
          );
    final total = widget.societies.length;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        TextField(
          onChanged: (value) => setState(() => _query = value),
          decoration: const InputDecoration(
            hintText: 'Search name or ID',
            prefixIcon: Icon(Icons.search, size: 20),
            isDense: true,
          ),
        ),
        const SizedBox(height: 10),
        Semantics(
          label:
              '$total ${total == 1 ? 'society' : 'societies'} available to your role',
          excludeSemantics: true,
          child: Text(
            '${visible.length} of $total ${total == 1 ? 'society' : 'societies'} · lowest completeness first',
            style: const TextStyle(color: AppColors.muted, fontSize: 11.5),
          ),
        ),
        const SizedBox(height: 8),
        if (widget.showMap)
          Card(
            clipBehavior: Clip.antiAlias,
            child: MapPreview(location: visible.firstOrNull?.location),
          )
        else
          Card(
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                for (final (i, society) in visible.indexed) ...[
                  if (i > 0) const Divider(height: 1),
                  _SocietyCard(society: society),
                ],
              ],
            ),
          ),
      ],
    );
  }
}

class _SocietyCard extends StatelessWidget {
  const _SocietyCard({required this.society});

  final SocietyDetails society;

  @override
  Widget build(BuildContext context) {
    final percent = society.profileCompleteness;
    final color = percent < 60
        ? AppColors.danger
        : percent < 85
        ? const Color(0xFFE0B03A)
        : AppColors.leaf;
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
                    if (society.lastVerifiedOn != null)
                      'updated ${formatDate(society.lastVerifiedOn!)}',
                  ].join(' · '),
                  style: const TextStyle(color: AppColors.muted, fontSize: 11),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    SizedBox(
                      width: 70,
                      child: Semantics(
                        label: '$percent% complete',
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: percent / 100,
                            minHeight: 4,
                            color: color,
                            backgroundColor: AppColors.line,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '$percent%',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          OutlinedButton(
            onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  'Follow-up notes for ${society.nameEn} come in a later phase.',
                ),
              ),
            ),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size(48, 34),
              padding: const EdgeInsets.symmetric(horizontal: 12),
              textStyle: const TextStyle(fontSize: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            child: Text('Note', semanticsLabel: 'Note for ${society.nameEn}'),
          ),
        ],
      ),
    );
  }
}
