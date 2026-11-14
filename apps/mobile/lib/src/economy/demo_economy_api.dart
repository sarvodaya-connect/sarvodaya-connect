import 'dart:async';

import '../models/user.dart';
import '../society_record/society_record_models.dart' show ActorRef;
import 'economy_api.dart';
import 'economy_models.dart';

/// Fictional Village Economic Profile data for demo mode and tests. It
/// applies the same rules as the API (#145): who may read and write, units,
/// period shapes, overlaps, retries, corrections and stale versions. Nothing
/// here leaves the phone. Every business and figure is invented.
class DemoEconomyApi implements EconomyApi {
  DemoEconomyApi({
    required this.user,
    required this.clock,
    this.delay = const Duration(milliseconds: 500),
    this.isOnline,
  }) {
    _seed();
  }

  final AuthenticatedUser? Function() user;
  final DateTime Function() clock;
  final Duration delay;
  final bool Function()? isOnline;

  /// The demo societies and their districts, as in the demo society records.
  static const _districts = {
    'society-pahala-kosgama': 'district-kurunegala',
    'society-wellawa': 'district-kurunegala',
    'society-mawathagama': 'district-kurunegala',
    'society-wariyapola': 'district-anuradhapura',
  };
  static const _names = {
    'society-pahala-kosgama': 'Pahala Kosgama SSS',
    'society-wellawa': 'Wellawa SSS',
    'society-mawathagama': 'Mawathagama SSS',
    'society-wariyapola': 'Wariyapola SSS',
  };

  final _businesses = <String, _Business>{};
  final _outputs = <String, _Output>{};
  final _records = <String, _Record>{};
  final _requests = <String, String>{};
  var _nextId = 1;

  String _id(String kind) => 'demo-$kind-${_nextId++}';

  /// Lets a test change a figure as if someone else saved it elsewhere.
  void changeElsewhere(String recordId, double quantity) {
    final record = _records[recordId]!;
    record.quantity = quantity;
    record.version++;
    record.updatedAt = clock();
    record.updatedBy = const ActorRef(
      'Another officer',
      UserRole.societyOfficer,
    );
    record.revisions.insert(
      0,
      _revision(record, 'CORRECTED', record.updatedBy!),
    );
  }

  void _seed() {
    final now = clock();
    final today = sriLankaToday(now);
    const officer = ActorRef('Nimali Wijesinghe', UserRole.societyOfficer);
    DateTime monthsAgo(int months) =>
        DateTime.utc(today.year, today.month - months);
    ProductionPeriod month(int ago) {
      final start = monthsAgo(ago);
      return ProductionPeriod.month(start.year, start.month);
    }

    final dairy = _addBusiness(
      'society-pahala-kosgama',
      name: 'Kosgama Dairy Collective',
      industry: 'LIVESTOCK_DAIRY',
      description: "Collects members' milk each morning and makes curd.",
      status: 'OPERATING',
      by: officer,
      at: now.subtract(const Duration(days: 200)),
    );
    final milk = _addOutput(dairy, 'MILK', by: officer);
    final curd = _addOutput(dairy, 'CURD', by: officer);
    _addRecord(milk, month(3), 'ACTUAL', 3050, by: officer);
    _addRecord(milk, month(2), 'ACTUAL', 3100, by: officer);
    _addRecord(milk, month(0), 'ESTIMATED', 3300, by: officer);
    _addRecord(curd, month(2), 'ACTUAL', 182.5, by: officer);

    final mill = _addBusiness(
      'society-pahala-kosgama',
      name: "Members' Rice Mill",
      industry: 'FOOD_PROCESSING',
      description: "Mills members' paddy into rice flour.",
      status: 'SEASONAL',
      by: officer,
      at: now.subtract(const Duration(days: 150)),
    );
    final flour = _addOutput(mill, 'RICE_FLOUR', by: officer);
    // A reported zero: the mill stood still that month.
    _addRecord(flour, month(2), 'ACTUAL', 0, by: officer);

    final tailoring = _addBusiness(
      'society-pahala-kosgama',
      name: 'Kosgama Tailoring Centre',
      industry: 'SERVICES',
      status: 'TEMPORARILY_STOPPED',
      by: officer,
      at: now.subtract(const Duration(days: 120)),
    );
    final jobs = _addOutput(tailoring, 'TAILORING_JOBS', by: officer);
    _addRecord(
      jobs,
      ProductionPeriod.weekOf(today.subtract(const Duration(days: 21))),
      'ACTUAL',
      14,
      by: officer,
    );

    const wellawaOfficer = ActorRef('K. Rathnayake', UserRole.societyOfficer);
    final estate = _addBusiness(
      'society-wellawa',
      name: 'Wellawa Coconut Estate',
      industry: 'AGRICULTURE',
      status: 'OPERATING',
      by: wellawaOfficer,
      at: now.subtract(const Duration(days: 300)),
    );
    final nuts = _addOutput(estate, 'COCONUTS', by: wellawaOfficer);
    final seasonStart = monthsAgo(7);
    _addRecord(
      nuts,
      ProductionPeriod(
        basis: 'SEASONAL',
        startsOn: seasonStart,
        endsOn: DateTime.utc(seasonStart.year, seasonStart.month + 4, 0),
        seasonLabel: 'Yala ${seasonStart.year}',
      ),
      'ACTUAL',
      12400,
      by: wellawaOfficer,
    );
  }

