import 'package:flutter/material.dart';

import '../l10n/l10n.dart';
import '../l10n/l10n_format.dart';
import '../l10n/record_l10n.dart';
import '../society_record/record_widgets.dart';
import '../theme/app_theme.dart';
import 'economy_api.dart' show SocietyRecordException;
import 'economy_l10n.dart';
import 'economy_models.dart';
import 'economy_widgets.dart';

/// How many products the Overview lists before "N more".
const _shownOutputs = 3;

/// Issue #163, section 7: a short Village Economic Profile summary on the
/// society Overview. It uses the profile the record already loads (one
/// request, with each output's latest figures worked out by the API), never
/// the production history. Details stay in the Village Economic Profile tab.
///
/// A failure here says so in this card only; the rest of the record stays.
class EconomySummaryCard extends StatelessWidget {
  const EconomySummaryCard({
    super.key,
    required this.profile,
    required this.error,
    required this.loading,
    required this.businessDescription,
    required this.onRetry,
    required this.onOpen,
  });

  final EconomicProfile? profile;
  final SocietyRecordException? error;
  final bool loading;

  /// The society profile's free text, shown as it was typed.
  final String? businessDescription;
  final VoidCallback onRetry;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final profile = this.profile;
    final error = this.error;
    final open = Semantics(
      button: true,
      child: InkWell(
        key: const ValueKey('overview.openEconomy'),
        onTap: onOpen,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 32),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Flexible(
                child: Text(
                  l.ovOpenEconomy,
                  style: RecordStyle.link,
                  textAlign: TextAlign.end,
                ),
              ),
              const Icon(Icons.chevron_right, size: 16, color: AppColors.leaf),
            ],
          ),
        ),
      ),
    );

    final List<Widget> body;
    if (profile == null && error != null) {
      final ended = error.status == 403 || error.status == 404;
      body = [
        RecordNote(
          icon: ended ? Icons.lock_outline : Icons.error_outline,
          tone: ended ? NoteTone.info : NoteTone.error,
          message: ended
              ? l.vepNoAccess
              : '${l.vepLoadError}. ${l.recordError(error)}',
        ),
        if (!ended)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              key: const ValueKey('overview.economyRetry'),
              style: TextButton.styleFrom(minimumSize: const Size(48, 48)),
              onPressed: loading ? null : onRetry,
              child: Text(l.commonTryAgain),
            ),
          ),
      ];
    } else if (profile == null) {
      body = [Text(l.vepLoading, style: RecordStyle.caption)];
    } else if (profile.businesses.isEmpty) {
      body = [
        Text(l.vepEmptyTitle, style: RecordStyle.value),
        const SizedBox(height: 2),
        Text(
          profile.canManage ? l.vepEmptyManage : l.vepEmptyView,
          style: RecordStyle.caption,
        ),
      ];
    } else {
      final businesses = profile.businesses;
      final outputs = [for (final b in businesses) ...b.activeOutputs];
      final operating = businesses.where((b) => b.status == 'OPERATING');
      body = [
        KeyValueGrid([
          KeyValue(l.vepSummaryBusinesses, l.number(businesses.length)),
          KeyValue(l.vepSummaryOperating, l.number(operating.length)),
        ]),
        if (outputs.isNotEmpty) const SizedBox(height: 10),
        for (final output in outputs.take(_shownOutputs)) ...[
          Text(
            l.withUnit(l.outputName(output), l.unitName(output.unit)),
            style: RecordStyle.value,
          ),
          LatestFigure(
            measurement: 'ACTUAL',
            record: output.latest?.actual,
            known: output.latest != null,
          ),
          if (output.latest?.estimated != null)
            LatestFigure(
              measurement: 'ESTIMATED',
              record: output.latest?.estimated,
            ),
          const SizedBox(height: 8),
        ],
        if (outputs.length > _shownOutputs)
          Text(
            l.ovMoreOutputs(outputs.length - _shownOutputs),
            style: RecordStyle.caption,
          ),
        if (error != null) ...[
          const SizedBox(height: 6),
          Text(
            l.vepShowingSaved(l.recordError(error)),
            style: RecordStyle.caption.copyWith(color: AppColors.danger),
          ),
        ],
      ];
    }

    return RecordCard(
      title: l.recTabEconomy,
      trailing: Flexible(child: open),
      children: [
        ...body,
        const SizedBox(height: 10),
        Text(l.recBusiness, style: RecordStyle.label),
        const SizedBox(height: 2),
        Text(
          businessDescription ?? l.recNoneRecorded,
          style: businessDescription == null
              ? RecordStyle.body.copyWith(color: AppColors.muted)
              : RecordStyle.body,
        ),
        const SizedBox(height: 6),
        Text(l.vepSelfReported, style: RecordStyle.caption),
      ],
    );
  }
}
