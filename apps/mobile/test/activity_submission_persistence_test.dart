import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/models/activity_draft.dart';
import 'package:sarvodaya_connect_mobile/src/models/submission.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/validation/activity_validators.dart';

import 'test_helpers.dart';

ActivityDraft validActivity() => ActivityDraft()
  ..title = 'Fictional work camp'
  ..date = '2026-10-12'
  ..location = 'Demo village'
  ..gpsLocation = '7.4891 N, 80.3612 E'
  ..activityType = 'Shramadana work camp'
  ..description = 'A fictional community activity'
  ..sector = 'Demo sector'
  ..dimension = 'Social'
  ..femaleParticipants = '14'
  ..maleParticipants = '9'
  ..outcomes = 'Fictional results only'
  ..supportingInformation = 'Demo meeting notes';

void main() {
  test(
    'valid activity submission retains every field and can be fetched by id',
    () {
      final store = testStore()..switchDemoRole(UserRole.societyOfficer);
      final draft = validActivity();
      final reference = store.submitActivityReport(draft);
      final submission = store.submissions.firstWhere(
        (s) => s.reference == reference,
      );
      final fetched = store.submissionById(submission.id);
      expect(fetched, isNotNull);
      expect(fetched!.type, SubmissionType.activityReport);
      expect(fetched.status, SubmissionStatus.submitted);
      final report = fetched.activityReport!;
      expect(report.title, 'Fictional work camp');
      expect(report.date, '2026-10-12');
      expect(report.location, 'Demo village');
      expect(report.gpsLocation, '7.4891 N, 80.3612 E');
      expect(report.activityType, 'Shramadana work camp');
      expect(report.description, 'A fictional community activity');
      expect(report.sector, 'Demo sector');
      expect(report.dimension, 'Social');
      expect(report.femaleParticipants, '14');
      expect(report.maleParticipants, '9');
      expect(report.outcomes, 'Fictional results only');
      expect(report.supportingInformation, 'Demo meeting notes');
      ActivityDraftRegistry.clear(store);
      expect(ActivityDraftRegistry.forStore(store).title, isEmpty);
      expect(
        fetched.copyWith(status: SubmissionStatus.underReview).activityReport,
        same(report),
      );
      draft.title = 'Changed after submission';
      draft.gpsLocation = '0, 0';
      expect(
        store.submissionById(submission.id)!.activityReport!.title,
        'Fictional work camp',
      );
      expect(
        store.submissionById(submission.id)!.activityReport!.gpsLocation,
        '7.4891 N, 80.3612 E',
      );
    },
  );

  test(
    'valid signed and compass GPS; reject malformed and out-of-range GPS',
    () {
      for (final good in [
        '6.9271, 79.8612',
        '-90, +180',
        '7.4891 N, 80.3612 E',
        '0 S, 0 W',
      ]) {
        expect(
          ActivityValidators.isValidGpsCoordinates(good),
          isTrue,
          reason: good,
        );
      }
      for (final bad in [
        '91, 0',
        '-91, 0',
        '0, 181',
        '0, -181',
        '7.2 N, 80.1 N',
        '7.2, 80.1 E',
        'north, east',
        '7.2 80.1',
        '',
      ]) {
        expect(
          ActivityValidators.isValidGpsCoordinates(bad),
          isFalse,
          reason: bad,
        );
      }
      final store = testStore()..switchDemoRole(UserRole.societyOfficer);
      final draft = validActivity()..gpsLocation = '95.55, 181';
      final before = store.submissions.length;
      expect(
        ActivityValidators.forStep(draft, 0, today: demoNow)['gpsLocation'],
        isNotNull,
      );
      expect(() => store.submitActivityReport(draft), throwsStateError);
      expect(store.submissions.length, before);
      expect(draft.gpsLocation, '95.55, 181');
    },
  );

  test('role restriction prevents district manager and HQ submissions', () {
    final store = testStore();
    final before = store.submissions.length;
    for (final role in [UserRole.districtManager, UserRole.hqAdmin]) {
      store.switchDemoRole(role);
      expect(
        () => store.submitActivityReport(validActivity()),
        throwsStateError,
      );
    }
    expect(store.submissions.length, before);
  });

  test(
    'offline restriction prevents submissions and keeps draft unchanged',
    () {
      final store = testStore()..switchDemoRole(UserRole.societyOfficer);
      store.setDemoOptions(offline: true);
      final draft = validActivity();
      final before = store.submissions.length;
      expect(() => store.submitActivityReport(draft), throwsStateError);
      expect(store.submissions.length, before);
      expect(draft.outcomes, 'Fictional results only');
    },
  );
}