  _Business _addBusiness(
    String societyId, {
    required String name,
    required String industry,
    String? otherIndustry,
    String? description,
    required String status,
    required ActorRef by,
    required DateTime at,
  }) {
    final business = _Business(
      id: _id('business'),
      societyId: societyId,
      name: name,
      industry: industry,
      otherIndustry: otherIndustry,
      description: description,
      status: status,
      createdBy: by,
      createdAt: at,
    );
    if (status == 'CLOSED') business.closedAt = at;
    _businesses[business.id] = business;
    return business;
  }

  _Output _addOutput(
    _Business business,
    String product, {
    String? otherDescription,
    String? unit,
    required ActorRef by,
  }) {
    final output = _Output(
      id: _id('output'),
      business: business,
      product: product,
      otherDescription: otherDescription,
      unit: unit ?? productDefinition(product)!.unit!,
      createdAt: business.createdAt,
    );
    business.outputs.add(output);
    _outputs[output.id] = output;
    return output;
  }

  _Record _addRecord(
    _Output output,
    ProductionPeriod period,
    String measurement,
    double quantity, {
    required ActorRef by,
    String? note,
    String? source,
  }) {
    final at = period.endsOn.isAfter(clock())
        ? clock()
        : period.endsOn.add(const Duration(days: 2, hours: 4));
    final record = _Record(
      id: _id('record'),
      output: output,
      period: period,
      measurement: measurement,
      quantity: quantity,
      note: note,
      source: source,
      createdBy: by,
      createdAt: at,
    );
    record.revisions.add(_revision(record, 'CREATED', by));
    _records[record.id] = record;
    return record;
  }

  ProductionRevision _revision(_Record record, String change, ActorRef by) =>
      ProductionRevision(
        version: record.version,
        change: change,
        quantity: record.quantity,
        note: record.note,
        source: record.source,
        seasonLabel: record.period.seasonLabel,
        changedBy: by,
        changedAt: record.updatedAt,
      );

  Future<void> _wait() async {
    if (delay > Duration.zero) await Future<void>.delayed(delay);
    if (isOnline != null && !isOnline!()) {
      throw const SocietyRecordException(
        'You are offline. Nothing you entered has been lost. Try again when you are connected.',
        offline: true,
      );
    }
  }

  AuthenticatedUser get _signedIn {
    final current = user();
    if (current == null) {
      throw const SocietyRecordException('Sign in to continue', status: 401);
    }
    return current;
  }

  ActorRef get _actor => ActorRef(_signedIn.displayName, _signedIn.primaryRole);

  bool _canView(String societyId) {
    final district = _districts[societyId];
    return district != null &&
        _signedIn.canViewSociety(societyId, district, clock());
  }

  bool _canManage(String societyId) =>
      _signedIn.roles.contains(UserRole.societyOfficer) &&
      _signedIn.societyIds.contains(societyId);

  void _visibleSociety(String societyId) {
    if (!_canView(societyId)) {
      throw const SocietyRecordException('Society not found', status: 404);
    }
  }

  /// Outside the caller's scope is 404; inside it but not theirs to change
  /// is 403, as on the server.
  void _assertManage(String societyId) {
    if (!_canManage(societyId)) {
      throw const SocietyRecordException(
        'Only the Society Officer of this society can change its economic profile',
        status: 403,
      );
    }
  }

