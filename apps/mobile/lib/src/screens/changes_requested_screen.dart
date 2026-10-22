import 'package:flutter/material.dart';

import '../format.dart';
import '../models/submission.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../validation/validators.dart';
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
                    child: StatusChip.submission(
                      submission.status,
                      compact: true,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text.rich(
                    TextSpan(
                      children: [
                        const TextSpan(
                          text: 'The District Centre needs you to fix ',
                        ),
                        TextSpan(
                          text:
                              '$returnedCount field${returnedCount == 1 ? '' : 's'}',
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        const TextSpan(text: '. Everything else is accepted.'),
                      ],
                    ),
                    style: const TextStyle(fontSize: 14, height: 1.4),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Returned by ${review.reviewerDisplayName} · ${formatDateTime(review.decidedAt)}',
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 11,
                    ),
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
                  const SizedBox(height: 14),
                  Card(
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        for (final (i, change)
                            in submission.changes.indexed) ...[
                          if (i > 0) const Divider(height: 1),
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
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton.icon(
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => SubmissionDetailScreen(
                            submissionId: submission.id,
                          ),
                        ),
                      ),
                      style: TextButton.styleFrom(
                        foregroundColor: const Color(0xFF2D5C88),
                        textStyle: const TextStyle(
                          fontSize: 12,
                          decoration: TextDecoration.underline,
                        ),
                      ),
                      icon: const Icon(Icons.schedule, size: 16),
                      label: const Text('See full history'),
                    ),
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
          label: const Text('Send corrected update'),
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
    return Semantics(
      label:
          '${change.label}: ${change.proposedValue}. No Correction Required · read-only',
      excludeSemantics: true,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        child: Row(
          children: [
            const Icon(
              Icons.check_circle_outline,
              color: AppColors.leaf,
              size: 18,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    change.label,
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 11,
                    ),
                  ),
                  Text(
                    change.proposedValue,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
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
      color: const Color(0xFFFFF1E2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(
                Icons.warning_amber,
                color: Color(0xFFB4650F),
                size: 18,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(
                        text: '${change.label} *',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      const TextSpan(
                        text: '  — fix this',
                        style: TextStyle(color: Color(0xFFB4650F)),
                      ),
                    ],
                  ),
                  style: const TextStyle(fontSize: 13, color: AppColors.ink),
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
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '“$comment”',
                          style: const TextStyle(fontSize: 13, height: 1.35),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '$reviewer, District Centre',
                          style: const TextStyle(
                            color: AppColors.muted,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 10),
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
          const SizedBox(height: 6),
          ValueListenableBuilder<TextEditingValue>(
            valueListenable: controller,
            builder: (context, value, _) => Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 6,
              children: [
                Text(
                  change.proposedValue,
                  semanticsLabel: 'You sent ${change.proposedValue}',
                  style: const TextStyle(
                    color: AppColors.muted,
                    fontSize: 11,
                    decoration: TextDecoration.lineThrough,
                  ),
                ),
                if (value.text.isNotEmpty) ...[
                  const Text(
                    '→',
                    style: TextStyle(color: AppColors.muted, fontSize: 11),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 1,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.mint,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      value.text,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: AppColors.forest,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
