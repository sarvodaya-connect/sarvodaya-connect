import 'dart:math';

import '../society_record/society_record_models.dart' show ActorRef;

/// Issue #146: the phone side of the Village Economic Profile (#145).
///
/// Businesses operated by the society itself, what each produces and how
/// much it reported for an exact period. Every figure is typed by the
/// Society Officer and is self-reported: nothing here is verified.
///
/// The catalogue below mirrors `packages/api-contracts/src/economy.ts`, the
/// one list the API, the dashboard and the phone share. Codes are stored and
/// sent; [EconomyL10n] translates them. `test/economy_catalogue_test.dart`
/// fails if this copy and the shared contract ever differ.

const economyIndustries = [
  'AGRICULTURE',
  'LIVESTOCK_DAIRY',
  'FISHERIES',
  'FOOD_PROCESSING',
  'TEXTILES_GARMENTS',
  'HANDICRAFTS',
  'SERVICES',
  'OTHER',
];

const businessStatuses = [
  'OPERATING',
  'SEASONAL',
  'TEMPORARILY_STOPPED',
  'CLOSED',
];

/// Unit code → how many decimal places it accepts (0: whole numbers only).
const productionUnits = {
  'LITRE': 2,
  'KILOGRAM': 3,
  'METRE': 2,
  'ITEM': 0,
  'NUT': 0,
  'EGG': 0,
  'PACKET': 0,
  'JOB': 0,
};

class EconomyProduct {
  const EconomyProduct(this.code, this.industry, this.kind, this.unit);

  final String code;
  final String? industry;

  /// 'GOOD' or 'SERVICE'; null for OTHER.
  final String? kind;

  /// The one unit of a standard product; null for OTHER, whose unit is chosen.
  final String? unit;
}

const economyProducts = [
  EconomyProduct('MILK', 'LIVESTOCK_DAIRY', 'GOOD', 'LITRE'),
  EconomyProduct('CURD', 'LIVESTOCK_DAIRY', 'GOOD', 'KILOGRAM'),
  EconomyProduct('EGGS', 'LIVESTOCK_DAIRY', 'GOOD', 'EGG'),
  EconomyProduct('PADDY', 'AGRICULTURE', 'GOOD', 'KILOGRAM'),
  EconomyProduct('VEGETABLES', 'AGRICULTURE', 'GOOD', 'KILOGRAM'),
  EconomyProduct('FRUIT', 'AGRICULTURE', 'GOOD', 'KILOGRAM'),
  EconomyProduct('COCONUTS', 'AGRICULTURE', 'GOOD', 'NUT'),
  EconomyProduct('TEA_LEAF', 'AGRICULTURE', 'GOOD', 'KILOGRAM'),
  EconomyProduct('FISH', 'FISHERIES', 'GOOD', 'KILOGRAM'),
  EconomyProduct('DRIED_FISH', 'FISHERIES', 'GOOD', 'KILOGRAM'),
  EconomyProduct('RICE_FLOUR', 'FOOD_PROCESSING', 'GOOD', 'KILOGRAM'),
  EconomyProduct('SNACK_PACKETS', 'FOOD_PROCESSING', 'GOOD', 'PACKET'),
  EconomyProduct('GARMENTS', 'TEXTILES_GARMENTS', 'GOOD', 'ITEM'),
  EconomyProduct('HANDLOOM_FABRIC', 'TEXTILES_GARMENTS', 'GOOD', 'METRE'),
  EconomyProduct('HANDICRAFT_ITEMS', 'HANDICRAFTS', 'GOOD', 'ITEM'),
  EconomyProduct('TAILORING_JOBS', 'SERVICES', 'SERVICE', 'JOB'),
  EconomyProduct('REPAIR_JOBS', 'SERVICES', 'SERVICE', 'JOB'),
  EconomyProduct('OTHER', null, null, null),
];

EconomyProduct? productDefinition(String code) =>
    economyProducts.where((product) => product.code == code).firstOrNull;

const productionBases = ['WEEKLY', 'MONTHLY', 'SEASONAL'];
const productionMeasurements = ['ACTUAL', 'ESTIMATED'];

/// The largest quantity one record accepts.
const maxProductionQuantity = 100000000;

/// A season covers at most this many days.
const maxSeasonDays = 366;

/// The API's limits on typed text, so the form stops at the same place.
const maxBusinessName = 150;
const maxBusinessDescription = 500;
const maxOtherText = 150;
const maxSeasonLabel = 60;
const maxNote = 500;
const maxSource = 150;