  _Business _visibleBusiness(String id) {
    final business = _businesses[id];
    if (business == null || !_canView(business.societyId)) {
      throw const SocietyRecordException('Business not found', status: 404);
    }
    return business;
  }

  _Output _visibleOutput(String id) {
    final output = _outputs[id];
    if (output == null || !_canView(output.business.societyId)) {
      throw const SocietyRecordException('Output not found', status: 404);
    }
    return output;
  }

  _Record _visibleRecord(String id) {
    final record = _records[id];
    if (record == null || !_canView(record.output.business.societyId)) {
      throw const SocietyRecordException(
        'Production record not found',
        status: 404,
      );
    }
    return record;
  }

  static const _stale = SocietyRecordException(
    'Someone else changed this since you opened it. Reload to see the latest figures, then try again',
    status: 409,
  );

  SocietyRecordException _invalid(String message) =>
      SocietyRecordException(message, status: 400);

  @override
  Future<EconomicProfile> fetchProfile(String societyId) async {
    await _wait();
    _visibleSociety(societyId);
    final businesses =
        _businesses.values.where((b) => b.societyId == societyId).toList()
          ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
    return EconomicProfile(
      societyId: societyId,
      societyName: _names[societyId]!,
      // As the API: each output's latest actual and estimate from its whole
      // history, never from a page of it.
      businesses: [
        for (final business in businesses)
          business.snapshot(
            latestByOutput(
              _newestFirst(
                _records.values.where((r) => r.output.business == business),
              ).map((r) => r.snapshot()),
            ),
          ),
      ],
      canManage: _canManage(societyId),
    );
  }

  List<_Record> _newestFirst(Iterable<_Record> records) =>
      records.toList()..sort((a, b) {
        final byStart = b.period.startsOn.compareTo(a.period.startsOn);
        return byStart != 0 ? byStart : a.measurement.compareTo(b.measurement);
      });

  String? _businessError({
    required String name,
    required String industry,
    String? otherIndustry,
    String? description,
    required String status,
  }) {
    if (name.trim().length < 2) return 'Enter the business name';
    if (name.trim().length > maxBusinessName) return 'The name is too long';
    if (!economyIndustries.contains(industry)) {
      return 'Choose an industry from the list';
    }
    if (industry == 'OTHER' && (otherIndustry?.trim().isEmpty ?? true)) {
      return 'Describe the industry when choosing Other';
    }
    if ((description?.length ?? 0) > maxBusinessDescription) {
      return 'The description is too long';
    }
    if (!businessStatuses.contains(status)) return 'Choose a status';
    return null;
  }

  String? _clean(String? text) {
    final trimmed = text?.trim();
    return trimmed == null || trimmed.isEmpty ? null : trimmed;
  }

  @override
  Future<SocietyBusiness> createBusiness(
    String societyId,
    BusinessInput input,
  ) async {
    await _wait();
    _visibleSociety(societyId);
    _assertManage(societyId);
    final error = _businessError(
      name: input.name,
      industry: input.industry,
      otherIndustry: input.otherIndustry,
      description: input.description,
      status: input.status,
    );
    if (error != null) throw _invalid(error);
    if (_businesses.values.where((b) => b.societyId == societyId).length >=
        maxSocietyBusinesses) {
      throw _invalid(
        'A society can record at most $maxSocietyBusinesses businesses',
      );
    }
    return _addBusiness(
      societyId,
      name: input.name.trim(),
      industry: input.industry,
      otherIndustry: input.industry == 'OTHER'
          ? _clean(input.otherIndustry)
          : null,
      description: _clean(input.description),
      status: input.status,
      by: _actor,
      at: clock(),
    ).snapshot();
  }

