import '../auth/api_auth_service.dart';
import '../auth/auth_service.dart';
import '../l10n/l10n_format.dart' show ClientFailure;
import '../society_record/society_record_api.dart' show SocietyRecordException;
import 'economy_models.dart';

export '../society_record/society_record_api.dart' show SocietyRecordException;

/// A new business. [otherIndustry] only for the OTHER industry.
class BusinessInput {
  const BusinessInput({
    required this.name,
    required this.industry,
    this.otherIndustry,
    this.description,
    this.status = 'OPERATING',
  });

  final String name;
  final String industry;
  final String? otherIndustry;
  final String? description;
  final String status;

  Map<String, Object?> toJson() => {
    'name': name,
    'industry': industry,
    'otherIndustry': industry == 'OTHER' ? otherIndustry : null,
    'description': description,
    'status': status,
  };
}

/// A product or service of a business. [unit] is only sent for OTHER; a
/// standard product always uses its own unit.
class OutputInput {
  const OutputInput({required this.product, this.otherDescription, this.unit});

  final String product;
  final String? otherDescription;
  final String? unit;

  Map<String, Object?> toJson() => {
    'product': product,
    if (product == 'OTHER') ...{
      'otherDescription': otherDescription,
      'unit': unit,
    },
  };
}

/// A new production figure. [clientRequestId] stays the same for every retry
/// of one save, so the API returns the record it already made.
class ProductionInput {
  const ProductionInput({
    required this.clientRequestId,
    required this.period,
    required this.measurement,
    required this.quantity,
    this.note,
    this.source,
  });

  final String clientRequestId;
  final ProductionPeriod period;
  final String measurement;
  final double quantity;
  final String? note;
  final String? source;

  Map<String, Object?> toJson() => {
    'clientRequestId': clientRequestId,
    'basis': period.basis,
    'startsOn': formatDay(period.startsOn),
    'endsOn': formatDay(period.endsOn),
    'seasonLabel': period.basis == 'SEASONAL' ? period.seasonLabel : null,
    'measurement': measurement,
    'quantity': quantity,
    'note': note,
    'source': source,
  };
}

/// A correction: the figure, and for a season its name, note and source.
/// The period, measurement and output never change.
class ProductionCorrection {
  const ProductionCorrection({
    required this.version,
    required this.quantity,
    this.seasonLabel,
    this.note,
    this.source,
  });

  final int version;
  final double quantity;
  final String? seasonLabel;
  final String? note;
  final String? source;

  Map<String, Object?> toJson(String basis) => {
    'version': version,
    'quantity': quantity,
    if (basis == 'SEASONAL') 'seasonLabel': seasonLabel,
    // Empty text clears a saved note or source.
    'note': note ?? '',
    'source': source ?? '',
  };
}

/// The saved record, and whether this save made it (false: a retry of a save
/// that had already reached the server, so nothing was added).
class SavedProduction {
  const SavedProduction(this.record, {required this.created});

  final ProductionRecord record;
  final bool created;
}

/// Issue #146: the phone's boundary to the Village Economic Profile API
/// (#145). The server decides every permission and rule;
/// [HttpEconomyApi] talks to it and `DemoEconomyApi` mirrors it with
/// fictional data. Failures are [SocietyRecordException]s, so the record
/// screens show them the same way: 404 outside the caller's scope, 403 for a
/// write the caller may not make, 409 for a conflict.
abstract interface class EconomyApi {
  /// The society's businesses and outputs, each output with its latest actual
  /// and estimate worked out by the API from the whole history.
  Future<EconomicProfile> fetchProfile(String societyId);

  Future<SocietyBusiness> createBusiness(String societyId, BusinessInput input);

  /// Only the fields in [changes] change; [version] is the one the form
  /// opened, so a change made elsewhere since then is refused with 409.
  Future<SocietyBusiness> updateBusiness(
    String businessId,
    int version,
    Map<String, Object?> changes,
  );

  Future<BusinessOutput> createOutput(String businessId, OutputInput input);

  Future<BusinessOutput> setOutputArchived(
    String outputId, {
    required int version,
    required bool archived,
  });