/// A society can record at most this many businesses.
const maxSocietyBusinesses = 50;

DateTime? _date(Object? value) =>
    value == null ? null : DateTime.parse(value as String);

/// A `YYYY-MM-DD` calendar day as a date with no time.
DateTime parseDay(String value) {
  final parts = value.split('-').map(int.parse).toList();
  return DateTime.utc(parts[0], parts[1], parts[2]);
}

String formatDay(DateTime day) =>
    '${day.year.toString().padLeft(4, '0')}-${day.month.toString().padLeft(2, '0')}-${day.day.toString().padLeft(2, '0')}';

/// Today in Sri Lanka (UTC+5:30), whatever the phone's time zone.
DateTime sriLankaToday(DateTime now) {
  final local = now.toUtc().add(const Duration(hours: 5, minutes: 30));
  return DateTime.utc(local.year, local.month, local.day);
}

class BusinessOutput {
  const BusinessOutput({
    required this.id,
    required this.businessId,
    required this.product,
    required this.otherDescription,
    required this.unit,
    required this.kind,
    required this.archivedAt,
    required this.version,
    required this.createdAt,
    required this.updatedAt,
  });

  factory BusinessOutput.fromJson(Map<String, dynamic> json) => BusinessOutput(
    id: json['id'] as String,
    businessId: json['businessId'] as String,
    product: json['product'] as String,
    otherDescription: json['otherDescription'] as String?,
    unit: json['unit'] as String,
    kind: json['kind'] as String?,
    archivedAt: _date(json['archivedAt']),
    version: json['version'] as int,
    createdAt: DateTime.parse(json['createdAt'] as String),
    updatedAt: DateTime.parse(json['updatedAt'] as String),
  );

  final String id;
  final String businessId;
  final String product;
  final String? otherDescription;
  final String unit;
  final String? kind;
  final DateTime? archivedAt;
  final int version;
  final DateTime createdAt;
  final DateTime updatedAt;

  bool get archived => archivedAt != null;
  int get decimals => productionUnits[unit] ?? 0;
}

class SocietyBusiness {
  const SocietyBusiness({
    required this.id,
    required this.societyId,
    required this.name,
    required this.industry,
    required this.otherIndustry,
    required this.description,
    required this.status,
    required this.closedAt,
    required this.version,
    required this.outputs,
    required this.createdBy,
    required this.updatedBy,
    required this.createdAt,
    required this.updatedAt,
  });

  factory SocietyBusiness.fromJson(Map<String, dynamic> json) =>
      SocietyBusiness(
        id: json['id'] as String,
        societyId: json['societyId'] as String,
        name: json['name'] as String,
        industry: json['industry'] as String,
        otherIndustry: json['otherIndustry'] as String?,
        description: json['description'] as String?,
        status: json['status'] as String,
        closedAt: _date(json['closedAt']),
        version: json['version'] as int,
        outputs: (json['outputs'] as List? ?? const [])
            .map((row) => BusinessOutput.fromJson(row as Map<String, dynamic>))
            .toList(),
        createdBy: ActorRef.fromJson(json['createdBy'] as Map<String, dynamic>),
        updatedBy: json['updatedBy'] == null
            ? null
            : ActorRef.fromJson(json['updatedBy'] as Map<String, dynamic>),
        createdAt: DateTime.parse(json['createdAt'] as String),
        updatedAt: DateTime.parse(json['updatedAt'] as String),
      );

  final String id;
  final String societyId;
  final String name;
  final String industry;
  final String? otherIndustry;
  final String? description;
  final String status;
  final DateTime? closedAt;
  final int version;
  final List<BusinessOutput> outputs;
  final ActorRef createdBy;
  final ActorRef? updatedBy;
  final DateTime createdAt;
  final DateTime updatedAt;

  bool get closed => status == 'CLOSED';
  List<BusinessOutput> get activeOutputs =>
      outputs.where((output) => !output.archived).toList();
  ActorRef get lastChangedBy => updatedBy ?? createdBy;
}

/// The exact period a figure covers. Both ends are included.
class ProductionPeriod {
  const ProductionPeriod({
    required this.basis,
    required this.startsOn,
    required this.endsOn,
    this.seasonLabel,
  });

  /// The first to the last day of [month] in [year].
  factory ProductionPeriod.month(int year, int month) => ProductionPeriod(
    basis: 'MONTHLY',
    startsOn: DateTime.utc(year, month),
    endsOn: DateTime.utc(year, month + 1, 0),
  );