  @override
  Future<SocietyBusiness> updateBusiness(
    String businessId,
    int version,
    Map<String, Object?> changes,
  ) async {
    await _wait();
    final business = _visibleBusiness(businessId);
    _assertManage(business.societyId);
    final industry = changes['industry'] as String? ?? business.industry;
    final name = (changes['name'] as String?)?.trim() ?? business.name;
    final otherIndustry = industry == 'OTHER'
        ? (changes.containsKey('otherIndustry')
              ? _clean(changes['otherIndustry'] as String?)
              : business.otherIndustry)
        : null;
    final description = changes.containsKey('description')
        ? _clean(changes['description'] as String?)
        : business.description;
    final status = changes['status'] as String? ?? business.status;
    final error = _businessError(
      name: name,
      industry: industry,
      otherIndustry: otherIndustry,
      description: description,
      status: status,
    );
    if (error != null) throw _invalid(error);
    final unchanged =
        name == business.name &&
        industry == business.industry &&
        otherIndustry == business.otherIndustry &&
        description == business.description &&
        status == business.status;
    if (unchanged) return business.snapshot();
    if (version != business.version) throw _stale;
    business
      ..name = name
      ..industry = industry
      ..otherIndustry = otherIndustry
      ..description = description
      ..closedAt = status == 'CLOSED' ? (business.closedAt ?? clock()) : null
      ..status = status
      ..version += 1
      ..updatedBy = _actor
      ..updatedAt = clock();
    return business.snapshot();
  }

  @override
  Future<BusinessOutput> createOutput(
    String businessId,
    OutputInput input,
  ) async {
    await _wait();
    final business = _visibleBusiness(businessId);
    _assertManage(business.societyId);
    if (business.status == 'CLOSED') {
      throw _invalid(
        'This business is closed. Reopen it before adding products or services',
      );
    }
    final product = productDefinition(input.product);
    if (product == null) {
      throw _invalid('Choose a product or service from the list');
    }
    final other = _clean(input.otherDescription);
    if (product.code == 'OTHER') {
      if (other == null) {
        throw _invalid('Describe the output when choosing Other');
      }
      if (!productionUnits.containsKey(input.unit)) {
        throw _invalid('Choose a unit from the list');
      }
    } else if (business.outputs.any(
      (o) => o.product == product.code && o.archivedAt == null,
    )) {
      throw const SocietyRecordException(
        'This business already records this product. Use the existing one',
        status: 409,
      );
    }
    return _addOutput(
      business,
      product.code,
      otherDescription: product.code == 'OTHER' ? other : null,
      unit: product.code == 'OTHER' ? input.unit : null,
      by: _actor,
    ).snapshot();
  }

  @override
  Future<BusinessOutput> setOutputArchived(
    String outputId, {
    required int version,
    required bool archived,
  }) async {
    await _wait();
    final output = _visibleOutput(outputId);
    _assertManage(output.business.societyId);
    if ((output.archivedAt != null) == archived) return output.snapshot();
    if (version != output.version) throw _stale;
    if (!archived &&
        output.product != 'OTHER' &&
        output.business.outputs.any(
          (o) =>
              o != output &&
              o.product == output.product &&
              o.archivedAt == null,
        )) {
      throw const SocietyRecordException(
        'This business already records this product. Archive that one first',
        status: 409,
      );
    }
    output
      ..archivedAt = archived ? clock() : null
      ..version += 1
      ..updatedAt = clock();
    return output.snapshot();
  }

  @override
  Future<RecordPage> fetchRecords(
    String outputId, {
    int page = 1,
    int pageSize = 20,
  }) async {
    await _wait();
    final output = _visibleOutput(outputId);
    final all = _newestFirst(_records.values.where((r) => r.output == output));
    return RecordPage(
      items: [
        for (final record in all.skip((page - 1) * pageSize).take(pageSize))
          record.snapshot(),
      ],
      page: page,
      pageSize: pageSize,
      total: all.length,
    );
  }

  /// The same checks as the API's `checkPeriod`.
  String? _periodError(ProductionPeriod period, String measurement) {
    final start = period.startsOn, end = period.endsOn;
    if (end.isBefore(start)) return 'The period cannot end before it starts';
    switch (period.basis) {
      case 'WEEKLY':
        if (start.weekday != DateTime.monday || period.days != 7) {
          return 'A weekly period runs from a Monday to the next Sunday';
        }
      case 'MONTHLY':
        if (start.day != 1 ||
            end != DateTime.utc(start.year, start.month + 1, 0)) {
          return 'A monthly period runs from the first to the last day of one month';
        }
      case 'SEASONAL':
        if (_clean(period.seasonLabel) == null) {
          return 'Name the season, for example Maha 2026/27';
        }
        if (period.days > maxSeasonDays) {
          return 'A season can cover at most $maxSeasonDays days';
        }
      default:
        return 'Choose weekly, monthly or seasonal';
    }
    final today = sriLankaToday(clock());
    if (measurement == 'ACTUAL' && end.isAfter(today)) {
      return 'An actual figure can only cover days that have passed. Record an estimate instead';
    }
    if (end.isAfter(today.add(const Duration(days: 366)))) {
      return 'An estimate can look at most a year ahead';
    }
    return null;
  }

