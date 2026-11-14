import 'package:flutter/material.dart';

import '../l10n/l10n.dart';
import '../l10n/l10n_format.dart';
import '../l10n/record_l10n.dart';
import '../society_record/record_widgets.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/state_views.dart';
import 'economy_api.dart';
import 'economy_l10n.dart';
import 'economy_models.dart';
import 'economy_widgets.dart';

/// How far back the month list reaches.
const _monthsBack = 36;

/// Issue #146 frame 4: record a production figure, or correct one.
///
/// The officer types the quantity in the output's own unit and picks the
/// exact period and whether it is actual or estimated. A preview shows the
/// figure as it will be saved. A new figure carries a request id that stays
/// the same while the figure stays the same, so a retry after a lost answer
/// returns the record already made instead of adding a second one. A
/// correction keeps the period and measurement and sends the version it
/// opened; if someone changed the figure since, the save is refused and the
/// typed value stays while the latest figure is reloaded.
class ProductionFormScreen extends StatefulWidget {
  const ProductionFormScreen({
    super.key,
    required this.business,
    this.initialOutputId,
    this.knownRecords = const {},
    this.correcting,
  });

  final SocietyBusiness business;
  final String? initialOutputId;

  /// Records already loaded, by output id, to spot a period that already
  /// has a figure before the save is sent.
  final Map<String, List<ProductionRecord>> knownRecords;

  /// The record being corrected; null for a new figure.
  final ProductionRecord? correcting;

  @override
  State<ProductionFormScreen> createState() => _ProductionFormScreenState();
}

class _ProductionFormScreenState extends State<ProductionFormScreen> {
  late final DateTime _today = sriLankaToday(DemoScope.read(context).now);
  late final _outputs = widget.business.activeOutputs;
  late String? _outputId =
      widget.correcting?.outputId ??
      widget.initialOutputId ??
      (_outputs.length == 1 ? _outputs.single.id : null);
  String _measurement = 'ACTUAL';
  String _basis = 'MONTHLY';
  DateTime? _month;
  DateTime? _weekDay;
  DateTime? _seasonStart;
  DateTime? _seasonEnd;
  late ProductionRecord? _correcting = widget.correcting;
  late final _known = {
    for (final entry in widget.knownRecords.entries)
      entry.key: [...entry.value],
  };

  final _quantity = TextEditingController();
  final _seasonLabel = TextEditingController();
  final _note = TextEditingController();
  final _source = TextEditingController();

  String? _requestId;
  String? _requestKey;
  bool _submitted = false;
  bool _saving = false;
  bool _conflict = false;
  bool _overlap = false;
  String? _serverError;
  String? _reloaded;

  @override
  void initState() {
    super.initState();
    final last = DateTime.utc(_today.year, _today.month - 1);
    _month = last;
    _weekDay = _today.subtract(const Duration(days: 7));
    final correcting = _correcting;
    if (correcting != null) _fill(correcting);
    for (final controller in [_quantity, _seasonLabel, _note, _source]) {
      controller.addListener(() => setState(() {}));
    }
  }

  /// Puts a saved record's values in the boxes, for a correction.
  void _fill(ProductionRecord record) {
    _quantity.text = _plain(record.quantity);
    _seasonLabel.text = record.period.seasonLabel ?? '';
    _note.text = record.note ?? '';
    _source.text = record.source ?? '';
  }

  /// "3200" or "182.5": a saved figure as it would be typed.
  String _plain(double value) => value == value.roundToDouble()
      ? value.toInt().toString()
      : value.toString();

  @override
  void dispose() {
    _quantity.dispose();
    _seasonLabel.dispose();
    _note.dispose();
    _source.dispose();
    super.dispose();
  }

  AppLocalizations get _l => context.l10n;

  BusinessOutput? get _output =>
      widget.business.outputs.where((o) => o.id == _outputId).firstOrNull;

