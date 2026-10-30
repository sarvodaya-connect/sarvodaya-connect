import 'package:flutter/material.dart';

import '../format.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/state_views.dart';
import 'audit_report_upload_screen.dart';
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
    if (controller.text.trim().isEmpty) {
      return _changed ? 'Enter the total, for example $example.' : null;
    }
    return parseAmount(controller.text, allowNegative: loss) == null
        ? 'Use numbers only, for example $example.'
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
    setState(() => _saving = true);
    try {
      await DemoScope.read(context).societyRecords.saveAnnualSummary(
        widget.record.id,
        _year,
        totalProfit: profit,
        totalExpenses: expenses,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Saved. The old and new values are in the society history.',
          ),
        ),
      );
      Navigator.of(context).pop(true);
    } on SocietyRecordException catch (error) {
      if (mounted) {
        setState(() {
          _saving = false;
          _saveError = '${error.message} Your figures are still here.';
        });
      }
    }
  }

  Future<void> _confirmLeave() async {
    final leave = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Leave without saving?'),
        content: const Text(
          'You changed the yearly figures. If you leave now, these changes are lost.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Keep editing'),
          ),
          TextButton(
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Discard changes'),
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
                  ? 'Was ${formatLkr(saved)}'
                  : change == null
                  ? null
                  : 'Last changed by ${change.updatedBy.label} · ${formatDate(change.updatedAt)}',
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
          title: 'Yearly summary',
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
                      title: "Couldn't load the yearly summary",
                      message: _loadError!.message,
                      primaryLabel: 'Try again',
                      onPrimary: _load,
                    )
                  : summary == null
                  ? const LoadingSkeleton(label: 'Loading the yearly summary')
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                      children: [
                        const FieldLabel('Financial year', required: true),
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
                                  '${year.label} · ${formatDate(year.startsOn).replaceFirst(RegExp(r'^0'), '')} – ${formatDate(year.endsOn)}',
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
                          'Total profit for the year (LKR)',
                          _profit,
                          summary.totalProfit,
                          summary.profitChange,
                          '412500',
                          loss: true,
                        ),
                        _amountField(
                          'Total expenses for the year (LKR)',
                          _expenses,
                          summary.totalExpenses,
                          summary.expensesChange,
                          '1286000',
                        ),
                        const FieldLabel('Audit report for this year'),
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
                                            'Not uploaded yet',
                                        style: RecordStyle.value,
                                      ),
                                      if (summary.auditReport != null)
                                        Text(
                                          'Uploaded ${formatWhen(summary.auditReport!.uploadedAt, DemoScope.of(context).now)} by ${summary.auditReport!.uploadedBy.displayName}',
                                          style: RecordStyle.caption,
                                        ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 8),
                                if (summary.auditReport != null)
                                  const RecordChip(
                                    'Uploaded',
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
                                                      AuditReportUploadScreen(
                                                        record: record,
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
                                    label: const Text('Upload'),
                                  )
                                else
                                  const RecordChip(
                                    'Missing',
                                    tone: ChipTone.danger,
                                  ),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        const RecordNote(
                          icon: Icons.info_outline,
                          tone: NoteTone.warning,
                          dashed: true,
                          message: 'Only two yearly totals are kept, with the audit report. The app records no transactions, loans, savings, payments, sales or accounts.',
                        ),
                        const SizedBox(height: 8),
                        const RecordNote(
                          icon: Icons.history,
                          tone: NoteTone.success,
                          message: 'Saving adds the old and new values to the society history, with your name and the time.',
                        ),
                        if (_saveError != null) ...[
                          const SizedBox(height: 8),
                          NoticeBanner(
                            icon: Icons.error_outline,
                            tone: NoticeTone.error,
                            title: 'Not saved',
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
            child: const Text('Cancel'),
          ),
          primary: FilledButton(
            onPressed: _dirty && valid && !_saving ? _save : null,
            child: Text(_saving ? 'Saving…' : 'Save'),
          ),
        ),
      ),
    );
  }
}
