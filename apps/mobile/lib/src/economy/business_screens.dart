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
import 'production_screens.dart';

/// How many figures of each output the details screen shows at first.
const _historyPage = 10;

/// Issue #146 frame 3: one business, its products and services, the latest
/// figure and the history of each. The Society Officer can record, correct,
/// edit, close or reopen; everyone else sees the same, read only.
class BusinessDetailScreen extends StatefulWidget {
  const BusinessDetailScreen({
    super.key,
    required this.societyId,
    required this.businessId,
  });

  final String societyId;
  final String businessId;

  @override
  State<BusinessDetailScreen> createState() => _BusinessDetailScreenState();
}

class _BusinessDetailScreenState extends State<BusinessDetailScreen> {
  EconomicProfile? _profile;
  final _records = <String, List<ProductionRecord>>{};
  final _hasMore = <String, bool>{};
  SocietyRecordException? _error;
  bool _loading = false;
  bool _busy = false;

  SocietyBusiness? get _business => _profile?.business(widget.businessId);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    final api = DemoScope.read(context).economy;
    try {
      final profile = await api.fetchProfile(widget.societyId);
      final business = profile.business(widget.businessId);
      final pages = <String, RecordPage>{};
      for (final output in business?.outputs ?? const <BusinessOutput>[]) {
        pages[output.id] = await api.fetchRecords(
          output.id,
          pageSize: _historyPage,
        );
      }
      if (!mounted) return;
      setState(() {
        _profile = profile;
        _records
          ..clear()
          ..addAll({for (final e in pages.entries) e.key: e.value.items});
        _hasMore
          ..clear()
          ..addAll({for (final e in pages.entries) e.key: e.value.hasMore});
      });
    } on SocietyRecordException catch (error) {
      if (mounted) setState(() => _error = error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _more(BusinessOutput output) async {
    final shown = _records[output.id] ?? const [];
    try {
      final page = await DemoScope.read(context).economy.fetchRecords(
        output.id,
        page: shown.length ~/ _historyPage + 1,
        pageSize: _historyPage,
      );
      if (!mounted) return;
      setState(() {
        _records[output.id] = [
          ...shown,
          ...page.items.where((r) => !shown.any((s) => s.id == r.id)),
        ];
        _hasMore[output.id] = page.hasMore;
      });
    } on SocietyRecordException catch (error) {
      if (mounted) _snack(context.l10n.recordError(error));
    }
  }

  void _snack(String message) {
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _open(Widget screen) async {
    final changed = await Navigator.of(context)
        .push<bool>(MaterialPageRoute(builder: (_) => screen));
    if (changed == true && mounted) await _load();
  }

  /// A figure may be corrected on its own screen; the history reloads after
  /// it closes, however it was closed.
  Future<void> _openRecord(Widget screen) async {
    await Navigator.of(context)
        .push<void>(MaterialPageRoute(builder: (_) => screen));
    if (mounted) await _load();
  }

  /// Runs a change, says what happened, and reloads whatever the outcome so
  /// a refusal never leaves a stale screen behind.
  Future<void> _change(
    Future<void> Function(EconomyApi api) action,
    String done,
  ) async {
    if (_busy) return;
    setState(() => _busy = true);
    final l = context.l10n;
    try {
      await action(DemoScope.read(context).economy);
      if (mounted) _snack(done);
    } on SocietyRecordException catch (error) {
      if (mounted) {
        _snack(
          error.status == 409 ? l.vepConflictReloaded : saveError(l, error),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
        await _load();
      }
    }
  }

  Future<void> _setClosed(SocietyBusiness business, bool closed) async {
    final l = context.l10n;
    if (closed &&
        !await confirmAction(
          context,
          title: l.vepCloseTitle,
          message: l.vepCloseBody,
          confirm: l.vepCloseBusiness,
        )) {
      return;
    }
    if (!mounted) return;
    await _change(
      (api) => api.updateBusiness(business.id, business.version, {
        'status': closed ? 'CLOSED' : 'OPERATING',
      }),
      closed ? l.vepClosedDone : l.vepReopenedDone,
    );
  }

  Future<void> _setArchived(BusinessOutput output, bool archived) async {
    final l = context.l10n;
    if (archived &&
        !await confirmAction(
          context,
          title: l.vepArchiveTitle(l.outputName(output)),
          message: l.vepArchiveBody,
          confirm: l.vepArchive,
        )) {
      return;
    }
    if (!mounted) return;
    await _change(
      (api) => api.setOutputArchived(
        output.id,
        version: output.version,
        archived: archived,
      ),
      archived ? l.vepArchivedDone : l.vepRestoredDone,
    );
  }

  Future<void> _addOutput(SocietyBusiness business) async {
    final input = await showOutputPicker(
      context,
      industry: business.industry,
      taken: {for (final o in business.activeOutputs) o.product},
    );
    if (input == null || !mounted) return;
    await _change(
      (api) => api.createOutput(business.id, input),
      context.l10n.vepOutputAdded,
    );
  }

  void _record(SocietyBusiness business, {BusinessOutput? output}) => _open(
    ProductionFormScreen(
      business: business,
      initialOutputId: output?.id,
      knownRecords: _records,
    ),
  );

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final profile = _profile;
    final business = _business;
    final error = _error;
    final canManage = profile?.canManage == true;
    Widget body;
    if (profile == null && error == null) {
      body = LoadingSkeleton(label: l.vepLoading);
    } else if ((error != null &&
            (error.status == 403 || error.status == 404)) ||
        (profile != null && business == null)) {
      body = NoAccessView(
        title: l.vepNoAccessTitle,
        message: l.vepNoAccess,
        onBack: () => Navigator.maybePop(context),
      );
    } else if (business == null) {
      body = StateMessage(
        icon: Icons.error_outline,
        tone: StateTone.error,
        isAlert: true,
        title: l.vepLoadError,
        message: l.recNothingLost(l.recordError(error!)),
        primaryLabel: l.commonTryAgain,
        onPrimary: _load,
      );
    } else {
      body = RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          key: PageStorageKey('vep.business.${business.id}'),
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
          children: [
            if (error != null) ...[
              RecordNote(
                icon: Icons.error_outline,
                tone: NoteTone.error,
                title: l.vepLoadError,
                message: l.vepShowingSaved(l.recordError(error)),
              ),
              const SizedBox(height: 10),
            ],
            _header(l, business),
            if (canManage) ...[
              const SizedBox(height: 10),
              _actions(l, business),
            ],
            const SizedBox(height: 14),
            EconomyLabel(l.vepOutputsTitle),
            const SizedBox(height: 4),
            if (business.outputs.isEmpty)
              RecordCard(
                children: [
                  Text(
                    canManage && !business.closed
                        ? l.vepNoOutputsManage
                        : l.vepNoOutputs,
                    style: RecordStyle.body,
                  ),
                ],
              ),
            for (final output in [
              ...business.activeOutputs,
              ...business.outputs.where((o) => o.archived),
            ]) ...[
              _OutputCard(
                output: output,
                records: _records[output.id] ?? const [],
                hasMore: _hasMore[output.id] ?? false,
                canManage: canManage,
                businessClosed: business.closed,
                busy: _busy,
                onRecord: () => _record(business, output: output),
                onArchive: (archived) => _setArchived(output, archived),
                onMore: () => _more(output),
                onOpenRecord: (record) => _openRecord(
                  ProductionRecordScreen(
                    business: business,
                    output: output,
                    recordId: record.id,
                    canManage: canManage,
                  ),
                ),
              ),
              const SizedBox(height: 10),
            ],
            if (!canManage)
              RecordNote(icon: Icons.lock_outline, message: l.vepViewOnly),
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
              business?.name ?? l.vepDetailsTitle,
              style: RecordStyle.screenTitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            if (business != null)
              Text(
                l.businessIndustry(business),
                style: RecordStyle.screenSubtitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
          ],
        ),
        actions: [
          if (business != null && canManage)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: OutlinedButton.icon(
                key: const ValueKey('vep.editBusiness'),
                style: compactOutlinedStyle,
                onPressed: _busy
                    ? null
                    : () => _open(
                        BusinessFormScreen(
                          societyId: widget.societyId,
                          societyName: profile!.societyName,
                          business: business,
                        ),
                      ),
                icon: const Icon(Icons.edit_outlined, size: 14),
                label: Text(l.recEdit),
              ),
            )
          else if (business != null)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(
                child: RecordChip(l.recViewOnly, icon: Icons.lock_outline),
              ),
            ),
        ],
        shape: const Border(bottom: BorderSide(color: AppColors.line)),
      ),
      body: body,
    );
  }

