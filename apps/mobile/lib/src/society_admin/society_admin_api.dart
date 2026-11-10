import '../auth/api_auth_service.dart';
import '../auth/auth_service.dart';
import '../society_record/society_record_api.dart' show SocietyRecordException;
import '../l10n/l10n_format.dart' show ClientFailure;

export '../society_record/society_record_api.dart' show SocietyRecordException;

/// A district HQ can create a society in.
class DistrictChoice {
  const DistrictChoice({required this.id, required this.name});

  factory DistrictChoice.fromJson(Map<String, dynamic> json) =>
      DistrictChoice(id: json['id'] as String, name: json['nameEn'] as String);

  final String id;
  final String name;
}

/// HQ's new society: its basic details only. The Exco is entered later by the
/// Society Officer HQ assigns (the API accepts a society with no Exco).
class NewSociety {
  const NewSociety({
    required this.nameEn,
    required this.societyCode,
    required this.districtId,
    required this.dsDivision,
    required this.addressLine,
    required this.memberCount,
    required this.grade,
    this.nameLocal,
    this.gnDivision,
    this.landline,
    this.businessDescription,
    this.latitude,
    this.longitude,
  });

  final String nameEn;
  final String societyCode;
  final String districtId;
  final String dsDivision;
  final String addressLine;
  final int memberCount;
  final String grade;
  final String? nameLocal;
  final String? gnDivision;
  final String? landline;
  final String? businessDescription;
  final double? latitude;
  final double? longitude;

  Map<String, dynamic> toJson() => {
    'societyCode': societyCode.trim().toUpperCase(),
    'nameEn': nameEn.trim(),
    if (nameLocal?.trim().isNotEmpty == true) 'nameLocal': nameLocal!.trim(),
    'districtId': districtId,
    'dsDivision': dsDivision.trim(),
    if (gnDivision?.trim().isNotEmpty == true) 'gnDivision': gnDivision!.trim(),
    'addressLine': addressLine.trim(),
    'memberCount': memberCount,
    if (landline?.trim().isNotEmpty == true) 'landline': landline!.trim(),
    'grade': grade,
    if (businessDescription?.trim().isNotEmpty == true)
      'businessDescription': businessDescription!.trim(),
    if (latitude != null && longitude != null) ...{
      'latitude': latitude,
      'longitude': longitude,
    },
  };
}

/// One person HQ can choose on Assign staff (V5 D05a).
class StaffChoice {
  const StaffChoice({
    required this.id,
    required this.displayName,
    required this.username,
    required this.assignedHere,
    required this.otherSocieties,
  });

  factory StaffChoice.fromJson(Map<String, dynamic> json) => StaffChoice(
    id: json['id'] as String,
    displayName: json['displayName'] as String,
    username: json['username'] as String? ?? '',
    assignedHere: json['assignedHere'] == true,
    otherSocieties: (json['otherSocieties'] as num?)?.toInt() ?? 0,
  );

  final String id;
  final String displayName;
  final String username;
  final bool assignedHere;

  /// Other societies this person looks after. A Society Officer chosen here
  /// moves from their old society.
  final int otherSocieties;
}

/// Active accounts of each role in the society's district.
class StaffChoices {
  const StaffChoices({
    required this.districtManagers,
    required this.deputies,
    required this.coordinators,
    required this.officers,
  });

  factory StaffChoices.fromJson(Map<String, dynamic> json) {
    List<StaffChoice> list(String key) => [
      for (final row in (json[key] as List?) ?? const [])
        StaffChoice.fromJson(row as Map<String, dynamic>),
    ];
    return StaffChoices(
      districtManagers: list('districtManagers'),
      deputies: list('deputies'),
      coordinators: list('coordinators'),
      officers: list('officers'),
    );
  }

  final List<StaffChoice> districtManagers;
  final List<StaffChoice> deputies;
  final List<StaffChoice> coordinators;
  final List<StaffChoice> officers;
}

/// HQ on the phone: create a society (basic details) and assign its staff,
/// the same steps as the dashboard (V5 D05n, D05a). The server allows both to
/// HQ only and checks every rule again.
abstract interface class SocietyAdminApi {
  Future<List<DistrictChoice>> fetchDistricts();

  /// Returns the new society's id.
  Future<String> createSociety(NewSociety society);
  Future<StaffChoices> fetchStaffChoices(String societyId);

  /// One DDM, one SPC and one Society Officer. Anyone whose access changes is
  /// signed out by the server.
  Future<void> assignStaff(
    String societyId, {
    required String deputyId,
    required String coordinatorId,
    required String officerId,
  });
}

class HttpSocietyAdminApi implements SocietyAdminApi {
  HttpSocietyAdminApi(this.api);

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
  Future<List<DistrictChoice>> fetchDistricts() async {
    final json = await _call('/districts') as Map<String, dynamic>;
    return [
      for (final row in json['data'] as List)
        DistrictChoice.fromJson(row as Map<String, dynamic>),
    ];
  }

  @override
  Future<String> createSociety(NewSociety society) async {
    final json = await _call(
      '/societies',
      method: 'POST',
      body: society.toJson(),
    ) as Map<String, dynamic>;
    return json['id'] as String;
  }

  @override
  Future<StaffChoices> fetchStaffChoices(String societyId) async =>
      StaffChoices.fromJson(
        await _call('/societies/$societyId/staff-options')
            as Map<String, dynamic>,
      );

  @override
  Future<void> assignStaff(
    String societyId, {
    required String deputyId,
    required String coordinatorId,
    required String officerId,
  }) async {
    await _call(
      '/societies/$societyId/assignments',
      method: 'PUT',
      body: {
        'deputyId': deputyId,
        'coordinatorId': coordinatorId,
        'officerId': officerId,
      },
    );
  }
}

/// Demonstration mode has no server to keep a new society in, so creating
/// and assigning are refused with a plain explanation rather than pretending
/// to save.
class DemoSocietyAdminApi implements SocietyAdminApi {
  const DemoSocietyAdminApi();

  static const _refused = SocietyRecordException(
    'Creating a society and assigning staff need the live server. They are not available with demonstration data.',
  );

  @override
  Future<List<DistrictChoice>> fetchDistricts() async => const [
    DistrictChoice(id: 'district-kurunegala', name: 'Kurunegala'),
  ];

  @override
  Future<String> createSociety(NewSociety society) async => throw _refused;

  @override
  Future<StaffChoices> fetchStaffChoices(String societyId) async =>
      throw _refused;

  @override
  Future<void> assignStaff(
    String societyId, {
    required String deputyId,
    required String coordinatorId,
    required String officerId,
  }) async => throw _refused;
}