  /// Monday to Sunday of the week holding [day].
  factory ProductionPeriod.weekOf(DateTime day) {
    final start = DateTime.utc(
      day.year,
      day.month,
      day.day,
    ).subtract(Duration(days: day.weekday - DateTime.monday));
    return ProductionPeriod(
      basis: 'WEEKLY',
      startsOn: start,
      endsOn: start.add(const Duration(days: 6)),
    );
  }

  final String basis;
  final DateTime startsOn;
  final DateTime endsOn;
  final String? seasonLabel;

  int get days => endsOn.difference(startsOn).inDays + 1;

  bool sameAs(ProductionPeriod other) =>
      basis == other.basis &&
      startsOn == other.startsOn &&
      endsOn == other.endsOn;

  bool overlaps(ProductionPeriod other) =>
      !startsOn.isAfter(other.endsOn) && !other.startsOn.isAfter(endsOn);
}

class ProductionRecord {
  const ProductionRecord({
    required this.id,
    required this.outputId,
    required this.period,
    required this.measurement,
    required this.quantity,
    required this.unit,
    required this.note,
    required this.source,
    required this.version,
    required this.createdBy,
    required this.updatedBy,
    required this.createdAt,
    required this.updatedAt,
  });

  factory ProductionRecord.fromJson(Map<String, dynamic> json) =>
      ProductionRecord(
        id: json['id'] as String,
        outputId: json['outputId'] as String,
        period: ProductionPeriod(
          basis: json['basis'] as String,
          startsOn: parseDay(json['startsOn'] as String),
          endsOn: parseDay(json['endsOn'] as String),
          seasonLabel: json['seasonLabel'] as String?,
        ),
        measurement: json['measurement'] as String,
        quantity: (json['quantity'] as num).toDouble(),
        unit: json['unit'] as String,
        note: json['note'] as String?,
        source: json['source'] as String?,
        version: json['version'] as int,
        createdBy: ActorRef.fromJson(json['createdBy'] as Map<String, dynamic>),
        updatedBy: json['updatedBy'] == null
            ? null
            : ActorRef.fromJson(json['updatedBy'] as Map<String, dynamic>),
        createdAt: DateTime.parse(json['createdAt'] as String),
        updatedAt: DateTime.parse(json['updatedAt'] as String),
      );

  final String id;
  final String outputId;
  final ProductionPeriod period;
  final String measurement;

  /// Self-reported. 0 is a reported zero, never "not reported".
  final double quantity;
  final String unit;
  final String? note;
  final String? source;
  final int version;
  final ActorRef createdBy;
  final ActorRef? updatedBy;
  final DateTime createdAt;
  final DateTime updatedAt;

  bool get actual => measurement == 'ACTUAL';
  bool get corrected => version > 1;
  ActorRef get lastChangedBy => updatedBy ?? createdBy;
}

class ProductionRevision {
  const ProductionRevision({
    required this.version,
    required this.change,
    required this.quantity,
    required this.note,
    required this.source,
    required this.seasonLabel,
    required this.changedBy,
    required this.changedAt,
  });

  factory ProductionRevision.fromJson(Map<String, dynamic> json) =>
      ProductionRevision(
        version: json['version'] as int,
        change: json['change'] as String,
        quantity: (json['quantity'] as num).toDouble(),
        note: json['note'] as String?,
        source: json['source'] as String?,
        seasonLabel: json['seasonLabel'] as String?,
        changedBy: ActorRef.fromJson(json['changedBy'] as Map<String, dynamic>),
        changedAt: DateTime.parse(json['changedAt'] as String),
      );

  final int version;

  /// 'CREATED' or 'CORRECTED'.
  final String change;
  final double quantity;
  final String? note;
  final String? source;
  final String? seasonLabel;
  final ActorRef changedBy;
  final DateTime changedAt;
}

class ProductionHistory {
  const ProductionHistory({required this.record, required this.revisions});

  final ProductionRecord record;

  /// Newest first.
  final List<ProductionRevision> revisions;
}

class EconomicProfile {
  const EconomicProfile({
    required this.societyId,
    required this.societyName,
    required this.businesses,
    required this.canManage,
    this.businessDescription,
  });

  factory EconomicProfile.fromJson(Map<String, dynamic> json) =>
      EconomicProfile(
        societyId: json['society']['id'] as String,
        societyName: json['society']['name'] as String,
        businessDescription: json['businessDescription'] as String?,
        businesses: (json['businesses'] as List)
            .map((row) => SocietyBusiness.fromJson(row as Map<String, dynamic>))
            .toList(),
        canManage: json['permissions']?['canManage'] == true,
      );

