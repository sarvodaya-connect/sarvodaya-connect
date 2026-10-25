import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sarvodaya_connect_mobile/src/models/submission.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/services/submission_api_client.dart';

Map<String, Object?> sample({
  String status = 'SUBMITTED',
  int version = 2,
  List<Map<String, Object?>> changes = const [],
  List<Map<String, Object?>> reviews = const [],
  List<Map<String, Object?>> events = const [],
}) => {
  'id': 'f7cdf50d-2f7d-4e06-ac47-72319175e078',
  'reference': 'SUB-00004',
  'societyId': '29000000-0000-4000-8000-000000000101',
  'type': 'COUNCIL_UPDATE',
  'title': 'Treasurer change',
  'submittedBy': 'demo-officer-sunrise',
  'status': status,
  'version': version,
  'correctionStatus': 'NONE',
  'changes': changes,
  'documents': <Object?>[],
  'reviews': reviews,
  'events': events,
  'updatedAt': '2026-10-24T15:18:09.635Z',
};

http.Response json(Object? body, [int status = 200]) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json'},
);

SocietySubmission parsed({String status = 'SUBMITTED', int version = 2}) =>
    submissionFromJson(sample(status: status, version: version));

void main() {
  const base = 'http://test/api/v1';

  test('maps a returned submission with per-field comments', () {
    final submission = submissionFromJson(
      sample(
        status: 'CHANGES_REQUESTED',
        version: 4,
        changes: [
          {
            'field': 'treasurer.fullName',
            'label': 'Treasurer',
            'previousValue': 'A',
            'proposedValue': 'B',
            'correctionStatus': 'REQUIRED',
            'reviewerComment': 'Use full legal name',
          },
        ],
        reviews: [
          {
            'id': 'r1',
            'reviewerUserId': 'demo-dm-north',
            'reviewerDisplayName': 'Demo District Manager',
            'decision': 'CHANGES_REQUESTED',
            'decidedAt': '2026-10-24T15:18:09.696Z',
          },
        ],
        events: [
          {
            'id': 'e1',
            'action': 'REQUEST_CHANGES',
            'fromStatus': 'UNDER_REVIEW',
            'toStatus': 'CHANGES_REQUESTED',
            'actorId': 'demo-dm-north',
            'actorDisplayName': 'Demo District Manager',
            'createdAt': '2026-10-24T15:18:09.696Z',
          },
        ],
      ),
    );

    expect(submission.version, 4);
    expect(submission.status, SubmissionStatus.changesRequested);
    expect(submission.isLocked, isFalse);
    expect(
      submission.changes.single.correctionStatus,
      CorrectionStatus.required,
    );
    expect(submission.changes.single.reviewerComment, 'Use full legal name');
    expect(submission.latestReview!.comment, contains('Use full legal name'));
    expect(submission.latestReview!.field, 'treasurer.fullName');
    expect(submission.timeline.last.title, 'Changes Requested');
  });

  test('maps every status and locks the ones waiting for review', () {
    for (final entry in {
      'DRAFT': SubmissionStatus.draft,
      'SUBMITTED': SubmissionStatus.submitted,
      'UNDER_REVIEW': SubmissionStatus.underReview,
      'CHANGES_REQUESTED': SubmissionStatus.changesRequested,
      'RESUBMITTED': SubmissionStatus.resubmitted,
      'APPROVED': SubmissionStatus.approved,
      'REJECTED': SubmissionStatus.rejected,
    }.entries) {
      expect(parsed(status: entry.key).status, entry.value);
    }
    expect(parsed(status: 'UNDER_REVIEW').isLocked, isTrue);
    expect(parsed(status: 'APPROVED').isLocked, isFalse);
    expect(() => parsed(status: 'NOPE'), throwsFormatException);
  });

  test('list sends the demo user header and parses the page', () async {
    late http.Request seen;
    final api = SubmissionApiClient(
      baseUrl: base,
      client: MockClient((request) async {
        seen = request;
        return json({
          'data': [sample()],
          'meta': {'page': 1},
        });
      }),
    );

    final result = await api.list(UserRole.societyOfficer);

    expect(seen.method, 'GET');
    expect(seen.url.path, '/api/v1/submissions');
    expect(seen.headers['X-Demo-User'], 'demo-officer-sunrise');
    expect(result.single.reference, 'SUB-00004');
  });

  test('createDraft posts the changes in API format', () async {
    late Map<String, dynamic> sent;
    final api = SubmissionApiClient(
      baseUrl: base,
      client: MockClient((request) async {
        sent = jsonDecode(request.body) as Map<String, dynamic>;
        return json(sample(status: 'DRAFT', version: 1), 201);
      }),
    );

    final draft = await api.createDraft(
      societyId: '29000000-0000-4000-8000-000000000101',
      type: SubmissionType.councilUpdate,
      title: 'Treasurer change',
      changes: const [
        SubmissionChange(
          field: 'treasurer.fullName',
          label: 'Treasurer',
          previousValue: 'A',
          proposedValue: 'B',
        ),
      ],
    );

    expect(sent['type'], 'COUNCIL_UPDATE');
    expect((sent['changes'] as List).single['proposedValue'], 'B');
    expect(draft.status, SubmissionStatus.draft);
  });

  test('submit and resubmit send the version the officer last saw', () async {
    final bodies = <String, Map<String, dynamic>>{};
    final api = SubmissionApiClient(
      baseUrl: base,
      client: MockClient((request) async {
        bodies[request.url.path] =
            jsonDecode(request.body) as Map<String, dynamic>;
        return json(sample());
      }),
    );
    final submission = parsed(status: 'CHANGES_REQUESTED', version: 4);

    await api.submit(submission);
    await api.resubmit(submission, {'treasurer.fullName': 'B Perera'});

    expect(bodies['/api/v1/submissions/${submission.id}/submit'], {
      'version': 4,
    });
    final resubmit = bodies['/api/v1/submissions/${submission.id}/resubmit']!;
    expect(resubmit['version'], 4);
    expect(resubmit['corrections'], [
      {'field': 'treasurer.fullName', 'correctedValue': 'B Perera'},
    ]);
  });

  test(
    'a stale version surfaces as a conflict with the server message',
    () async {
      final api = SubmissionApiClient(
        baseUrl: base,
        client: MockClient(
          (_) async => json({
            'message': 'This submission changed since you opened it',
          }, 409),
        ),
      );

      await expectLater(
        api.submit(parsed()),
        throwsA(
          isA<SubmissionApiException>()
              .having((e) => e.isConflict, 'isConflict', isTrue)
              .having((e) => e.message, 'message', contains('changed')),
        ),
      );
    },
  );

  test('network failures are reported without a status code', () async {
    final api = SubmissionApiClient(
      baseUrl: base,
      client: MockClient((_) async => throw http.ClientException('down')),
    );

    await expectLater(
      api.list(UserRole.societyOfficer),
      throwsA(
        isA<SubmissionApiException>().having(
          (e) => e.isNetwork,
          'isNetwork',
          isTrue,
        ),
      ),
    );
  });
}
