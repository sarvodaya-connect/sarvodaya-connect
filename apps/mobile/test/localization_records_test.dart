import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/home/home_screens.dart';
import 'package:sarvodaya_connect_mobile/src/l10n/l10n.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/national/national_screens.dart';
import 'package:sarvodaya_connect_mobile/src/screens/society_officer_home_screen.dart';
import 'package:sarvodaya_connect_mobile/src/society_record/society_record_screen.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';
import 'package:sarvodaya_connect_mobile/src/validation/validators.dart';

import 'test_helpers.dart';

/// Issue #108 phase 3 on the phone: society records in Sinhala and Tamil.
/// Everyone and every society here is fictional. The Sinhala and Tamil are
/// unreviewed drafts.

const _pahala = 'society-pahala-kosgama';

Future<DemoStore> _pump(
  WidgetTester tester,
  Widget home, {
  required String code,
  required UserRole role,
  Size size = const Size(412, 3200),
  double textScale = 1,
}) async {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  if (textScale != 1) {
    tester.platformDispatcher.textScaleFactorTestValue = textScale;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
  }
  final store = DemoStore(loadDelay: Duration.zero, clock: () => demoNow)
    ..switchDemoRole(role);
  await tester.pumpWidget(
    DemoScope(
      store: store,
      child: MaterialApp(
        theme: AppTheme.light(),
        locale: Locale(code),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        home: home,
      ),
    ),
  );
  await tester.pumpAndSettle();
  return store;
}

