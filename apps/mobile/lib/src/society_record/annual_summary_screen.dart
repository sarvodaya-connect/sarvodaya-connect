import 'package:flutter/material.dart';

import '../l10n/l10n.dart';
import '../l10n/l10n_format.dart';
import '../l10n/record_l10n.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/state_views.dart';
import 'document_upload_screen.dart';
import 'record_widgets.dart';
import 'society_record_api.dart';
import 'society_record_models.dart';

/// Whole or decimal LKR, at most two decimal places; a loss may be negative.
final _amountPattern = RegExp(r'^-?\d{1,12}(\.\d{1,2})?$');

/// Parses "1,286,000" or "1286000.50"; returns null when it is not a number.
double? parseAmount(String text, {bool allowNegative = false}) {
  final compact = text.replaceAll(',', '').replaceAll(' ', '').trim();
  if (!_amountPattern.hasMatch(compact)) return null;
  final value = double.parse(compact);
  if (value < 0 && !allowNegative) return null;
  return value;
}

/// M06f: the financial year, total profit and total expenses in LKR. Two
/// yearly totals only — no accounting. Entered by the Society Officer or
/// the assigned SPC.
class AnnualSummaryScreen extends StatefulWidget {
  const AnnualSummaryScreen({super.key, required this.record});

  final SocietyRecord record;

  @override
  State<AnnualSummaryScreen> createState() => _AnnualSummaryScreenState();
}

class _AnnualSummaryScreenState extends State<AnnualSummaryScreen> {
  final _profit = TextEditingController();
  final _expenses = TextEditingController();
  AnnualSummaryResult? _result;
  late int _year = widget.record.annualSummary.financialYear.startYear;
  SocietyRecordException? _loadError;
  String? _saveError;
  bool _saving = false;
  bool _changed = false;

