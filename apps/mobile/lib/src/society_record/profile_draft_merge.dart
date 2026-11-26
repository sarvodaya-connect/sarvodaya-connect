import 'society_record_models.dart';

/// Issue #127: the M06e fields a profile draft keeps, as the form shows them.
/// The location is one field, "latitude,longitude", or empty.
const profileDraftFields = [
  'nameEn',
  'femaleMembers',
  'maleMembers',
  'addressLine',
  'landline',
  'businessDescription',
  'location',
];

/// The record's values for [profileDraftFields], as the form shows them.
Map<String, String> profileValuesOf(SocietyRecord record) => {
  'nameEn': record.nameEn,
  'femaleMembers': record.femaleMembers?.toString() ?? '',
  'maleMembers': record.maleMembers?.toString() ?? '',
  'addressLine': record.addressLine ?? '',
  'landline': record.landline ?? '',
  'businessDescription': record.businessDescription ?? '',
  'location': record.latitude == null || record.longitude == null
      ? ''
      : '${record.latitude},${record.longitude}',
};

/// What the Reload Record flow does with a draft and the newer record.
class ProfileMerge {
  const ProfileMerge({
    required this.base,
    required this.values,
    required this.conflicts,
    required this.tookNewer,
  });

  /// The newer record's values: what the draft is now compared with.
  final Map<String, String> base;

  /// The form's values after the merge.
  final Map<String, String> values;

  /// Fields the person edited that also changed on the server to something
  /// else. The person's value is kept and marked for review.
  final Set<String> conflicts;

  /// Fields the person left alone that changed on the server: the newer
  /// value is taken.
  final Set<String> tookNewer;

  bool get changedOnServer => conflicts.isNotEmpty || tookNewer.isNotEmpty;
}

/// Restores the earlier Reload Record behaviour (PR #53): the person's edits
/// are kept, newer values are taken for fields they did not touch, and fields
/// edited on both sides are flagged for review. Nothing newer on the server
/// is overwritten without the person seeing it.
ProfileMerge mergeProfileDraft({
  required Map<String, String> base,
  required Map<String, String> values,
  required Map<String, String> latest,
}) {
  final merged = <String, String>{};
  final conflicts = <String>{};
  final tookNewer = <String>{};
  for (final field in profileDraftFields) {
    final was = base[field] ?? '';
    final mine = values[field] ?? was;
    final now = latest[field] ?? '';
    if (now == was || mine == now) {
      merged[field] = mine;
    } else if (mine == was) {
      merged[field] = now;
      tookNewer.add(field);
    } else {
      merged[field] = mine;
      conflicts.add(field);
    }
  }
  return ProfileMerge(
    base: {for (final field in profileDraftFields) field: latest[field] ?? ''},
    values: merged,
    conflicts: conflicts,
    tookNewer: tookNewer,
  );
}