  final String societyId;
  final String societyName;

  /// The society profile's free text, unchanged and never turned into
  /// businesses.
  final String? businessDescription;
  final List<SocietyBusiness> businesses;

  /// Only the assigned Society Officer manages this module.
  final bool canManage;

  SocietyBusiness? business(String id) =>
      businesses.where((business) => business.id == id).firstOrNull;
}

/// One page of records, newest period first.
class RecordPage {
  const RecordPage({
    required this.items,
    required this.page,
    required this.pageSize,
    required this.total,
  });

  factory RecordPage.fromJson(Map<String, dynamic> json) => RecordPage(
    items: (json['items'] as List)
        .map((row) => ProductionRecord.fromJson(row as Map<String, dynamic>))
        .toList(),
    page: json['page'] as int,
    pageSize: json['pageSize'] as int,
    total: json['total'] as int,
  );

  final List<ProductionRecord> items;
  final int page;
  final int pageSize;
  final int total;

  bool get hasMore => page * pageSize < total;
}

/// The latest actual and the latest estimated figure of one output. They are
/// different measurements and are never added together.
class LatestProduction {
  const LatestProduction({this.actual, this.estimated});

  final ProductionRecord? actual;
  final ProductionRecord? estimated;

  bool get none => actual == null && estimated == null;
}

/// Output id → its latest figures, picked from records newest period first.
Map<String, LatestProduction> latestByOutput(
  Iterable<ProductionRecord> newestFirst,
) {
  final actual = <String, ProductionRecord>{};
  final estimated = <String, ProductionRecord>{};
  for (final record in newestFirst) {
    (record.actual ? actual : estimated).putIfAbsent(
      record.outputId,
      () => record,
    );
  }
  return {
    for (final id in {...actual.keys, ...estimated.keys})
      id: LatestProduction(actual: actual[id], estimated: estimated[id]),
  };
}

/// The newest change to [business] or to any of [figures], and who made it,
/// so "Last updated" moves when a figure is saved, not only the business.
(DateTime, ActorRef) lastChange(
  SocietyBusiness business,
  Iterable<ProductionRecord?> figures,
) {
  var when = business.updatedAt;
  var who = business.lastChangedBy;
  for (final record in figures) {
    if (record != null && record.updatedAt.isAfter(when)) {
      when = record.updatedAt;
      who = record.lastChangedBy;
    }
  }
  return (when, who);
}

/// The quantity typed for [unit], or null when it is not one: a number from 0
/// to [maxProductionQuantity] with at most the unit's decimal places. Commas
/// and spaces between digits are allowed ("3,200"); a minus sign, letters or
/// too many decimals are not, and nothing is rounded or clamped.
double? parseQuantity(String text, String unit) {
  final compact = text.trim().replaceAll(RegExp(r'[\s,]'), '');
  final decimals = productionUnits[unit] ?? 0;
  final pattern = decimals == 0
      ? RegExp(r'^\d+$')
      : RegExp('^\\d+(\\.\\d{1,$decimals})?\$');
  if (!pattern.hasMatch(compact)) return null;
  final value = double.tryParse(compact);
  if (value == null || !value.isFinite || value > maxProductionQuantity) {
    return null;
  }
  return value;
}

/// Why [text] is not a quantity for [unit], for the form's message.
enum QuantityProblem { empty, notNumber, wholeOnly, tooManyDecimals, tooLarge }

QuantityProblem? quantityProblem(String text, String unit) {
  final compact = text.trim().replaceAll(RegExp(r'[\s,]'), '');
  if (compact.isEmpty) return QuantityProblem.empty;
  if (parseQuantity(text, unit) != null) return null;
  final number = double.tryParse(compact);
  if (number == null || number < 0 || !RegExp(r'^[\d.]+$').hasMatch(compact)) {
    return QuantityProblem.notNumber;
  }
  if (number > maxProductionQuantity) return QuantityProblem.tooLarge;
  return (productionUnits[unit] ?? 0) == 0
      ? QuantityProblem.wholeOnly
      : QuantityProblem.tooManyDecimals;
}

/// A version 4 UUID, sent with a new production figure so a retried save
/// returns the record it already made instead of adding a second one.
String newClientRequestId([Random? random]) {
  final source = random ?? Random.secure();
  final bytes = List<int>.generate(16, (_) => source.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}
