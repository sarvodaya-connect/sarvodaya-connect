import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/society_admin/assign_staff_screen.dart';
import 'package:sarvodaya_connect_mobile/src/society_admin/create_society_screen.dart';
import 'package:sarvodaya_connect_mobile/src/society_admin/society_admin_api.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/exco_screens.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_models.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_screen.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';

import 'test_helpers.dart';

/// 25 members in the agreed groups; seats 10–12 hold the three offices
/// unless [offices] says otherwise.
List<ExcoMember> _fullExco({
  Map<int, String> offices = const {
    10: 'President',
    11: 'Secretary',
    12: 'Treasurer',
  },
}) {
  final groups = [
    for (final (group, seats) in const [
      ('CHILDREN', 3),
      ('YOUTH', 3),
      ('MOTHERS', 3),
      ('ORDINARY', 9),
      ('ELDERS_COUNCIL', 7),
    ])
      for (var i = 0; i < seats; i++) group,
  ];
  return [
    for (final (index, group) in groups.indexed)
      ExcoMember(
        id: 'm${index + 1}',
        seatNumber: index + 1,
        fullName: 'Fictional Member ${index + 1}',
        position: offices[index + 1] ?? 'Member',
        seatType: group,
      ),
  ];
}

class _FakeAdmin implements SocietyAdminApi {
  _FakeAdmin({this.refuseCreate});

  final SocietyRecordException? refuseCreate;
  NewSociety? created;
  ({String deputy, String coordinator, String officer})? assigned;

  @override
  Future<List<DistrictChoice>> fetchDistricts() async => const [
    DistrictChoice(id: 'd1', name: 'Kurunegala'),
  ];

  @override
  Future<String> createSociety(NewSociety society) async {
    if (refuseCreate != null) throw refuseCreate!;
    created = society;
    return 'new-society';
  }

  @override
  Future<StaffChoices> fetchStaffChoices(String societyId) async =>
      const StaffChoices(
        districtManagers: [
          StaffChoice(
            id: 'dm',
            displayName: 'R. Fernando',
            username: 'r.fernando',
            assignedHere: false,
            otherSocieties: 0,
          ),
        ],
        deputies: [
          StaffChoice(
            id: 'ddm',
            displayName: 'P. Dissanayake',
            username: 'p.d',
            assignedHere: false,
            otherSocieties: 2,
          ),
        ],
        coordinators: [
          StaffChoice(
            id: 'spc',
            displayName: 'M. Herath',
            username: 'm.herath',
            assignedHere: false,
            otherSocieties: 4,
          ),
        ],
        officers: [
          StaffChoice(
            id: 'so',
            displayName: 'N. Wijesinghe',
            username: 'n.w',
            assignedHere: false,
            otherSocieties: 0,
          ),
        ],
      );

  @override
  Future<void> assignStaff(
    String societyId, {
    required String deputyId,
    required String coordinatorId,
    required String officerId,
  }) async {
    assigned = (
      deputy: deputyId,
      coordinator: coordinatorId,
      officer: officerId,
    );
  }
}

