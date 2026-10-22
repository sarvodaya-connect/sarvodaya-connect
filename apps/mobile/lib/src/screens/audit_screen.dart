import 'package:flutter/material.dart';

import '../format.dart';
import '../models/audit.dart';
import '../models/document.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/demo_loader.dart';
import '../widgets/section_card.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';
import 'documents_screen.dart';

/// M12 · Annual audit: the required audit steps for each financial year,
/// their completion status and the audit report upload.
class AuditScreen extends StatelessWidget {
  const AuditScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Audit')),
      body: Column(
        children: [
          if (store.offline) const OfflineBanner(),
          Expanded(
            child: DemoLoader(
              loadingLabel: 'Loading audits',
              skeletonCards: 2,
              builder: (context) => const _AuditContent(),
            ),
          ),
        ],
      ),
    );
  }
}

class _AuditContent extends StatelessWidget {
  const _AuditContent();

  @override
  Widget build(BuildContext context) {
    final audits = DemoScope.of(context).audits;
    if (audits.isEmpty) {
      return StateMessage(
        icon: Icons.fact_check_outlined,
        title: 'No audits yet',
        message: 'When your society’s first annual audit is due, its checklist will appear here.',
        secondaryLabel: 'Back',
        onSecondary: () => Navigator.of(context).maybePop(),
      );
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _CurrentAuditCard(audit: audits.first),
        for (final audit in audits.skip(1)) ...[
          const SizedBox(height: 12),
          _PastAuditCard(audit: audit),
        ],
      ],
    );
  }
}

class _CurrentAuditCard extends StatelessWidget {
  const _CurrentAuditCard({required this.audit});

  final AnnualAudit audit;

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final today = DateTime(store.now.year, store.now.month, store.now.day);
    final daysLate = today.difference(audit.dueOn).inDays;
    final total = audit.items.length;
    return SectionCard(
      title: audit.financialYear,
      trailing: StatusChip(audit.status.style, compact: true, dot: true),
      children: [
        Text(
          'Due ${formatDate(audit.dueOn)} · prepared by ${audit.preparedBy.toLowerCase()}',
          style: const TextStyle(color: AppColors.muted, fontSize: 11.5),
        ),
        if (audit.status == AuditStatus.overdue) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.dangerSoft,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Semantics(
              liveRegion: true,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'The report is $daysLate ${daysLate == 1 ? 'day' : 'days'} late',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.ink,
                    ),
                  ),
                  const Text(
                    'Upload it as soon as the auditor signs it.',
                    style: TextStyle(fontSize: 13, color: AppColors.ink),
                  ),
                ],
              ),
            ),
          ),
        ],
        if (audit.status == AuditStatus.underReview) ...[
          const SizedBox(height: 12),
          const NoticeBanner(
            icon: Icons.hourglass_top,
            tone: NoticeTone.success,
            title: 'Audit report received',
            message: 'The District Centre will check it and tell you when it is approved.',
          ),
        ],
        const SizedBox(height: 12),
        if (!audit.reportUploaded)
          FilledButton(
            onPressed: () =>
                showUploadSheet(context, initialType: DocumentType.auditReport),
            child: const Text('Upload audit report'),
          )
        else
          OutlinedButton(
            onPressed: () => _openReports(context),
            child: const Text('View in Documents'),
          ),
        const SizedBox(height: 4),
        Theme(
          data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
          child: ExpansionTile(
            tilePadding: EdgeInsets.zero,
            childrenPadding: EdgeInsets.zero,
            title: const Text(
              'Required steps',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            ),
            subtitle: Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Semantics(
                label: '${audit.completedCount} of $total audit steps complete',
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: LinearProgressIndicator(
                    value: audit.completedCount / total,
                    minHeight: 6,
                    backgroundColor: AppColors.mint,
                    color: AppColors.leaf,
                  ),
                ),
              ),
            ),
            trailing: Text(
              '${audit.completedCount} of $total complete',
              style: const TextStyle(color: AppColors.muted, fontSize: 12),
            ),
            children: [
              for (final item in audit.items) _ChecklistRow(item: item),
            ],
          ),
        ),
      ],
    );
  }
}

class _PastAuditCard extends StatelessWidget {
  const _PastAuditCard({required this.audit});

  final AnnualAudit audit;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: audit.financialYear,
      trailing: StatusChip(audit.status.style, compact: true, dot: true),
      children: [
        Text(
          audit.reviewedOn == null
              ? 'All ${audit.items.length} steps complete'
              : 'Approved ${formatDate(audit.reviewedOn!)} by ${audit.reviewedBy}',
          style: const TextStyle(color: AppColors.muted, fontSize: 11.5),
        ),
        if (audit.reviewerComment != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              '“${audit.reviewerComment}”',
              style: const TextStyle(
                color: AppColors.ink,
                fontSize: 13,
                height: 1.35,
              ),
            ),
          ),
        ],
        const SizedBox(height: 12),
        OutlinedButton(
          onPressed: () => _openReports(context),
          child: Text(
            'View report',
            semanticsLabel: 'View audit report ${audit.financialYear}',
          ),
        ),
      ],
    );
  }
}

/// One required audit step. The status has an icon and a label as well as a colour.
class _ChecklistRow extends StatelessWidget {
  const _ChecklistRow({required this.item});

  final AuditChecklistItem item;

  @override
  Widget build(BuildContext context) {
    final style = item.status.style;
    final date = item.completedOn == null
        ? null
        : 'Done ${formatDate(item.completedOn!)}';
    return MergeSemantics(
      child: ListTile(
        contentPadding: EdgeInsets.zero,
        leading: Icon(style.icon, color: style.foreground),
        title: Text(
          item.title,
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        ),
        subtitle: Text(
          [item.description, ?date].join(' · '),
          style: TextStyle(
            fontSize: 12,
            color: item.status == AuditItemStatus.overdue
                ? AppColors.danger
                : AppColors.muted,
          ),
        ),
        trailing: StatusChip(style, compact: true),
      ),
    );
  }
}

void _openReports(BuildContext context) {
  Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (_) =>
          const DocumentsScreen(initialFilter: DocumentType.auditReport),
    ),
  );
}
