import 'package:flutter/material.dart';

import '../format.dart';
import '../models/committee.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/council_widgets.dart';
import '../widgets/section_card.dart';
import '../widgets/state_views.dart';
import 'documents_screen.dart';
import 'replace_member_screen.dart';

/// M07b · Executive Council: current seats, details, replacement and history.
class CouncilScreen extends StatelessWidget {
  const CouncilScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final draft = store.draft;
    final submission = store.councilSubmission;
    final locked = submission != null && submission.isLocked;

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Executive Council'),
          bottom: const TabBar(
            labelColor: AppColors.forest,
            indicatorColor: AppColors.leaf,
            tabs: [
              Tab(text: 'Current'),
              Tab(text: 'History'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _CurrentCouncil(locked: locked),
            const _CouncilHistory(),
          ],
        ),
        bottomNavigationBar: draft != null && !locked
            ? BottomActionBar(
                secondary: OutlinedButton(
                  onPressed: () => _confirmDiscard(context),
                  child: const Text('Discard'),
                ),
                primary: FilledButton(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => const DocumentsScreen(inFlow: true),
                    ),
                  ),
                  child: const Text('Next: add supporting document'),
                ),
              )
            : null,
      ),
    );
  }

  static Future<void> _confirmDiscard(BuildContext context) async {
    final discard = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Discard this draft?'),
        content: const Text(
          'The replacement and any documents you added for it will be removed from this phone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Keep draft'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Discard'),
          ),
        ],
      ),
    );
    if (discard == true && context.mounted) {
      DemoScope.read(context).discardDraft();
    }
  }
}

class _CurrentCouncil extends StatelessWidget {
  const _CurrentCouncil({required this.locked});

  final bool locked;

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final draft = store.draft;
    final submission = store.councilSubmission;
    final council = store.council;
    final officeBearers = council
        .where((member) => member.isOfficeBearer)
        .toList();
    final executive = council
        .where(
          (member) =>
              !member.isOfficeBearer &&
              member.seatType != CouncilSeatType.elder,
        )
        .toList();
    final elders = council
        .where((member) => member.seatType == CouncilSeatType.elder)
        .toList();

    String? pendingLabel(CommitteeMember member) {
      if (!store.hasPendingChange(member.id)) return null;
      if (locked || submission?.isLocked == true) {
        return 'Change waiting for District';
      }
      if (draft != null && draft.memberId == member.id) {
        return 'Draft: ${draft.fullName} from ${formatDate(draft.startDate)}';
      }
      return 'Change returned for correction';
    }

    Widget tile(CommitteeMember member) => MemberTile(
      member: member,
      pendingLabel: pendingLabel(member),
      onTap: () => _showDetails(context, member, canReplace: !locked),
      onReplace: locked || (draft != null && draft.memberId != member.id)
          ? null
          : () => _openReplace(context, member),
    );

    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 16),
      children: [
        if (locked && submission?.reviewStartedAt != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: NoticeBanner.locked(
              reviewer: submission!.reviewerDisplayName!,
              since: submission.reviewStartedAt!,
            ),
          )
        else if (locked)
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: NoticeBanner(
              icon: Icons.lock_outline,
              tone: NoticeTone.warning,
              title: 'Waiting for the District Centre',
              message: 'You sent a Council update. You can make new changes after it has been reviewed.',
            ),
          )
        else if (draft != null)
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: NoticeBanner(
              icon: Icons.edit_note,
              title: 'Draft change, not sent yet',
              message: 'The approved Council below has not changed. Add the AGM minutes, then review and send it to the District Centre.',
            ),
          ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: SectionCard(
            children: [
              SeatSummary(filled: store.seatsFilled, total: store.totalSeats),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _GroupHeader('Office bearers'),
        for (final member in officeBearers) tile(member),
        const SizedBox(height: 8),
        _GroupHeader('Executive members · ${executive.length}'),
        for (final member in executive) tile(member),
        const SizedBox(height: 8),
        _GroupHeader(
          'Elders Council · ${elders.length} of ${CouncilSeatType.elder.seatCount}',
        ),
        for (final member in elders) tile(member),
      ],
    );
  }

  static void _openReplace(BuildContext context, CommitteeMember member) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ReplaceMemberScreen(memberId: member.id),
      ),
    );
  }

  static void _showDetails(
    BuildContext context,
    CommitteeMember member, {
    required bool canReplace,
  }) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  MemberAvatar(member, size: 48),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          member.fullName,
                          style: Theme.of(sheetContext).textTheme.titleLarge,
                        ),
                        Text(
                          member.position,
                          style: const TextStyle(color: AppColors.muted),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              InfoRow(
                label: 'Seat type',
                value: '${member.seatType.label} seat',
              ),
              if (member.age != null)
                InfoRow(label: 'Age', value: '${member.age}'),
              InfoRow(label: 'Phone', value: member.phone),
              InfoRow(
                label: 'Start date',
                value: member.appointedOn == null
                    ? null
                    : formatDate(member.appointedOn!),
              ),
              InfoRow(
                label: 'Primary contact',
                value: member.isPrimaryContact ? 'Yes' : 'No',
              ),
              if (canReplace) ...[
                const SizedBox(height: 4),
                FilledButton(
                  onPressed: () {
                    Navigator.of(sheetContext).pop();
                    _openReplace(context, member);
                  },
                  child: Text(
                    'Replace ${member.position == 'Executive member' ? 'this member' : member.position}',
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _GroupHeader extends StatelessWidget {
  const _GroupHeader(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: Semantics(
        header: true,
        child: Text(
          text.toUpperCase(),
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.6,
            color: AppColors.leaf,
          ),
        ),
      ),
    );
  }
}

class _CouncilHistory extends StatelessWidget {
  const _CouncilHistory();

  @override
  Widget build(BuildContext context) {
    final history = DemoScope.of(context).councilHistory;
    if (history.isEmpty) {
      return const StateMessage(
        icon: Icons.history,
        title: 'No earlier members yet',
        message: 'When a replacement is approved, the outgoing member is kept here with their dates.',
      );
    }
    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 16),
      children: [
        for (final member in history)
          ListTile(
            leading: MemberAvatar(member),
            title: Text(member.fullName),
            subtitle: Text(
              '${member.position} · ${member.appointedOn == null ? '' : formatDate(member.appointedOn!)}'
              ' – ${member.endedOn == null ? '' : formatDate(member.endedOn!)}',
            ),
          ),
      ],
    );
  }
}