  Widget _header(AppLocalizations l, SocietyBusiness business) => RecordCard(
    children: [
      Wrap(
        spacing: 8,
        runSpacing: 6,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [BusinessStatusChip(business.status)],
      ),
      if (business.description != null) ...[
        const SizedBox(height: 10),
        Text(business.description!, style: RecordStyle.body),
      ],
      const SizedBox(height: 12),
      KeyValueGrid([
        KeyValue(l.vepFieldIndustry, l.businessIndustry(business)),
        KeyValue(l.vepSummaryOutputs, l.number(business.activeOutputs.length)),
      ]),
      if (business.closed && business.closedAt != null) ...[
        const SizedBox(height: 10),
        RecordNote(
          icon: Icons.inventory_2_outlined,
          message: l.vepClosedNote(l.date(business.closedAt!)),
        ),
      ],
      const SizedBox(height: 10),
      Builder(
        builder: (context) {
          final (changedAt, who) = lastChange(business, [
            for (final records in _records.values) ...records,
          ]);
          return Text(
            l.vepBusinessUpdated(l.savedAt(changedAt), l.actor(who)),
            style: RecordStyle.caption,
          );
        },
      ),
    ],
  );

  Widget _actions(AppLocalizations l, SocietyBusiness business) => Wrap(
    spacing: 8,
    runSpacing: 8,
    children: [
      if (!business.closed && business.activeOutputs.isNotEmpty)
        FilledButton.icon(
          key: const ValueKey('vep.recordProduction'),
          style: compactFilledStyle,
          onPressed: _busy ? null : () => _record(business),
          icon: const Icon(Icons.add_chart, size: 16),
          label: Text(l.vepRecordProduction),
        ),
      if (!business.closed)
        OutlinedButton.icon(
          key: const ValueKey('vep.addOutput'),
          style: compactOutlinedStyle,
          onPressed: _busy ? null : () => _addOutput(business),
          icon: const Icon(Icons.add, size: 16),
          label: Text(l.vepAddOutput),
        ),
      OutlinedButton(
        key: const ValueKey('vep.closeBusiness'),
        style: compactOutlinedStyle,
        onPressed: _busy ? null : () => _setClosed(business, !business.closed),
        child: Text(business.closed ? l.vepReopenBusiness : l.vepCloseBusiness),
      ),
    ],
  );
}

