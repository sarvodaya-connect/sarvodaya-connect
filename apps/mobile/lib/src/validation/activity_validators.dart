import '../models/activity_draft.dart';

/// Validation for the four M09 steps. Keys match form-field identifiers.
class ActivityValidators {
  static Map<String, String> forStep(
    ActivityDraft draft,
    int step, {
    required DateTime today,
  }) {
    final errors = <String, String>{};
    if (step == 0) {
      if (draft.title.trim().isEmpty) {
        errors['title'] = 'Enter an activity name.';
      }
      if (draft.activityType.trim().isEmpty) {
        errors['activityType'] = 'Choose an activity type.';
      }
      if (draft.description.trim().isEmpty) {
        errors['description'] = 'Enter a short description.';
      }
      if (draft.gpsLocation.trim().isEmpty) {
        errors['gpsLocation'] = 'Enter the GPS location.';
      } else if (!isValidGpsCoordinates(draft.gpsLocation)) {
        errors['gpsLocation'] = 'Use latitude, longitude (e.g. 6.9271, 79.8612 or 7.4891 N, 80.3612 E). Latitude must be -90 to 90 and longitude -180 to 180.';
      }
      if (draft.location.trim().isEmpty) {
        errors['location'] = 'Enter the activity location.';
      }
      if (draft.date.trim().isEmpty) {
        errors['date'] = 'Choose an activity date.';
      } else {
        final value = draft.date.trim();
        final parsed = DateTime.tryParse(value);
        final validFormat = RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(value);
        if (!validFormat || parsed == null || _isoDate(parsed) != value) {
          errors['date'] = 'Use a valid date (YYYY-MM-DD).';
        } else {
          final current = DateTime(today.year, today.month, today.day);
          if (parsed.isAfter(current)) {
            errors['date'] = 'Activity date cannot be in the future.';
          }
        }
      }
    } else if (step == 1) {
      if (draft.sector.trim().isEmpty) {
        errors['sector'] = 'Enter the Sarvodaya sector.';
      }
      if (!const [
        'Social',
        'Economic',
        'Governance',
      ].contains(draft.dimension)) {
        errors['dimension'] = 'Choose an activity dimension.';
      }
    } else if (step == 2) {
      final female = _count(draft.femaleParticipants, 'female', errors);
      final male = _count(draft.maleParticipants, 'male', errors);
      if (female != null && male != null && female + male == 0) {
        errors['participants'] = 'Enter at least one participant.';
      }
      if (draft.outcomes.trim().isEmpty) {
        errors['outcomes'] = 'Describe the activity outcomes.';
      }
    }
    return errors;
  }

  static Map<String, String> all(
    ActivityDraft draft, {
    required DateTime today,
  }) {
    final errors = <String, String>{};
    for (var i = 0; i < 3; i++) {
      errors.addAll(forStep(draft, i, today: today));
    }
    return errors;
  }

  /// Accept decimal latitude/longitude or coordinates with compass directions.
  static bool isValidGpsCoordinates(String input) {
    final text = input.trim();
    final decimal = RegExp(
      r'^([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))$',
    );
    final compass = RegExp(
      r'^(\d+(?:\.\d+)?)\s*([NS])\s*,\s*(\d+(?:\.\d+)?)\s*([EW])$',
      caseSensitive: false,
    );
    final match = decimal.firstMatch(text) ?? compass.firstMatch(text);
    if (match == null) return false;
    final latitude = double.tryParse(match.group(1)!);
    final longitude = double.tryParse(
      match.groupCount == 4 ? match.group(3)! : match.group(2)!,
    );
    return latitude != null &&
        longitude != null &&
        latitude.isFinite &&
        longitude.isFinite &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180;
  }

  static int? _count(String value, String field, Map<String, String> errors) {
    final normalized = value.trim();
    final number = int.tryParse(normalized);
    if (!RegExp(r'^\d+$').hasMatch(normalized) ||
        number == null ||
        number < 0 ||
        number > 1000000) {
      errors[field] = 'Enter a whole number from 0 to 1,000,000.';
      return null;
    }
    return number;
  }

  static String _isoDate(DateTime date) =>
      '${date.year.toString().padLeft(4, '0')}-'
      '${date.month.toString().padLeft(2, '0')}-'
      '${date.day.toString().padLeft(2, '0')}';
}
