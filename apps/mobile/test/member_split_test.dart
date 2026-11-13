import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/data/demo_data.dart';
import 'package:sarvodaya_connect_mobile/src/l10n/generated/app_localizations.dart';
import 'package:sarvodaya_connect_mobile/src/l10n/l10n_format.dart'
    show ClientFailure;
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/national/national_screens.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/demo_society_record_api.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/edit_society_screen.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/record_widgets.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_api.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_models.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_screen.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';

import 'test_helpers.dart';

/// Issue #141: female and male members on the society profile, on the phone.
/// Every society and figure is fictional; the Sinhala and Tamil are drafts.

const _pahala = 'society-pahala-kosgama';
const _wellawa = 'society-wellawa';

/// Saving always fails, as when the phone has no connection.
class _FailingSave extends DemoSocietyRecordApi {
  _FailingSave({required super.user, required super.clock})
    : super(delay: Duration.zero);

  int attempts = 0;

  @override
  Future<SocietyRecord> updateRecord(
    String id,
    Map<String, Object> changes,
  ) async {
    attempts++;
    throw const SocietyRecordException(
      'The server did not answer. Check your connection and try again.',
      offline: true,
      failure: ClientFailure.offline,
    );
  }
}

Future<DemoStore> _pump(
  WidgetTester tester,
  Widget home, {
  UserRole role = UserRole.societyOfficer,
  String code = 'en',
  Size size = const Size(412, 2400),
  double textScale = 1,
  SocietyRecordApi Function(AuthenticatedUser? Function() user)? records,
}) async {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  DemoStore? holder;
  final store = DemoStore(
    loadDelay: Duration.zero,
    clock: () => demoNow,
    societyRecordApi: records?.call(() => holder?.user),
  )..switchDemoRole(role);
  holder = store;
  await tester.pumpWidget(
    DemoScope(
      store: store,
      child: MaterialApp(
        theme: AppTheme.light(),
        locale: Locale(code),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context)
              .copyWith(textScaler: TextScaler.linear(textScale)),
          child: child!,
        ),
        home: home,
      ),
    ),
  );
  await tester.pumpAndSettle();
  return store;
}

Future<void> _openEdit(WidgetTester tester) async {
  await tester.tap(find.widgetWithText(OutlinedButton, 'Edit'));
  await tester.pumpAndSettle();
}

Finder _box(int index) => find.byType(TextField).at(index);

/// The read-only total under the two boxes.
String _total(WidgetTester tester) =>
    tester.widget<ReadOnlyField>(find.byType(ReadOnlyField).last).value;