class _OutputCard extends StatelessWidget {
  const _OutputCard({
    required this.output,
    required this.records,
    required this.hasMore,
    required this.canManage,
    required this.businessClosed,
    required this.busy,
    required this.onRecord,
    required this.onArchive,
    required this.onMore,
    required this.onOpenRecord,
  });

  final BusinessOutput output;
  final List<ProductionRecord> records;
  final bool hasMore;
  final bool canManage;
  final bool businessClosed;
  final bool busy;
  final VoidCallback onRecord;
  final ValueChanged<bool> onArchive;
  final VoidCallback onMore;
  final ValueChanged<ProductionRecord> onOpenRecord;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    // From the API's whole-history answer, not from the page shown below.
    final latest = output.latest;
    final now = DemoScope.of(context).now;
    return RecordCard(
      color: output.archived ? const Color(0xFFF6F7F4) : AppColors.surface,
      title: l.outputName(output),
      trailing: output.archived
          ? RecordChip(l.vepArchived, icon: Icons.inventory_2_outlined)
          : null,
      children: [
        Text(
          l.vepMeasuredIn(l.unitName(output.unit)),
          style: RecordStyle.caption,
        ),
        LatestFigure(
          measurement: 'ACTUAL',
          record: latest?.actual,
          known: latest != null,
        ),
        if (latest?.estimated != null)
          LatestFigure(measurement: 'ESTIMATED', record: latest?.estimated),
        const SizedBox(height: 12),
        EconomyLabel(l.vepHistoryTitle),
        if (records.isEmpty)
          Text(l.vepHistoryEmpty, style: RecordStyle.body)
        else
          for (final (index, record) in records.indexed) ...[
            if (index > 0) const Divider(height: 1),
            _RecordRow(
              record: record,
              now: now,
              onTap: () => onOpenRecord(record),
            ),
          ],
        if (hasMore)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              style: TextButton.styleFrom(minimumSize: const Size(48, 48)),
              onPressed: onMore,
              child: Text(l.vepShowMore),
            ),
          ),
        if (canManage) ...[
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            children: [
              if (!output.archived && !businessClosed)
                TextButton.icon(
                  key: ValueKey('vep.record.${output.id}'),
                  style: TextButton.styleFrom(minimumSize: const Size(48, 48)),
                  onPressed: busy ? null : onRecord,
                  icon: const Icon(Icons.add_chart, size: 16),
                  label: Text(l.vepRecordShort),
                ),
              TextButton.icon(
                key: ValueKey('vep.archive.${output.id}'),
                style: TextButton.styleFrom(
                  minimumSize: const Size(48, 48),
                  foregroundColor: AppColors.inkSoft,
                ),
                onPressed: busy || (businessClosed && output.archived)
                    ? null
                    : () => onArchive(!output.archived),
                icon: Icon(
                  output.archived
                      ? Icons.unarchive_outlined
                      : Icons.inventory_2_outlined,
                  size: 16,
                ),
                label: Text(output.archived ? l.vepRestore : l.vepArchive),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

/// One saved figure: quantity, measurement, period, and when it last
/// changed. The period it covers and the time it was saved are kept apart.
class _RecordRow extends StatelessWidget {
  const _RecordRow({
    required this.record,
    required this.now,
    required this.onTap,
  });

  final ProductionRecord record;
  final DateTime now;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return InkWell(
      key: ValueKey('vep.recordRow.${record.id}'),
      onTap: onTap,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 48),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          l.quantity(record.quantity, record.unit),
                          style: RecordStyle.value,
                        ),
                        MeasurementChip(record.measurement),
                        if (record.corrected)
                          RecordChip(l.vepCorrected, tone: ChipTone.warning),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(l.period(record.period), style: RecordStyle.body),
                    Text(
                      l.vepSavedWhen(l.recordWhen(record.updatedAt, now)),
                      style: RecordStyle.caption,
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, size: 18, color: AppColors.muted),
            ],
          ),
        ),
      ),
    );
  }
}