  String? _text(TextEditingController c) {
    final text = c.text.trim();
    return text.isEmpty ? null : text;
  }

  DateTime get _furthest => _today.add(const Duration(days: 366));

  /// Months that can be chosen: ended ones for actual figures, and up to a
  /// year ahead for estimates. Newest first.
  List<DateTime> get _months {
    final last = DateTime.utc(_today.year, _today.month + 12);
    return [
      for (
        var m = last;
        !m.isBefore(DateTime.utc(_today.year, _today.month - _monthsBack));
        m = DateTime.utc(m.year, m.month - 1)
      )
        if (!ProductionPeriod.month(
          m.year,
          m.month,
        ).endsOn.isAfter(_measurement == 'ACTUAL' ? _today : _furthest))
          m,
    ];
  }

  ProductionPeriod? get _period {
    final correcting = _correcting;
    if (correcting != null) {
      return ProductionPeriod(
        basis: correcting.period.basis,
        startsOn: correcting.period.startsOn,
        endsOn: correcting.period.endsOn,
        seasonLabel: correcting.period.basis == 'SEASONAL'
            ? _text(_seasonLabel)
            : null,
      );
    }
    switch (_basis) {
      case 'MONTHLY':
        final month = _month;
        return month == null
            ? null
            : ProductionPeriod.month(month.year, month.month);
      case 'WEEKLY':
        final day = _weekDay;
        return day == null ? null : ProductionPeriod.weekOf(day);
      default:
        final start = _seasonStart, end = _seasonEnd;
        if (start == null || end == null) return null;
        return ProductionPeriod(
          basis: 'SEASONAL',
          startsOn: start,
          endsOn: end,
          seasonLabel: _text(_seasonLabel),
        );
    }
  }

  String? get _periodError {
    final l = _l;
    final period = _period;
    if (_basis == 'SEASONAL' || _correcting?.period.basis == 'SEASONAL') {
      if (_text(_seasonLabel) == null) return l.vepSeasonLabelRequired;
    }
    if (_correcting != null) return null;
    if (period == null) {
      return _basis == 'SEASONAL' ? l.vepSeasonDates : l.vepPeriodRequired;
    }
    if (period.endsOn.isBefore(period.startsOn)) return l.vepSeasonOrder;
    if (period.days > maxSeasonDays) return l.vepSeasonTooLong;
    if (_measurement == 'ACTUAL' && period.endsOn.isAfter(_today)) {
      return l.vepActualFuture;
    }
    if (period.endsOn.isAfter(_furthest)) return l.vepEstimateTooFar;
    return null;
  }

  double? get _value {
    final output = _output;
    return output == null ? null : parseQuantity(_quantity.text, output.unit);
  }

  String? get _quantityError {
    final output = _output;
    if (output == null) return null;
    return switch (quantityProblem(_quantity.text, output.unit)) {
      null => null,
      QuantityProblem.empty => _l.vepQuantityRequired,
      QuantityProblem.notNumber => _l.vepQuantityNotNumber,
      QuantityProblem.wholeOnly => _l.vepQuantityWhole,
      QuantityProblem.tooManyDecimals => _l.vepQuantityDecimals(
        output.decimals,
      ),
      QuantityProblem.tooLarge => _l.vepQuantityTooLarge(
        _l.number(maxProductionQuantity),
      ),
    };
  }

  String? get _outputError => _output == null ? _l.vepOutputChoose : null;

  bool get _valid =>
      _outputError == null && _periodError == null && _quantityError == null;

  /// A saved figure for exactly this output, measurement and period.
  ProductionRecord? get _existing {
    final period = _period;
    if (_correcting != null || period == null || _outputId == null) {
      return null;
    }
    return _known[_outputId]
        ?.where((r) => r.measurement == _measurement && r.period.sameAs(period))
        .firstOrNull;
  }

