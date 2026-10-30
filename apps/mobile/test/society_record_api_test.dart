import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sarvodaya_connect_mobile/src/auth/api_auth_service.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_api.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_models.dart';

const _base = 'http://api.test/api/v1';
const _id = '29000000-0000-4000-8000-000000000101';

/// A society record as the API returns it (SC-65).
Map<String, dynamic> _recordJson() => {
  'id': _id,
  'societyCode': 'S-104233',
  'nameEn': 'Pahala Kosgama SSS',
  'district': {'id': 'd', 'code': 'KG', 'nameEn': 'Kurunegala'},
  'status': 'ACTIVE',
  'address': {'addressLine': 'Temple Road', 'dsDivision': 'Kuliyapitiya East'},
  'location': {'latitude': 7.4672, 'longitude': 80.0412},
  'committee': [
    {
      'id': 'm1',
      'seatNumber': 1,
      'fullName': 'A. Jayasekara',
      'position': 'President',
      'isActive': true,
      'nicMasked': '••••0047',
    },
    {
      'id': 'm2',
      'seatNumber': 2,
      'fullName': 'Former member',
      'position': 'Member',
      'isActive': false,
    },
  ],
  'memberCount': 418,
  'landline': '037 000 0123',
  'businessDescription': 'A small rice mill.',
  'grade': 'B',
  'gradeChangedAt': '2025-03-12T05:50:00.000Z',
  'gradeChangedBy': {'displayName': 'D. Gunawardena', 'role': 'HQ_ADMIN'},
  'openGradeRequest': {
    'id': 'r1',
    'societyId': _id,
    'fromGrade': 'B',
    'toGrade': 'A',
    'reason': 'The Exco was re-formed.',
    'status': 'PENDING',
    'requestedBy': {
      'displayName': 'S. Karunaratne',
      'role': 'PROGRAMME_COORDINATOR',
    },
    'requestedAt': '2026-10-24T10:10:00.000Z',
  },
  'staff': [
    {
      'role': 'SOCIETY_OFFICER',
      'displayName': 'N. Wijesinghe',
      'accountStatus': 'ACTIVE',
    },
  ],
  'annualSummary': {
    'societyId': _id,
    'financialYear': {
      'startYear': 2025,
      'label': 'FY 2025/26',
      'startsOn': '2025-04-01',
      'endsOn': '2026-03-31',
    },
    'totalProfit': 412500.5,
    'totalExpenses': null,
    'profitChange': {
      'updatedAt': '2026-10-22T10:40:00.000Z',
      'updatedBy': {'displayName': 'N. Wijesinghe', 'role': 'SOCIETY_OFFICER'},
      'previousValue': 398000,
    },
    'auditReport': null,
  },
  'permissions': {
    'canEdit': false,
    'canRequestGradeChange': false,
    'canEditAnnualSummary': false,
    'canUploadAuditReport': false,
    'canUploadDocuments': false,
    'viewOnlyReason': 'TEMPORARY_DISTRICT_ACCESS',
    'viewOnlyUntil': '2026-10-31T12:30:00.000Z',
  },
  'lastChange': {
    'at': '2026-10-30T04:32:00.000Z',
    'by': {'displayName': 'N. Wijesinghe', 'role': 'SOCIETY_OFFICER'},
  },
};

