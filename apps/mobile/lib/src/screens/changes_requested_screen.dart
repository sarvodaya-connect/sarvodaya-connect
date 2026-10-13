import 'package:flutter/material.dart';

import '../format.dart';
import '../models/submission.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../validation/validators.dart';
import '../widgets/section_card.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';
import 'submission_detail_screen.dart';

/// M15 · Changes Requested: only the fields the District Manager returned can be edited.
class ChangesRequestedScreen extends StatefulWidget {
  const ChangesRequestedScreen({super.key, required this.submissionId});

  final String submissionId;

  @override
  State<ChangesRequestedScreen> createState() => _ChangesRequestedScreenState();
}

class _ChangesRequestedScreenState extends State<ChangesRequestedScreen> {
  final _formKey = GlobalKey<FormState>();
  final Map<String, TextEditingController> _controllers = {};
  final Map<String, DateTime?> _dates = {};
  bool _sending = false;
  String? _sendError;

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  bool _isDateField(SubmissionChange change) =>
      change.field.endsWith('.appointedOn');

  TextEditingController _controllerFor(SubmissionChange change) {
    return _controllers.putIfAbsent(
      change.field,
      () => TextEditingController(text: change.correctedValue ?? ''),
    );
  }

  Future<void> _pickDate(SubmissionChange change) async {
    final store = DemoScope.read(context);
    final picked = await showDatePicker(
      context: context,
      initialDate: _dates[change.field] ?? store.now,
      firstDate: DateTime(2000),
      lastDate: store.now,
      helpText: change.label,
    );
    if (picked == null) return;
    setState(() {
      _dates[change.field] = picked;
      _controllerFor(change).text = formatDate(picked);
    });
  }

  Future<void> _resubmit(SocietySubmission submission) async {
    if (!_formKey.currentState!.validate()) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Send the correction?'),
        content: const Text(
          'The District Manager will check the corrected field. The original value stays in the history.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Yes, resubmit'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final store = DemoScope.read(context);
    setState(() {
      _sending = true;
      _sendError = null;
    });
    try {
      for (final change in submission.changes.where(
        (c) => c.correctionStatus == CorrectionStatus.required,
      )) {
        store.correctField(
          submission.id,
          change.field,
          _controllerFor(change).text.trim(),
        );
      }
      await store.resubmit(submission.id);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(
          builder: (_) => SubmissionDetailScreen(submissionId: submission.id),
        ),
      );
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Correction sent to the District Centre.'),
        ),
      );
    } on OfflineException {
      if (mounted) {
        setState(
          () => _sendError = 'You are offline, so the correction was not sent. It is saved on this phone.',
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final submission = store.submissionById(widget.submissionId);
    if (submission == null ||
        submission.status != SubmissionStatus.changesRequested) {
      return Scaffold(
        appBar: AppBar(title: const Text('Council update')),
        body: StateMessage(
          icon: Icons.check_circle_outline,
          title: 'Nothing to correct',
          message: 'This submission is not waiting for a correction.',
          primaryLabel: 'Back',
          onPrimary: () => Navigator.of(context).pop(),
        ),
      );
    }
    final review = submission.reviews.lastWhere(
      (r) => r.decision == ReviewDecision.changesRequested,
    );
    final returnedCount = submission.changes
        .where((c) => c.correctionStatus == CorrectionStatus.required)
        .length;

    return Scaffold(
      appBar: AppBar(title: const Text('Council update')),
      body: Column(
        children: [
          if (store.offline) const OfflineBanner(),
          Expanded(
            child: Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: StatusChip.submission(submission.status),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'The District Centre needs you to fix $returnedCount field${returnedCount == 1 ? '' : 's'}. Everything else is accepted.',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Returned by ${review.reviewerDisplayName} · ${formatDateTime(review.decidedAt)}',
                    style: const TextStyle(color: AppColors.muted),
                  ),
                  // Fixed slot so the editable field below is never rebuilt when this appears.
                  Padding(
                    padding: EdgeInsets.only(top: _sendError == null ? 0 : 12),
                    child: _sendError == null
                        ? const SizedBox.shrink()
                        : NoticeBanner(
                            icon: Icons.wifi_off,
                            tone: NoticeTone.error,
                            title: 'Not sent',
                            message: _sendError,
                          ),
                  ),
                  const SizedBox(height: 16),
                  for (final change in submission.changes)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child:
                          change.correctionStatus == CorrectionStatus.required
                          ? _ReturnedField(
                              change: change,
                              comment: review.field == change.field
                                  ? review.comment
                                  : null,
                              reviewer: review.reviewerDisplayName,
                              controller: _controllerFor(change),
                              isDate: _isDateField(change),
                              onPickDate: () => _pickDate(change),
                              validator: (value) => _isDateField(change)
                                  ? Validators.startDate(
                                      _dates[change.field],
                                      today: store.now,
                                    )
                                  : Validators.required(
                                      value,
                                      change.label.toLowerCase(),
                                    ),
                            )
                          : _AcceptedField(change: change),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: BottomActionBar(
        primary: FilledButton.icon(
          onPressed: _sending ? null : () => _resubmit(submission),
          icon: const Icon(Icons.send),
          label: const Text('Review and resubmit'),
        ),
      ),
    );
  }
}

class _AcceptedField extends StatelessWidget {
  const _AcceptedField({required this.change});

  final SubmissionChange change;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.only(top: 2),
              child: Icon(
                Icons.check_circle_outline,
                color: AppColors.leaf,
                size: 20,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: InfoRow(label: change.label, value: change.proposedValue),
            ),
          ],
        ),
        const Padding(
          padding: EdgeInsets.only(left: 30, bottom: 8),
          child: Text(
            'No Correction Required · read-only',
            style: TextStyle(color: AppColors.muted, fontSize: 12),
          ),
        ),
      ],
    );
  }
}

class _ReturnedField extends StatelessWidget {
  const _ReturnedField({
    required this.change,
    required this.comment,
    required this.reviewer,
    required this.controller,
    required this.isDate,
    required this.onPickDate,
    required this.validator,
  });

  final SubmissionChange change;
  final String? comment;
  final String reviewer;
  final TextEditingController controller;
  final bool isDate;
  final VoidCallback onPickDate;
  final FormFieldValidator<String> validator;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF6EE),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE9A46F), width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(
                Icons.warning_amber,
                color: Color(0xFFA2470F),
                size: 20,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '${change.label} * — fix this',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    color: Color(0xFFA2470F),
                  ),
                ),
              ),
            ],
          ),
          if (comment != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.chat_bubble_outline,
                    size: 18,
                    color: AppColors.muted,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '“$comment”\n$reviewer, District Centre',
                      style: const TextStyle(height: 1.35),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 10),
          Text(
            'You sent: ${change.proposedValue}',
            style: const TextStyle(color: AppColors.muted, fontSize: 13),
          ),
          const SizedBox(height: 8),
          TextFormField(
            controller: controller,
            readOnly: isDate,
            onTap: isDate ? onPickDate : null,
            decoration: InputDecoration(
              labelText: 'Corrected ${change.label.toLowerCase()} *',
              suffixIcon: isDate
                  ? IconButton(
                      tooltip: 'Choose date',
                      icon: const Icon(Icons.calendar_today_outlined),
                      onPressed: onPickDate,
                    )
                  : null,
            ),
            validator: validator,
          ),
        ],
      ),
    );
  }
}