  /// A saved figure that shares days with this period but is not the same.
  ProductionRecord? get _overlapping {
    final period = _period;
    if (_correcting != null || period == null || _outputId == null) {
      return null;
    }
    return _known[_outputId]
        ?.where(
          (r) =>
              r.measurement == _measurement &&
              r.period.overlaps(period) &&
              !r.period.sameAs(period),
        )
        .firstOrNull;
  }

  bool get _dirty {
    final correcting = _correcting;
    if (correcting != null) {
      return _value != correcting.quantity ||
          (_quantity.text.trim().isEmpty) ||
          _text(_note) != correcting.note ||
          _text(_source) != correcting.source ||
          (correcting.period.basis == 'SEASONAL' &&
              _text(_seasonLabel) != correcting.period.seasonLabel);
    }
    return _quantity.text.trim().isNotEmpty ||
        _text(_note) != null ||
        _text(_source) != null ||
        _text(_seasonLabel) != null;
  }

  void _correctInstead(ProductionRecord record) {
    setState(() {
      final typed = _quantity.text;
      _correcting = record;
      _fill(record);
      // Keep the figure the officer typed; it is what they mean to save.
      if (typed.trim().isNotEmpty) _quantity.text = typed;
      _overlap = false;
      _serverError = null;
    });
  }