Future<void> _pump(WidgetTester tester, DemoStore store, Widget home) async {
  tester.view.physicalSize = const Size(412 * 3, 2400 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    DemoScope(
      store: store,
      child: MaterialApp(theme: AppTheme.light(), home: home),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _choose(WidgetTester tester, String hint, String option) async {
  await tester.ensureVisible(find.text(hint).first);
  await tester.tap(find.text(hint).first);
  await tester.pumpAndSettle();
  await tester.tap(find.text(option).last);
  await tester.pumpAndSettle();
}

void main() {
  group('Exco completion (the API rules)', () {
    test('a new society with no Exco is incomplete', () {
      final status = ExcoStatus.of(const []);
      expect(status.complete, isFalse);
      expect(status.filledSeats, 0);
      expect(status.problems, ['No Exco members have been entered yet.']);
      expect(status.shortLabel, 'Not entered yet');
    });

    test('a partial Exco says how many seats are left', () {
      final status = ExcoStatus.of(_fullExco().sublist(9, 12));
      expect(status.complete, isFalse);
      expect(status.filledSeats, 3);
      expect(status.problems, ['22 of 25 seats are still to fill.']);
      expect(status.shortLabel, '3 of 25');
    });

    test('25 valid seats missing an office bearer stay incomplete', () {
      final status = ExcoStatus.of(
        _fullExco(offices: const {10: 'President', 11: 'Secretary'}),
      );
      expect(status.complete, isFalse);
      expect(status.filledSeats, 25);
      expect(status.missingOffices, ['Treasurer']);
      expect(status.problems, ['No Treasurer chosen yet.']);
      expect(status.shortLabel, 'No Treasurer');
    });

    test('a full Exco with all three office bearers is complete', () {
      final status = ExcoStatus.of(_fullExco());
      expect(status.complete, isTrue);
      expect(status.problems, isEmpty);
      expect(status.missingOffices, isEmpty);
    });

    test('an older record with two Treasurers is incomplete', () {
      final status = ExcoStatus.of(
        _fullExco(
          offices: const {
            10: 'President',
            11: 'Secretary',
            12: 'Treasurer',
            13: 'Treasurer',
          },
        ),
      );
      expect(status.complete, isFalse);
      expect(status.problems, [
        '2 members are recorded as Treasurer; choose one.',
      ]);
    });

    test('the record uses the status the server sent', () {
      final json = {
        'filledSeats': 25,
        'totalSeats': 25,
        'complete': false,
        'missingOffices': ['Treasurer'],
        'problems': ['No Treasurer chosen yet.'],
      };
      final status = ExcoStatus.fromJson(json);
      expect(status.complete, isFalse);
      expect(status.missingOffices, ['Treasurer']);
      expect(status.problems, ['No Treasurer chosen yet.']);
    });

    test(
      'saving refuses a second office holder and a group over its number',
      () {
        Map<String, Object?> seat(int n, String group, [String p = 'Member']) =>
            {'seatNumber': n, 'seatType': group, 'position': p};
        expect(
          excoSaveProblem([
            seat(1, 'ORDINARY', 'President'),
            seat(2, 'ORDINARY', 'President'),
          ]),
          'Choose only one President',
        );
        expect(
          excoSaveProblem([for (var n = 1; n <= 4; n++) seat(n, 'CHILDREN')]),
          "Council can have only 3 children's seats",
        );
        // A partial Exco, or 25 seats without office bearers, saves.
        expect(excoSaveProblem([seat(1, 'ORDINARY')]), isNull);
        expect(
          excoSaveProblem([
            for (final member in _fullExco(offices: const {}))
              member.toCouncilJson(),
          ]),
          isNull,
        );
      },
    );
  });

  testWidgets(
    'a full Exco without a Treasurer shows as incomplete and says why',
    (tester) async {
      final store = DemoStore(loadDelay: Duration.zero, clock: () => demoNow)
        ..switchDemoRole(UserRole.societyOfficer);
      const id = 'society-pahala-kosgama';
      final record = await store.societyRecords.fetchRecord(id);
      final treasurer = record.exco.firstWhere(
        (member) => member.position == 'Treasurer',
      );
      await store.societyRecords.updateCouncil(
        id,
        councilWith(
          record.exco,
          office: (seat: treasurer.seatNumber, office: 'Member'),
        ),
      );

      await _pump(tester, store, const SocietyRecordScreen(societyId: id));
      await tester.tap(find.widgetWithText(Tab, 'Members & Exco'));
      await tester.pumpAndSettle();

      expect(find.text('25 of 25 members entered'), findsOneWidget);
      expect(find.text('● Incomplete'), findsOneWidget);
      expect(find.text('● Complete'), findsNothing);
      expect(find.textContaining('No Treasurer chosen yet.'), findsOneWidget);
      expect(find.text('Treasurer Not Chosen'), findsOneWidget);
    },
  );

  testWidgets('HQ creates a society without an Exco, then assigns its staff', (
    tester,
  ) async {
    final admin = _FakeAdmin();
    final store = DemoStore(
      loadDelay: Duration.zero,
      clock: () => demoNow,
      societyAdminApi: admin,
    )..switchDemoRole(UserRole.hqAdmin);
    await _pump(tester, store, const CreateSocietyScreen());

    expect(find.text('The Exco Is Entered Later'), findsOneWidget);
    await tester.tap(find.text('Save and assign staff'));
    await tester.pumpAndSettle();
    expect(admin.created, isNull);
    expect(find.text('Choose the district.'), findsWidgets);

    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), 'Fictional Wellawa Society');
    await tester.enterText(fields.at(1), 'S-777001');
    await _choose(tester, 'Choose a district', 'Kurunegala');
    await tester.enterText(fields.at(3), 'Fictional DS');
    await tester.enterText(fields.at(5), 'Fictional Road');
    await tester.enterText(fields.at(6), '164');
    await tester.tap(find.text('Save and assign staff'));
    await tester.pumpAndSettle();

    expect(admin.created?.nameEn, 'Fictional Wellawa Society');
    expect(admin.created!.toJson().containsKey('council'), isFalse);
    expect(admin.created!.toJson()['districtId'], 'd1');

    // Step 2: all three roles are needed before saving.
    expect(find.byType(AssignStaffScreen), findsOneWidget);
    expect(find.text('R. Fernando'), findsOneWidget);
    final save = find.widgetWithText(FilledButton, 'Save assignments');
    expect(tester.widget<FilledButton>(save).onPressed, isNull);
    await _choose(tester, 'Choose a person', 'P. Dissanayake');
    await _choose(tester, 'Choose a person', 'M. Herath');
    expect(tester.widget<FilledButton>(save).onPressed, isNull);
    await _choose(tester, 'Choose a person', 'N. Wijesinghe');
    expect(tester.widget<FilledButton>(save).onPressed, isNotNull);
    await tester.tap(save);
    await tester.pumpAndSettle();
    expect(admin.assigned, (deputy: 'ddm', coordinator: 'spc', officer: 'so'));
  });

  testWidgets('a role the server refuses cannot create a society', (
    tester,
  ) async {
    final admin = _FakeAdmin(
      refuseCreate: const SocietyRecordException(
        'Only HQ can do this',
        status: 403,
      ),
    );
    final store = DemoStore(
      loadDelay: Duration.zero,
      clock: () => demoNow,
      societyAdminApi: admin,
    )..switchDemoRole(UserRole.societyOfficer);
    await _pump(tester, store, const CreateSocietyScreen());
    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), 'Fictional Society');
    await tester.enterText(fields.at(1), 'S-777002');
    await _choose(tester, 'Choose a district', 'Kurunegala');
    await tester.enterText(fields.at(3), 'Fictional DS');
    await tester.enterText(fields.at(5), 'Fictional Road');
    await tester.enterText(fields.at(6), '90');
    await tester.tap(find.text('Save and assign staff'));
    await tester.pumpAndSettle();
    expect(find.text('The Society Was Not Created'), findsOneWidget);
    expect(find.textContaining('Only HQ can do this'), findsOneWidget);
    expect(find.byType(AssignStaffScreen), findsNothing);
  });
}
