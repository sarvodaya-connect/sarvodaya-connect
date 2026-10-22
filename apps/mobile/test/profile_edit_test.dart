import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/models/society.dart';
import 'package:sarvodaya_connect_mobile/src/models/submission.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/screens/edit_profile_screen.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/widgets/map_preview.dart';

import 'test_helpers.dart';

Finder _field(String label) => find.widgetWithText(TextFormField, label);

/// Signs in, opens the Society tab and taps Request update.
Future<DemoStore> _openEditProfile(
  WidgetTester tester, {
  DemoStore? store,
}) async {
  final demoStore = await pumpApp(tester, store: store);
  await signInWithDemoAccount(tester);
  await tester.tap(find.text('Society'));
  await tester.pumpAndSettle();
  await tapVisible(tester, find.text('Request update').first);
  return demoStore;
}

Future<void> _saveDraft(WidgetTester tester) async {
  await tester.tap(find.widgetWithText(FilledButton, 'Save draft'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('read-only roles do not see enabled edit controls', (
    tester,
  ) async {
    final store = testStore()..switchDemoRole(UserRole.districtManager);
    await tester.pumpWidget(
      DemoScope(
        store: store,
        child: const MaterialApp(home: EditProfileScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Read-only access'), findsOneWidget);
    expect(find.byType(TextFormField), findsNothing);
    expect(find.text('Save draft'), findsNothing);
    expect(find.text('Use my location'), findsNothing);
  });

  testWidgets(
    'Request update opens profile edit with the approved values',
    (tester) async {
      await _openEditProfile(tester);

      expect(find.text('Edit profile'), findsOneWidget);
      expect(find.text('No. 12, Temple Road'), findsOneWidget);
      expect(find.text('Pahala Kosgama'), findsOneWidget);
      expect(find.text('+94 00 000 0010'), findsOneWidget);
      expect(find.text('Changes are saved as a draft'), findsOneWidget);
    },
  );

  testWidgets('required fields show inline errors and a summary', (
    tester,
  ) async {
    final store = await _openEditProfile(tester);

    await tester.enterText(_field('Address *'), '');
    await tester.enterText(_field('Village or town *'), '');
    await tester.enterText(_field('Society phone *'), '');
    await _saveDraft(tester);

    expect(find.text('Fix 3 fields before saving'), findsOneWidget);
    expect(find.text('Enter the address.'), findsOneWidget);
    expect(find.text('Enter the village or town.'), findsOneWidget);
    expect(find.text('Enter the phone number.'), findsOneWidget);
    expect(store.profileDraft, isNull);
  });

  testWidgets(
    'invalid email and phone are rejected and the entered values are kept',
    (tester) async {
      final store = await _openEditProfile(tester);

      await tester.enterText(_field('Address *'), 'No. 14, Temple Road');
      await tester.enterText(_field('Society phone *'), '12345');
      await tester.enterText(_field('Society email'), 'society@');
      await _saveDraft(tester);

      expect(
        find.text('Use a Sri Lankan number, for example +94 00 000 0001.'),
        findsOneWidget,
      );
      expect(
        find.text('Enter an email address like name@example.invalid.'),
        findsOneWidget,
      );
      // Nothing the officer typed is lost.
      expect(find.text('No. 14, Temple Road'), findsOneWidget);
      expect(find.text('12345'), findsOneWidget);
      expect(find.text('society@'), findsOneWidget);
      expect(store.profileDraft, isNull);
    },
  );

  testWidgets(
    'saving creates a draft and leaves the approved record unchanged',
    (tester) async {
      final store = await _openEditProfile(tester);

      await tester.enterText(_field('Address *'), 'No. 14, Temple Road');
      await tester.enterText(
        _field('Society email'),
        'pahala.kosgama@example.invalid',
      );
      await _saveDraft(tester);

      // Review screen shows approved -> proposed values.
      expect(find.text('Check profile changes'), findsOneWidget);
      expect(find.text('No. 12, Temple Road'), findsOneWidget);
      expect(find.text('No. 14, Temple Road'), findsOneWidget);
      expect(find.text('Missing'), findsOneWidget); // approved email
      expect(store.society.address.addressLine, 'No. 12, Temple Road');
      expect(store.approvedProfile.email, isEmpty);
      expect(store.profileDraft?.values.addressLine, 'No. 14, Temple Road');

      // Back on the profile, approved and draft values are shown separately.
      await tester.tap(find.widgetWithText(OutlinedButton, 'Save draft'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('You have draft profile changes'),
        -300,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('You have draft profile changes'), findsOneWidget);
      expect(find.text('No. 12, Temple Road'), findsOneWidget);
      expect(find.text('Draft: No. 14, Temple Road'), findsOneWidget);
      expect(
        find.text('Draft: pahala.kosgama@example.invalid'),
        findsOneWidget,
      );
    },
  );

  testWidgets(
    'location permission denied offers Open Settings and Place Pin Manually',
    (tester) async {
      final store = testStore()..setDemoOptions(locationPermissionDenied: true);
      await _openEditProfile(tester, store: store);

      await tapVisible(tester, find.text('Use my location'));

      expect(find.text('Location permission is needed'), findsOneWidget);
      expect(find.text('Open Settings'), findsOneWidget);
      expect(find.text('Place Pin Manually'), findsOneWidget);

      await tapVisible(tester, find.text('Open Settings'));
      expect(
        find.textContaining('nothing on the device is changed'),
        findsOneWidget,
      );
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();
      expect(
        store.society.location,
        const GeoLocation(latitude: 7.4672, longitude: 80.0412),
      );
    },
  );

  testWidgets('a pin placed manually is stored in the draft only', (
    tester,
  ) async {
    final store = testStore()..setDemoOptions(locationPermissionDenied: true);
    await _openEditProfile(tester, store: store);
    await tapVisible(tester, find.text('Use my location'));
    await tapVisible(tester, find.text('Place Pin Manually'));

    expect(find.text('Place pin manually'), findsOneWidget);
    await tester.enterText(_field('Latitude *'), '12.5');
    await tester.tap(find.text('Use this location'));
    await tester.pumpAndSettle();
    expect(find.textContaining('outside Sri Lanka'), findsOneWidget);

    await tester.enterText(_field('Latitude *'), '7.4690');
    await tester.enterText(_field('Longitude *'), '80.0430');
    await tester.tap(find.text('Use this location'));
    await tester.pumpAndSettle();

    expect(find.text('Placed manually on the map'), findsOneWidget);
    await _saveDraft(tester);
    expect(
      store.profileDraft?.values.location,
      const GeoLocation(latitude: 7.469, longitude: 80.043),
    );
    expect(
      store.society.location,
      const GeoLocation(latitude: 7.4672, longitude: 80.0412),
    );
  });

  testWidgets('tapping the map places the pin and fills the coordinates', (
    tester,
  ) async {
    await _openEditProfile(tester);
    await tapVisible(tester, find.text('Place pin manually'));

    final map = find.byType(MapPreview);
    final box = tester.getRect(map);
    // Top-left quarter of the demo map area is north-west of the society.
    await tester.tapAt(
      Offset(box.left + box.width * 0.25, box.top + box.height * 0.25),
    );
    await tester.pumpAndSettle();

    final latitude = double.parse(
      tester.widget<TextFormField>(_field('Latitude *')).controller!.text,
    );
    final longitude = double.parse(
      tester.widget<TextFormField>(_field('Longitude *')).controller!.text,
    );
    expect(latitude, closeTo(7.4697, 0.0002));
    expect(longitude, closeTo(80.0382, 0.0002));
    expect(find.textContaining('Pin: 7.469'), findsOneWidget);
  });

  testWidgets('Use my location fills a demonstration location when allowed', (
    tester,
  ) async {
    await _openEditProfile(tester);

    await tapVisible(tester, find.text('Use my location'));

    expect(find.text('From this phone (demo location)'), findsOneWidget);
    expect(find.text(DemoStore.demoDeviceLocation.label), findsOneWidget);
  });

  testWidgets(
    'a newer record blocks saving until Reload Record, keeping the officer edits',
    (tester) async {
      final store = await _openEditProfile(tester);
      await tester.enterText(_field('Address *'), 'No. 14, Temple Road');
      await tester.pump();

      store.demoNewerRecord(); // The District Centre changes the society phone.
      await tester.pumpAndSettle();

      expect(
        find.text('A newer version of this record is available'),
        findsOneWidget,
      );
      expect(find.text('Reload Record'), findsOneWidget);
      await _saveDraft(tester);
      expect(
        store.profileDraft,
        isNull,
        reason: 'an outdated draft must not be saved',
      );
      expect(find.text('No. 14, Temple Road'), findsOneWidget);

      await tapVisible(tester, find.text('Reload Record'));
      expect(
        find.text('A newer version of this record is available'),
        findsNothing,
      );
      expect(
        find.text('+94 00 000 0011'),
        findsOneWidget,
      ); // newer approved phone
      expect(
        find.text('No. 14, Temple Road'),
        findsOneWidget,
      ); // officer edit kept

      await _saveDraft(tester);
      expect(store.profileDraft?.values.addressLine, 'No. 14, Temple Road');
      expect(store.profileDraft?.values.phone, '+94 00 000 0011');
    },
  );

  testWidgets(
    'an outdated saved draft cannot be submitted until it is reloaded',
    (tester) async {
      final store = await _openEditProfile(tester);
      await tester.enterText(_field('Address *'), 'No. 14, Temple Road');
      await _saveDraft(tester);

      store.demoNewerRecord();
      await tester.pumpAndSettle();

      final submit = find.widgetWithText(FilledButton, 'Submit to District');
      expect(
        find.text('A newer version of this record is available'),
        findsOneWidget,
      );
      expect(tester.widget<FilledButton>(submit).onPressed, isNull);

      await tapVisible(tester, find.text('Reload Record'));
      expect(tester.widget<FilledButton>(submit).onPressed, isNotNull);

      await tester.tap(submit);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Yes, submit'));
      await tester.pumpAndSettle();

      expect(find.text('Sent to District Centre'), findsOneWidget);
      expect(store.society.address.addressLine, 'No. 12, Temple Road');
      expect(
        store.pendingProfileSubmission?.status,
        SubmissionStatus.submitted,
      );
      expect(
        store.pendingProfileSubmission?.changes.single.proposedValue,
        'No. 14, Temple Road',
      );
    },
  );

  testWidgets(
    'Demo options can trigger the newer-record and permission states',
    (tester) async {
      final store = await pumpApp(tester);
      await signInWithDemoAccount(tester);

      await tester.tap(find.text('More'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Demo options'));
      await tester.pumpAndSettle();
      await tapVisible(tester, find.text('Location permission denied'));
      await tapVisible(tester, find.text('Simulate a newer society record'));

      expect(store.locationPermissionDenied, isTrue);
      expect(store.recordVersion, 2);
      expect(store.approvedProfile.phone, '+94 00 000 0011');
    },
  );
}