  Future<void> _refreshKnown(EconomyApi api) async {
    final output = _output;
    if (output == null) return;
    try {
      final page = await api.fetchRecords(output.id, pageSize: 100);
      if (mounted) setState(() => _known[output.id] = page.items);
    } on SocietyRecordException {
      // The warning still shows; the history reloads on the business page.
    }
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() {
      _submitted = true;
      _serverError = null;
      _overlap = false;
    });
    if (!_valid) return;
    final correcting = _correcting;
    if (correcting != null && !_dirty) {
      Navigator.of(context).pop(false);
      return;
    }
    final existing = _existing;
    if (existing != null) {
      // Never a second figure for the same period: offer the correction.
      setState(() => _overlap = true);
      return;
    }
    setState(() => _saving = true);
    final l = _l;
    final api = DemoScope.read(context).economy;
    final output = _output!, period = _period!, value = _value!;
    try {
      if (correcting != null) {
        final saved = await api.correctRecord(
          correcting,
          ProductionCorrection(
            version: correcting.version,
            quantity: value,
            seasonLabel: _text(_seasonLabel),
            note: _text(_note),
            source: _text(_source),
          ),
        );
        if (!mounted) return;
        _done(
          saved.version == correcting.version
              ? l.vepNoChange
              : l.vepCorrectedDone,
        );
        return;
      }
      final key = [
        output.id,
        _measurement,
        period.basis,
        formatDay(period.startsOn),
        formatDay(period.endsOn),
        period.seasonLabel,
        value,
        _text(_note),
        _text(_source),
      ].join('|');
      if (key != _requestKey) {
        _requestKey = key;
        _requestId = newClientRequestId();
      }
      final saved = await api.createRecord(
        output.id,
        ProductionInput(
          clientRequestId: _requestId!,
          period: period,
          measurement: _measurement,
          quantity: value,
          note: _text(_note),
          source: _text(_source),
        ),
      );
      if (!mounted) return;
      if (!saved.created && saved.record.quantity != value) {
        // The period already had another figure: correcting it is the way.
        setState(() {
          _saving = false;
          _known[output.id] = [saved.record, ...?_known[output.id]];
          _overlap = true;
        });
        return;
      }
      _done(saved.created ? l.vepSaved : l.vepAlreadySaved);
    } on SocietyRecordException catch (error) {
      if (!mounted) return;
      if (error.status == 409 && correcting == null) {
        await _refreshKnown(api);
        if (!mounted) return;
        setState(() {
          _saving = false;
          _overlap = true;
        });
        return;
      }
      setState(() {
        _saving = false;
        _conflict = error.status == 409;
        _serverError = _conflict ? null : saveError(l, error);
      });
    }
  }

  void _done(String message) {
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(SnackBar(content: Text(message)));
    Navigator.of(context).pop(true);
  }

  /// After a stale-edit conflict: loads the figure saved now and moves to
  /// its version. The typed value stays in the box.
  Future<void> _reload() async {
    final record = _correcting;
    if (record == null) return;
    try {
      final history = await DemoScope.read(context).economy
          .fetchHistory(record.id);
      if (!mounted) return;
      setState(() {
        _correcting = history.record;
        _conflict = false;
        _reloaded = _l.vepReloaded(
          _l.quantity(history.record.quantity, history.record.unit),
          _l.actor(history.record.lastChangedBy),
        );
      });
    } on SocietyRecordException catch (error) {
      if (mounted) setState(() => _serverError = saveError(_l, error));
    }
  }

  Future<void> _leave() async {
    if (await confirmDiscard(context) && mounted) {
      Navigator.of(context).pop(false);
    }
  }

  Future<DateTime?> _pickDate(DateTime? initial, {DateTime? last}) async {
    final lastDay = last ?? _furthest;
    final start = initial ?? (_today.isAfter(lastDay) ? lastDay : _today);
    final picked = await showDatePicker(
      context: context,
      initialDate: start.isAfter(lastDay) ? lastDay : start,
      firstDate: DateTime(2000),
      lastDate: lastDay,
    );
    return picked == null
        ? null
        : DateTime.utc(picked.year, picked.month, picked.day);
  }

  Widget _choiceRow<T>({
    required String label,
    required List<(T, String)> options,
    required T value,
    required ValueChanged<T> onSelected,
    String? keyPrefix,
  }) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      FieldLabel(label, required: true),
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final (option, text) in options)
            ChoiceChip(
              key: keyPrefix == null ? null : ValueKey('$keyPrefix.$option'),
              label: Text(text),
              selected: value == option,
              onSelected: _saving ? null : (_) => onSelected(option),
            ),
        ],
      ),
    ],
  );

  Widget _dateButton(
    String label,
    DateTime? value,
    VoidCallback onTap,
    Key key,
  ) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      FieldLabel(label, required: true),
      OutlinedButton.icon(
        key: key,
        style: compactOutlinedStyle.copyWith(
          alignment: Alignment.centerLeft,
          minimumSize: const WidgetStatePropertyAll(Size(0, 48)),
        ),
        onPressed: _saving ? null : onTap,
        icon: const Icon(Icons.calendar_today_outlined, size: 15),
        label: Text(
          value == null ? _l.vepPickDate : _l.date(value),
          overflow: TextOverflow.ellipsis,
        ),
      ),
    ],
  );

  Widget _periodFields() {
    final l = _l;
    final months = _months;
    return switch (_basis) {
      'MONTHLY' => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          FieldLabel(l.vepFieldMonth, required: true),
          DropdownButtonFormField<DateTime>(
            key: ValueKey('vep.production.month.$_measurement'),
            initialValue: months.contains(_month) ? _month : null,
            isExpanded: true,
            style: recordInputStyle,
            decoration: changedDecoration(changed: false),
            hint: Text(l.vepChoose, style: recordInputStyle),
            items: [
              for (final month in months)
                DropdownMenuItem(value: month, child: Text(l.monthName(month))),
            ],
            onChanged: _saving
                ? null
                : (value) => setState(() => _month = value),
          ),
        ],
      ),
      'WEEKLY' => _dateButton(l.vepFieldWeek, _weekDay, () async {
        final day = await _pickDate(
          _weekDay,
          last: _measurement == 'ACTUAL' ? _today : null,
        );
        if (day != null && mounted) setState(() => _weekDay = day);
      }, const ValueKey('vep.production.week')),
      _ => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          FieldLabel(l.vepFieldSeasonLabel, required: true),
          TextField(
            key: const ValueKey('vep.production.seasonLabel'),
            controller: _seasonLabel,
            enabled: !_saving,
            maxLength: maxSeasonLabel,
            style: recordInputStyle,
            decoration: changedDecoration(
              changed: false,
              helper: l.vepSeasonHint,
            ).copyWith(counterText: ''),
          ),
          const SizedBox(height: 10),
          LayoutBuilder(
            builder: (context, constraints) {
              final start = _dateButton(
                l.vepFieldStart,
                _seasonStart,
                () async {
                  final day = await _pickDate(_seasonStart);
                  if (day != null && mounted) {
                    setState(() => _seasonStart = day);
                  }
                },
                const ValueKey('vep.production.seasonStart'),
              );
              final end = _dateButton(l.vepFieldEnd, _seasonEnd, () async {
                final day = await _pickDate(_seasonEnd ?? _seasonStart);
                if (day != null && mounted) setState(() => _seasonEnd = day);
              }, const ValueKey('vep.production.seasonEnd'));
              // Side by side when there is room; stacked on small phones
              // and with large text.
              if (constraints.maxWidth < 340 ||
                  MediaQuery.textScalerOf(context).scale(1) > 1.15) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [start, const SizedBox(height: 10), end],
                );
              }
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: start),
                  const SizedBox(width: 10),
                  Expanded(child: end),
                ],
              );
            },
          ),
        ],
      ),
    };
  }

  @override
  Widget build(BuildContext context) {
    final l = _l;
    final output = _output;
    final correcting = _correcting;
    final period = _period;
    final value = _value;
    final dirty = _dirty;
    final periodError = _submitted ? _periodError : null;
    final quantityError = _submitted || _quantity.text.trim().isNotEmpty
        ? _quantityError
        : null;
    final existing = _existing;
    final overlapping = _overlapping;
    final measurement = correcting?.measurement ?? _measurement;
    return PopScope(
      canPop: !dirty || _saving,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _leave();
      },
      child: Scaffold(
        appBar: recordFormAppBar(
          context,
          title: correcting == null
              ? l.vepProductionAddTitle
              : l.vepProductionCorrectTitle,
          subtitle: widget.business.name,
          actions: [if (dirty) const UnsavedChip()],
        ),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
          children: [
            if (correcting != null) ...[
              RecordNote(
                icon: Icons.edit_note_outlined,
                tone: NoteTone.warning,
                message: l.vepCorrectingNote(
                  l.measurementName(correcting.measurement),
                  l.period(correcting.period),
                  l.quantity(correcting.quantity, correcting.unit),
                ),
              ),
              const SizedBox(height: 14),
            ],
            FieldLabel(l.vepFieldOutput, required: true),
            if (correcting != null || _outputs.length == 1)
              ReadOnlyField(
                output == null
                    ? '—'
                    : l.withUnit(l.outputName(output), l.unitName(output.unit)),
              )
            else
              DropdownButtonFormField<String>(
                key: const ValueKey('vep.production.output'),
                initialValue: _outputId,
                isExpanded: true,
                style: recordInputStyle,
                decoration: changedDecoration(
                  changed: false,
                  error: _submitted ? _outputError : null,
                ),
                hint: Text(l.vepChoose, style: recordInputStyle),
                items: [
                  for (final option in _outputs)
                    DropdownMenuItem(
                      value: option.id,
                      child: Text(
                        l.withUnit(
                          l.outputName(option),
                          l.unitName(option.unit),
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                ],
                onChanged: _saving
                    ? null
                    : (value) => setState(() => _outputId = value),
              ),
            const SizedBox(height: 14),
            if (correcting == null) ...[
              _choiceRow(
                label: l.vepFieldMeasurement,
                keyPrefix: 'vep.production.measurement',
                options: [
                  for (final m in productionMeasurements)
                    (m, l.measurementName(m)),
                ],
                value: _measurement,
                onSelected: (value) => setState(() {
                  _measurement = value;
                  // A month the new list does not offer is cleared, never
                  // kept out of sight.
                  if (!_months.contains(_month)) _month = null;
                }),
              ),
              const SizedBox(height: 4),
              Text(
                _measurement == 'ACTUAL' ? l.vepActualHelp : l.vepEstimatedHelp,
                style: RecordStyle.caption,
              ),
              const SizedBox(height: 14),
              _choiceRow(
                label: l.vepFieldBasis,
                keyPrefix: 'vep.production.basis',
                options: [for (final b in productionBases) (b, l.basisName(b))],
                value: _basis,
                onSelected: (value) => setState(() => _basis = value),
              ),
              const SizedBox(height: 12),
              _periodFields(),
              if (period != null && _basis != 'MONTHLY') ...[
                const SizedBox(height: 6),
                Text(
                  l.vepCovers(l.period(period), period.days),
                  style: RecordStyle.caption,
                ),
              ],
            ] else ...[
              KeyValueGrid([
                KeyValue(
                  l.vepFieldMeasurement,
                  l.measurementName(correcting.measurement),
                ),
                KeyValue(l.vepFieldBasis, l.basisName(correcting.period.basis)),
              ]),
              const SizedBox(height: 10),
              KeyValue(l.vepRecordPeriod, l.period(correcting.period)),
              if (correcting.period.basis == 'SEASONAL') ...[
                const SizedBox(height: 12),
                FieldLabel(l.vepFieldSeasonLabel, required: true),
                TextField(
                  key: const ValueKey('vep.production.seasonLabel'),
                  controller: _seasonLabel,
                  enabled: !_saving,
                  maxLength: maxSeasonLabel,
                  style: recordInputStyle,
                  decoration: changedDecoration(changed: false)
                      .copyWith(counterText: ''),
                ),
              ],
            ],
            if (periodError != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  periodError,
                  style: const TextStyle(fontSize: 12, color: AppColors.danger),
                ),
              ),
            if (existing != null) ...[
              const SizedBox(height: 12),
              NoticeBanner(
                icon: Icons.info_outline,
                tone: _overlap ? NoticeTone.warning : NoticeTone.info,
                title: l.vepExistingTitle,
                message: l.vepExisting(
                  l.period(existing.period),
                  l.measurementName(existing.measurement),
                  l.quantity(existing.quantity, existing.unit),
                ),
                action: OutlinedButton(
                  key: const ValueKey('vep.production.correctInstead'),
                  style: compactOutlinedStyle,
                  onPressed: _saving ? null : () => _correctInstead(existing),
                  child: Text(l.vepCorrectInstead),
                ),
              ),
            ] else if (overlapping != null || _overlap) ...[
              const SizedBox(height: 12),
              NoticeBanner(
                icon: Icons.warning_amber_rounded,
                tone: NoticeTone.warning,
                title: l.vepOverlapTitle,
                message: overlapping == null
                    ? l.vepOverlapBody
                    : l.vepOverlapWith(
                        l.period(overlapping.period),
                        l.quantity(overlapping.quantity, overlapping.unit),
                      ),
              ),
            ],
            const SizedBox(height: 14),
            FieldLabel(l.vepFieldQuantity, required: true),
            TextField(
              key: const ValueKey('vep.production.quantity'),
              controller: _quantity,
              enabled: !_saving && output != null,
              keyboardType: TextInputType.numberWithOptions(
                decimal: (output?.decimals ?? 0) > 0,
              ),
              textInputAction: TextInputAction.next,
              style: recordInputStyle.copyWith(
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
              decoration: changedDecoration(
                changed: correcting != null && value != correcting.quantity,
                helper: output == null
                    ? null
                    : output.decimals == 0
                    ? l.vepQuantityHelpWhole(l.unitName(output.unit))
                    : l.vepQuantityHelpDecimals(
                        l.unitName(output.unit),
                        output.decimals,
                      ),
                error: quantityError,
                suffix: output == null
                    ? null
                    : Padding(
                        padding: const EdgeInsets.only(right: 12),
                        child: Align(
                          widthFactor: 1,
                          child: Text(
                            l.unitName(output.unit),
                            style: RecordStyle.caption,
                          ),
                        ),
                      ),
              ),
            ),
            const SizedBox(height: 12),
            FieldLabel(l.vepFieldNote),
            TextField(
              key: const ValueKey('vep.production.note'),
              controller: _note,
              enabled: !_saving,
              maxLines: 3,
              minLines: 1,
              maxLength: maxNote,
              style: recordInputStyle,
              decoration: changedDecoration(changed: false)
                  .copyWith(counterText: ''),
            ),
            const SizedBox(height: 12),
            FieldLabel(l.vepFieldSource),
            TextField(
              key: const ValueKey('vep.production.source'),
              controller: _source,
              enabled: !_saving,
              maxLength: maxSource,
              style: recordInputStyle,
              decoration: changedDecoration(
                changed: false,
                helper: l.vepSourceHint,
              ).copyWith(counterText: ''),
            ),
            const SizedBox(height: 16),
            EconomyLabel(l.vepPreview),
            Semantics(
              liveRegion: true,
              container: true,
              child: RecordCard(
                color: const Color(0xFFF3F8F3),
                children: [
                  if (output != null && period != null && value != null)
                    Text(
                      l.productionLine(
                        l.outputName(output),
                        value,
                        output.unit,
                        period,
                        measurement,
                      ),
                      key: const ValueKey('vep.production.preview'),
                      style: RecordStyle.value,
                    )
                  else
                    Text(l.vepPreviewEmpty, style: RecordStyle.caption),
                  const SizedBox(height: 4),
                  Text(l.vepPreviewNote, style: RecordStyle.caption),
                ],
              ),
            ),
            if (_reloaded != null) ...[
              const SizedBox(height: 12),
              RecordNote(icon: Icons.info_outline, message: _reloaded!),
            ],
            if (_conflict) ...[
              const SizedBox(height: 12),
              NoticeBanner(
                icon: Icons.sync_problem_outlined,
                tone: NoticeTone.warning,
                title: l.vepConflictTitle,
                message: l.vepConflictBody,
                action: OutlinedButton(
                  key: const ValueKey('vep.production.reload'),
                  style: compactOutlinedStyle,
                  onPressed: _reload,
                  child: Text(l.vepReload),
                ),
              ),
            ],
            if (_serverError != null) ...[
              const SizedBox(height: 12),
              NoticeBanner(
                icon: Icons.error_outline,
                tone: NoticeTone.error,
                title: l.editNotSaved,
                message: _serverError,
              ),
            ],
          ],
        ),
        bottomNavigationBar: BottomActionBar(
          secondary: OutlinedButton(
            onPressed: _saving ? null : () => Navigator.of(context).maybePop(),
            child: Text(l.editCancel),
          ),
          primary: FilledButton(
            key: const ValueKey('vep.production.save'),
            onPressed: _saving || _conflict ? null : _save,
            child: Text(
              _saving
                  ? l.recSaving
                  : correcting == null
                  ? l.vepSaveFigure
                  : l.vepSaveCorrection,
            ),
          ),
        ),
      ),
    );
  }
}