  String? _quantityError(double quantity, String unit) {
    if (!quantity.isFinite || quantity < 0) {
      return 'The quantity cannot be negative';
    }
    if (quantity > maxProductionQuantity) return 'The quantity is too large';
    final decimals = productionUnits[unit]!;
    final text = quantity.toString();
    final places = text.contains('.') && !text.endsWith('.0')
        ? text.split('.').last.length
        : 0;
    if (places > decimals) {
      return decimals == 0
          ? 'Enter a whole number for this unit'
          : 'Enter at most $decimals decimal places for this unit';
    }
    return null;
  }

  @override
  Future<SavedProduction> createRecord(
    String outputId,
    ProductionInput input,
  ) async {
    await _wait();
    final output = _visibleOutput(outputId);
    _assertManage(output.business.societyId);
    final period = ProductionPeriod(
      basis: input.period.basis,
      startsOn: input.period.startsOn,
      endsOn: input.period.endsOn,
      seasonLabel: input.period.basis == 'SEASONAL'
          ? _clean(input.period.seasonLabel)
          : null,
    );
    final periodError = _periodError(period, input.measurement);
    if (periodError != null) throw _invalid(periodError);
    final quantityError = _quantityError(input.quantity, output.unit);
    if (quantityError != null) throw _invalid(quantityError);

    // A retry of a save that already reached the server adds nothing.
    final repeated = _records[_requests[input.clientRequestId]];
    if (repeated != null) {
      if (repeated.output != output ||
          repeated.measurement != input.measurement ||
          !repeated.period.sameAs(period)) {
        throw const SocietyRecordException(
          'This request id was already used for a different record',
          status: 409,
        );
      }
      return SavedProduction(repeated.snapshot(), created: false);
    }
    final archived = output.archivedAt;
    if (archived != null && period.startsOn.isAfter(sriLankaToday(archived))) {
      throw _invalid(
        'This output was archived before this period. Bring it back first',
      );
    }
    final closed = output.business.closedAt;
    if (closed != null && period.startsOn.isAfter(sriLankaToday(closed))) {
      throw _invalid('This business was closed before this period');
    }
    final overlapping = _records.values
        .where(
          (r) =>
              r.output == output &&
              r.measurement == input.measurement &&
              r.period.overlaps(period),
        )
        .firstOrNull;
    if (overlapping != null) {
      if (overlapping.period.sameAs(period) &&
          overlapping.quantity == input.quantity) {
        _requests[input.clientRequestId] = overlapping.id;
        return SavedProduction(overlapping.snapshot(), created: false);
      }
      throw SocietyRecordException(
        overlapping.period.sameAs(period)
            ? 'This period already has a ${input.measurement.toLowerCase()} figure (record ${overlapping.id}). Correct that record instead'
            : 'This overlaps a ${input.measurement.toLowerCase()} figure already saved for this output (record ${overlapping.id})',
        status: 409,
      );
    }
    final record = _addRecord(
      output,
      period,
      input.measurement,
      input.quantity,
      by: _actor,
      note: _clean(input.note),
      source: _clean(input.source),
    );
    record.createdAt = clock();
    record.updatedAt = clock();
    record.revisions
      ..clear()
      ..add(_revision(record, 'CREATED', _actor));
    _requests[input.clientRequestId] = record.id;
    return SavedProduction(record.snapshot(), created: true);
  }

