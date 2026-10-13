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

  SocietyContact? get primaryContact {
    for (final contact in contacts) {
      if (contact.isPrimary) return contact;
    }
    return null;
  }
}