/// A product or service waiting to be added by the business form.
class _PendingOutput {
  _PendingOutput(this.input);

  final OutputInput input;
  bool added = false;
}

/// Issue #146 frame 2: add or edit a business. A new business can be given
/// several products and services at once; an existing one can be given more
/// (archiving is on the business page). Pops true once anything was saved.
class BusinessFormScreen extends StatefulWidget {
  const BusinessFormScreen({
    super.key,
    required this.societyId,
    required this.societyName,
    this.business,
    this.existingIds = const {},
  });

  final String societyId;
  final String societyName;

  /// Null for a new business.
  final SocietyBusiness? business;

  /// The businesses already listed when the form opened, so a retry after a
  /// lost answer can tell whether the first try created the business.
  final Set<String> existingIds;

  @override
  State<BusinessFormScreen> createState() => _BusinessFormScreenState();
}

class _BusinessFormScreenState extends State<BusinessFormScreen> {
  late final _name = TextEditingController(text: widget.business?.name ?? '');
  late final _otherIndustry = TextEditingController(
    text: widget.business?.otherIndustry ?? '',
  );
  late final _description = TextEditingController(
    text: widget.business?.description ?? '',
  );
  late String? _industry = widget.business?.industry;
  late String _status = widget.business?.status ?? 'OPERATING';
  final _pending = <_PendingOutput>[];

  /// The version this form will change; a reload after a conflict moves it.
  late int _version = widget.business?.version ?? 0;

  /// The business saved by this form, once it has been.
  SocietyBusiness? _saved;
  bool _detailsSaved = false;
  bool _uncertain = false;
  bool _submitted = false;
  bool _saving = false;
  bool _conflict = false;
  String? _serverError;
  SocietyBusiness? _latest;

  bool get _editing => widget.business != null;