  @override
  Future<ProductionRecord> correctRecord(
    ProductionRecord current,
    ProductionCorrection correction,
  ) async {
    await _wait();
    final record = _visibleRecord(current.id);
    _assertManage(record.output.business.societyId);
    final quantityError = _quantityError(
      correction.quantity,
      record.output.unit,
    );
    if (quantityError != null) throw _invalid(quantityError);
    final seasonLabel = record.period.basis == 'SEASONAL'
        ? _clean(correction.seasonLabel) ?? record.period.seasonLabel
        : null;
    if (record.period.basis == 'SEASONAL' && seasonLabel == null) {
      throw _invalid('Name the season, for example Maha 2026/27');
    }
    final note = _clean(correction.note), source = _clean(correction.source);
    final unchanged =
        record.quantity == correction.quantity &&
        record.period.seasonLabel == seasonLabel &&
        record.note == note &&
        record.source == source;
    // Values already saved are accepted and change nothing.
    if (unchanged) return record.snapshot();
    if (correction.version != record.version) throw _stale;
    record
      ..quantity = correction.quantity
      ..period = ProductionPeriod(
        basis: record.period.basis,
        startsOn: record.period.startsOn,
        endsOn: record.period.endsOn,
        seasonLabel: seasonLabel,
      )
      ..note = note
      ..source = source
      ..version += 1
      ..updatedBy = _actor
      ..updatedAt = clock();
    record.revisions.insert(0, _revision(record, 'CORRECTED', _actor));
    return record.snapshot();
  }

  @override
  Future<ProductionHistory> fetchHistory(String recordId) async {
    await _wait();
    final record = _visibleRecord(recordId);
    return ProductionHistory(
      record: record.snapshot(),
      revisions: List.unmodifiable(record.revisions),
    );
  }
}

class _Business {
  _Business({
    required this.id,
    required this.societyId,
    required this.name,
    required this.industry,
    required this.otherIndustry,
    required this.description,
    required this.status,
    required this.createdBy,
    required this.createdAt,
  }) : updatedAt = createdAt;

  final String id;
  final String societyId;
  String name;
  String industry;
  String? otherIndustry;
  String? description;
  String status;
  DateTime? closedAt;
  int version = 1;
  final outputs = <_Output>[];
  final ActorRef createdBy;
  ActorRef? updatedBy;
  final DateTime createdAt;
  DateTime updatedAt;

  /// [latest] is given for the economic profile only, as on the API.
  SocietyBusiness snapshot([Map<String, LatestProduction>? latest]) =>
      SocietyBusiness(
        id: id,
        societyId: societyId,
        name: name,
        industry: industry,
        otherIndustry: otherIndustry,
        description: description,
        status: status,
        closedAt: closedAt,
        version: version,
        outputs: [
          for (final output in outputs)
            output.snapshot(
              latest == null
                  ? null
                  : latest[output.id] ?? const LatestProduction(),
            ),
        ],
        createdBy: createdBy,
        updatedBy: updatedBy,
        createdAt: createdAt,
        updatedAt: updatedAt,
      );
}

class _Output {
  _Output({
    required this.id,
    required this.business,
    required this.product,
    required this.otherDescription,
    required this.unit,
    required this.createdAt,
  }) : updatedAt = createdAt;

  final String id;
  final _Business business;
  final String product;
  final String? otherDescription;
  final String unit;
  DateTime? archivedAt;
  int version = 1;
  final DateTime createdAt;
  DateTime updatedAt;

  BusinessOutput snapshot([LatestProduction? latest]) => BusinessOutput(
    id: id,
    businessId: business.id,
    product: product,
    otherDescription: otherDescription,
    unit: unit,
    kind: productDefinition(product)?.kind,
    archivedAt: archivedAt,
    version: version,
    createdAt: createdAt,
    updatedAt: updatedAt,
    latest: latest,
  );
}

class _Record {
  _Record({
    required this.id,
    required this.output,
    required this.period,
    required this.measurement,
    required this.quantity,
    required this.note,
    required this.source,
    required this.createdBy,
    required this.createdAt,
  }) : updatedAt = createdAt;

  final String id;
  final _Output output;
  ProductionPeriod period;
  final String measurement;
  double quantity;
  String? note;
  String? source;
  int version = 1;
  final ActorRef createdBy;
  ActorRef? updatedBy;
  DateTime createdAt;
  DateTime updatedAt;
  final revisions = <ProductionRevision>[];

  ProductionRecord snapshot() => ProductionRecord(
    id: id,
    outputId: output.id,
    period: period,
    measurement: measurement,
    quantity: quantity,
    unit: output.unit,
    note: note,
    source: source,
    version: version,
    createdBy: createdBy,
    updatedBy: updatedBy,
    createdAt: createdAt,
    updatedAt: updatedAt,
  );
}
