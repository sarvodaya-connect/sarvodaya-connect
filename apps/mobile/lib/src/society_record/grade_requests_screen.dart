import 'package:flutter/material.dart';

import '../format.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/state_views.dart';
import 'record_widgets.dart';
import 'society_record_api.dart';
import 'society_record_models.dart';

/// M06q: the open grade-change request and earlier ones, each showing who
/// sent or decided it and when.
class GradeRequestsScreen extends StatefulWidget {
  const GradeRequestsScreen({super.key, required this.record});

  final SocietyRecord record;

  @override
  State<GradeRequestsScreen> createState() => _GradeRequestsScreenState();
}

class _GradeRequestsScreenState extends State<GradeRequestsScreen> {
  List<GradeRequest>? _requests;
  SocietyRecordException? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final requests = await DemoScope.read(context).societyRecords
          .fetchGradeRequests(widget.record.id);
      if (mounted) setState(() => _requests = requests);
    } on SocietyRecordException catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final requests = _requests;
    final open = requests?.where(
      (request) => request.status == GradeRequestStatus.pending,
    );
    final earlier = requests?.where(
      (request) => request.status != GradeRequestStatus.pending,
    );
    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 58,
        titleSpacing: 0,
        shape: const Border(bottom: BorderSide(color: AppColors.line)),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Grade-change requests', style: RecordStyle.screenTitle),
            Text(widget.record.nameEn, style: RecordStyle.screenSubtitle),
          ],
        ),
      ),
      body: _error != null
          ? StateMessage(
              icon: Icons.error_outline,
              tone: StateTone.error,
              isAlert: true,
              title: "Couldn't load grade-change requests",
              message: _error!.message,
              primaryLabel: 'Try again',
              onPrimary: _load,
            )
          : requests == null
          ? const LoadingSkeleton(label: 'Loading grade-change requests')
          : requests.isEmpty
          ? const StateMessage(
              icon: Icons.workspace_premium_outlined,
              title: 'No grade-change requests yet',
              message: 'Requests sent to HQ for this society will appear here.',
            )
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
                children: [
                  for (final request in open!) _RequestCard(request: request),
                  if (earlier!.isNotEmpty)
                    const Padding(
                      padding: EdgeInsets.fromLTRB(2, 6, 2, 8),
                      child: Text(
                        'EARLIER REQUESTS',
                        style: RecordStyle.sectionLabel,
                      ),
                    ),
                  for (final request in earlier) _RequestCard(request: request),
                ],
              ),
            ),
    );
  }
}

String _dateTime(DateTime when) {
  final hour = when.hour % 12 == 0 ? 12 : when.hour % 12;
  return '${formatDate(when)}, $hour:${when.minute.toString().padLeft(2, '0')} ${when.hour < 12 ? 'a.m.' : 'p.m.'}';
}

class _RequestCard extends StatelessWidget {
  const _RequestCard({required this.request});

  final GradeRequest request;

  @override
  Widget build(BuildContext context) {
    final (label, tone) = switch (request.status) {
      GradeRequestStatus.pending => ('Waiting for HQ', ChipTone.warning),
      GradeRequestStatus.approved => ('Approved', ChipTone.success),
      GradeRequestStatus.rejected => ('Rejected', ChipTone.danger),
    };
    final pending = request.status == GradeRequestStatus.pending;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: RecordCard(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
        children: [
          Row(
            children: [
              Expanded(
                child: Text(request.change, style: RecordStyle.cardTitle),
              ),
              RecordChip(label, tone: tone),
            ],
          ),
          const SizedBox(height: 10),
          if (pending) ...[
            RecordTimelineEntry(
              title: 'Sent to HQ',
              detail:
                  '${request.requestedBy.label} · ${_dateTime(request.requestedAt)}',
              quote: request.reason,
              ringColor: AppColors.danger,
            ),
            const RecordTimelineEntry(
              title: 'Waiting for an HQ decision',
              detail: 'Usually within 5 working days',
              ringColor: AppColors.muted,
              last: true,
            ),
          ] else ...[
            RecordTimelineEntry(
              title:
                  '${request.status == GradeRequestStatus.approved ? 'Approved' : 'Rejected'} by ${request.decidedBy?.label ?? 'HQ'}',
              detail: request.decidedAt == null
                  ? ''
                  : _dateTime(request.decidedAt!),
              quote: request.decisionComment,
              ringColor: request.status == GradeRequestStatus.approved
                  ? AppColors.forest
                  : AppColors.danger,
            ),
            RecordTimelineEntry(
              title: 'Sent by ${request.requestedBy.label}',
              detail: formatDate(request.requestedAt),
              ringColor: AppColors.danger,
              last: true,
            ),
          ],
        ],
      ),
    );
  }
}