Future<void> _save(WidgetTester tester) async {
  final save = find.widgetWithText(FilledButton, 'Save changes');
  await tester.ensureVisible(save);
  await tester.tap(save);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'female 25 and male 17 show a total of 42 at once, and it is kept',
    (tester) async {
      await _pump(tester, const SocietyRecordScreen(societyId: _pahala));
      expect(find.text('412 · female/male not entered yet'), findsOneWidget);
      await _openEdit(tester);

      // An older record keeps its total, says the split is missing, and the
      // total cannot be typed into.
      expect(_total(tester), '412');
      expect(
        find.textContaining('Only a total of 412 members is on record'),
        findsOneWidget,
      );
      // Name, female, male, address, landline, business: no box for the total.
      expect(find.byType(TextField), findsNWidgets(6));

      await tester.enterText(_box(1), '25');
      await tester.pump();
      expect(_total(tester), '—');
      expect(
        find.text('Enter both the female and the male members.'),
        findsOneWidget,
      );
      await tester.enterText(_box(2), '17');
      await tester.pump();
      expect(_total(tester), '42');

      await _save(tester);
      expect(find.text('Edit Society Information'), findsNothing);
      expect(find.text('42 · 25 female, 17 male'), findsOneWidget);

      // Reopening shows the saved counts and their total.
      await _openEdit(tester);
      expect(find.widgetWithText(TextField, '25'), findsOneWidget);
      expect(find.widgetWithText(TextField, '17'), findsOneWidget);
      expect(_total(tester), '42');
      expect(find.textContaining('Only a total of'), findsNothing);
    },
  );

  testWidgets('a change to female moves the total, up and down', (
    tester,
  ) async {
    await _pump(
      tester,
      const SocietyRecordScreen(societyId: _wellawa),
      role: UserRole.programmeCoordinator,
    );
    expect(find.text('143 · 80 female, 63 male'), findsWidgets);
    await _openEdit(tester);
    expect(_total(tester), '143');
    await tester.enterText(_box(1), '85');
    await tester.pump();
    expect(_total(tester), '148');
    await _save(tester);
    expect(find.text('148 · 85 female, 63 male'), findsWidgets);

    await _openEdit(tester);
    await tester.enterText(_box(2), '50');
    await tester.pump();
    expect(_total(tester), '135');
    await _save(tester);
    expect(find.text('135 · 85 female, 50 male'), findsWidgets);
  });

  testWidgets('counts that are not whole numbers hold Save with a message', (
    tester,
  ) async {
    await _pump(
      tester,
      const SocietyRecordScreen(societyId: _wellawa),
      role: UserRole.programmeCoordinator,
    );
    await _openEdit(tester);
    final save = find.widgetWithText(FilledButton, 'Save changes');
    for (final typed in ['2.5', '-1', '8o', '1,000,001']) {
      await tester.enterText(_box(1), typed);
      await tester.pump();
      expect(
        find.text('Enter a whole number from 0 to 1,000,000, for example 25.'),
        findsOneWidget,
        reason: typed,
      );
      expect(_total(tester), '—');
      expect(tester.widget<FilledButton>(save).onPressed, isNull);
    }
    // 0 is an entered count; commas are allowed.
    await tester.enterText(_box(1), '0');
    await tester.enterText(_box(2), '1,000');
    await tester.pump();
    expect(_total(tester), '1,000');
    expect(tester.widget<FilledButton>(save).onPressed, isNotNull);
    // Once entered, the split cannot be cleared back to a bare total.
    await tester.enterText(_box(1), '');
    await tester.pump();
    expect(
      find.text('Enter both the female and the male members.'),
      findsOneWidget,
    );
  });

  testWidgets('a failed save keeps the typed counts and says nothing saved', (
    tester,
  ) async {
    late _FailingSave api;
    await _pump(
      tester,
      const SocietyRecordScreen(societyId: _pahala),
      records: (user) => api = _FailingSave(user: user, clock: () => demoNow),
    );
    await _openEdit(tester);
    await tester.enterText(_box(1), '25');
    await tester.enterText(_box(2), '17');
    await tester.pump();
    await _save(tester);
    expect(api.attempts, 1);
    expect(find.text('Edit Society Information'), findsOneWidget);
    expect(find.text('Not Saved'), findsOneWidget);
    expect(find.widgetWithText(TextField, '25'), findsOneWidget);
    expect(find.widgetWithText(TextField, '17'), findsOneWidget);
    expect(_total(tester), '42');
  });

  testWidgets('the API rules hold in demo mode too', (tester) async {
    final api = DemoSocietyRecordApi(
      user: () => demoOfficer,
      clock: () => demoNow,
      delay: Duration.zero,
    );
    await expectLater(
      api.updateRecord(_pahala, {'femaleMembers': 25}),
      throwsA(isA<SocietyRecordException>()),
    );
    final saved = await api.updateRecord(_pahala, {
      'femaleMembers': 25,
      'maleMembers': 17,
    });
    expect(
      [saved.memberCount, saved.femaleMembers, saved.maleMembers],
      [42, 25, 17],
    );
    // An app from before #141 may not send a total that contradicts it.
    await expectLater(
      api.updateRecord(_pahala, {'memberCount': 99}),
      throwsA(isA<SocietyRecordException>()),
    );
    expect((await api.fetchRecord(_pahala)).memberCount, 42);
  });

  testWidgets('Membership leads with the profile female, male and total', (
    tester,
  ) async {
    await _pump(
      tester,
      const RoleMembershipScreen(),
      role: UserRole.districtManager,
    );
    expect(find.text('Members on Society Profiles'), findsOneWidget);
    expect(find.text('Total members · 106 society profiles'), findsOneWidget);
    expect(
      find.text(
        '79 of 106 societies have entered their female and male members',
      ),
      findsOneWidget,
    );
    expect(
      find.textContaining('27 societies have a total but no female/male split'),
      findsOneWidget,
    );
    expect(find.textContaining('Category Counts'), findsOneWidget);
  });

  testWidgets('HQ Membership shows the national profile figures', (
    tester,
  ) async {
    await _pump(
      tester,
      const NationalMembershipScreen(),
      role: UserRole.hqAdmin,
    );
    expect(find.text('Members on Society Profiles'), findsOneWidget);
    expect(find.text('168,540'), findsOneWidget);
    expect(find.text('84,120'), findsOneWidget);
    expect(find.text('61,300'), findsOneWidget);
    expect(find.textContaining('Category Counts'), findsOneWidget);
  });

  for (final code in ['si', 'ta']) {
    testWidgets('fits a small phone with large text in $code', (tester) async {
      final l = await AppLocalizations.delegate.load(Locale(code));
      final store = await _pump(
        tester,
        const SizedBox(),
        role: UserRole.programmeCoordinator,
      );
      late SocietyRecord record;
      store.societyRecords.fetchRecord(_wellawa).then((r) => record = r);
      await tester.pumpAndSettle();
      // The record card says the split in each language.
      expect(l.recMembersSplit(143, 80, 63), contains('80'));

      await _pump(
        tester,
        EditSocietyScreen(record: record),
        role: UserRole.programmeCoordinator,
        code: code,
        size: const Size(360, 2400),
        textScale: 1.3,
      );
      expect(
        find.textContaining(l.editFemale, findRichText: true),
        findsOneWidget,
      );
      expect(
        find.textContaining(l.editTotal, findRichText: true),
        findsWidgets,
      );
      expect(_total(tester), '143');
      expect(tester.takeException(), isNull);

      // The error state, at a common phone width. (At 360 wide in Tamil the
      // app bar's existing "Unsaved changes" chip overflows once anything is
      // edited; that is on main too and is not part of these fields.)
      await _pump(
        tester,
        EditSocietyScreen(record: record),
        role: UserRole.programmeCoordinator,
        code: code,
        size: const Size(412, 2400),
        textScale: 1.3,
      );
      await tester.enterText(_box(1), '2.5');
      await tester.pump();
      expect(find.text(l.editMembersFormat), findsOneWidget);
      expect(_total(tester), '—');
      expect(tester.takeException(), isNull);

      for (final (role, screen) in [
        (UserRole.districtManager, const RoleMembershipScreen() as Widget),
        (UserRole.hqAdmin, const NationalMembershipScreen()),
      ]) {
        await _pump(
          tester,
          screen,
          role: role,
          code: code,
          size: const Size(360, 2400),
          textScale: 1.3,
        );
        expect(find.text(l.memberProfileHeading), findsOneWidget);
        expect(tester.takeException(), isNull);
      }
    });
  }
}
