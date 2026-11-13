import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sarvodaya_connect_mobile/src/auth/api_auth_service.dart';
import 'package:sarvodaya_connect_mobile/src/data/demo_data.dart';
import 'package:sarvodaya_connect_mobile/src/economy/demo_economy_api.dart';
import 'package:sarvodaya_connect_mobile/src/economy/economy_api.dart';
import 'package:sarvodaya_connect_mobile/src/economy/economy_models.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';

/// Issue #146: the phone's Village Economic Profile client and demo. Every
/// society, business and figure here is fictional.

const _pahala = 'society-pahala-kosgama';
const _wariyapola = 'society-wariyapola';

/// 13 November 2026, so October 2026 has ended and can take actual figures.
final _now = DateTime.utc(2026, 11, 13, 4, 30);
final _october = ProductionPeriod.month(2026, 10);

DemoEconomyApi _demo(
  AuthenticatedUser user, {
  DateTime Function()? clock,
  bool Function()? online,
}) => DemoEconomyApi(
  user: () => user,
  clock: clock ?? () => _now,
  delay: Duration.zero,
  isOnline: online,
);

Future<BusinessOutput> _milk(DemoEconomyApi api) async {
  final business = await api.createBusiness(
    _pahala,
    const BusinessInput(name: 'Fictional Dairy', industry: 'LIVESTOCK_DAIRY'),
  );
  return api.createOutput(business.id, const OutputInput(product: 'MILK'));
}

ProductionInput _input(
  double quantity, {
  String id = '11111111-1111-4111-8111-111111111111',
  String measurement = 'ACTUAL',
  ProductionPeriod? period,
}) => ProductionInput(
  clientRequestId: id,
  period: period ?? _october,
  measurement: measurement,
  quantity: quantity,
);

Matcher _status(int status) =>
    isA<SocietyRecordException>().having((e) => e.status, 'status', status);