  @override
  void initState() {
    super.initState();
    for (final controller in [_profit, _expenses]) {
      controller.addListener(() => setState(() {}));
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _profit.dispose();
    _expenses.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loadError = null;
      _result = null;
    });
    try {
      final result = await DemoScope.read(context).societyRecords
          .fetchAnnualSummary(widget.record.id, year: _year);
      if (!mounted) return;
      setState(() {
        _result = result;
        _profit.text = _initial(result.summary.totalProfit);
        _expenses.text = _initial(result.summary.totalExpenses);
      });
    } on SocietyRecordException catch (error) {
      if (mounted) setState(() => _loadError = error);
    }
  }

  String _initial(double? value) => value == null ? '' : formatAmount(value);

  AnnualSummary? get _summary => _result?.summary;

  bool _differs(TextEditingController controller, double? saved) {
    final value = parseAmount(controller.text, allowNegative: true);
    return controller.text.trim() != _initial(saved) && value != saved;
  }

  bool get _dirty =>
      _summary != null &&
      (_differs(_profit, _summary!.totalProfit) ||
          _differs(_expenses, _summary!.totalExpenses));

  String? _error(
    TextEditingController controller,
    String example, {
    bool loss = false,
  }) {
    final l = context.l10n;
    if (controller.text.trim().isEmpty) {
      return _changed ? l.rdEnterTotal(example) : null;
    }
    return parseAmount(controller.text, allowNegative: loss) == null
        ? l.rdNumbersOnly(example)
        : null;
  }

  Future<void> _save() async {
    setState(() {
      _changed = true;
      _saveError = null;
    });
    final profit = parseAmount(_profit.text, allowNegative: true);
    final expenses = parseAmount(_expenses.text);
    if (profit == null || expenses == null) return;
    final l = context.l10n;
    setState(() => _saving = true);
    try {
      await DemoScope.read(context).societyRecords.saveAnnualSummary(
        widget.record.id,
        _year,
        totalProfit: profit,
        totalExpenses: expenses,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l.rdSaved)));
      Navigator.of(context).pop(true);
    } on SocietyRecordException catch (error) {
      if (mounted) {
        setState(() {
          _saving = false;
          _saveError = l.rdKeptFigures(l.recordError(error));
        });
      }
    }
  }

  Future<void> _confirmLeave() async {
    final l = context.l10n;
    final leave = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l.rdLeave),
        content: Text(l.rdLeaveFigures),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(l.rdKeepEditing),
          ),
          TextButton(
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            onPressed: () => Navigator.pop(context, true),
            child: Text(l.rdDiscard),
          ),
        ],
      ),
    );
    if (leave == true && mounted) Navigator.of(context).pop(false);
  }

  Widget _amountField(
    String label,
    TextEditingController controller,
    double? saved,
    AmountChange? change,
    String example, {
    bool loss = false,
  }) {
    final l = context.l10n;
    final changed = _differs(controller, saved);
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          FieldLabel(label, required: true),
          TextField(
            controller: controller,
            style: recordInputStyle,
            keyboardType: TextInputType.numberWithOptions(
              decimal: true,
              signed: loss,
            ),
            decoration: changedDecoration(
              changed: changed,
              helper: changed && saved != null
                  ? l.rdWas(l.recordMoney(saved))
                  : change == null
                  ? null
                  : l.rdLastChanged(
                      l.actor(change.updatedBy),
                      l.date(change.updatedAt),
                    ),
              error: _error(controller, example, loss: loss),
            ),
            onChanged: (_) => _changed = true,
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final record = widget.record;
    final summary = _summary;
    final user = DemoScope.of(context).user!;
    final valid =
        parseAmount(_profit.text, allowNegative: true) != null &&
        parseAmount(_expenses.text) != null;
    return PopScope(
      canPop: !_dirty || _saving,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _confirmLeave();
      },
      child: Scaffold(
        appBar: recordFormAppBar(
          context,
          title: l.rdYearlySummary,
          subtitle: '${record.nameEn} · ${record.societyCode}',
          actions: [if (_dirty) const UnsavedChip()],
        ),
        body: Column(
          children: [
            ScopeBanner(record: record, user: user),
            Expanded(
              child: _loadError != null
                  ? StateMessage(
                      icon: Icons.error_outline,
                      tone: StateTone.error,
                      isAlert: true,
                      title: l.rdSummaryError,
                      message: _loadError!.message,
                      primaryLabel: l.rdRetry,
                      onPrimary: _load,
                    )
                  : summary == null
                  ? LoadingSkeleton(label: l.rdLoadingSummary)
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                      children: [
                        FieldLabel(l.rdFinancialYear, required: true),
                        DropdownButtonFormField<int>(
                          initialValue: _year,
                          isExpanded: true,
                          style: recordInputStyle,
                          decoration: const InputDecoration(
                            isDense: true,
                            contentPadding: EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 12,
                            ),
                          ),
                          items: [
                            for (final year in _result!.financialYears)
                              DropdownMenuItem(
                                value: year.startYear,
                                child: Text(
                                  '${year.label} · ${l.date(year.startsOn).replaceFirst(RegExp(r'^0'), '')} – ${l.date(year.endsOn)}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                          ],
                          onChanged: _dirty
                              ? null
                              : (year) {
                                  if (year == null) return;
                                  _year = year;
                                  _load();
                                },
                        ),
                        const SizedBox(height: 14),
                        _amountField(
                          l.rdProfitField,
                          _profit,
                          summary.totalProfit,
                          summary.profitChange,
                          '412500',
                          loss: true,
                        ),
                        _amountField(
                          l.rdExpensesField,
                          _expenses,
                          summary.totalExpenses,
                          summary.expensesChange,
                          '1286000',
                        ),
                        FieldLabel(l.rdAuditThisYear),
                        RecordCard(
                          padding: const EdgeInsets.all(12),
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        summary.auditReport?.fileName ??
                                            l.rdNotUploadedYet,
                                        style: RecordStyle.value,
                                      ),
                                      if (summary.auditReport != null)
                                        Text(
                                          l.rdUploadedBy(
                                            l.recordWhen(
                                              summary.auditReport!.uploadedAt,
                                              DemoScope.of(context).now,
                                            ),
                                            summary
                                                .auditReport!
                                                .uploadedBy
                                                .displayName,
                                          ),
                                          style: RecordStyle.caption,
                                        ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 8),
                                if (summary.auditReport != null)
                                  RecordChip(
                                    l.roleAuditsUploaded,
                                    tone: ChipTone.success,
                                  )
                                else if (record
                                    .permissions
                                    .canUploadAuditReport)
                                  OutlinedButton.icon(
                                    style: compactOutlinedStyle,
                                    onPressed: () async {
                                      final uploaded =
                                          await Navigator.of(context)
                                              .push<bool>(
                                                MaterialPageRoute(
                                                  builder: (_) =>
                                                      DocumentUploadScreen(
                                                        record: record,
                                                        documentType:
                                                            'AUDIT_REPORT',
                                                        financialYear: _year,
                                                      ),
                                                ),
                                              );
                                      if (uploaded == true &&
                                          mounted &&
                                          !_dirty) {
                                        _load();
                                      }
                                    },
                                    icon: const Icon(
                                      Icons.upload_outlined,
                                      size: 14,
                                    ),
                                    label: Text(l.rdUpload),
                                  )
                                else
                                  RecordChip(
                                    l.rdMissing,
                                    tone: ChipTone.danger,
                                  ),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        RecordNote(
                          icon: Icons.info_outline,
                          tone: NoteTone.warning,
                          dashed: true,
                          message: l.rdAnnualOnly,
                        ),
                        const SizedBox(height: 8),
                        RecordNote(
                          icon: Icons.history,
                          tone: NoteTone.success,
                          message: l.rdSavingHistory,
                        ),
                        if (_saveError != null) ...[
                          const SizedBox(height: 8),
                          NoticeBanner(
                            icon: Icons.error_outline,
                            tone: NoticeTone.error,
                            title: l.rdNotSaved,
                            message: _saveError,
                          ),
                        ],
                      ],
                    ),
            ),
          ],
        ),
        bottomNavigationBar: BottomActionBar(
          secondary: OutlinedButton(
            onPressed: () => Navigator.of(context).maybePop(),
            child: Text(l.rdCancel),
          ),
          primary: FilledButton(
            onPressed: _dirty && valid && !_saving ? _save : null,
            child: Text(_saving ? l.rdSaving : l.rdSave),
          ),
        ),
      ),
    );
  }
}
