// Draft edits to the society profile (SC-25 M04). Drafts never change the
// approved record; they are reviewed by the District Centre first.

import 'society.dart';

/// Where the GPS location in a draft came from.
enum LocationSource { approved, device, manual }

extension LocationSourceInfo on LocationSource {
  String get label => switch (this) {
    LocationSource.approved => 'Approved location',
    LocationSource.device => 'From this phone (demo location)',
    LocationSource.manual => 'Placed manually on the map',
  };
}

/// The editable profile fields, used for both the approved record and a draft.
class ProfileValues {
  const ProfileValues({
    required this.addressLine,
    required this.village,
    required this.phone,
    required this.email,
    required this.location,
  });

  factory ProfileValues.fromSociety(SocietyDetails society) {
    String? contact(String label, String? Function(SocietyContact) pick) {
      for (final item in society.contacts) {
        if (item.label == label) return pick(item);
      }
      return null;
    }

    return ProfileValues(
      addressLine: society.address.addressLine ?? '',
      village: society.address.village ?? '',
      phone: contact('Society phone', (item) => item.phone) ?? '',
      email: contact('Society email', (item) => item.email) ?? '',
      location: society.location,
    );
  }

  final String addressLine;
  final String village;
  final String phone;
  final String email;
  final GeoLocation? location;

  ProfileValues copyWith({
    String? addressLine,
    String? village,
    String? phone,
    String? email,
    GeoLocation? location,
  }) {
    return ProfileValues(
      addressLine: addressLine ?? this.addressLine,
      village: village ?? this.village,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      location: location ?? this.location,
    );
  }

  /// Field labels whose values differ between this and [other].
  List<String> changedFieldsComparedTo(ProfileValues other) => [
    if (addressLine != other.addressLine) ProfileField.address,
    if (village != other.village) ProfileField.village,
    if (phone != other.phone) ProfileField.phone,
    if (email != other.email) ProfileField.email,
    if (location != other.location) ProfileField.location,
  ];

  String? valueOf(String field) => switch (field) {
    ProfileField.address => addressLine,
    ProfileField.village => village,
    ProfileField.phone => phone,
    ProfileField.email => email,
    ProfileField.location => location?.label,
    _ => null,
  };
}

/// Labels for the editable profile fields.
class ProfileField {
  const ProfileField._();

  static const address = 'Address';
  static const village = 'Village or town';
  static const phone = 'Society phone';
  static const email = 'Society email';
  static const location = 'GPS location';

  static const all = [address, village, phone, email, location];
}

class ProfileEditDraft {
  const ProfileEditDraft({
    required this.values,
    required this.base,
    required this.baseVersion,
    required this.locationSource,
    required this.savedAt,
  });

  /// The officer's proposed values.
  final ProfileValues values;

  /// The approved values the draft was started from.
  final ProfileValues base;

  /// Version of the approved record the draft was started from. If the record
  /// has a newer version, the draft must be reloaded before it can be sent.
  final int baseVersion;
  final LocationSource locationSource;
  final DateTime savedAt;
}

/// Thrown when a draft is based on an older version of the society record.
class ConflictingUpdateException implements Exception {
  const ConflictingUpdateException();
}