  @override
  void initState() {
    super.initState();
    for (final controller in [_name, _otherIndustry, _description]) {
      controller.addListener(() => setState(() {}));
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _otherIndustry.dispose();
    _description.dispose();
    super.dispose();
  }

  String? _text(TextEditingController c) {
    final text = c.text.trim();
    return text.isEmpty ? null : text;
  }

  /// The business fields that differ from what the form opened with.
  Map<String, Object?> get _changes {
    final business = widget.business;
    final otherIndustry = _industry == 'OTHER' ? _text(_otherIndustry) : null;
    if (business == null) {
      return {
        'name': _name.text.trim(),
        'industry': _industry,
        'otherIndustry': otherIndustry,
        'description': _text(_description),
        'status': _status,
      };
    }
    return {
      if (_name.text.trim() != business.name) 'name': _name.text.trim(),
      if (_industry != business.industry) 'industry': _industry,
      if (otherIndustry != business.otherIndustry)
        'otherIndustry': otherIndustry,
      if (_text(_description) != business.description)
        // Empty text clears the description.
        'description': _text(_description) ?? '',
      if (_status != business.status) 'status': _status,
    };
  }

  bool get _dirty =>
      _pending.any((p) => !p.added) ||
      (!_detailsSaved &&
          (_editing
              ? _changes.isNotEmpty
              : _name.text.trim().isNotEmpty ||
                    _industry != null ||
                    _text(_description) != null));

  String? get _nameError {
    final length = _name.text.trim().length;
    return length < 2 ? context.l10n.vepNameError : null;
  }

  String? get _industryError =>
      _industry == null ? context.l10n.vepIndustryError : null;

  String? get _otherIndustryError =>
      _industry == 'OTHER' && _text(_otherIndustry) == null
      ? context.l10n.vepOtherIndustryError
      : null;

  bool get _valid =>
      _nameError == null &&
      _industryError == null &&
      _otherIndustryError == null;

  /// After an answer was lost, the business may have been created already.
  Future<SocietyBusiness?> _findCreated(EconomyApi api) async {
    final profile = await api.fetchProfile(widget.societyId);
    final name = _name.text.trim().toLowerCase();
    return profile.businesses
        .where(
          (b) =>
              !widget.existingIds.contains(b.id) &&
              b.name.toLowerCase() == name,
        )
        .firstOrNull;
  }

  /// After an answer was lost, the output may have been added already.
  Future<bool> _outputExists(
    EconomyApi api,
    String businessId,
    OutputInput input,
  ) async {
    final business = (await api.fetchProfile(widget.societyId))
        .business(businessId);
    return business?.activeOutputs.any(
          (o) =>
              o.product == input.product &&
              (input.product != 'OTHER' ||
                  (o.otherDescription == input.otherDescription &&
                      o.unit == input.unit)),
        ) ??
        false;
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() {
      _submitted = true;
      _serverError = null;
    });
    if (!_valid || !_dirty) return;
    setState(() => _saving = true);
    final l = context.l10n;
    final api = DemoScope.read(context).economy;
    try {
      var business = _saved ?? widget.business;
      if (!_editing && _saved == null) {
        if (_uncertain) _saved = await _findCreated(api);
        _saved ??= await api.createBusiness(
          widget.societyId,
          BusinessInput(
            name: _name.text.trim(),
            industry: _industry!,
            otherIndustry: _text(_otherIndustry),
            description: _text(_description),
            status: _status,
          ),
        );
        business = _saved;
        _detailsSaved = true;
      } else if (_editing && !_detailsSaved && _changes.isNotEmpty) {
        business = _saved = await api.updateBusiness(
          widget.business!.id,
          _version,
          _changes,
        );
        _detailsSaved = true;
      }
      for (final pending in _pending.where((p) => !p.added)) {
        try {
          if (_uncertain &&
              await _outputExists(api, business!.id, pending.input)) {
            pending.added = true;
            continue;
          }
          await api.createOutput(business!.id, pending.input);
          pending.added = true;
        } on SocietyRecordException catch (error) {
          // A standard product already on the business is already added.
          if (error.status == 409 && pending.input.product != 'OTHER') {
            pending.added = true;
          } else {
            rethrow;
          }
        }
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l.vepBusinessSaved)));
      Navigator.of(context).pop(true);
    } on SocietyRecordException catch (error) {
      if (!mounted) return;
      final left = _pending.where((p) => !p.added).length;
      setState(() {
        _saving = false;
        _uncertain = uncertain(error);
        _conflict = error.status == 409 && _editing && !_detailsSaved;
        _serverError = _conflict
            ? null
            : _detailsSaved && left > 0
            ? '${l.vepPartial(left)} ${l.recordError(error)}'
            : saveError(l, error);
      });
    }
  }

  /// After a conflict: shows what is saved now and moves to its version.
  /// What the person typed stays in the boxes.
  Future<void> _reload() async {
    try {
      final profile = await DemoScope.read(context).economy
          .fetchProfile(widget.societyId);
      final latest = profile.business(widget.business!.id);
      if (!mounted) return;
      setState(() {
        _latest = latest;
        if (latest != null) _version = latest.version;
        _conflict = false;
      });
    } on SocietyRecordException catch (error) {
      if (mounted) {
        setState(() => _serverError = saveError(context.l10n, error));
      }
    }
  }

  Future<void> _leave() async {
    if (await confirmDiscard(context) && mounted) {
      Navigator.of(context).pop(_detailsSaved || _pending.any((p) => p.added));
    }
  }

  Future<void> _addOutput() async {
    final input = await showOutputPicker(
      context,
      industry: _industry,
      taken: {
        ...?widget.business?.activeOutputs.map((o) => o.product),
        ..._pending.map((p) => p.input.product),
      },
    );
    if (input != null && mounted) {
      setState(() => _pending.add(_PendingOutput(input)));
    }
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    bool required = false,
    String? error,
    String? hint,
    int maxLines = 1,
    int? maxLength,
    Key? key,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FieldLabel(label, required: required),
        TextField(
          key: key,
          controller: controller,
          // Saved details are locked: a later change here would not be sent.
          enabled: !_saving && !_detailsSaved,
          maxLines: maxLines,
          minLines: 1,
          maxLength: maxLength,
          style: recordInputStyle,
          decoration: changedDecoration(
            changed: false,
            helper: hint,
            error: _submitted ? error : null,
          ).copyWith(counterText: ''),
        ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final dirty = _dirty;
    // Issue #146 review: once the business details are saved (a new
    // business, or an edit), they are locked here, so a retry that only adds
    // the products left can never report an unsent change as saved.
    final locked = _detailsSaved;
    final statuses = [
      ...businessStatuses.where((s) => s != 'CLOSED'),
      if (widget.business?.status == 'CLOSED') 'CLOSED',
    ];
    final latest = _latest;
    return PopScope(
      canPop: !dirty || _saving,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _leave();
      },
      child: Scaffold(
        appBar: recordFormAppBar(
          context,
          title: _editing ? l.vepBusinessEditTitle : l.vepBusinessAddTitle,
          subtitle: widget.societyName,
          actions: [if (dirty) const UnsavedChip()],
        ),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
          children: [
            if (!_editing) ...[
              RecordNote(
                icon: Icons.storefront_outlined,
                message: l.vepBusinessFormIntro,
              ),
              const SizedBox(height: 14),
            ],
            if (locked) ...[
              RecordNote(
                icon: Icons.check_circle_outline,
                tone: NoteTone.success,
                message: l.vepBusinessLocked,
              ),
              const SizedBox(height: 14),
            ],
            _field(
              _name,
              l.vepFieldName,
              required: true,
              error: _nameError,
              maxLength: maxBusinessName,
              key: const ValueKey('vep.form.name'),
            ),
            FieldLabel(l.vepFieldIndustry, required: true),
            DropdownButtonFormField<String>(
              key: const ValueKey('vep.form.industry'),
              initialValue: _industry,
              isExpanded: true,
              style: recordInputStyle,
              decoration: changedDecoration(
                changed: false,
                error: _submitted ? _industryError : null,
              ),
              hint: Text(l.vepChoose, style: recordInputStyle),
              items: [
                for (final industry in economyIndustries)
                  DropdownMenuItem(
                    value: industry,
                    child: Text(
                      l.industryName(industry),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
              onChanged: _saving || locked
                  ? null
                  : (value) => setState(() => _industry = value),
            ),
            const SizedBox(height: 12),
            if (_industry == 'OTHER')
              _field(
                _otherIndustry,
                l.vepFieldOtherIndustry,
                required: true,
                error: _otherIndustryError,
                maxLength: maxOtherText,
                key: const ValueKey('vep.form.otherIndustry'),
              ),
            _field(
              _description,
              l.vepFieldDescription,
              hint: l.vepFieldDescriptionHint,
              maxLines: 3,
              maxLength: maxBusinessDescription,
              key: const ValueKey('vep.form.description'),
            ),
            FieldLabel(l.vepFieldStatus, required: true),
            DropdownButtonFormField<String>(
              key: const ValueKey('vep.form.status'),
              initialValue: _status,
              isExpanded: true,
              style: recordInputStyle,
              decoration: changedDecoration(changed: false),
              items: [
                for (final status in statuses)
                  DropdownMenuItem(
                    value: status,
                    child: Text(
                      l.statusName(status),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
              onChanged: _saving || locked
                  ? null
                  : (value) => setState(() => _status = value ?? _status),
            ),
            const SizedBox(height: 18),
            EconomyLabel(l.vepOutputsTitle),
            Text(l.vepOutputsHelp, style: RecordStyle.caption),
            const SizedBox(height: 8),
            for (final output in widget.business?.activeOutputs ?? const [])
              _OutputLine(
                name: l.outputName(output),
                unit: l.unitName(output.unit),
              ),
            for (final pending in _pending)
              _OutputLine(
                name: pending.input.product == 'OTHER'
                    ? pending.input.otherDescription!
                    : l.productName(pending.input.product),
                unit: l.unitName(
                  pending.input.unit ??
                      productDefinition(pending.input.product)!.unit!,
                ),
                added: pending.added,
                onRemove: pending.added || _saving
                    ? null
                    : () => setState(() => _pending.remove(pending)),
              ),
            if (widget.business?.closed != true)
              Align(
                alignment: Alignment.centerLeft,
                child: OutlinedButton.icon(
                  key: const ValueKey('vep.form.addOutput'),
                  style: compactOutlinedStyle,
                  onPressed: _saving ? null : _addOutput,
                  icon: const Icon(Icons.add, size: 16),
                  label: Text(l.vepAddOutput),
                ),
              ),
            if (_editing) ...[
              const SizedBox(height: 6),
              Text(l.vepArchiveOnDetails, style: RecordStyle.caption),
            ],
            if (_conflict) ...[
              const SizedBox(height: 14),
              NoticeBanner(
                icon: Icons.sync_problem_outlined,
                tone: NoticeTone.warning,
                title: l.vepConflictTitle,
                message: l.vepConflictBusiness,
                action: OutlinedButton(
                  key: const ValueKey('vep.form.reload'),
                  style: compactOutlinedStyle,
                  onPressed: _reload,
                  child: Text(l.vepReload),
                ),
              ),
            ],
            if (latest != null && !_conflict) ...[
              const SizedBox(height: 14),
              RecordNote(
                icon: Icons.info_outline,
                message: l.vepNowSavedBusiness(
                  latest.name,
                  l.statusName(latest.status),
                ),
              ),
            ],
            if (_serverError != null) ...[
              const SizedBox(height: 14),
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
            key: const ValueKey('vep.form.save'),
            onPressed: dirty && !_saving && !_conflict ? _save : null,
            child: Text(_saving ? l.recSaving : l.vepSaveBusiness),
          ),
        ),
      ),
    );
  }
}

class _OutputLine extends StatelessWidget {
  const _OutputLine({
    required this.name,
    required this.unit,
    this.added = true,
    this.onRemove,
  });

  final String name;
  final String unit;
  final bool added;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 6),
    padding: const EdgeInsets.fromLTRB(12, 4, 4, 4),
    constraints: const BoxConstraints(minHeight: 48),
    decoration: BoxDecoration(
      color: added ? AppColors.surface : const Color(0xFFFFFBEA),
      borderRadius: BorderRadius.circular(10),
      border: Border.all(
        color: added ? AppColors.line : const Color(0xFFE5C96B),
      ),
    ),
    child: Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(name, style: RecordStyle.value),
              Text(
                context.l10n.vepMeasuredIn(unit),
                style: RecordStyle.caption,
              ),
            ],
          ),
        ),
        if (onRemove != null)
          IconButton(
            tooltip: context.l10n.vepRemoveOutput(name),
            onPressed: onRemove,
            icon: const Icon(Icons.close, size: 18),
          ),
      ],
    ),
  );
}