void main() {
  group('quantities, periods and latest figures', () {
    test('quantities follow the unit: decimals for litres, whole nuts', () {
      expect(parseQuantity('3,200', 'LITRE'), 3200);
      expect(parseQuantity('12.25', 'LITRE'), 12.25);
      expect(parseQuantity('12.255', 'LITRE'), isNull);
      expect(parseQuantity('0.125', 'KILOGRAM'), 0.125);
      expect(parseQuantity('0', 'NUT'), 0);
      expect(parseQuantity('2.5', 'NUT'), isNull);
      expect(parseQuantity('-1', 'LITRE'), isNull);
      expect(parseQuantity('12a', 'LITRE'), isNull);
      expect(parseQuantity('100000001', 'LITRE'), isNull);
      expect(quantityProblem('', 'LITRE'), QuantityProblem.empty);
      expect(quantityProblem('2.5', 'NUT'), QuantityProblem.wholeOnly);
      expect(
        quantityProblem('1.2345', 'KILOGRAM'),
        QuantityProblem.tooManyDecimals,
      );
      expect(quantityProblem('-3', 'LITRE'), QuantityProblem.notNumber);
      expect(quantityProblem('lots', 'LITRE'), QuantityProblem.notNumber);
      expect(quantityProblem('200000000', 'JOB'), QuantityProblem.tooLarge);
      expect(quantityProblem('0', 'JOB'), isNull);
    });

    test('weeks run Monday to Sunday and months cover every day', () {
      final week = ProductionPeriod.weekOf(DateTime.utc(2026, 10, 8));
      expect(formatDay(week.startsOn), '2026-10-05');
      expect(formatDay(week.endsOn), '2026-10-11');
      expect(formatDay(ProductionPeriod.month(2028, 2).endsOn), '2028-02-29');
      expect(_october.days, 31);
    });

    test('today is the Sri Lanka day, whatever the phone says', () {
      expect(
        formatDay(sriLankaToday(DateTime.utc(2026, 10, 31, 19))),
        '2026-11-01',
      );
    });

    test('the latest actual and estimate are kept apart, never added', () {
      final page = RecordPage.fromJson({
        'items': [
          _recordJson('r3', '2026-11-01', '2026-11-30', 'ESTIMATED', 3300),
          _recordJson('r2', '2026-10-01', '2026-10-31', 'ACTUAL', 3200),
          _recordJson('r1', '2026-09-01', '2026-09-30', 'ACTUAL', 3100),
        ],
        'page': 1,
        'pageSize': 100,
        'total': 3,
      });
      final latest = latestByOutput(page.items)['out-1']!;
      expect(latest.actual!.quantity, 3200);
      expect(latest.estimated!.quantity, 3300);
    });

    test('request ids are version 4 UUIDs, new each time', () {
      final a = newClientRequestId(), b = newClientRequestId();
      expect(
        RegExp(
          r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
        ).hasMatch(a),
        isTrue,
      );
      expect(a, isNot(b));
    });
  });

  group('the demo follows the API rules', () {
    test(
      '3,200 litres for October 2026 is saved once, even when retried',
      () async {
        final api = _demo(demoOfficer);
        final milk = await _milk(api);
        final first = await api.createRecord(milk.id, _input(3200));
        expect(first.created, isTrue);
        final retry = await api.createRecord(milk.id, _input(3200));
        expect(retry.created, isFalse);
        expect(retry.record.id, first.record.id);
        // The same figure without the request id adds nothing either.
        final again = await api.createRecord(
          milk.id,
          _input(3200, id: '22222222-2222-4222-8222-222222222222'),
        );
        expect(again.created, isFalse);
        expect((await api.fetchRecords(milk.id)).total, 1);
      },
    );

    test(
      'a different figure for a saved period must be a correction',
      () async {
        final api = _demo(demoOfficer);
        final milk = await _milk(api);
        final saved = await api.createRecord(milk.id, _input(3200));
        await expectLater(
          api.createRecord(
            milk.id,
            _input(3400, id: '33333333-3333-4333-8333-333333333333'),
          ),
          throwsA(_status(409)),
        );
        final corrected = await api.correctRecord(
          saved.record,
          const ProductionCorrection(version: 1, quantity: 3400),
        );
        expect(corrected.quantity, 3400);
        expect(corrected.version, 2);
        // A stale correction is refused instead of overwriting 3,400.
        await expectLater(
          api.correctRecord(
            saved.record,
            const ProductionCorrection(version: 1, quantity: 3000),
          ),
          throwsA(_status(409)),
        );
        final history = await api.fetchHistory(saved.record.id);
        expect(history.record.quantity, 3400);
        expect(history.revisions.map((r) => (r.change, r.quantity)), [
          ('CORRECTED', 3400),
          ('CREATED', 3200),
        ]);
        // A decrease works the same way.
        final lower = await api.correctRecord(
          history.record,
          const ProductionCorrection(version: 2, quantity: 2900),
        );
        expect(lower.quantity, 2900);
      },
    );

    test(
      'actual and estimated are separate; overlaps and the future are refused',
      () async {
        final api = _demo(demoOfficer);
        final milk = await _milk(api);
        await api.createRecord(milk.id, _input(3200));
        final estimate = await api.createRecord(
          milk.id,
          _input(
            3500,
            id: '44444444-4444-4444-8444-444444444444',
            measurement: 'ESTIMATED',
          ),
        );
        expect(estimate.created, isTrue);
        await expectLater(
          api.createRecord(
            milk.id,
            _input(
              700,
              id: '55555555-5555-4555-8555-555555555555',
              period: ProductionPeriod.weekOf(DateTime.utc(2026, 10, 7)),
            ),
          ),
          throwsA(_status(409)),
        );
        await expectLater(
          api.createRecord(
            milk.id,
            _input(
              3000,
              id: '66666666-6666-4666-8666-666666666666',
              period: ProductionPeriod.month(2026, 11),
            ),
          ),
          throwsA(_status(400)),
        );
        // Whole numbers only for nuts.
        final business = (await api.fetchProfile(_pahala)).businesses.last;
        final nuts = await api.createOutput(
          business.id,
          const OutputInput(product: 'COCONUTS'),
        );
        const nutsId = '77777777-7777-4777-8777-777777777777';
        await expectLater(
          api.createRecord(nuts.id, _input(2.5, id: nutsId)),
          throwsA(_status(400)),
        );
        // A reported zero is a figure, not a missing report.
        final zero = await api.createRecord(nuts.id, _input(0, id: nutsId));
        expect(zero.record.quantity, 0);
        // Reusing a request id for a different record is refused.
        await expectLater(
          api.createRecord(milk.id, _input(3300, id: nutsId)),
          throwsA(_status(409)),
        );
      },
    );

    test(
      'Other outputs need a description and unit; a product is added once',
      () async {
        final api = _demo(demoOfficer);
        final business = await api.createBusiness(
          _pahala,
          const BusinessInput(
            name: 'Fictional Crafts',
            industry: 'HANDICRAFTS',
          ),
        );
        await expectLater(
          api.createOutput(business.id, const OutputInput(product: 'OTHER')),
          throwsA(_status(400)),
        );
        final other = await api.createOutput(
          business.id,
          const OutputInput(
            product: 'OTHER',
            otherDescription: 'Fictional jaggery',
            unit: 'KILOGRAM',
          ),
        );
        expect(other.unit, 'KILOGRAM');
        await api.createOutput(
          business.id,
          const OutputInput(product: 'HANDICRAFT_ITEMS'),
        );
        await expectLater(
          api.createOutput(
            business.id,
            const OutputInput(product: 'HANDICRAFT_ITEMS'),
          ),
          throwsA(_status(409)),
        );
      },
    );

    test('closing keeps figures, refuses later periods, and a stale close is refused', () async {
      final api = _demo(demoOfficer);
      final milk = await _milk(api);
      await api.createRecord(milk.id, _input(3200));
      final business = (await api.fetchProfile(_pahala))
          .business(milk.businessId)!;
      final closed = await api.updateBusiness(business.id, business.version, {
        'status': 'CLOSED',
      });
      expect(closed.closedAt, isNotNull);
      expect((await api.fetchRecords(milk.id)).total, 1);
      await expectLater(
        api.updateBusiness(business.id, business.version, {
          'status': 'OPERATING',
        }),
        throwsA(_status(409)),
      );
      await expectLater(
        api.createOutput(business.id, const OutputInput(product: 'CURD')),
        throwsA(_status(400)),
      );
    });

    test(
      'only the assigned Society Officer writes; others read their scope',
      () async {
        final officer = _demo(demoOfficer);
        expect((await officer.fetchProfile(_pahala)).canManage, isTrue);
        await expectLater(
          officer.fetchProfile(_wariyapola),
          throwsA(_status(404)),
        );
        for (final user in [
          demoSpc,
          demoDdm,
          demoDistrictManager,
          demoHqAdmin,
        ]) {
          final api = _demo(user);
          final profile = await api.fetchProfile(_pahala);
          expect(profile.canManage, isFalse, reason: user.displayName);
          expect(profile.businesses, isNotEmpty);
          await expectLater(
            api.createBusiness(
              _pahala,
              const BusinessInput(name: 'Not allowed', industry: 'SERVICES'),
            ),
            throwsA(_status(403)),
            reason: user.displayName,
          );
        }
        await expectLater(
          _demo(demoDistrictManager).fetchProfile(_wariyapola),
          throwsA(_status(404)),
        );
      },
    );

    test('a DDM grant gives read access only while it lasts', () async {
      var now = _now;
      final ddm = AuthenticatedUser(
        id: 'fictional-ddm',
        displayName: 'Fictional DDM',
        roles: const [UserRole.deputyDistrictManager],
        districtIds: const ['district-kurunegala'],
        societyIds: const [],
        delegatedDistrictAccess: [
          DistrictAccessGrant(
            districtId: 'district-kurunegala',
            startsAt: _now.subtract(const Duration(hours: 1)),
            expiresAt: _now.add(const Duration(hours: 2)),
          ),
        ],
      );
      final api = _demo(ddm, clock: () => now);
      final profile = await api.fetchProfile(_pahala);
      expect(profile.canManage, isFalse);
      now = _now.add(const Duration(hours: 3));
      await expectLater(api.fetchProfile(_pahala), throwsA(_status(404)));
    });

    test(
      'offline: nothing is saved and the retry adds the figure once',
      () async {
        var online = true;
        final api = _demo(demoOfficer, online: () => online);
        final milk = await _milk(api);
        online = false;
        await expectLater(
          api.createRecord(milk.id, _input(3200)),
          throwsA(
            isA<SocietyRecordException>().having(
              (e) => e.offline,
              'offline',
              true,
            ),
          ),
        );
        online = true;
        expect((await api.fetchRecords(milk.id)).total, 0);
        expect((await api.createRecord(milk.id, _input(3200))).created, isTrue);
        expect((await api.fetchRecords(milk.id)).total, 1);
      },
    );
  });

  group('the HTTP client', () {
    test('uses the #145 endpoints, request ids and versions', () async {
      final calls = <String>[];
      final api = HttpEconomyApi(
        IdentityApi(
          baseUrl: 'http://api.test/api/v1',
          client: MockClient((request) async {
            calls.add(
              '${request.method} ${request.url.path}?${request.url.query} ${request.body}',
            );
            final path = request.url.path;
            Object body;
            var status = 200;
            if (path.endsWith('/economic-profile')) {
              body = {
                'society': {
                  'id': 'soc-1',
                  'name': 'Fictional SSS',
                  'societyCode': 'S-1',
                  'districtId': 'd-1',
                },
                'businessDescription': 'Free text, kept as typed.',
                'businesses': [_businessJson()],
                'permissions': {'canManage': true},
              };
            } else if (path.endsWith('/production-records') &&
                request.method == 'POST') {
              status = 201;
              body = {
                'record': _recordJson(
                  'r1',
                  '2026-10-01',
                  '2026-10-31',
                  'ACTUAL',
                  3200,
                ),
                'created': true,
              };
            } else if (path.contains('/production-records/')) {
              body = {
                'record': _recordJson(
                  'r1',
                  '2026-10-01',
                  '2026-10-31',
                  'ACTUAL',
                  3400,
                  version: 2,
                ),
                'changed': true,
              };
            } else {
              body = {
                'items': [
                  _recordJson('r1', '2026-10-01', '2026-10-31', 'ACTUAL', 3200),
                ],
                'page': 1,
                'pageSize': 100,
                'total': 1,
              };
            }
            return http.Response.bytes(
              utf8.encode(jsonEncode(body)),
              status,
              headers: {'content-type': 'application/json; charset=utf-8'},
            );
          }),
        )..token = 'session',
      );

      final profile = await api.fetchProfile('soc-1');
      expect(profile.canManage, isTrue);
      expect(profile.businessDescription, 'Free text, kept as typed.');
      expect(profile.businesses.single.outputs.single.unit, 'LITRE');

      final latest = await api.fetchLatest('soc-1', {'out-1'});
      expect(latest['out-1']!.actual!.quantity, 3200);
      expect(latest['out-1']!.estimated, isNull);

      final saved = await api.createRecord('out-1', _input(3200));
      expect(saved.created, isTrue);
      final corrected = await api.correctRecord(
        saved.record,
        const ProductionCorrection(version: 1, quantity: 3400),
      );
      expect(corrected.quantity, 3400);

      expect(calls, [
        'GET /api/v1/societies/soc-1/economic-profile? ',
        'GET /api/v1/economic-profile/production-records?societyId=soc-1&page=1&pageSize=100 ',
        'POST /api/v1/business-outputs/out-1/production-records? '
            '{"clientRequestId":"11111111-1111-4111-8111-111111111111","basis":"MONTHLY","startsOn":"2026-10-01","endsOn":"2026-10-31","seasonLabel":null,"measurement":"ACTUAL","quantity":3200.0,"note":null,"source":null}',
        'PATCH /api/v1/production-records/r1? {"version":1,"quantity":3400.0,"note":"","source":""}',
      ]);
    });

    test(
      'keeps the status of a refusal and marks a lost answer as offline',
      () async {
        final conflict = HttpEconomyApi(
          IdentityApi(
            baseUrl: 'http://api.test/api/v1',
            client: MockClient(
              (_) async => http.Response(
                jsonEncode({
                  'error': {
                    'code': 'CONFLICT',
                    'message': 'Someone else changed this since you opened it.',
                  },
                }),
                409,
              ),
            ),
          )..token = 'session',
        );
        await expectLater(
          conflict.updateBusiness('b-1', 1, {'name': 'Fictional'}),
          throwsA(_status(409)),
        );
        final lost = HttpEconomyApi(
          IdentityApi(
            baseUrl: 'http://api.test/api/v1',
            client: MockClient((_) async => throw http.ClientException('down')),
          )..token = 'session',
        );
        await expectLater(
          lost.createRecord('out-1', _input(3200)),
          throwsA(
            isA<SocietyRecordException>().having(
              (e) => e.offline,
              'offline',
              true,
            ),
          ),
        );
      },
    );
  });
}

