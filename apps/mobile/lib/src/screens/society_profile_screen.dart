import 'package:flutter/material.dart';

import '../format.dart';
import '../models/society.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/council_widgets.dart';
import '../models/profile_draft.dart';
import '../widgets/demo_loader.dart';
import '../widgets/map_preview.dart';
import '../widgets/profile_widgets.dart';
import '../widgets/section_card.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';
import 'council_screen.dart';
import 'edit_profile_screen.dart';
import 'profile_review_screen.dart';
import 'membership_screen.dart';
import 'village_profile_screen.dart';

/// M06 · Society profile, with the annual M06b village profile tab.
class SocietyProfileScreen extends StatefulWidget {
  const SocietyProfileScreen({super.key});

  @override
  State<SocietyProfileScreen> createState() => _SocietyProfileScreenState();
}

class _SocietyProfileScreenState extends State<SocietyProfileScreen> {
  static const _tabs = ['Profile', 'Village', 'Council', 'Members', 'Finance'];

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    return DefaultTabController(
      length: _tabs.length,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Society'),
          actions: [
            IconButton(
              tooltip: 'Record history',
              icon: const Icon(Icons.history),
              onPressed: () => _showHistory(context),
            ),
          ],
          bottom: TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            labelColor: AppColors.forest,
            unselectedLabelColor: AppColors.inkSoft,
            indicatorColor: AppColors.leaf,
            indicatorSize: TabBarIndicatorSize.tab,
            dividerColor: AppColors.line,
            labelPadding: const EdgeInsets.symmetric(horizontal: 12),
            labelStyle: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
            unselectedLabelStyle: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
            tabs: [for (final tab in _tabs) Tab(text: tab, height: 40)],
          ),
        ),
        body: Column(
          children: [
            if (store.offline) const OfflineBanner(),
            Expanded(
              child: DemoLoader(
                loadingLabel: 'Loading the society profile',
                builder: (context) => const TabBarView(
                  children: [
                    _ProfileContent(),
                    VillageProfileTab(),
                    _CouncilTab(),
                    MembershipContent(),
                    StateMessage(
                      icon: Icons.account_balance_wallet_outlined,
                      title: 'Finance comes in a later phase',
                      message: 'Contributions, payments and SDF shares will be shown here.',
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static void _showHistory(BuildContext context) {
    final society = DemoScope.read(context).society;
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Record history',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 12),
              InfoRow(
                label: 'Last verified',
                value: society.lastVerifiedOn == null
                    ? null
                    : '${formatDate(society.lastVerifiedOn!)} by ${society.lastVerifiedBy}',
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Council tab: seats and office bearers, with the way into M07b.
class _CouncilTab extends StatelessWidget {
  const _CouncilTab();

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final canEdit = (store.user?.canEditSociety(store.society.id) ?? false);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        SectionCard(
          children: [
            SeatSummary(filled: store.seatsFilled, total: store.totalSeats),
          ],
        ),
        const SizedBox(height: 12),
        const _OfficeBearersCard(),
        const SizedBox(height: 12),
        if (canEdit)
          FilledButton.icon(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const CouncilScreen()),
            ),
            icon: const Icon(Icons.groups_outlined),
            label: const Text('Update Committee'),
          ),
      ],
    );
  }
}

class _ProfileContent extends StatelessWidget {
  const _ProfileContent();

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final society = store.society;
    final approved = store.approvedProfile;
    final draft = store.profileDraft;
    final pending = store.pendingProfileSubmission;
    final canEdit = (store.user?.canEditSociety(store.society.id) ?? false);
    final draftChanged = draft == null
        ? const <String>{}
        : draft.values.changedFieldsComparedTo(approved).toSet();
    String? orNull(String value) => value.isEmpty ? null : value;
    List<Widget> field(String label, String? value) => [
      InfoRow(label: label, value: value),
      if (draftChanged.contains(label))
        DraftValueTag(
          draft!.values.valueOf(label)?.isNotEmpty == true
              ? draft.values.valueOf(label)!
              : '(removed)',
        ),
    ];
    void openEdit() => Navigator.of(
      context,
    ).push(MaterialPageRoute<void>(builder: (_) => const EditProfileScreen()));
    final requestUpdate = canEdit
        ? _RequestUpdate(onPressed: pending == null ? openEdit : null)
        : null;
    final dense = Theme.of(context).copyWith(
      textTheme: Theme.of(context).textTheme.copyWith(
        bodySmall: const TextStyle(color: AppColors.muted, fontSize: 11),
      ),
    );

    return Theme(
      data: dense,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (pending != null) ...[
            NoticeBanner(
              icon: Icons.lock_outline,
              tone: NoticeTone.warning,
              title: 'Profile update waiting for the District Centre',
              message:
                  '${pending.reference} is being reviewed. You can edit the profile again after it has been reviewed.',
            ),
            const SizedBox(height: 12),
          ],
          if (draft != null && store.profileDraftOutdated) ...[
            ConflictNotice(
              updatedBy: store.recordUpdatedBy ?? 'The District Centre',
              updatedAt: store.recordUpdatedAt ?? store.now,
              onReload: () {
                store.reloadProfileDraft();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text(
                      'Record reloaded. Your draft changes are kept.',
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 12),
          ] else if (draft != null) ...[
            NoticeBanner(
              icon: Icons.edit_note,
              title: 'You have draft profile changes',
              message: 'Draft values are marked “Draft”. Only you can see them; the approved values have not changed.',
              action: canEdit
                  ? Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton(
                        onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => const ProfileReviewScreen(),
                          ),
                        ),
                        style: TextButton.styleFrom(padding: EdgeInsets.zero),
                        child: const Text('Review draft'),
                      ),
                    )
                  : null,
            ),
            const SizedBox(height: 12),
          ],
          _ProfileCard(
            title: 'Basic information',
            trailing: requestUpdate,
            children: [
              InfoRow(label: 'Name', value: society.nameEn),
              InfoRow(label: 'Local name', value: society.nameLocal),
              Row(
                children: [
                  Expanded(
                    child: InfoRow(
                      label: 'Society ID',
                      value: society.societyCode,
                    ),
                  ),
                  Expanded(
                    child: InfoRow(
                      label: 'Founded',
                      value: society.establishedOn?.year.toString(),
                    ),
                  ),
                ],
              ),
              Row(
                children: [
                  Expanded(
                    child: InfoRow(
                      label: 'Registration number',
                      value: society.registrationNumber,
                    ),
                  ),
                  Expanded(
                    child: InfoRow(
                      label: 'District',
                      value: society.district.nameEn,
                    ),
                  ),
                ],
              ),
              InfoRow(
                label: 'Status',
                value: _societyStatus(society.status).label,
              ),
            ],
          ),
          const SizedBox(height: 12),
          _ProfileCard(
            title: 'Location',
            trailing: requestUpdate,
            children: [
              MapPreview(location: society.location, height: 120),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: InfoRow(
                      label: 'DS Division',
                      value: society.address.dsDivision,
                    ),
                  ),
                  Expanded(
                    child: InfoRow(
                      label: 'GN Division',
                      value: society.address.gnDivision,
                    ),
                  ),
                ],
              ),
              ...field(ProfileField.location, society.location?.label),
            ],
          ),
          const SizedBox(height: 12),
          const _OfficeBearersCard(),
          const SizedBox(height: 12),
          _ProfileCard(
            title: 'Address and contact',
            trailing: requestUpdate,
            children: [
              ...field(ProfileField.address, orNull(approved.addressLine)),
              ...field(ProfileField.village, orNull(approved.village)),
              ...field(ProfileField.phone, orNull(approved.phone)),
              ...field(ProfileField.email, orNull(approved.email)),
              for (final contact in society.contacts)
                if (contact.fullName != null || contact.email != null)
                  InfoRow(
                    label: contact.isPrimary
                        ? 'Primary contact'
                        : (contact.label ?? 'Contact'),
                    value: [
                      if (contact.fullName != null) contact.fullName!,
                      if (contact.position != null) '(${contact.position})',
                    ].join(' · '),
                  ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Card with a title row, a hairline under it, and an optional action.
class _ProfileCard extends StatelessWidget {
  const _ProfileCard({
    required this.title,
    required this.children,
    this.trailing,
  });

  final String title;
  final Widget? trailing;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Card(
    clipBehavior: Clip.antiAlias,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 6, 4, 6),
          child: Row(
            children: [
              Expanded(
                child: Semantics(
                  header: true,
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
              ?trailing,
            ],
          ),
        ),
        const Divider(height: 1),
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 2),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: children,
          ),
        ),
      ],
    ),
  );
}

