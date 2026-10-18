import 'package:flutter/material.dart';

import '../data/demo_data.dart';
import '../models/society.dart';
import '../models/user.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/demo_loader.dart';
import '../widgets/section_card.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';

/// M20 · Lists only the society records allowed by the signed-in role.
class MySocietiesScreen extends StatelessWidget {
  const MySocietiesScreen({super.key});

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
      appBar: AppBar(title: const Text('My Societies')),
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
                      return _SocietyList(societies: societies);
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

class _SocietyList extends StatelessWidget {
  const _SocietyList({required this.societies});

  final List<SocietyDetails> societies;

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      SectionCard(
        children: [
          Text(
            '${societies.length} ${societies.length == 1 ? 'society' : 'societies'} available to your role',
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: 4),
          const Text(
            'This list follows your society or district assignment.',
            style: TextStyle(color: AppColors.muted),
          ),
        ],
      ),
      const SizedBox(height: 12),
      for (final society in societies) ...[
        _SocietyCard(society: society),
        const SizedBox(height: 10),
      ],
    ],
  );
}

class _SocietyCard extends StatelessWidget {
  const _SocietyCard({required this.society});

  final SocietyDetails society;

  @override
  Widget build(BuildContext context) => Card(
    child: ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      leading: const CircleAvatar(
        backgroundColor: AppColors.mint,
        foregroundColor: AppColors.leaf,
        child: Icon(Icons.holiday_village_outlined),
      ),
      title: Text(society.nameEn),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Text(
          '${society.societyCode} · ${society.district.nameEn}\n${society.profileCompleteness}% complete',
        ),
      ),
      isThreeLine: true,
      trailing: StatusChip(_status(society.status), compact: true),
    ),
  );

  StatusStyle _status(SocietyStatus status) => switch (status) {
    SocietyStatus.active => const StatusStyle(
      'Active',
      Icons.check_circle_outline,
      Color(0xFF25643F),
      Color(0xFFE5F3E8),
    ),
    SocietyStatus.inactive => const StatusStyle(
      'Inactive',
      Icons.pause_circle_outline,
      Color(0xFF55605A),
      Color(0xFFEEF0EC),
    ),
    SocietyStatus.underReview => const StatusStyle(
      'Under review',
      Icons.hourglass_top,
      Color(0xFF7A5A00),
      Color(0xFFFFF2CC),
    ),
    SocietyStatus.suspended => const StatusStyle(
      'Suspended',
      Icons.block_outlined,
      Color(0xFFA8312A),
      Color(0xFFFBE9E7),
    ),
  };
}
