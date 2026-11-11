import '../auth/api_auth_service.dart';
import '../auth/auth_service.dart';
import '../l10n/l10n_format.dart' show ClientFailure;
import '../society_record/society_record_api.dart' show SocietyRecordException;
import 'national_models.dart';

export '../society_record/society_record_api.dart' show SocietyRecordException;

/// Boundary between the HQ phone screens (M05h, M61–M69) and the API. The
/// server allows the national figures to HQ only and scopes the directory
/// and society summary to each user; these screens only show what it returns.
abstract interface class NationalApi {
  Future<NationalOverview> fetchOverview();
  Future<List<DistrictFigures>> fetchDistricts();
  Future<SocietyMapData> fetchMap();
  Future<DirectoryPage> fetchDirectory(DirectoryQuery query);
  Future<SocietyAtAGlance> fetchSociety(String id);
  Future<NationalProgrammes> fetchProgrammes({int? year});

  /// Issue #117: M64 for a DM, DDM or SPC, over the societies the server
  /// lets them count. HQ uses [fetchProgrammes].
  Future<NationalProgrammes> fetchScopedProgrammes({int? year});
  Future<FiguresNotAdded> fetchFiguresNotAdded();
}

class HttpNationalApi implements NationalApi {
  HttpNationalApi(this.api);

  final IdentityApi api;

  Future<Json> _get(String path) async {
    try {
      return await api.request(path) as Json;
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
  Future<NationalOverview> fetchOverview() async =>
      NationalOverview.fromJson(await _get('/national/overview'));

  @override
  Future<List<DistrictFigures>> fetchDistricts() async {
    final json = await _get('/national/districts');
    return [
      for (final row in json['data'] as List)
        DistrictFigures.fromJson(row as Json),
    ];
  }

  @override
  Future<SocietyMapData> fetchMap() async =>
      SocietyMapData.fromJson(await _get('/national/map'));

  @override
  Future<DirectoryPage> fetchDirectory(DirectoryQuery query) async {
    final params = {
      'pageSize': '50',
      if (query.search.isNotEmpty) 'q': query.search,
      if (query.districtId != null) 'districtId': query.districtId!,
      if (query.grade != null) 'grade': query.grade!,
      if (query.notUpdated) 'view': 'not-updated',
    };
    return DirectoryPage.fromJson(
      await _get('/society-directory?${Uri(queryParameters: params).query}'),
    );
  }

  @override
  Future<SocietyAtAGlance> fetchSociety(String id) async =>
      SocietyAtAGlance.fromJson(await _get('/societies/$id/summary'));

  @override
  Future<NationalProgrammes> fetchProgrammes({int? year}) async =>
      NationalProgrammes.fromJson(
        await _get('/national/programmes${year == null ? '' : '?year=$year'}'),
      );

  @override
  Future<NationalProgrammes> fetchScopedProgrammes({int? year}) async =>
      NationalProgrammes.fromJson(
        await _get('/programmes${year == null ? '' : '?year=$year'}'),
      );

  @override
  Future<FiguresNotAdded> fetchFiguresNotAdded() async =>
      FiguresNotAdded.fromJson(await _get('/national/finance?pageSize=20'));
}
