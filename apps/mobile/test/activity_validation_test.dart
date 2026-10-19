import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/models/activity_draft.dart';
import 'package:sarvodaya_connect_mobile/src/validation/activity_validators.dart';

void main() {
  final today = DateTime(2026, 10, 19);
  test('invalid data reports field-specific errors', () {
    final draft = ActivityDraft()
      ..title = ''
      ..date = '2026-02-30'
      ..location = ''
      ..sector = ''
      ..dimension = ''
      ..femaleParticipants = '-1'
      ..maleParticipants = '1.5';
    final errors = ActivityValidators.all(draft, today: today);
    expect(
      errors.keys,
      containsAll([
        'title',
        'date',
        'location',
        'sector',
        'dimension',
        'female',
        'male',
        'outcomes',
      ]),
    );
  });

  test('future activity date is rejected', () {
    final draft = ActivityDraft()
      ..title = 'Demo event'
      ..location = 'Demo village'
      ..date = '2026-10-20';
    expect(
      ActivityValidators.forStep(draft, 0, today: today)['date'],
      isNotNull,
    );
  });

  test('zero participants are rejected', () {
    final draft = ActivityDraft()
      ..femaleParticipants = '0'
      ..maleParticipants = '0'
      ..outcomes = 'Demo outcome';
    expect(
      ActivityValidators.forStep(draft, 2, today: today)['participants'],
      isNotNull,
    );
  });

  test('valid activity has no validation errors', () {
    final draft = ActivityDraft()
      ..title = 'Demo clean-up'
      ..activityType = 'Work camp'
      ..description = 'Clean-up of the fictional village.'
      ..gpsLocation = '7.4891 N, 80.3612 E'
      ..date = '2026-10-18'
      ..location = 'Fictional village'
      ..sector = 'Approved sector name'
      ..dimension = 'Social'
      ..femaleParticipants = '12'
      ..maleParticipants = '8'
      ..outcomes = '20 volunteers cleaned a fictional site.';
    expect(ActivityValidators.all(draft, today: today), isEmpty);
  });

  test('draft persists in a session until cleared', () {
    final session = Object();
    ActivityDraftRegistry.forStore(session).title = 'Saved draft';
    expect(ActivityDraftRegistry.forStore(session).title, 'Saved draft');
    ActivityDraftRegistry.clear(session);
    expect(ActivityDraftRegistry.forStore(session).title, isEmpty);
  });
}
