import 'package:flutter/material.dart';

import '../format.dart';
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

/// M06 · Society profile (approved registry record, read-only).
class SocietyProfileScreen extends StatelessWidget {
  const SocietyProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Society profile')),
      body: Column(
        children: [
          if (store.offline) const OfflineBanner(),
          Expanded(
            child: DemoLoader(
              loadingLabel: 'Loading the society profile',
              builder: (context) => const _ProfileContent(),
            ),
          ),
        ],
      ),
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
    final officeBearers = store.council
        .where((member) => member.isOfficeBearer)
        .toList();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        NoticeBanner(
          icon: Icons.verified_outlined,
          tone: NoticeTone.success,
          title: 'Approved record · Verified',
          message:
              'Last verified ${formatDate(society.lastVerifiedOn!)} by ${society.lastVerifiedBy}. '
              'Changes you make are drafts until the District Centre approves them.',
        ),
        const SizedBox(height: 12),
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
            action: Align(
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
            ),
          ),
          const SizedBox(height: 12),
        ],
        SectionCard(
          title: 'Registration',
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
                    label: 'Registration number',
                    value: society.registrationNumber,
                  ),
                ),
              ],
            ),
            Row(
              children: [
                Expanded(
                  child: InfoRow(
                    label: 'Established',
                    value: society.establishedOn == null
                        ? null
                        : formatDate(society.establishedOn!),
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
          ],
        ),
        const SizedBox(height: 12),
        SectionCard(
          title: 'Address and contact',
          trailing: TextButton.icon(
            onPressed: pending == null ? openEdit : null,
            icon: const Icon(Icons.edit_outlined, size: 18),
            label: const Text('Edit Profile'),
          ),
          children: [
            ...field(ProfileField.address, orNull(approved.addressLine)),
            ...field(ProfileField.village, orNull(approved.village)),
            ...field(ProfileField.phone, orNull(approved.phone)),
            ...field(ProfileField.email, orNull(approved.email)),
            InfoRow(
              label: 'Primary contact',
              value:
                  '${society.primaryContact?.fullName} (${society.primaryContact?.position})',
            ),
          ],
        ),
        const SizedBox(height: 12),
        SectionCard(
          title: 'Location',
          children: [
            MapPreview(location: society.location),
            const SizedBox(height: 12),
            ...field(ProfileField.location, society.location?.label),
          ],
        ),
        const SizedBox(height: 12),
        SectionCard(
          title: 'Executive Council',
          trailing:
              store.councilSubmission != null &&
                  store.councilSubmission!.isLocked
              ? StatusChip.submission(
                  store.councilSubmission!.status,
                  compact: true,
                )
              : null,
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
          children: [
            SeatSummary(filled: store.seatsFilled, total: store.totalSeats),
            const SizedBox(height: 12),
            for (final member in officeBearers)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    MemberAvatar(member, size: 32),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        member.fullName,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                    Text(
                      member.position,
                      style: const TextStyle(color: AppColors.muted),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 4),
            FilledButton.icon(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => const CouncilScreen()),
              ),
              icon: const Icon(Icons.groups_outlined),
              label: const Text('Update Committee'),
            ),
          ],
        ),
      ],
    );
  }
}