class _RequestUpdate extends StatelessWidget {
  const _RequestUpdate({required this.onPressed});

  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => TextButton.icon(
    onPressed: onPressed,
    style: TextButton.styleFrom(
      foregroundColor: const Color(0xFF2D5C88),
      textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
      minimumSize: const Size(44, 40),
    ),
    icon: const Icon(Icons.edit_outlined, size: 15),
    label: const Text('Request update'),
  );
}

class _OfficeBearersCard extends StatelessWidget {
  const _OfficeBearersCard();

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final officeBearers = store.council
        .where((member) => member.isOfficeBearer)
        .toList();
    return _ProfileCard(
      title: 'Office bearers',
      trailing: TextButton(
        onPressed: () => Navigator.of(
          context,
        ).push(MaterialPageRoute<void>(builder: (_) => const CouncilScreen())),
        style: TextButton.styleFrom(
          foregroundColor: const Color(0xFF2D5C88),
          textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
        ),
        child: const Text('View all'),
      ),
      children: [
        if (store.councilSubmission != null &&
            store.councilSubmission!.isLocked) ...[
          Align(
            alignment: Alignment.centerLeft,
            child: StatusChip.submission(
              store.councilSubmission!.status,
              compact: true,
            ),
          ),
          const SizedBox(height: 8),
        ],
        for (final member in officeBearers)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              children: [
                MemberAvatar(member, size: 32),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    member.fullName,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                ),
                Text(
                  member.position,
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

StatusStyle _societyStatus(SocietyStatus status) => switch (status) {
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