/// One saved figure with every version of it, newest first. The Society
/// Officer can correct it; the history keeps the earlier figures.
class ProductionRecordScreen extends StatefulWidget {
  const ProductionRecordScreen({
    super.key,
    required this.business,
    required this.output,
    required this.recordId,
    required this.canManage,
  });

  final SocietyBusiness business;
  final BusinessOutput output;
  final String recordId;
  final bool canManage;

  @override
  State<ProductionRecordScreen> createState() => _ProductionRecordScreenState();
}

class _ProductionRecordScreenState extends State<ProductionRecordScreen> {
  ProductionHistory? _history;
  SocietyRecordException? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final history = await DemoScope.read(context).economy
          .fetchHistory(widget.recordId);
      if (mounted) setState(() => _history = history);
    } on SocietyRecordException catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  Future<void> _correct(ProductionRecord record) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) =>
            ProductionFormScreen(business: widget.business, correcting: record),
      ),
    );
    if (saved == true && mounted) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final history = _history;
    final error = _error;
    final now = DemoScope.of(context).now;
    Widget body;
    if (error != null && (error.status == 403 || error.status == 404)) {
      body = NoAccessView(
        title: l.vepNoAccessTitle,
        message: l.vepNoAccess,
        onBack: () => Navigator.maybePop(context),
      );
    } else if (history == null && error != null) {
      body = StateMessage(
        icon: Icons.error_outline,
        tone: StateTone.error,
        isAlert: true,
        title: l.vepLoadError,
        message: l.recNothingLost(l.recordError(error)),
        primaryLabel: l.commonTryAgain,
        onPrimary: _load,
      );
    } else if (history == null) {
      body = LoadingSkeleton(label: l.vepLoading);
    } else {
      final record = history.record;
      body = RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
          children: [
            RecordCard(
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    MeasurementChip(record.measurement),
                    if (record.corrected)
                      RecordChip(l.vepCorrected, tone: ChipTone.warning),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  l.quantity(record.quantity, record.unit),
                  key: const ValueKey('vep.record.quantity'),
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: AppColors.ink,
                  ),
                ),
                const SizedBox(height: 10),
                KeyValueGrid([
                  KeyValue(l.vepRecordPeriod, l.period(record.period)),
                  KeyValue(l.vepFieldBasis, l.basisName(record.period.basis)),
                  KeyValue(
                    l.vepRecordNote,
                    record.note ?? l.recNoneRecorded,
                    missing: record.note == null,
                  ),
                  KeyValue(
                    l.vepRecordSource,
                    record.source ?? l.recNoneRecorded,
                    missing: record.source == null,
                  ),
                ]),
                const SizedBox(height: 10),
                Text(
                  l.vepBusinessUpdated(
                    l.savedAt(record.updatedAt),
                    l.actor(record.lastChangedBy),
                  ),
                  style: RecordStyle.caption,
                ),
              ],
            ),
            if (widget.canManage) ...[
              const SizedBox(height: 10),
              Align(
                alignment: Alignment.centerRight,
                child: FilledButton.icon(
                  key: const ValueKey('vep.record.correct'),
                  style: compactFilledStyle,
                  onPressed: () => _correct(record),
                  icon: const Icon(Icons.edit_outlined, size: 15),
                  label: Text(l.vepCorrect),
                ),
              ),
            ],
            const SizedBox(height: 14),
            EconomyLabel(l.vepRevisionsTitle),
            RecordCard(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
              children: [
                for (final (index, revision) in history.revisions.indexed)
                  RecordTimelineEntry(
                    title: revision.change == 'CREATED'
                        ? l.vepRevisionCreated(
                            l.quantity(revision.quantity, record.unit),
                          )
                        : l.vepRevisionCorrected(
                            l.quantity(revision.quantity, record.unit),
                          ),
                    detail:
                        '${l.actor(revision.changedBy)} · ${l.recordWhen(revision.changedAt, now)}',
                    quote: revision.note,
                    ringColor: revision.change == 'CREATED'
                        ? AppColors.forest
                        : AppColors.orangeChanged,
                    last: index == history.revisions.length - 1,
                  ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              l.vepSelfReported,
              style: RecordStyle.caption,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 58,
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              l.outputName(widget.output),
              style: RecordStyle.screenTitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            Text(
              widget.business.name,
              style: RecordStyle.screenSubtitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
        shape: const Border(bottom: BorderSide(color: AppColors.line)),
      ),
      body: body,
    );
  }
}