Future<void> _tap(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

/// Every piece of text on screen, from plain and rich text alike.
List<String> _texts(WidgetTester tester) => [
  for (final widget in tester.widgetList<RichText>(find.byType(RichText)))
    widget.text.toPlainText(),
];

void _noEnglish(WidgetTester tester, List<String> english) {
  final shown = _texts(tester);
  for (final phrase in english) {
    expect(
      shown.where((text) => text.contains(phrase)),
      isEmpty,
      reason: '"$phrase" is still in English',
    );
  }
}

void main() {
  test('the record validators keep English without a language', () {
    expect(Validators.personName(''), 'Enter the full name.');
    expect(Validators.addressLine('No'), contains('Temple Road'));
    final si = lookupAppLocalizations(const Locale('si'));
    expect(Validators.personName('', si), si.valFullName);
    expect(Validators.sriLankanPhone('123', si), si.valPhoneFormat);
  });

  for (final (code, language) in [('si', 'Sinhala'), ('ta', 'Tamil')]) {
    final l = lookupAppLocalizations(Locale(code));

    group('in $language', () {
      testWidgets('M06: the Society Officer\'s record keeps names as stored', (
        tester,
      ) async {
        await _pump(
          tester,
          const SocietyRecordScreen(societyId: _pahala),
          code: code,
          role: UserRole.societyOfficer,
        );
        expect(find.text(l.recScopeOfficer), findsOneWidget);
        expect(find.text(l.recTabOverview), findsOneWidget);
        expect(find.text(l.recOfficeBearers), findsOneWidget);
        expect(find.text('Pahala Kosgama SSS'), findsWidgets);
        expect(find.text('S-104233'), findsWidgets);
        _noEnglish(tester, [
          'Your access',
          'Society name',
          'Assigned SPC',
          'Responsible Staff',
          'Office Bearers',
          'Request: ',
          'Business Run',
          'Last changed by',
        ]);
      });

      testWidgets('M06v: the DM sees the record view only', (tester) async {
        await _pump(
          tester,
          const SocietyRecordScreen(societyId: _pahala),
          code: code,
          role: UserRole.districtManager,
        );
        expect(find.text(l.recViewOnlyDm), findsOneWidget);
        expect(find.text(l.recViewOnly), findsWidgets);
        _noEnglish(tester, ['View only', 'District Managers view']);
      });

      testWidgets('M06e and M06u: validation and the unsaved-changes warning', (
        tester,
      ) async {
        await _pump(
          tester,
          const SocietyRecordScreen(societyId: _pahala),
          code: code,
          role: UserRole.societyOfficer,
        );
        await _tap(tester, find.widgetWithText(OutlinedButton, l.recEdit));
        expect(find.text(l.editTitle), findsOneWidget);
        // An older record: only a total, kept until the split is entered.
        expect(find.text(l.editMembersOldTotal(412)), findsOneWidget);
        await tester.enterText(find.byType(TextField).at(1), '25');
        await tester.enterText(find.byType(TextField).at(4), '037 22');
        await tester.pumpAndSettle();
        expect(find.text(l.editMembersBoth), findsOneWidget);
        expect(find.text(l.editLandlineFormat), findsOneWidget);
        expect(find.text('● ${l.recUnsaved}'), findsOneWidget);
        await _tap(tester, find.byTooltip(l.commonClose));
        expect(find.text(l.editLeaveTitle), findsOneWidget);
        expect(find.textContaining(l.editFieldFemale), findsWidgets);
        _noEnglish(tester, [
          'Leave Without Saving',
          'You changed',
          'Keep editing',
          'Discard changes',
        ]);
        await _tap(tester, find.text(l.editDiscard));
        // The stored value is unchanged.
        expect(find.text(l.recMembersNoSplit(412)), findsWidgets);
      });

      testWidgets('M07, M07v and M07x: the Exco and replacing a member', (
        tester,
      ) async {
        await _pump(
          tester,
          const SocietyRecordScreen(societyId: _pahala, initialTab: 1),
          code: code,
          role: UserRole.societyOfficer,
        );
        expect(find.text(l.excoAllFilled), findsOneWidget);
        expect(find.text('● ${l.recExcoShortComplete}'), findsOneWidget);
        _noEnglish(tester, [
          'All 25 positions filled',
          'Office Bearers',
          'Search name or profession',
          'Personal details',
          ' yrs',
        ]);
        await _tap(tester, find.text('N. Wijesinghe'));
        expect(find.text(l.excoMemberOf(2)), findsOneWidget);
        expect(find.text(l.excoNicTitle), findsOneWidget);
        await _tap(tester, find.text(l.excoReplaceMember));
        expect(find.text(l.excoReplaceTitle('N. Wijesinghe')), findsOneWidget);
        await _tap(tester, find.text(l.excoEnterNew));
        await _tap(tester, find.text(l.excoSaveMember));
        expect(find.text(l.excoNicRequired), findsOneWidget);
        expect(find.text(l.valFullName), findsOneWidget);
        expect(find.text(l.valAddressRequired), findsOneWidget);
        _noEnglish(tester, ['Enter the', 'Save member', 'Role in the Exco']);
      });

      testWidgets('M07o: choosing an office bearer', (tester) async {
        await _pump(
          tester,
          const SocietyRecordScreen(societyId: _pahala, initialTab: 1),
          code: code,
          role: UserRole.societyOfficer,
        );
        await _tap(tester, find.text(l.excoChange).at(2));
        expect(
          find.text(l.excoChooseOfficeTitle(l.recOfficeTreasurer)),
          findsOneWidget,
        );
        _noEnglish(tester, [
          'Choose the',
          'Office bearers are chosen',
          'Make ',
        ]);
      });

      testWidgets('M06h: the change history and its filters', (tester) async {
        await _pump(
          tester,
          const SocietyRecordScreen(societyId: _pahala, initialTab: 4),
          code: code,
          role: UserRole.societyOfficer,
        );
        expect(find.text(l.recHistoryAll), findsOneWidget);
        expect(find.text(l.recHistoryFooter), findsOneWidget);
        _noEnglish(tester, ['Every change shows', 'Annual Summary']);
      });

      testWidgets('M06g and M06q: requesting a grade change', (tester) async {
        await _pump(
          tester,
          const SocietyRecordScreen(societyId: _pahala),
          code: code,
          role: UserRole.programmeCoordinator,
        );
        // Pahala Kosgama has a request waiting, so the record opens M06q.
        await _tap(tester, find.textContaining('→').first);
        expect(find.text(l.gradeReqTitle), findsOneWidget);
        expect(find.text(l.gradeReqSentToHq), findsOneWidget);
        _noEnglish(tester, [
          'Sent to HQ',
          'Waiting for an HQ Decision',
          'Earlier Requests',
        ]);
      });

      testWidgets('M05: the Society Officer home', (tester) async {
        await _pump(
          tester,
          const SocietyOfficerHomeScreen(societyId: _pahala),
          code: code,
          role: UserRole.societyOfficer,
        );
        expect(find.text(l.officerUpdate), findsOneWidget);
        expect(find.text(l.officerInfo), findsOneWidget);
        expect(find.text('Pahala Kosgama SSS'), findsOneWidget);
        _noEnglish(tester, [
          'Update Your Society',
          'Society Information',
          'Exco Members',
          'Change History',
          'Your access',
          'requested by',
          'Summary and Audit Report',
        ]);
      });

      testWidgets('M20: the DM\'s district societies', (tester) async {
        await _pump(
          tester,
          const DistrictSocietiesScreen(),
          code: code,
          role: UserRole.districtManager,
        );
        expect(find.text(l.listDistrictViewOnly), findsOneWidget);
        _noEnglish(tester, ['Your district', 'Search name or S number']);
      });

      testWidgets('M66 and M67: HQ\'s directory and a society summary', (
        tester,
      ) async {
        await _pump(
          tester,
          const NationalSocietiesScreen(),
          code: code,
          role: UserRole.hqAdmin,
        );
        expect(find.text(l.dirActive), findsOneWidget);
        _noEnglish(tester, [
          'active societies',
          'members ·',
          'updated ',
          'figures not added',
          'Class:',
          'Name or S number',
        ]);
        await _tap(tester, find.byType(ListTile).first);
        expect(find.text(l.summTitle), findsOneWidget);
        _noEnglish(tester, [
          'Society Summary',
          'Records Complete',
          'Registrar Documents',
          'Open society record',
          'Activities this year',
        ]);
      });

      for (final (role, screen) in <(UserRole, Widget)>[
        (
          UserRole.societyOfficer,
          const SocietyRecordScreen(societyId: _pahala),
        ),
        (
          UserRole.societyOfficer,
          const SocietyRecordScreen(societyId: _pahala, initialTab: 1),
        ),
        (
          UserRole.societyOfficer,
          const SocietyOfficerHomeScreen(societyId: _pahala),
        ),
        // M66 at this size overflows in English too (its list rows), so it
        // is left out here and noted in the pull request.
      ]) {
        testWidgets(
          '${screen.runtimeType} for ${role.name} fits a small phone with '
          'large text',
          (tester) async {
            await _pump(
              tester,
              screen,
              code: code,
              role: role,
              size: const Size(320, 568),
              textScale: 2,
            );
            expect(tester.takeException(), isNull);
          },
        );
      }
    });
  }
}
