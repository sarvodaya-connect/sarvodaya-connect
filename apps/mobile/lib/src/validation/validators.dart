import '../models/committee.dart';

/// Form validators for SC-26. Each returns an error message, or null when valid.
/// Messages are written for society volunteers, not technical users.
class Validators {
  const Validators._();

  static final RegExp _namePattern = RegExp(
    r"^[\p{L}\p{M} .'\-]+$",
    unicode: true,
  );
  static final RegExp _phonePattern = RegExp(r'^(?:\+94|0)\d{9}$');
  static final RegExp _emailPattern = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

  static String? required(String? value, String label) {
    if (value == null || value.trim().isEmpty) return 'Enter the $label.';
    return null;
  }

  static String? personName(String? value) {
    final missing = required(value, 'full name');
    if (missing != null) return missing;
    final name = value!.trim();
    if (name.replaceAll(RegExp(r"[ .'\-]"), '').length < 2) {
      return 'Enter at least 2 letters.';
    }
    if (name.length > 80) return 'Use 80 characters or fewer.';
    if (!_namePattern.hasMatch(name)) {
      return 'Use letters, spaces, full stops, hyphens or apostrophes only.';
    }
    return null;
  }

  /// Sri Lankan numbers: +94 followed by 9 digits, or 0 followed by 9 digits.
  /// Spaces and hyphens are ignored. The final format is still to be confirmed by Sarvodaya.
  static String? sriLankanPhone(String? value) {
    final missing = required(value, 'phone number');
    if (missing != null) return missing;
    final digits = normalisePhone(value!);
    if (!_phonePattern.hasMatch(digits)) {
      return 'Use a Sri Lankan number, for example +94 00 000 0001.';
    }
    return null;
  }

  static String? optionalEmail(String? value) {
    if (value == null || value.trim().isEmpty) return null;
    if (!_emailPattern.hasMatch(value.trim())) {
      return 'Enter an email address like name@example.invalid.';
    }
    return null;
  }

  static String? seatType(CouncilSeatType? value) {
    if (value == null) return 'Choose the seat type.';
    return null;
  }

  /// Age is required for Child and Youth seats and must fit the seat's age range.
  static String? ageForSeat(String? value, CouncilSeatType? seatType) {
    final range = seatType?.ageRange;
    final text = value?.trim() ?? '';
    if (range == null) {
      if (text.isEmpty) return null;
      final age = int.tryParse(text);
      if (age == null || age < 7 || age > 120) {
        return 'Enter the age in years, for example 42.';
      }
      return null;
    }
    if (text.isEmpty) {
      return 'Enter the age. ${seatType!.label} seats are for ages ${range.min}–${range.max}.';
    }
    final age = int.tryParse(text);
    if (age == null) return 'Enter the age in whole years.';
    if (age < range.min || age > range.max) {
      return 'A ${seatType!.label} seat needs someone aged ${range.min}–${range.max}.';
    }
    return null;
  }

  /// The start date is required and cannot be in the future.
  static String? startDate(DateTime? value, {required DateTime today}) {
    if (value == null) return 'Choose the start date.';
    final endOfToday = DateTime(today.year, today.month, today.day, 23, 59, 59);
    if (value.isAfter(endOfToday)) {
      return 'The start date cannot be in the future.';
    }
    return null;
  }

  static String? addressLine(String? value) {
    final missing = required(value, 'address');
    if (missing != null) return missing;
    final text = value!.trim();
    if (text.length < 5) {
      return 'Enter the full address, for example No. 12, Temple Road.';
    }
    if (text.length > 120) return 'Use 120 characters or fewer.';
    return null;
  }

  static final RegExp _placePattern = RegExp(
    r"^[\p{L}\p{M}\p{N} .,'\-]+$",
    unicode: true,
  );

  static String? villageName(String? value) {
    final missing = required(value, 'village or town');
    if (missing != null) return missing;
    final text = value!.trim();
    if (text.length < 2) return 'Enter at least 2 letters.';
    if (text.length > 60) return 'Use 60 characters or fewer.';
    if (!_placePattern.hasMatch(text)) {
      return 'Use letters, numbers, spaces, commas, full stops or hyphens only.';
    }
    return null;
  }

  /// Rough bounding box of Sri Lanka, so a mistyped coordinate is caught.
  static const latitudeRange = (min: 5.8, max: 10.0);
  static const longitudeRange = (min: 79.4, max: 82.0);

  static String? latitude(String? value) =>
      _coordinate(value, 'latitude', latitudeRange, '7.4672');

  static String? longitude(String? value) =>
      _coordinate(value, 'longitude', longitudeRange, '80.0412');

  static String? _coordinate(
    String? value,
    String label,
    ({double min, double max}) range,
    String example,
  ) {
    final missing = required(value, label);
    if (missing != null) return missing;
    final number = double.tryParse(value!.trim());
    if (number == null) {
      return 'Enter the $label as a number, for example $example.';
    }
    if (number < range.min || number > range.max) {
      return 'This $label is outside Sri Lanka (${range.min}–${range.max}).';
    }
    return null;
  }

  static String? gpsLocation(Object? location) {
    if (location == null) return "Add the society's GPS location.";
    return null;
  }

  static String normalisePhone(String value) =>
      value.replaceAll(RegExp(r'[\s\-]'), '');
}
