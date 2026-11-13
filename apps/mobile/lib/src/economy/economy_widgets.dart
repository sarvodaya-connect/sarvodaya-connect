import 'package:flutter/material.dart';

import '../l10n/l10n.dart';
import '../l10n/record_l10n.dart';
import '../society_record/record_widgets.dart';
import '../theme/app_theme.dart';
import 'economy_api.dart';
import 'economy_l10n.dart';
import 'economy_models.dart';

/// "● Operating", "● Seasonal", "● Temporarily stopped" or "● Closed". The
/// word is always shown, so the colour never carries the meaning alone.
class BusinessStatusChip extends StatelessWidget {
  const BusinessStatusChip(this.status, {super.key});

  final String status;

  @override
  Widget build(BuildContext context) => RecordChip(
    context.l10n.statusName(status),
    tone: switch (status) {
      'OPERATING' => ChipTone.success,
      'SEASONAL' => ChipTone.info,
      'TEMPORARILY_STOPPED' => ChipTone.warning,
      _ => ChipTone.neutral,
    },
  );
}

/// "Actual" or "Estimated", in different colours and always in words.
class MeasurementChip extends StatelessWidget {
  const MeasurementChip(this.measurement, {super.key});

  final String measurement;

  @override
  Widget build(BuildContext context) => RecordChip(
    context.l10n.measurementName(measurement),
    tone: measurement == 'ESTIMATED' ? ChipTone.info : ChipTone.success,
    icon: measurement == 'ESTIMATED'
        ? Icons.insights_outlined
        : Icons.check_circle_outline,
  );
}

/// One measurement of an output: "Latest actual · 3,200 litres ·
/// October 2026", or "Not reported". Never a total of actual and estimated.
class LatestFigure extends StatelessWidget {
  const LatestFigure({
    super.key,
    required this.measurement,
    required this.record,
  });

  final String measurement;
  final ProductionRecord? record;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final record = this.record;
    final label = measurement == 'ESTIMATED'
        ? l.vepLatestEstimated
        : l.vepLatestActual;
    return Semantics(
      container: true,
      child: Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 1),
              child: Icon(
                measurement == 'ESTIMATED'
                    ? Icons.insights_outlined
                    : Icons.check_circle_outline,
                size: 13,
                color: measurement == 'ESTIMATED'
                    ? const Color(0xFF2D5C88)
                    : AppColors.leaf,
              ),
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text.rich(
                TextSpan(
                  children: [
                    TextSpan(text: '$label · '),
                    if (record == null)
                      TextSpan(
                        text: l.vepNotReported,
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontStyle: FontStyle.italic,
                        ),
                      )
                    else ...[
                      TextSpan(
                        text: l.quantity(record.quantity, record.unit),
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          color: AppColors.ink,
                        ),
                      ),
                      TextSpan(text: ' · ${l.period(record.period)}'),
                    ],
                  ],
                ),
                style: const TextStyle(
                  fontSize: 11.5,
                  height: 1.35,
                  color: AppColors.inkSoft,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The shared "leave without saving?" question. True when the person chose
/// to throw away what they typed.
Future<bool> confirmDiscard(BuildContext context) async {
  final l = context.l10n;
  final discard = await showDialog<bool>(
    context: context,
    builder: (dialog) => AlertDialog(
      title: Text(l.editLeaveTitle),
      content: Text(l.vepLeaveBody),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(dialog, false),
          child: Text(l.editKeepEditing),
        ),
        TextButton(
          style: TextButton.styleFrom(foregroundColor: AppColors.danger),
          onPressed: () => Navigator.pop(dialog, true),
          child: Text(l.editDiscard),
        ),
      ],
    ),
  );
  return discard == true;
}

/// A yes/no question before closing a business or archiving an output.
Future<bool> confirmAction(
  BuildContext context, {
  required String title,
  required String message,
  required String confirm,
}) async {
  final l = context.l10n;
  final yes = await showDialog<bool>(
    context: context,
    builder: (dialog) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(dialog, false),
          child: Text(l.editCancel),
        ),
        TextButton(
          onPressed: () => Navigator.pop(dialog, true),
          child: Text(confirm),
        ),
      ],
    ),
  );
  return yes == true;
}

/// Whether a failed request might still have reached the server: no answer,
/// or a server failure. A retry then checks before sending again.
bool uncertain(SocietyRecordException error) =>
    error.offline || error.status == null || error.status! >= 500;

/// The message for a failed save. A refusal says the person can only view;
/// anything else keeps the typed values and says so.
String saveError(AppLocalizations l, SocietyRecordException error) =>
    error.status == 403
    ? l.vepForbidden
    : error.status == 404
    ? l.vepNoAccess
    : l.recStillHere(l.recordError(error));

/// A short label above a value in the economy cards.
class EconomyLabel extends StatelessWidget {
  const EconomyLabel(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 4),
    child: Semantics(
      header: true,
      child: Text(text, style: RecordStyle.sectionLabel),
    ),
  );
}
