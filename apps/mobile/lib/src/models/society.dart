// Dart mirrors of the shared API contracts in packages/api-contracts/src/registry.ts.
// Field and enum names follow the contracts so the API can replace the demo data later.

enum SocietyStatus { active, inactive, underReview, suspended }

enum VerificationStatus { unverified, pending, verified }

class DistrictRef {
  const DistrictRef({
    required this.id,
    required this.code,
    required this.nameEn,
  });

  final String id;
  final String code;
  final String nameEn;
}

class SocietyAddress {
  const SocietyAddress({
    this.addressLine,
    this.village,
    this.gnDivision,
    this.dsDivision,
  });

  final String? addressLine;
  final String? village;
  final String? gnDivision;
  final String? dsDivision;
}

class GeoLocation {
  const GeoLocation({required this.latitude, required this.longitude});

  final double latitude;
  final double longitude;

  /// 7.4672° N, 80.0412° E
  String get label =>
      '${latitude.toStringAsFixed(4)}° N, ${longitude.toStringAsFixed(4)}° E';

  @override
  bool operator ==(Object other) =>
      other is GeoLocation &&
      other.latitude == latitude &&
      other.longitude == longitude;

  @override
  int get hashCode => Object.hash(latitude, longitude);
}

class SocietyContact {
  const SocietyContact({
    required this.id,
    this.label,
    this.fullName,
    this.position,
    this.phone,
    this.email,
    required this.isPrimary,
  });

  final String id;
  final String? label;
  final String? fullName;
  final String? position;
  final String? phone;
  final String? email;
  final bool isPrimary;
}

class SocietyDetails {
  const SocietyDetails({
    required this.id,
    required this.societyCode,
    required this.nameEn,
    this.nameLocal,
    required this.district,
    required this.status,
    required this.verificationStatus,
    required this.profileCompleteness,
    required this.updatedAt,
    this.registrationNumber,
    this.establishedOn,
    required this.address,
    this.location,
    required this.contacts,
    this.lastVerifiedOn,
    this.lastVerifiedBy,
    this.grade,
    this.dsDivision,
    this.memberCount,
    this.spcName,
    this.spcUserId,
    this.hasOpenGradeRequest = false,
  });

  final String id;
  final String societyCode;
  final String nameEn;
  final String? nameLocal;
  final DistrictRef district;
  final SocietyStatus status;
  final VerificationStatus verificationStatus;

  /// Percentage (0-100) of required profile sections that are complete.
  final int profileCompleteness;
  final DateTime updatedAt;
  final String? registrationNumber;
  final DateTime? establishedOn;
  final SocietyAddress address;
  final GeoLocation? location;
  final List<SocietyContact> contacts;
  final DateTime? lastVerifiedOn;
  final String? lastVerifiedBy;
  final String? grade;
  final String? dsDivision;
  final int? memberCount;
  final String? spcName;
  final String? spcUserId;
  final bool hasOpenGradeRequest;

  /// Copy with an updated address, location, contacts or update time.
  SocietyDetails copyWith({
    SocietyAddress? address,
    GeoLocation? location,
    List<SocietyContact>? contacts,
    DateTime? updatedAt,
    String? grade,
    String? dsDivision,
    int? memberCount,
    String? spcName,
    String? spcUserId,
    bool? hasOpenGradeRequest,
  }) {
    return SocietyDetails(
      id: id,
      societyCode: societyCode,
      nameEn: nameEn,
      nameLocal: nameLocal,
      district: district,
      status: status,
      verificationStatus: verificationStatus,
      profileCompleteness: profileCompleteness,
      updatedAt: updatedAt ?? this.updatedAt,
      registrationNumber: registrationNumber,
      establishedOn: establishedOn,
      address: address ?? this.address,
      location: location ?? this.location,
      contacts: contacts ?? this.contacts,
      lastVerifiedOn: lastVerifiedOn,
      lastVerifiedBy: lastVerifiedBy,
      grade: grade ?? this.grade,
      dsDivision: dsDivision ?? this.dsDivision,
      memberCount: memberCount ?? this.memberCount,
      spcName: spcName ?? this.spcName,
      spcUserId: spcUserId ?? this.spcUserId,
      hasOpenGradeRequest: hasOpenGradeRequest ?? this.hasOpenGradeRequest,
    );
  }

  SocietyContact? get primaryContact {
    for (final contact in contacts) {
      if (contact.isPrimary) return contact;
    }
    return null;
  }
}