void main() {
  test('reads the V4 society record from the API', () async {
    final api = HttpSocietyRecordApi(
      IdentityApi(
        baseUrl: _base,
        client: MockClient(
          (request) async => http.Response.bytes(
            utf8.encode(jsonEncode(_recordJson())),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          ),
        ),
      )..token = 'session',
    );
    final record = await api.fetchRecord(_id);

    expect(record.grade, 'B');
    expect(record.memberCount, 418);
    expect(record.openGradeRequest!.change, 'B → A');
    expect(record.openGradeRequest!.requestedBy.label, 'S. Karunaratne (SPC)');
    expect(record.exco.map((member) => member.fullName), ['A. Jayasekara']);
    expect(record.annualSummary.totalProfit, 412500.5);
    expect(record.annualSummary.figuresAdded, isFalse);
    expect(record.annualSummary.profitChange!.previousValue, 398000);
    expect(
      record.permissions.viewOnlyReason,
      ViewOnlyReason.temporaryDistrictAccess,
    );
    expect(
      record.staffWithRole(UserRole.societyOfficer)!.displayName,
      'N. Wijesinghe',
    );
    expect(record.lastChangeBy!.label, 'N. Wijesinghe (Society Officer)');
  });

  test('uploads the audit report through the signed link and confirms it', () async {
    final calls = <String>[];
    final client = MockClient((request) async {
      calls.add('${request.method} ${request.url.path}');
      if (request.url.path.endsWith('/documents') && request.method == 'POST') {
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body, containsPair('documentType', 'AUDIT_REPORT'));
        expect(body, containsPair('financialYear', 2025));
        expect(body, containsPair('sizeBytes', 3));
        expect(request.headers['authorization'], 'Bearer session');
        return http.Response(
          jsonEncode({
            'document': {'id': 'doc-1'},
            'upload': {
              'method': 'PUT',
              'url': 'http://api.test/api/v1/storage/local/signed-token',
              'headers': {'Content-Type': 'application/pdf'},
            },
          }),
          201,
        );
      }
      if (request.url.path.endsWith('/complete')) {
        return http.Response(
          jsonEncode({
            'id': 'doc-1',
            'documentType': 'AUDIT_REPORT',
            'title': 'Audit report FY 2025/26',
            'fileName': 'audit.pdf',
            'sizeBytes': 3,
            'uploadedBy': 'N. Wijesinghe',
            'uploadedByRole': 'SOCIETY_OFFICER',
            'uploadedAt': '2026-10-30T04:32:00.000Z',
            'financialYear': {'startYear': 2025, 'label': 'FY 2025/26'},
          }),
          200,
        );
      }
      return http.Response('{}', 404);
    });
    final uploads = <String>[];
    final progress = <double>[];
    final api = HttpSocietyRecordApi(
      IdentityApi(baseUrl: _base, client: client)..token = 'session',
      uploadClient: MockClient.streaming((request, body) async {
        uploads.add(
          '${request.method} ${request.url.path} ${request.headers['Content-Type']}',
        );
        expect(await body.expand((chunk) => chunk).toList(), [1, 2, 3]);
        return http.StreamedResponse(const Stream.empty(), 200);
      }),
    );

    final document = await api.uploadAuditReport(
      _id,
      financialYear: 2025,
      file: const PickedDocument(
        name: 'audit.pdf',
        bytes: [1, 2, 3],
        contentType: 'application/pdf',
      ),
      onProgress: progress.add,
    );

    expect(calls, [
      'POST /api/v1/documents',
      'POST /api/v1/documents/doc-1/complete',
    ]);
    expect(uploads, ['PUT /api/v1/storage/local/signed-token application/pdf']);
    expect(progress.last, 1);
    expect(document.financialYearLabel, 'FY 2025/26');
    expect(document.uploadedByRole, UserRole.societyOfficer);
  });

  test(
    'turns server refusals and dropped connections into safe messages',
    () async {
      final forbidden = HttpSocietyRecordApi(
        IdentityApi(
          baseUrl: _base,
          client: MockClient(
            (_) async => http.Response(
              jsonEncode({
                'error': {
                  'code': 'FORBIDDEN',
                  'message': 'Only HQ can change a society grade',
                },
              }),
              403,
            ),
          ),
        ),
      );
      await expectLater(
        forbidden.requestGradeChange(
          _id,
          toGrade: 'A',
          reason: 'A good year for us',
        ),
        throwsA(
          isA<SocietyRecordException>()
              .having((error) => error.status, 'status', 403)
              .having(
                (error) => error.message,
                'message',
                'Only HQ can change a society grade',
              ),
        ),
      );

      final offline = HttpSocietyRecordApi(
        IdentityApi(
          baseUrl: _base,
          client: MockClient((_) => throw http.ClientException('No route')),
        ),
      );
      await expectLater(
        offline.fetchHistory(_id),
        throwsA(
          isA<SocietyRecordException>().having(
            (error) => error.offline,
            'offline',
            isTrue,
          ),
        ),
      );
    },
  );
}