/// The product or service sheet: a standard product (its unit is fixed) or
/// Other with a description and a chosen unit. Products of [industry] come
/// first; ones in [taken] are already on the business and are left out.
Future<OutputInput?> showOutputPicker(
  BuildContext context, {
  required String? industry,
  required Set<String> taken,
}) => showModalBottomSheet<OutputInput>(
  context: context,
  isScrollControlled: true,
  showDragHandle: true,
  backgroundColor: AppColors.surface,
  builder: (_) => _OutputPicker(industry: industry, taken: taken),
);

class _OutputPicker extends StatefulWidget {
  const _OutputPicker({required this.industry, required this.taken});

  final String? industry;
  final Set<String> taken;

  @override
  State<_OutputPicker> createState() => _OutputPickerState();
}

class _OutputPickerState extends State<_OutputPicker> {
  String? _product;
  String? _unit;
  final _description = TextEditingController();
  bool _submitted = false;

  @override
  void initState() {
    super.initState();
    _description.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _description.dispose();
    super.dispose();
  }

  List<EconomyProduct> get _choices {
    final open = economyProducts
        .where((p) => p.code == 'OTHER' || !widget.taken.contains(p.code))
        .toList();
    int rank(EconomyProduct p) => p.code == 'OTHER'
        ? 2
        : p.industry == widget.industry
        ? 0
        : 1;
    return open..sort((a, b) => rank(a).compareTo(rank(b)));
  }