  /// One output's records, newest period first.
  Future<RecordPage> fetchRecords(
    String outputId, {
    int page = 1,
    int pageSize = 20,
  });

  Future<SavedProduction> createRecord(String outputId, ProductionInput input);

  Future<ProductionRecord> correctRecord(
    ProductionRecord record,
    ProductionCorrection correction,
  );

  Future<ProductionHistory> fetchHistory(String recordId);
}

class HttpEconomyApi implements EconomyApi {
  HttpEconomyApi(this.api);

  final IdentityApi api;

  Future<dynamic> _call(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) async {
    try {
      return await api.request(path, method: method, body: body);
    } on IdentityError catch (error) {
      throw SocietyRecordException(error.message, status: error.status);
    } on AuthNetworkException {
      throw const SocietyRecordException(
        'The server did not answer. Check your connection and try again.',
        offline: true,
        failure: ClientFailure.offline,
      );
    } on AuthServiceException {
      throw const SocietyRecordException(
        'Something went wrong on the server. Try again.',
        failure: ClientFailure.server,
      );
    }
  }

  @override
  Future<EconomicProfile> fetchProfile(String societyId) async =>
      EconomicProfile.fromJson(
        await _call('/societies/$societyId/economic-profile')
            as Map<String, dynamic>,
      );

  @override
  Future<SocietyBusiness> createBusiness(
    String societyId,
    BusinessInput input,
  ) async => SocietyBusiness.fromJson(
    await _call(
      '/societies/$societyId/businesses',
      method: 'POST',
      body: input.toJson(),
    ) as Map<String, dynamic>,
  );

  @override
  Future<SocietyBusiness> updateBusiness(
    String businessId,
    int version,
    Map<String, Object?> changes,
  ) async => SocietyBusiness.fromJson(
    await _call(
      '/businesses/$businessId',
      method: 'PATCH',
      body: {...changes, 'version': version},
    ) as Map<String, dynamic>,
  );

  @override
  Future<BusinessOutput> createOutput(
    String businessId,
    OutputInput input,
  ) async => BusinessOutput.fromJson(
    await _call(
      '/businesses/$businessId/outputs',
      method: 'POST',
      body: input.toJson(),
    ) as Map<String, dynamic>,
  );

  @override
  Future<BusinessOutput> setOutputArchived(
    String outputId, {
    required int version,
    required bool archived,
  }) async => BusinessOutput.fromJson(
    await _call(
      '/business-outputs/$outputId',
      method: 'PATCH',
      body: {'version': version, 'archived': archived},
    ) as Map<String, dynamic>,
  );

  @override
  Future<RecordPage> fetchRecords(
    String outputId, {
    int page = 1,
    int pageSize = 20,
  }) async => RecordPage.fromJson(
    await _call(
      '/business-outputs/$outputId/production-records?page=$page&pageSize=$pageSize',
    ) as Map<String, dynamic>,
  );

  @override
  Future<SavedProduction> createRecord(
    String outputId,
    ProductionInput input,
  ) async {
    final data = await _call(
      '/business-outputs/$outputId/production-records',
      method: 'POST',
      body: input.toJson(),
    ) as Map<String, dynamic>;
    return SavedProduction(
      ProductionRecord.fromJson(data['record'] as Map<String, dynamic>),
      created: data['created'] == true,
    );
  }

  @override
  Future<ProductionRecord> correctRecord(
    ProductionRecord record,
    ProductionCorrection correction,
  ) async {
    final data = await _call(
      '/production-records/${record.id}',
      method: 'PATCH',
      body: correction.toJson(record.period.basis),
    ) as Map<String, dynamic>;
    return ProductionRecord.fromJson(data['record'] as Map<String, dynamic>);
  }

  @override
  Future<ProductionHistory> fetchHistory(String recordId) async {
    final data = await _call(
      '/production-records/$recordId/history',
    ) as Map<String, dynamic>;
    return ProductionHistory(
      record: ProductionRecord.fromJson(data['record'] as Map<String, dynamic>),
      revisions: (data['revisions'] as List)
          .map(
            (row) => ProductionRevision.fromJson(row as Map<String, dynamic>),
          )
          .toList(),
    );
  }
}