Map<String, dynamic> _actor() => {
  'displayName': 'Fictional Officer',
  'role': 'SOCIETY_OFFICER',
};

Map<String, dynamic> _businessJson() => {
  'id': 'b-1',
  'societyId': 'soc-1',
  'name': 'Fictional Dairy',
  'industry': 'LIVESTOCK_DAIRY',
  'otherIndustry': null,
  'description': null,
  'status': 'OPERATING',
  'closedAt': null,
  'version': 1,
  'outputs': [
    {
      'id': 'out-1',
      'businessId': 'b-1',
      'product': 'MILK',
      'otherDescription': null,
      'unit': 'LITRE',
      'kind': 'GOOD',
      'archivedAt': null,
      'version': 1,
      'createdAt': '2026-09-01T03:00:00.000Z',
      'updatedAt': '2026-09-01T03:00:00.000Z',
    },
  ],
  'createdBy': _actor(),
  'updatedBy': null,
  'createdAt': '2026-09-01T03:00:00.000Z',
  'updatedAt': '2026-09-01T03:00:00.000Z',
};

Map<String, dynamic> _recordJson(
  String id,
  String startsOn,
  String endsOn,
  String measurement,
  num quantity, {
  int version = 1,
}) => {
  'id': id,
  'outputId': 'out-1',
  'basis': 'MONTHLY',
  'startsOn': startsOn,
  'endsOn': endsOn,
  'seasonLabel': null,
  'measurement': measurement,
  'quantity': quantity,
  'unit': 'LITRE',
  'note': null,
  'source': null,
  'version': version,
  'createdBy': _actor(),
  'updatedBy': null,
  'createdAt': '2026-11-02T03:00:00.000Z',
  'updatedAt': '2026-11-02T03:00:00.000Z',
};