  String? get _error {
    final l = context.l10n;
    if (_product == null) return l.vepOutputChoose;
    if (_product == 'OTHER' &&
        (_description.text.trim().isEmpty || _unit == null)) {
      return l.vepOutputOtherError;
    }
    return null;
  }

  void _add() {
    setState(() => _submitted = true);
    if (_error != null) return;
    Navigator.pop(
      context,
      OutputInput(
        product: _product!,
        otherDescription: _product == 'OTHER' ? _description.text.trim() : null,
        unit: _product == 'OTHER' ? _unit : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final fixedUnit = _product == null || _product == 'OTHER'
        ? null
        : productDefinition(_product!)!.unit;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Semantics(
                header: true,
                child: Text(
                  l.vepOutputSheetTitle,
                  style: RecordStyle.cardTitle,
                ),
              ),
              const SizedBox(height: 12),
              FieldLabel(l.vepFieldOutput, required: true),
              DropdownButtonFormField<String>(
                key: const ValueKey('vep.picker.product'),
                initialValue: _product,
                isExpanded: true,
                style: recordInputStyle,
                decoration: changedDecoration(changed: false),
                hint: Text(l.vepChoose, style: recordInputStyle),
                items: [
                  for (final product in _choices)
                    DropdownMenuItem(
                      value: product.code,
                      child: Text(
                        product.unit == null
                            ? l.productName(product.code)
                            : l.withUnit(
                                l.productName(product.code),
                                l.unitName(product.unit!),
                              ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                ],
                onChanged: (value) => setState(() => _product = value),
              ),
              if (fixedUnit != null) ...[
                const SizedBox(height: 6),
                Text(
                  l.vepUnitFixed(l.unitName(fixedUnit)),
                  style: RecordStyle.caption,
                ),
              ],
              if (_product == 'OTHER') ...[
                const SizedBox(height: 12),
                FieldLabel(l.vepOutputOtherDescription, required: true),
                TextField(
                  key: const ValueKey('vep.picker.description'),
                  controller: _description,
                  maxLength: maxOtherText,
                  style: recordInputStyle,
                  decoration: changedDecoration(changed: false)
                      .copyWith(counterText: ''),
                ),
                const SizedBox(height: 12),
                FieldLabel(l.vepOutputUnit, required: true),
                DropdownButtonFormField<String>(
                  key: const ValueKey('vep.picker.unit'),
                  initialValue: _unit,
                  isExpanded: true,
                  style: recordInputStyle,
                  decoration: changedDecoration(changed: false),
                  hint: Text(l.vepChoose, style: recordInputStyle),
                  items: [
                    for (final unit in productionUnits.keys)
                      DropdownMenuItem(
                        value: unit,
                        child: Text(l.unitName(unit)),
                      ),
                  ],
                  onChanged: (value) => setState(() => _unit = value),
                ),
                const SizedBox(height: 6),
                Text(l.vepOtherNotAdded, style: RecordStyle.caption),
              ],
              if (_submitted && _error != null) ...[
                const SizedBox(height: 8),
                Text(
                  _error!,
                  style: const TextStyle(fontSize: 12, color: AppColors.danger),
                ),
              ],
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context),
                      child: Text(l.editCancel),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: FilledButton(
                      key: const ValueKey('vep.picker.add'),
                      onPressed: _add,
                      child: Text(l.vepOutputAdd),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
